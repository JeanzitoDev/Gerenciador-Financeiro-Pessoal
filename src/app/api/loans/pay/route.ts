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
  number: z.number().int().min(1).max(1200),
  account_id: z.uuid(),
  date: z
    .string()
    .refine(validDate)
    .refine((d) => d <= today()),
  amount_cents: z.number().int().min(1).max(MAX_CENTS),
});
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { supabase } = await requireUser();
    await consumeBudget(supabase);
    const b = schema.safeParse(await readJson(request));
    if (!b.success) throw new ApiError(422, "Revise a parcela, conta e data.");
    const { data, error } = await supabase.rpc("pay_loan_installment", {
      p_id: b.data.id,
      p_number: b.data.number,
      p_account: b.data.account_id,
      p_date: b.data.date,
      p_amount: b.data.amount_cents,
    });
    if (error) throw databaseError(error);
    return json({ ok: true, id: data });
  } catch (e) {
    return errorResponse(e);
  }
}
