import { requireUser, json, errorResponse, databaseError } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const tables = [
      "accounts",
      "transactions",
      "goals",
      "contributions",
      "investments",
      "recurrences",
    ] as const;
    const results = await Promise.all(
      tables.map(async (table) => {
        const all: Record<string, unknown>[] = [];
        for (let page = 0; ; page++) {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .eq("user_id", user.id)
            .order("id")
            .range(page * 500, page * 500 + 499);
          if (error) throw databaseError(error);
          all.push(...data);
          if (data.length < 500) break;
        }
        return [table, all];
      }),
    );
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw databaseError(error);
    return json({
      ...Object.fromEntries(results),
      profile: profile ?? {
        user_id: user.id,
        display_name: "",
        theme: "system",
        accent: "violet",
        background: "gradient",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
