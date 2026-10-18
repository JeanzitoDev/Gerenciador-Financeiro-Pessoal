import Decimal from "decimal.js";
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export { Decimal };
export const MAX_CENTS = 999_999_999_999;
export function checkedCents(
  value: Decimal.Value,
  limit = Number.MAX_SAFE_INTEGER,
): number {
  const n = new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  if (!n.isFinite() || n.abs().gt(limit))
    throw new Error("Valor fora do limite permitido.");
  return n.toNumber();
}
/** Strict pt-BR amount. No Number/parseFloat on currency strings. */
export function parseMoney(input: string): number {
  const raw = input.trim().replace(/^R\$\s*/, "");
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw))
    throw new Error("Use um valor como 1.234,56.");
  return checkedCents(
    new Decimal(raw.replaceAll(".", "").replace(",", ".")).times(100),
    MAX_CENTS,
  );
}
export function moneyInput(cents: number): string {
  return new Decimal(cents).div(100).toFixed(2).replace(".", ",");
}
export function formatMoney(cents: number): string {
  if (!Number.isSafeInteger(cents))
    throw new Error("Valor monetário inválido.");
  // Format integer reais as bigint and substitute the exact cent portion.
  // Converting cents / 100 to a JS number can lose a cent in large aggregates.
  const [whole, fraction] = new Decimal(cents)
    .abs()
    .div(100)
    .toFixed(2)
    .split(".");
  const parts = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).formatToParts(BigInt(whole));
  return (
    (cents < 0 ? "-" : "") +
    parts
      .map((part) => (part.type === "fraction" ? fraction : part.value))
      .join("")
  );
}
export function sumCents(values: number[]): number {
  return checkedCents(values.reduce((a, v) => a.plus(v), new Decimal(0)));
}
export function percent(rate: number | null): string {
  return rate === null || !Number.isFinite(rate)
    ? "Indisponível"
    : new Intl.NumberFormat("pt-BR", {
        style: "percent",
        maximumFractionDigits: 2,
      }).format(rate);
}
