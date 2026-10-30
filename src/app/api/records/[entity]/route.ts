import {
  requireUser,
  json,
  errorResponse,
  databaseError,
  checkOrigin,
  readJson,
  ApiError,
} from "@/lib/api";
import { schemas, isEntity, uuidSchema } from "@/lib/validation";
import { consumeBudget } from "@/lib/budget";
import { encodeCreditCardAccountForLegacyDb } from "@/lib/finance/credit-cards";
import { today } from "@/lib/finance/dates";
type Context = { params: Promise<{ entity: string }> };
async function mutate(
  request: Request,
  context: Context,
  method: "POST" | "PUT" | "DELETE",
) {
  try {
    checkOrigin(request);
    const { entity } = await context.params;
    if (!isEntity(entity)) throw new ApiError(404, "Recurso não encontrado.");
    const { supabase, user } = await requireUser();
    await consumeBudget(supabase);
    const body = await readJson(request);
    if (
      entity === "transactions" &&
      method === "DELETE" &&
      typeof body.group_prefix === "string" &&
      /^cc:[a-zA-Z0-9_-]+:$/.test(body.group_prefix)
    ) {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", user.id)
        .like("external_id", `${body.group_prefix}%`);
      if (error) throw databaseError(error);
      return json({ ok: true });
    }
    if (
      entity === "transactions" &&
      method === "POST" &&
      Array.isArray(body.batch_entries)
    ) {
      if (body.batch_entries.length < 1 || body.batch_entries.length > 60)
        throw new ApiError(422, "Quantidade de parcelas inválida.");
      const rows = body.batch_entries.map((item: unknown) => {
        const parsedItem = schemas.transactions.safeParse(item);
        if (!parsedItem.success)
          throw new ApiError(
            422,
            parsedItem.error.issues[0]?.message ?? "Revise os campos.",
          );
        return { ...parsedItem.data, user_id: user.id };
      });
      const { data, error } = await supabase
        .from("transactions")
        .insert(rows)
        .select("id");
      if (error) throw databaseError(error);
      return json({ ok: true, id: data?.[0]?.id }, 201);
    }
    if (
      entity === "transactions" &&
      method === "PUT" &&
      Array.isArray(body.batch_pay_ids)
    ) {
      const ids = body.batch_pay_ids.map((rawId: unknown) => {
        const p = uuidSchema.safeParse(rawId);
        if (!p.success) throw new ApiError(400, "Identificador inválido.");
        return p.data;
      });
      if (!ids.length) throw new ApiError(422, "Nenhum item selecionado.");
      const now = today();
      const payDate =
        typeof body.pay_date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(body.pay_date) &&
        body.pay_date <= now
          ? body.pay_date
          : now;
      const { error: updateErr } = await supabase
        .from("transactions")
        .update({ status: "posted", date: payDate })
        .in("id", ids)
        .eq("user_id", user.id);
      if (updateErr) throw databaseError(updateErr);
      if (body.payment_entry && typeof body.payment_entry === "object") {
        const parsedPay = schemas.transactions.safeParse(body.payment_entry);
        if (!parsedPay.success)
          throw new ApiError(
            422,
            parsedPay.error.issues[0]?.message ?? "Revise os campos.",
          );
        const { error: insertErr } = await supabase
          .from("transactions")
          .insert({ ...parsedPay.data, user_id: user.id });
        if (insertErr) throw databaseError(insertErr);
      }
      return json({ ok: true, id: ids[0] });
    }
    let id: string | undefined;
    if (method !== "POST") {
      const parsed = uuidSchema.safeParse(body.id);
      if (!parsed.success) throw new ApiError(400, "Identificador inválido.");
      id = parsed.data;
    }
    if (method === "DELETE") {
      if (entity === "recurrences") {
        const { error } = await supabase.rpc("delete_recurrence", { p_id: id });
        if (error) throw databaseError(error);
        return json({ ok: true });
      }
      // A cancelled tombstone prevents the recurrence generator from resurrecting an occurrence.
      if (entity === "transactions") {
        const { data: row, error } = await supabase
          .from(entity)
          .select("recurrence_id")
          .eq("id", id!)
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw databaseError(error);
        if (!row) throw new ApiError(404, "Registro não encontrado.");
        if (row.recurrence_id) {
          const { error } = await supabase
            .from(entity)
            .update({ status: "cancelled" })
            .eq("id", id!)
            .eq("user_id", user.id);
          if (error) throw databaseError(error);
          return json({ ok: true });
        }
      }
      const { data, error } = await supabase
        .from(entity)
        .delete()
        .eq("id", id!)
        .eq("user_id", user.id)
        .select("id");
      if (error) throw databaseError(error);
      if (!data.length) throw new ApiError(404, "Registro não encontrado.");
      return json({ ok: true });
    }
    // Older deployed clients must not erase the new goal conditions when editing a name/date.
    if (
      entity === "goals" &&
      method === "PUT" &&
      (!Object.hasOwn(body, "dependencies") ||
        !Object.hasOwn(body, "completed"))
    ) {
      const { data: current, error } = await supabase
        .from("goals")
        .select("dependencies,completed")
        .eq("id", id!)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw databaseError(error);
      if (!current) throw new ApiError(404, "Registro não encontrado.");
      if (!Object.hasOwn(body, "dependencies"))
        body.dependencies = current.dependencies;
      if (!Object.hasOwn(body, "completed")) body.completed = current.completed;
    }
    const parsed = schemas[entity].safeParse(body);
    if (!parsed.success)
      throw new ApiError(
        422,
        parsed.error.issues[0]?.message ?? "Revise os campos.",
      );
    let dbPayload: Record<string, unknown> = {
      ...(parsed.data as Record<string, unknown>),
    };
    if (entity === "accounts" && dbPayload.kind !== "credit_card") {
      delete dbPayload.institution;
      delete dbPayload.credit_limit_cents;
      delete dbPayload.closing_day;
      delete dbPayload.due_day;
    }
    const runAccountOrEntityQuery = async (payloadToSave: Record<string, unknown>) => {
      const q =
        method === "POST"
          ? supabase
              .from(entity)
              .insert({ ...payloadToSave, user_id: user.id })
          : supabase
              .from(entity)
              .update(payloadToSave)
              .eq("id", id!)
              .eq("user_id", user.id);
      return q.select("id").maybeSingle();
    };
    let { data, error } = await runAccountOrEntityQuery(dbPayload);
    if (
      error &&
      entity === "accounts" &&
      (parsed.data as Record<string, unknown>).kind === "credit_card"
    ) {
      const fallbackPayload = encodeCreditCardAccountForLegacyDb(
        parsed.data as Record<string, unknown>,
      );
      ({ data, error } = await runAccountOrEntityQuery(fallbackPayload));
    }
    if (error) throw databaseError(error);
    if (!data) throw new ApiError(404, "Registro não encontrado.");
    return json({ ok: true, id: data.id }, method === "POST" ? 201 : 200);
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(r: Request, c: Context) {
  return mutate(r, c, "POST");
}
export async function PUT(r: Request, c: Context) {
  return mutate(r, c, "PUT");
}
export async function DELETE(r: Request, c: Context) {
  return mutate(r, c, "DELETE");
}
