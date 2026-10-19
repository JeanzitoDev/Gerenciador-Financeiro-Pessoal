import { moneyInput, parseMoney } from "./money";
/** Editable pt-BR mask. Digits before the comma are reais; blur pads cents. */
export function maskMoneyInput(raw: string) {
  const negative = raw
    .trim()
    .replace(/^R\$\s*/, "")
    .replace("−", "-")
    .startsWith("-");
  const clean = raw.replace(/[^0-9,]/g, "");
  const [whole = "", fraction] = clean.split(",");
  const digits = whole.replace(/^0+(?=\d)/, "");
  const grouped =
    digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".") ||
    (fraction === undefined ? "" : "0");
  return (
    (negative ? "-" : "") +
    grouped +
    (fraction === undefined ? "" : "," + fraction.slice(0, 2))
  );
}
export function finishMoneyInput(raw: string) {
  if (!raw) return "";
  try {
    const masked = maskMoneyInput(raw);
    return maskMoneyInput(
      moneyInput(parseMoney(masked.endsWith(",") ? masked + "00" : masked)),
    );
  } catch {
    return maskMoneyInput(raw); // Keep invalid/oversized values visible for validation.
  }
}
