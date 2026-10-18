import AuthForm from "@/components/auth-form";
import { isConfigured } from "@/lib/supabase/config";
export const dynamic = "force-dynamic";
export default function Password() {
  return <AuthForm configured={isConfigured()} updatePassword />;
}
