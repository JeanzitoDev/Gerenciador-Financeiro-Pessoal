import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get("code");
  if (code && isConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          url.searchParams.get("next") === "/nova-senha"
            ? "/nova-senha"
            : "/app",
          url.origin,
        ),
        { headers: { "Cache-Control": "private, no-store" } },
      );
  }
  return NextResponse.redirect(new URL("/entrar?erro=link", url.origin), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
