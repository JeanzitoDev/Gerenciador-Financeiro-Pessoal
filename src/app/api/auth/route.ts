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
  display_name: z.string().trim().max(80).optional(),
  password: z
    .string()
    .min(8, "Use pelo menos 8 caracteres.")
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
      if (process.env.NEXT_PUBLIC_AUTH_EMAIL_ENABLED !== "true")
        throw new ApiError(
          503,
          "A recuperação por e-mail ficará disponível em uma próxima versão.",
        );
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
      if (!body.display_name)
        throw new ApiError(422, "Conte como podemos te chamar.");
      const { data, error } = await supabase.auth.signUp({
        email: body.email,
        password: body.password,
        options: {
          data: { display_name: body.display_name },
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (error) {
        // Codes only: never log an email, password, token or upstream message containing PII.
        console.error("Auth signup", {
          name: error.name,
          code: error.code,
          status: error.status,
        });
        const message =
          error.code === "email_address_invalid"
            ? "Confira o endereço de e-mail informado."
            : error.code === "email_exists" ||
                error.code === "user_already_exists"
              ? "Não foi possível criar a conta. Tente entrar."
              : error.status === 429
                ? "Muitas tentativas. Aguarde antes de tentar novamente."
                : error.status === 0
                  ? "Não foi possível conectar ao serviço de acesso. Tente novamente."
                  : "Não foi possível criar a conta. Confira os dados e tente novamente.";
        throw new ApiError(
          error.status === 429 ? 429 : error.status === 0 ? 503 : 400,
          message,
        );
      }
      if (data?.session) {
        const { error: signOutError } = await supabase.auth.signOut({
          scope: "local",
        });
        if (signOutError)
          throw new ApiError(
            503,
            "Conta criada. Recarregue a página para continuar.",
          );
      }
      return json({
        ok: true,
        requires_confirmation: !data?.session,
        message: data?.session
          ? "Conta criada! Entre com seu e-mail e senha."
          : "Conta criada. A confirmação de e-mail ainda está habilitada no projeto Supabase.",
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
