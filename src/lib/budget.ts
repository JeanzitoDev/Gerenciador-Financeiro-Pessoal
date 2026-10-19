import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, databaseError } from "./api";
export async function consumeBudget(client: SupabaseClient) {
  const { data, error } = await client.rpc("consume_write_budget");
  if (error) throw databaseError(error);
  if (!data)
    throw new ApiError(
      429,
      "Muitas alterações em pouco tempo. Aguarde um minuto.",
    );
}
