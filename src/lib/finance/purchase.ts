import { Decimal, MAX_CENTS, checkedCents } from "./money";
import type { FinanceData } from "../types";
import { overview } from "./engine";
import { recurrenceDates } from "./recurrence";
import { addMonths } from "./dates";
import { loanSchedule } from "./loans";

export interface PurchaseInput {
  mode: "purchase" | "ceiling";
  payment: "cash" | "financed";
  system: "price" | "sac";
  price: number;
  income: number;
  expenses: number;
  replacedExpenses: number;
  savings: number;
  reserve: number;
  fees: number;
  ongoing: number;
  buffer: number;
  months: number;
  monthlyRate: number;
  monthlySaving: number;
}
function principalForPayment(
  payment: number,
  count: number,
  rate: number,
  system: "price" | "sac",
) {
  const r = new Decimal(rate);
  const principal = r.isZero()
    ? new Decimal(payment).times(count)
    : system === "sac"
      ? new Decimal(payment).div(r.plus(new Decimal(1).div(count)))
      : new Decimal(payment)
          .times(new Decimal(1).minus(r.plus(1).pow(-count)))
          .div(r);
  return principal.floor();
}
export function simulatePurchase(v: PurchaseInput) {
  const amounts = [
    v.price,
    v.income,
    v.expenses,
    v.replacedExpenses,
    v.savings,
    v.reserve,
    v.fees,
    v.ongoing,
    v.buffer,
    v.monthlySaving,
  ];
  if (
    !amounts.every(
      (x) => Number.isSafeInteger(x) && x >= 0 && x <= MAX_CENTS,
    ) ||
    !["cash", "financed"].includes(v.payment) ||
    !["purchase", "ceiling"].includes(v.mode) ||
    !["price", "sac"].includes(v.system)
  )
    throw new Error("Revise os valores da simulação.");
  if (v.mode === "purchase" && !v.price)
    throw new Error("Informe o preço da compra.");
  if (v.replacedExpenses > v.expenses)
    throw new Error(
      "Os gastos que vão acabar não podem passar dos gastos atuais.",
    );
  if (
    !Number.isInteger(v.months) ||
    v.months < 1 ||
    v.months > 600 ||
    !Number.isFinite(v.monthlyRate) ||
    v.monthlyRate < 0 ||
    v.monthlyRate > 1
  )
    throw new Error("Use de 1 a 600 parcelas e juros de 0% a 100% ao mês.");
  const monthlyRoom = checkedCents(
    new Decimal(v.income)
      .minus(v.expenses)
      .plus(v.replacedExpenses)
      .minus(v.ongoing)
      .minus(v.buffer),
  );
  const capacity = Math.max(0, monthlyRoom);
  const freeForEntry = Decimal.max(
    0,
    new Decimal(v.savings).minus(v.reserve).minus(v.fees),
  );
  const maxPrincipal =
    v.payment === "cash"
      ? new Decimal(0)
      : principalForPayment(capacity, v.months, v.monthlyRate, v.system);
  const ceiling =
    monthlyRoom < 0
      ? 0
      : checkedCents(Decimal.min(MAX_CENTS, freeForEntry.plus(maxPrincipal)));
  const price = v.mode === "ceiling" ? ceiling : v.price;
  const entry = Decimal.min(price, freeForEntry);
  const principal =
    v.payment === "cash" ? new Decimal(0) : new Decimal(price).minus(entry);
  const r = new Decimal(v.monthlyRate);
  let first = new Decimal(0),
    last = new Decimal(0),
    installmentsTotal = new Decimal(0);
  if (principal.gt(0)) {
    if (r.isZero()) {
      first = principal.div(v.months);
      last = first;
      installmentsTotal = principal;
    } else if (v.system === "sac") {
      first = principal.div(v.months).plus(principal.times(r));
      last = principal.div(v.months).times(r.plus(1));
      installmentsTotal = principal.plus(
        principal
          .times(r)
          .times(v.months + 1)
          .div(2),
      );
    } else {
      first = principal
        .times(r)
        .div(new Decimal(1).minus(r.plus(1).pow(-v.months)));
      last = first;
      installmentsTotal = first.times(v.months);
    }
  }
  // Round the largest installment up so the suggested ceiling respects a cent-level budget.
  const firstPayment = checkedCents(first.ceil(), MAX_CENTS);
  const minimumEntry =
    v.payment === "cash"
      ? new Decimal(price)
      : Decimal.max(0, new Decimal(price).minus(maxPrincipal));
  const purchaseCashTarget = checkedCents(minimumEntry.plus(v.fees), MAX_CENTS);
  const missingCash = checkedCents(
    Decimal.max(0, minimumEntry.plus(v.fees).plus(v.reserve).minus(v.savings)),
    MAX_CENTS,
  );
  const beforePurchaseRoom = Math.max(0, v.income - v.expenses - v.buffer);
  const saving = Math.min(v.monthlySaving, beforePurchaseRoom);
  const monthsToSave = !missingCash
    ? 0
    : saving > 0
      ? new Decimal(missingCash).div(saving).ceil().toNumber()
      : null;
  const fits = missingCash === 0 && monthlyRoom >= firstPayment && price > 0;
  return {
    price,
    ceiling,
    capacity,
    monthlyRoom,
    fits,
    entry: v.payment === "cash" ? price : checkedCents(entry),
    principal: checkedCents(principal),
    firstPayment,
    lastPayment: checkedCents(last.ceil()),
    total: checkedCents(
      v.payment === "cash"
        ? new Decimal(price).plus(v.fees)
        : entry.plus(installmentsTotal).plus(v.fees),
    ),
    interest: checkedCents(installmentsTotal.minus(principal)),
    remainingMonthly: checkedCents(
      new Decimal(v.income)
        .minus(v.expenses)
        .plus(v.replacedExpenses)
        .minus(v.ongoing)
        .minus(firstPayment),
    ),
    purchaseCashTarget,
    missingCash,
    monthsToSave,
    saving,
    savingsAdjusted: v.monthlySaving > beforePurchaseRoom,
  };
}

