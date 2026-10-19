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
import { generationSchema } from "@/lib/validation";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { supabase } = await requireUser();
    await consumeBudget(supabase);
    const parsed = generationSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new ApiError(422, "Revise o período.");
    const { data, error } = await supabase.rpc("generate_recurrences", {
      p_from: parsed.data.from,
      p_until: parsed.data.until,
    });
    if (error) throw databaseError(error);
    return json({ count: data });
  } catch (e) {
    return errorResponse(e);
  }
}
