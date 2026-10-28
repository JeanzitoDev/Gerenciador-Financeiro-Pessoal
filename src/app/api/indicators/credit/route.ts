import { requireUser, json, errorResponse, ApiError } from "@/lib/api";
import { Decimal } from "@/lib/finance/money";
import { validDate } from "@/lib/finance/dates";
const sources = {
  vehicle: {
    code: 25471,
    annual: false,
    label: "Aquisição de veículos",
    page: "https://dadosabertos.bcb.gov.br/dataset/25471-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---a",
  },
  home: {
    code: 20772,
    annual: true,
    label: "Financiamento imobiliário com taxas de mercado",
    page: "https://dadosabertos.bcb.gov.br/dataset/20772-taxa-media-de-juros-das-operacoes-de-credito-com-recursos-direcionados---pessoas-fisicas---fi",
  },
} as const;
export async function GET(request: Request) {
  try {
    await requireUser();
    const kind = new URL(request.url).searchParams.get("kind");
    if (kind !== "vehicle" && kind !== "home")
      throw new ApiError(
        422,
        "Escolha carro ou imóvel para consultar esta referência.",
      );
    const source = sources[kind];
    // Fixed origin + numeric allowlist. No email, salary, budget, cookies or authorization sent upstream.
    const response = await fetch(
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${source.code}/dados/ultimos/1?formato=json`,
      {
        next: { revalidate: 21600 },
        signal: AbortSignal.timeout(8000),
        redirect: "error",
        credentials: "omit",
      },
    );
    if (!response.ok) throw new Error("upstream");
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("shape");
    const row = rows[0];
    if (
      typeof row?.valor !== "string" ||
      !/^\d+(?:[.,]\d+)?$/.test(row.valor) ||
      typeof row?.data !== "string" ||
      !/^\d{2}\/\d{2}\/\d{4}$/.test(row.data) ||
      !validDate(row.data.split("/").reverse().join("-"))
    )
      throw new Error("shape");
    const raw = new Decimal(row.valor.replace(",", ".")).div(100);
    const monthly = source.annual
      ? raw.plus(1).pow(new Decimal(1).div(12)).minus(1)
      : raw;
    if (monthly.lt(0) || monthly.gt(1)) throw new Error("range");
    return json({
      monthly_rate: monthly.toNumber(),
      original_rate: raw.toNumber(),
      original_unit: source.annual ? "year" : "month",
      date: row.data,
      source: `Banco Central · ${source.label} · série ${source.code}`,
      source_url: source.page,
    });
  } catch (e) {
    if (e instanceof ApiError) return errorResponse(e);
    return json(
      {
        error:
          "A referência de juros está indisponível. Você pode informar a taxa da proposta e continuar.",
      },
      503,
    );
  }
}