/** Suggestions are explicit and editable, never assume that salary alone is disposable. */
export function purchaseSuggestions(data: FinanceData, asOf: string) {
  const month = asOf.slice(0, 7),
    stats = overview(data, month, asOf);
  const benefit = new Set(
    data.accounts.filter((a) => a.kind === "benefit").map((a) => a.id),
  );
  const start = `${month}-01`;
  const end = new Date(
    Date.parse(`${addMonths(start, 1)}T12:00:00Z`) - 86400000,
  )
    .toISOString()
    .slice(0, 10);
  let income = new Decimal(0),
    expenses = new Decimal(0);
  for (const entry of data.transactions) {
    if (entry.status === "cancelled" || !entry.date.startsWith(month)) continue;
    if (entry.kind === "income" && !benefit.has(entry.target_account_id!))
      income = income.plus(entry.amount_cents);
    if (entry.kind === "expense" && !benefit.has(entry.source_account_id!))
      expenses = expenses.plus(entry.amount_cents);
  }
  for (const rule of data.recurrences.filter((r) => r.active)) {
    const account = data.accounts.find(
      (a) =>
        a.id ===
        (rule.kind === "income"
          ? rule.target_account_id
          : rule.source_account_id),
    );
    if (!account || benefit.has(account.id) || account.opening_date > end)
      continue;
    for (const date of recurrenceDates(
      rule.start_date,
      rule.frequency,
      account.opening_date > start ? account.opening_date : start,
      end,
      rule.end_date,
    )) {
      // Existing anchors include skipped and early-paid occurrences: never budget them twice.
      if (
        data.transactions.some(
          (entry) =>
            entry.recurrence_id === rule.id && entry.occurrence_date === date,
        )
      )
        continue;
      if (rule.kind === "income") income = income.plus(rule.amount_cents);
      else expenses = expenses.plus(rule.amount_cents);
    }
  }
  for (const loan of data.loans ?? []) {
    for (const installment of loanSchedule(loan, data.transactions))
      if (installment.date.startsWith(month) && !installment.paid)
        expenses = expenses.plus(installment.amount);
  }
  return {
    income: checkedCents(income, MAX_CENTS),
    expenses: checkedCents(expenses, MAX_CENTS),
    savings: Math.max(0, stats.free),
  };
}
