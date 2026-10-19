import {
  requireUser,
  json,
  errorResponse,
  databaseError,
  checkOrigin,
  readJson,
  ApiError,
} from "@/lib/api";
import { consumeBudget } from "@/lib/budget";
import { profileSchema } from "@/lib/validation";
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const { supabase, user } = await requireUser();
    await consumeBudget(supabase);
    const parsed = profileSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Revise as preferências.");
    const { error } = await supabase
      .from("profiles")
      .upsert({ ...parsed.data, user_id: user.id });
    if (error) throw databaseError(error);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
