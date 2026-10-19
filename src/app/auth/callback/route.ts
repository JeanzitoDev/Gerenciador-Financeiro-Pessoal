import { NextResponse } from "next/server";
import { publicRequestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get("code");
  const origin = publicRequestOrigin(request);
  if (code && isConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const recovering = url.searchParams.get("next") === "/nova-senha";
      if (!recovering) await supabase.auth.signOut({ scope: "local" });
      return NextResponse.redirect(
        new URL(
          url.searchParams.get("next") === "/nova-senha"
            ? "/nova-senha"
            : "/entrar?confirmado=1",
          origin,
        ),
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
  }
  return NextResponse.redirect(new URL("/entrar?erro=link", origin), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
