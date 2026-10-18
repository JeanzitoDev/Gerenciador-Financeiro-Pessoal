import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/supabase/config";
import FinanceApp from "@/components/finance-app";
export const dynamic = "force-dynamic";
export default async function AppPage() {
  if (!isConfigured()) redirect("/entrar?configurar=1");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  return <FinanceApp demo={false} />;
}
