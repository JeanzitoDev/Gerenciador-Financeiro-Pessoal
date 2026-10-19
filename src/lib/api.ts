import { NextResponse } from "next/server";
import { validatedRequestOrigin } from "./request-origin";
import { createClient } from "./supabase/server";
import { isConfigured } from "./supabase/config";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function requireUser() {
  if (!isConfigured())
    throw new ApiError(503, "Configure o Supabase para acessar sua conta.");
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user)
    throw new ApiError(401, "Sua sessão expirou. Entre novamente.");
  return { supabase, user };
}
export function checkOrigin(request: Request) {
  const origin = validatedRequestOrigin(request);
  if (!origin) throw new ApiError(403, "Origem da solicitação inválida.");
  return origin;
}
export async function readJson(request: Request) {
  const advertised = request.headers.get("content-length");
  if (advertised && Number(advertised) > 12000)
    throw new ApiError(413, "Solicitação muito grande.");
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let text = "",
    bytes = 0;
  if (reader) {
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 12000) {
          await reader.cancel();
          throw new ApiError(413, "Solicitação muito grande.");
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ApiError(400, "Dados inválidos.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "Dados inválidos.");
  return value as Record<string, unknown>;
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
export function errorResponse(error: unknown) {
  if (error instanceof ApiError)
    return json({ error: error.message }, error.status);
  return json({ error: "Não foi possível concluir. Tente novamente." }, 500);
}
export function databaseError(error: { code?: string; message: string }) {
  if (error.code === "23503")
    return new ApiError(
      409,
      "Este item está vinculado a outros registros. Remova os vínculos antes de excluir.",
    );
  if (error.code === "23505")
    return new ApiError(409, "Já existe um registro com este vínculo.");
  if (error.code === "P0001") return new ApiError(422, error.message);
  if (error.code === "42501")
    return new ApiError(403, "Você não tem acesso a este recurso.");
  if (error.code === "23514" || error.code === "22003")
    return new ApiError(
      422,
      "Revise os valores, as contas e as datas informadas.",
    );
  return new ApiError(
    500,
    "Não foi possível salvar os dados. Confira a configuração do banco.",
  );
}
