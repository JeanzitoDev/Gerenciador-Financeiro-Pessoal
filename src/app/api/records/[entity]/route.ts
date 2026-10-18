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
    const body = await readJson(request);
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
    const parsed = schemas[entity].safeParse(body);
    if (!parsed.success)
      throw new ApiError(
        422,
        parsed.error.issues[0]?.message ?? "Revise os campos.",
      );
    const query =
      method === "POST"
        ? supabase.from(entity).insert({ ...parsed.data, user_id: user.id })
        : supabase
            .from(entity)
            .update(parsed.data)
            .eq("id", id!)
            .eq("user_id", user.id);
    const { data, error } = await query.select("id").maybeSingle();
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
