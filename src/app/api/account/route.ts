import { createClient } from "@supabase/supabase-js";
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
const schema = z.object({
  password: z.string().min(1).max(128),
  confirmation: z.literal("APAGAR"),
});
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const { supabase, user } = await requireUser();
    await consumeBudget(supabase);
    const body = schema.safeParse(await readJson(request));
    if (!body.success)
      throw new ApiError(422, "Informe a senha e digite APAGAR.");
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret)
      throw new ApiError(
        503,
        "A exclusão precisa ser habilitada pelo administrador do site.",
      );
    if (!user.email)
      throw new ApiError(422, "Esta conta não usa senha por e-mail.");
    const options = {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    };
    const verification = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      options,
    );
    const { data, error } = await verification.auth.signInWithPassword({
      email: user.email,
      password: body.data.password,
    });
    if (error || data.user?.id !== user.id)
      throw new ApiError(401, "Senha incorreta. A conta foi mantida.");
    await verification.auth.signOut({ scope: "local" });
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      secret,
      options,
    );
    const result = await admin.rpc("delete_account_completely", {
      p_user: user.id,
    });
    if (result.error) throw databaseError(result.error);
    await supabase.auth.signOut({ scope: "local" });
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
