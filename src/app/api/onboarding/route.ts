import { z } from "zod";
import {
  requireUser,
  checkOrigin,
  readJson,
  json,
  ApiError,
  errorResponse,
  databaseError,
} from "@/lib/api";
import { consumeBudget } from "@/lib/budget";
const schema = z.object({
  step: z.number().int().min(0).max(4),
  dismissed: z.boolean().default(false),
});
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const { supabase, user } = await requireUser();
    await consumeBudget(supabase);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Etapa inválida.");
    const completedAt =
      parsed.data.step === 4 && !parsed.data.dismissed
        ? new Date().toISOString()
        : null;
    const { data, error } = await supabase
      .from("profiles")
      .update({
        onboarding_step: parsed.data.step,
        onboarding_dismissed: parsed.data.dismissed,
        onboarding_completed_at: completedAt,
      })
      .eq("user_id", user.id)
      .select("user_id")
      .maybeSingle();
    if (error) throw databaseError(error);
    if (!data) throw new ApiError(404, "Perfil não encontrado.");
    return json({ ok: true, completed_at: completedAt });
  } catch (e) {
    return errorResponse(e);
  }
}
