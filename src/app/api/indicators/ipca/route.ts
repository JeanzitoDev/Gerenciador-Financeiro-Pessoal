import { requireUser, json, errorResponse, ApiError } from "@/lib/api";
import { Decimal } from "@/lib/finance/money";
// Fixed upstream prevents SSRF. Shared server-side cache; never caches user data.
export async function GET() {
  try {
    await requireUser();
    const response = await fetch(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json",
      { next: { revalidate: 21600 }, signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) throw new Error("upstream");
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length !== 12) throw new Error("shape");
    let factor = new Decimal(1);
    for (const row of rows) {
      if (
        typeof row?.valor !== "string" ||
        !/^\-?\d+(?:[.,]\d+)?$/.test(row.valor) ||
        typeof row?.data !== "string" ||
        !/^\d{2}\/\d{2}\/\d{4}$/.test(row.data)
      )
        throw new Error("shape");
      const v = new Decimal(row.valor.replace(",", "."));
      if (v.lt(-10) || v.gt(100)) throw new Error("range");
      factor = factor.times(v.div(100).plus(1));
    }
    return json({
      annual_rate: factor.minus(1).toNumber(),
      from: rows[0].data,
      until: rows[11].data,
      source: "Banco Central · IPCA/IBGE, série 433",
      observed: true,
    });
  } catch (e) {
    if (e instanceof ApiError) return errorResponse(e);
    return json(
      {
        error:
          "Não foi possível consultar o IPCA. Você pode informar uma hipótese manual.",
      },
      503,
    );
  }
}
