import type { Account, Entry, Recurrence } from "../types";
import { obfuscateText } from "../privacy-crypto";
import { addMonths } from "./dates";
import { sumCents } from "./money";
import { recurrenceDates } from "./recurrence";

const CC_NAME_PREFIX = /^\[\[CC:([^|\]]*)\|(\d{1,2})\|(\d{1,2})\]\]\s*(.*)$/;
const CC_EXT_PREFIX =
  /^cc:([^:]+):(\d+)\/(\d+):(\d{4}-\d{2}-\d{2})(?::(\d{4}-\d{2}-\d{2}))?$/;

const CREDIT_WALLET_KEYWORDS = [
  "shopee",
  "sparcelado",
  "spaylater",
  "mercado crédito",
  "mercado credito",
  "mercado pago",
  "crediário",
  "crediario",
  "carnê",
  "carne",
  "magalu",
  "casas bahia",
  "pagaleve",
  "picpay",
  "ame digital",
  "shein",
  "aliexpress",
  "carteira",
  "loja",
  "renner",
  "riachuelo",
  "c&a",
  "havan",
];

export function isCreditWalletAccount(
  account: Pick<Account, "name" | "institution">,
): boolean {
  const haystack = `${account.name ?? ""} ${account.institution ?? ""}`
    .toLowerCase()
    .trim();
  return CREDIT_WALLET_KEYWORDS.some((kw) => haystack.includes(kw));
}

export interface CreditCardInstallmentMeta {
  groupId: string;
  installmentNumber: number;
  totalInstallments: number;
  purchaseDate: string;
  dueDate: string;
}

export interface CreditCardScheduleItem {
  number: number;
  total: number;
  dueDate: string;
  amountCents: number;
  status: "planned" | "posted";
}

export interface CreditCardSchedule {
  firstDueDate: string;
  lastDueDate: string;
  totalCents: number;
  openCents: number;
  items: CreditCardScheduleItem[];
}

export interface CreditCardInvoiceSummary {
  month: string;
  dueDate: string;
  totalCents: number;
  openCents: number;
  paidCents: number;
  status: "empty" | "open" | "paid" | "overdue";
  entries: Entry[];
}

export interface CreditCardSummary {
  limitCents: number;
  usedCents: number;
  availableCents: number;
  usageRatio: number;
  dueDay: number;
  closingDay: number;
  currentInvoice: CreditCardInvoiceSummary;
  upcomingInvoices: { month: string; openCents: number; count: number }[];
  allInvoices: {
    month: string;
    openCents: number;
    totalCents: number;
    count: number;
  }[];
}

export function clampDay(day: number, fallback = 10): number {
  const n = Math.trunc(Number(day));
  if (!Number.isFinite(n) || n < 1 || n > 31) return fallback;
  return n;
}

export function defaultClosingDay(dueDay: number): number {
  const d = clampDay(dueDay, 10);
  return ((d - 8 + 28) % 28) + 1;
}

