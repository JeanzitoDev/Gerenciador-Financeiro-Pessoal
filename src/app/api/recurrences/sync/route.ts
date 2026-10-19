import {
  requireUser,
  checkOrigin,
  json,
  errorResponse,
  databaseError,
} from "@/lib/api";
import { consumeBudget } from "@/lib/budget";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { supabase } = await requireUser();
    await consumeBudget(supabase);
    const { data, error } = await supabase.rpc("sync_recurrences");
    if (error) throw databaseError(error);
    return json({ count: data });
  } catch (e) {
    return errorResponse(e);
  }
}
