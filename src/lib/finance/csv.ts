import type { Account, Entry } from "../types";
import { moneyInput } from "./money";
export function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function exportEntries(entries: Entry[], accounts: Account[]): string {
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  const rows = [
    [
      "Data",
      "Tipo",
      "Descrição",
      "Valor BRL",
      "Status",
      "Categoria",
      "Origem",
      "Destino",
    ],
    ...entries.map((e) => [
      e.date,
      e.kind,
      e.description,
      moneyInput(e.amount_cents),
      e.status,
      e.category,
      names.get(e.source_account_id ?? "") ?? "",
      names.get(e.target_account_id ?? "") ?? "",
    ]),
  ];
  return "\ufeff" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
}