export function buildDateWithDay(yearMonth: string, day: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const clamped = clampDay(day, 10);
  const lastDay = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
  const actualDay = Math.min(clamped, lastDay);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(actualDay).padStart(2, "0")}`;
}

/**
 * Calculates the first invoice due date for a purchase made on `purchaseDate`.
 * - When `closingDay < dueDay` (e.g. closes day 3, due day 10 of the same month):
 *   - Purchase before `closingDay` -> due in the same month (`+0`).
 *   - Purchase on/after `closingDay` -> due in the next month (`+1`).
 * - When `closingDay >= dueDay` (e.g. closes day 26 of month M, due day 5 of month M+1):
 *   - Purchase before `closingDay` -> due in the next month (`+1`).
 *   - Purchase on/after `closingDay` -> due in two months (`+2`).
 */
export function calculateFirstDueDate(
  purchaseDate: string,
  dueDay: number,
  closingDay?: number,
  monthOffset = 0,
): string {
  const validDue = clampDay(dueDay, 10);
  const validClosing = clampDay(closingDay ?? defaultClosingDay(validDue), 3);
  const [y, m, pDay] = purchaseDate.split("-").map(Number);
  if (!y || !m || !pDay) {
    return buildDateWithDay("2026-01", validDue);
  }
  let advanceMonths = 0;
  if (validClosing < validDue) {
    advanceMonths = pDay < validClosing ? 0 : 1;
  } else {
    advanceMonths = pDay < validClosing ? 1 : 2;
  }
  const totalAdvance = advanceMonths + Math.trunc(monthOffset);
  const targetMonthStart = addMonths(
    `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`,
    totalAdvance,
  );
  return buildDateWithDay(targetMonthStart.slice(0, 7), validDue);
}

export function buildCreditCardSchedule(params: {
  purchaseDate: string;
  dueDay: number;
  closingDay?: number;
  installmentCents: number;
  totalInstallments: number;
  paidBefore?: number;
  firstDueDateOverride?: string;
}): CreditCardSchedule {
  const dueDay = clampDay(params.dueDay, 10);
  const total = Math.max(1, Math.min(120, Math.trunc(params.totalInstallments || 1)));
  const paidBefore = Math.max(0, Math.min(total, Math.trunc(params.paidBefore || 0)));
  const amount = Math.max(0, Math.trunc(params.installmentCents || 0));

  const firstDueDate =
    params.firstDueDateOverride && /^\d{4}-\d{2}-\d{2}$/.test(params.firstDueDateOverride)
      ? params.firstDueDateOverride
      : calculateFirstDueDate(params.purchaseDate, dueDay, params.closingDay);

  const firstMonthStart = `${firstDueDate.slice(0, 7)}-01`;
  const effectiveDueDay = Number(firstDueDate.slice(8, 10)) || dueDay;

  const items: CreditCardScheduleItem[] = [];
  for (let i = 1; i <= total; i++) {
    const monthDate = addMonths(firstMonthStart, i - 1);
    const dueDate =
      i === 1
        ? firstDueDate
        : buildDateWithDay(monthDate.slice(0, 7), effectiveDueDay);
    items.push({
      number: i,
      total,
      dueDate,
      amountCents: amount,
      status: i <= paidBefore ? "posted" : "planned",
    });
  }

  const totalCents = sumCents(items.map((it) => it.amountCents));
  const openCents = sumCents(
    items.filter((it) => it.status === "planned").map((it) => it.amountCents),
  );

  return {
    firstDueDate: items[0].dueDate,
    lastDueDate: items[items.length - 1].dueDate,
    totalCents,
    openCents,
    items,
  };
}

export function formatCreditCardExternalId(meta: CreditCardInstallmentMeta): string {
  return `cc:${meta.groupId}:${meta.installmentNumber}/${meta.totalInstallments}:${meta.purchaseDate}:${meta.dueDate}`;
}

export function parseCreditCardMeta(
  externalId: string | null | undefined,
): CreditCardInstallmentMeta | null {
  if (!externalId) return null;
  const match = externalId.match(CC_EXT_PREFIX);
  if (!match) return null;
  return {
    groupId: match[1],
    installmentNumber: Number(match[2]),
    totalInstallments: Number(match[3]),
    purchaseDate: match[4],
    dueDate: match[5] ?? match[4],
  };
}

export function getEntryDueDate(entry: Entry): string {
  const meta = parseCreditCardMeta(entry.external_id);
  return meta?.dueDate ?? entry.date;
}

export function getEntryInvoiceMonth(entry: Entry): string {
  return getEntryDueDate(entry).slice(0, 7);
}

export function shiftCreditCardEntryDate(
  entry: Pick<Entry, "date" | "external_id">,
  deltaMonths: number,
  dueDay?: number,
): { date: string; external_id: string | null } {
  const meta = parseCreditCardMeta(entry.external_id);
  const currentDue = meta?.dueDate ?? entry.date;
  const shiftedMonth = addMonths(`${currentDue.slice(0, 7)}-01`, deltaMonths).slice(
    0,
    7,
  );
  const targetDay = dueDay ?? (Number(currentDue.slice(8, 10)) || 10);
  const newDueDate = buildDateWithDay(shiftedMonth, targetDay);
  const newExt = meta
    ? formatCreditCardExternalId({
        ...meta,
        dueDate: newDueDate,
      })
    : (entry.external_id ?? null);
  return {
    date: newDueDate,
    external_id: newExt,
  };
}

export function creditCardSummary(
  card: Account,
  entries: Entry[],
  month: string,
  asOf: string,
  recurrences: Recurrence[] = [],
): CreditCardSummary {
  const limitCents = Math.max(0, card.credit_limit_cents ?? 0);
  const dueDay = clampDay(card.due_day ?? 10, 10);
  const closingDay = clampDay(
    card.closing_day ?? defaultClosingDay(dueDay),
    defaultClosingDay(dueDay),
  );

  const rawCardEntries = entries.filter(
    (e) => e.source_account_id === card.id && e.kind === "expense",
  );
  const activeCardRecurrences = recurrences.filter(
    (r) =>
      r.active && r.kind === "expense" && r.source_account_id === card.id,
  );

  const projectedEntries: Entry[] = [];
  if (activeCardRecurrences.length > 0) {
    const monthsToProject = new Set<string>([month]);
    const currentMonth = asOf.slice(0, 7);
    for (let i = 0; i <= 3; i++) {
      monthsToProject.add(addMonths(`${currentMonth}-01`, i).slice(0, 7));
    }
    for (const targetMonth of monthsToProject) {
      const mStart = `${targetMonth}-01`;
      const mNext = addMonths(mStart, 1);
      for (const rule of activeCardRecurrences) {
        const occDates = recurrenceDates(
          rule.start_date,
          rule.frequency,
          mStart,
          mNext,
          rule.end_date,
        ).filter((d) => d.startsWith(targetMonth));
        for (const occDate of occDates) {
          const alreadyMaterialized = rawCardEntries.some(
            (e) =>
              e.recurrence_id === rule.id &&
              (e.occurrence_date === occDate ||
                e.occurrence_date?.startsWith(targetMonth) ||
                e.date.startsWith(targetMonth)),
          );
          if (alreadyMaterialized) continue;
          const invoiceDue = buildDateWithDay(targetMonth, dueDay);
          projectedEntries.push({
            id: `virtual-rec-${rule.id}-${occDate}`,
            user_id: card.user_id,
            kind: "expense",
            description: rule.description,
            amount_cents: rule.amount_cents,
            date: invoiceDue,
            status: "planned",
            source_account_id: card.id,
            target_account_id: null,
            category: rule.category,
            recurrence_id: rule.id,
            occurrence_date: occDate,
            source: "recurrence",
            external_id: null,
            import_batch_id: null,
            categorization_rule_id: null,
            gross_cents: null,
            deductions_cents: null,
          });
        }
      }
    }
  }

  const cardEntries = [
    ...rawCardEntries.filter((e) => e.status !== "cancelled"),
    ...projectedEntries,
  ];

  const currentRealMonth = asOf.slice(0, 7);
  const usedCents = sumCents(
    cardEntries
      .filter(
        (e) =>
          e.status === "planned" &&
          (!e.recurrence_id || getEntryInvoiceMonth(e) <= currentRealMonth),
      )
      .map((e) => e.amount_cents),
  );
  const availableCents = Math.max(0, limitCents - usedCents);
  const usageRatio = limitCents > 0 ? Math.min(1, usedCents / limitCents) : 0;

  const invoiceEntries = cardEntries
    .filter((e) => getEntryInvoiceMonth(e) === month)
    .sort((a, b) => {
      const ma = parseCreditCardMeta(a.external_id);
      const mb = parseCreditCardMeta(b.external_id);
      const pa = ma?.purchaseDate ?? a.date;
      const pb = mb?.purchaseDate ?? b.date;
      return pb.localeCompare(pa) || a.description.localeCompare(b.description);
    });

  const totalCents = sumCents(invoiceEntries.map((e) => e.amount_cents));
  const openCents = sumCents(
    invoiceEntries
      .filter((e) => e.status === "planned")
      .map((e) => e.amount_cents),
  );
  const paidCents = sumCents(
    invoiceEntries
      .filter((e) => e.status === "posted")
      .map((e) => e.amount_cents),
  );
  const dueDate = buildDateWithDay(month, dueDay);

  let status: CreditCardInvoiceSummary["status"] = "empty";
  if (invoiceEntries.length > 0) {
    if (openCents === 0) status = "paid";
    else if (dueDate < asOf) status = "overdue";
    else status = "open";
  }

  const upcomingMap = new Map<string, { openCents: number; count: number }>();
  const allMap = new Map<
    string,
    { openCents: number; totalCents: number; count: number }
  >();
  for (const e of cardEntries) {
    const invMonth = getEntryInvoiceMonth(e);
    const curAll = allMap.get(invMonth) ?? {
      openCents: 0,
      totalCents: 0,
      count: 0,
    };
    allMap.set(invMonth, {
      openCents:
        e.status === "planned"
          ? sumCents([curAll.openCents, e.amount_cents])
          : curAll.openCents,
      totalCents: sumCents([curAll.totalCents, e.amount_cents]),
      count: curAll.count + 1,
    });
    if (e.status !== "planned") continue;
    if (invMonth <= month) continue;
    const current = upcomingMap.get(invMonth) ?? { openCents: 0, count: 0 };
    upcomingMap.set(invMonth, {
      openCents: sumCents([current.openCents, e.amount_cents]),
      count: current.count + 1,
    });
  }
  const upcomingInvoices = [...upcomingMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, info]) => ({ month: m, ...info }));
  const allInvoices = [...allMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, info]) => ({ month: m, ...info }));

  return {
    limitCents,
    usedCents,
    availableCents,
    usageRatio,
    dueDay,
    closingDay,
    currentInvoice: {
      month,
      dueDate,
      totalCents,
      openCents,
      paidCents,
      status,
      entries: invoiceEntries,
    },
    upcomingInvoices,
    allInvoices,
  };
}

/**
 * Encodes a credit card account into existing `accounts` columns when the database
 * has not yet applied the credit card columns migration.
 */
export function encodeCreditCardAccountForLegacyDb(
  payload: Record<string, unknown>,
  userId?: string,
): Record<string, unknown> {
  const inst = String(payload.institution ?? "")
    .replace(/[|\]]/g, " ")
    .trim()
    .slice(0, 22);
  const dueDay = clampDay(Number(payload.due_day ?? 10), 10);
  const closingDay = clampDay(
    Number(payload.closing_day ?? defaultClosingDay(dueDay)),
    defaultClosingDay(dueDay),
  );
  const rawName = String(payload.name ?? "").trim() || inst || "Cartão";
  const prefix = `[[CC:${inst}|${dueDay}|${closingDay}]] `;
  const availLen = Math.max(16, 80 - prefix.length);
  const protectedName = userId
    ? obfuscateText(rawName, userId, availLen)
    : rawName;
  const encodedName = `${prefix}${protectedName}`.slice(0, 80);
  return {
    name: encodedName,
    kind: "cash",
    opening_cents: Math.max(0, Number(payload.credit_limit_cents ?? 0)),
    opening_date: "2000-01-01",
    overdraft_cents: 0,
  };
}

/**
 * Normalizes a database row from `public.accounts` into an `Account` object,
 * transparently decoding legacy-encoded credit cards as well as native `credit_card` rows.
 */
export function normalizeAccountRow<T extends Record<string, unknown>>(row: T): T {
  const name = typeof row.name === "string" ? row.name : "";
  const match = name.match(CC_NAME_PREFIX);
  if (match) {
    const institution = match[1].trim();
    const dueDay = clampDay(Number(match[2]), 10);
    const closingDay = clampDay(Number(match[3]), defaultClosingDay(dueDay));
    const cleanName = match[4].trim() || institution || "Cartão de crédito";
    const limitCents = Math.max(
      0,
      Number(row.credit_limit_cents ?? row.opening_cents ?? 0),
    );
    return {
      ...row,
      name: cleanName,
      kind: "credit_card",
      institution,
      due_day: dueDay,
      closing_day: closingDay,
      credit_limit_cents: limitCents,
      opening_cents: 0,
      opening_date: "2000-01-01",
    };
  }
  if (row.kind === "credit_card") {
    const dueDay = clampDay(Number(row.due_day ?? 10), 10);
    const closingDay = clampDay(
      Number(row.closing_day ?? defaultClosingDay(dueDay)),
      defaultClosingDay(dueDay),
    );
    return {
      ...row,
      institution: typeof row.institution === "string" ? row.institution : "",
      due_day: dueDay,
      closing_day: closingDay,
      credit_limit_cents: Math.max(0, Number(row.credit_limit_cents ?? 0)),
      opening_cents: 0,
      opening_date:
        typeof row.opening_date === "string" ? row.opening_date : "2000-01-01",
    };
  }
  return row;
}

