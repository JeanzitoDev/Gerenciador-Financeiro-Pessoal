import { addMonths, validDate } from "./dates";
export function recurrenceDates(
  start: string,
  frequency: "monthly" | "weekly" | "yearly",
  from: string,
  until: string,
  end: string | null = null,
): string[] {
  if (
    ![start, from, until, ...(end ? [end] : [])].every(validDate) ||
    until < from ||
    until > addMonths(from, 12)
  )
    throw new Error("Janela de recorrência inválida (máximo 12 meses).");
  const result: string[] = [];
  const limit = end && end < until ? end : until;
  for (let i = 0; i < 10000; i++) {
    const date =
      frequency === "weekly"
        ? new Date(Date.parse(`${start}T12:00:00Z`) + i * 7 * 86400000)
            .toISOString()
            .slice(0, 10)
        : addMonths(start, i * (frequency === "yearly" ? 12 : 1));
    if (date > limit) break;
    if (date >= from) result.push(date);
  }
  return result;
}
