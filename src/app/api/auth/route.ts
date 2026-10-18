import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import {
  checkOrigin,
  readJson,
  json,
  errorResponse,
  ApiError,
} from "@/lib/api";
const authSchema = z.object({
  action: z.enum(["login", "signup", "reset", "update", "logout"]),
  email: z.email().max(254).optional(),
  password: z
    .string()
    .min(12, "Use pelo menos 12 caracteres.")
    .max(128)
    .optional(),
});
export async function POST(request: Request) {
  try {
    const origin = checkOrigin(request);
    if (!isConfigured())
      throw new ApiError(503, "Configure o Supabase para habilitar o acesso.");
    const raw = await readJson(request);
    // Legacy passwords may be shorter at sign-in, but new passwords require 12 characters.
    const result = (
      raw.action === "login"
        ? authSchema.extend({ password: z.string().min(1).max(128) })
        : authSchema
    ).safeParse(raw);
    if (!result.success)
      throw new ApiError(422, result.error.issues[0].message);
    const body = result.data;
    const supabase = await createClient();
    if (body.action === "logout") {
      const { error } = await supabase.auth.signOut();
      if (error)
        throw new ApiError(
          400,
          "Não foi possível encerrar a sessão. Tente novamente.",
        );
      return json({ ok: true });
    }
    if (body.action === "update") {
      if (!body.password) throw new ApiError(422, "Informe a nova senha.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user)
        throw new ApiError(401, "Abra novamente o link de recuperação.");
      const { error } = await supabase.auth.updateUser({
        password: body.password,
      });
      if (error) throw new ApiError(400, "Não foi possível alterar a senha.");
      return json({ ok: true });
    }
    if (!body.email) throw new ApiError(422, "Informe seu e-mail.");
    if (body.action === "reset") {
      await supabase.auth.resetPasswordForEmail(body.email, {
        redirectTo: `${origin}/auth/callback?next=/nova-senha`,
      });
      return json({
        ok: true,
        message:
          "Se o e-mail estiver cadastrado, você receberá um link de recuperação.",
      });
    }
    if (!body.password) throw new ApiError(422, "Informe sua senha.");
    if (body.action === "signup") {
      const { error } = await supabase.auth.signUp({
        email: body.email,
        password: body.password,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error)
        throw new ApiError(
          error.status === 429 ? 429 : 400,
          "Não foi possível cadastrar. Aguarde e confira as configurações de e-mail do projeto.",
        );
      return json({
        ok: true,
        message:
          "Confira seu e-mail para confirmar a conta. Depois, entre com sua senha.",
      });
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (error)
      throw new ApiError(
        error.status === 429 ? 429 : 401,
        "E-mail ou senha inválidos, ou e-mail ainda não confirmado.",
      );
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
