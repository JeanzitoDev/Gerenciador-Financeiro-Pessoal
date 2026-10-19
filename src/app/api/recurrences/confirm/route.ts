import { z } from "zod";
import {
  requireUser,
  checkOrigin,
  readJson,
  json,
  errorResponse,
  databaseError,
  ApiError,
} from "@/lib/api";
import { consumeBudget } from "@/lib/budget";
import { today, validDate } from "@/lib/finance/dates";
import { MAX_CENTS } from "@/lib/finance/money";
const schema = z.object({
  id: z.uuid(),
  action: z.enum(["confirm", "skip"]),
  date: z.string().refine(validDate).optional(),
  amount_cents: z.number().int().min(1).max(MAX_CENTS).optional(),
});
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { supabase, user } = await requireUser();
    await consumeBudget(supabase);
    const body = schema.safeParse(await readJson(request));
    if (!body.success) throw new ApiError(422, "Revise a confirmação.");
    const { id, action, date, amount_cents } = body.data;
    const paymentDate = date ?? today();
    const { data: row, error: findError } = await supabase
      .from("transactions")
      .select("id,status,recurrence_id,date")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (findError) throw databaseError(findError);
    if (!row?.recurrence_id)
      throw new ApiError(404, "Ocorrência não encontrada.");
    if (row.status !== "planned") return json({ ok: true });
    if (action === "confirm" && paymentDate > today())
      throw new ApiError(
        422,
        "A data do pagamento ou recebimento deve ser até hoje.",
      );
    const { error } = await supabase
      .from("transactions")
      .update({
        status: action === "skip" ? "cancelled" : "posted",
        ...(action === "confirm" ? { date: paymentDate } : {}),
        ...(amount_cents ? { amount_cents } : {}),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "planned");
    if (error) throw databaseError(error);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
