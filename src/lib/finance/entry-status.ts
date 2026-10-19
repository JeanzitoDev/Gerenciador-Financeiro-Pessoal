import type { Entry } from "../types";

export function isPaidEarly(entry: Entry) {
  return (
    entry.status === "posted" &&
    !!entry.recurrence_id &&
    !!entry.occurrence_date &&
    entry.date < entry.occurrence_date
  );
}
export function entryStatusLabel(entry: Entry) {
  if (entry.status === "cancelled") return "Cancelado";
  if (entry.status === "planned")
    return entry.kind === "expense"
      ? "A pagar"
      : entry.kind === "income"
        ? "A receber"
        : "Previsto";
  if (entry.kind === "expense")
    return isPaidEarly(entry) ? "Pago adiantado" : "Pago";
  if (entry.kind === "income")
    return isPaidEarly(entry) ? "Recebido adiantado" : "Recebido";
  return "Realizado";
}
