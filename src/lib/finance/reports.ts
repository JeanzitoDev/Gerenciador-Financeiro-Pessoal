import type { Account, Entry, FinanceData } from "../types";
import { addMonths, monthLabel } from "./dates";
import { accountOverdraft, balance, reserved } from "./engine";
import { sumCents } from "./money";

export interface ReportCategoryRow {
  name: string;
  value: number;
  share: number;
}

export interface TopExpenseRow {
  id: string;
  description: string;
  category: string;
  date: string;
  amount_cents: number;
  accountName: string;
  isFixed: boolean;
}

export interface AccountMonthlyRow {
  account: Account;
  income: number;
  expense: number;
  savedInMonth: number;
  balance: number;
  reserved: number;
  available: number;
  overdraftLimit: number;
  overdraftUsed: number;
  overdraftRemaining: number;
}

export interface PeriodReportRow {
  key: string;
  label: string;
  income: number;
  expense: number;
  result: number;
  savedInMonth: number;
  savingsRate: number | null;
}

export interface MonthlyReport {
  month: string;
  previousMonth: string;
  current: {
    income: number;
    expense: number;
    result: number;
    savedInMonth: number;
    savingsRate: number | null;
    fixedExpense: number;
    variableExpense: number;
    plannedIncome: number;
    plannedExpense: number;
  };
  previous: {
    income: number;
    expense: number;
    result: number;
    savedInMonth: number;
  };
  deltas: {
    incomeDiff: number;
    expenseDiff: number;
    resultDiff: number;
    incomePct: number | null;
    expensePct: number | null;
  };
  averages: {
    income: number;
    expense: number;
    result: number;
  };
  periods: PeriodReportRow[];
  expenseCategories: ReportCategoryRow[];
  incomeCategories: ReportCategoryRow[];
  topExpenses: TopExpenseRow[];
  accountSummaries: AccountMonthlyRow[];
}

function summarizeMonth(
  data: FinanceData,
  targetMonth: string,
  asOf: string,
  accountId: string,
) {
  const segregatedIds = new Set(
    data.accounts
      .filter((a) => a.kind === "benefit" || a.kind === "credit_card")
      .map((a) => a.id),
  );
  const posted = data.transactions.filter(
    (e) =>
      e.status === "posted" &&
      e.date.startsWith(targetMonth) &&
      e.date <= asOf,
  );
  const planned = data.transactions.filter(
    (e) => e.status === "planned" && e.date.startsWith(targetMonth),
  );

  const isEligibleIncome = (e: Entry) =>
    e.kind === "income" &&
    (accountId
      ? e.target_account_id === accountId
      : !segregatedIds.has(e.target_account_id ?? ""));

  const isEligibleExpense = (e: Entry) =>
    e.kind === "expense" &&
    (accountId
      ? e.source_account_id === accountId
      : !segregatedIds.has(e.source_account_id ?? ""));

  const incomeEntries = posted.filter(isEligibleIncome);
  const expenseEntries = posted.filter(isEligibleExpense);

  const income = sumCents(incomeEntries.map((e) => e.amount_cents));
  const expense = sumCents(expenseEntries.map((e) => e.amount_cents));
  const result = sumCents([income, -expense]);

  const fixedExpense = sumCents(
    expenseEntries
      .filter((e) => Boolean(e.recurrence_id || e.loan_id))
      .map((e) => e.amount_cents),
  );
  const variableExpense = Math.max(0, sumCents([expense, -fixedExpense]));

  const plannedIncome = sumCents(
    planned.filter(isEligibleIncome).map((e) => e.amount_cents),
  );
  const plannedExpense = sumCents(
    planned.filter(isEligibleExpense).map((e) => e.amount_cents),
  );

  const savedInMonth = sumCents(
    data.contributions
      .filter(
        (c) =>
          c.date.startsWith(targetMonth) &&
          c.date <= asOf &&
          (!accountId || c.account_id === accountId),
      )
      .map((c) => c.amount_cents),
  );

  const savingsRate = income > 0 ? result / income : null;

  return {
    income,
    expense,
    result,
    savedInMonth,
    savingsRate,
    fixedExpense,
    variableExpense,
    plannedIncome,
    plannedExpense,
    incomeEntries,
    expenseEntries,
  };
}

function groupCategories(entries: Entry[]): ReportCategoryRow[] {
  const sums = new Map<string, number>();
  for (const e of entries) {
    const label = e.category.trim() || "Outros";
    sums.set(label, sumCents([sums.get(label) ?? 0, e.amount_cents]));
  }
  const total = sumCents([...sums.values()]);
  return [...sums.entries()]
    .map(([name, value]) => ({
      name,
      value,
      share: total > 0 ? value / total : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function buildMonthlyReport(
  data: FinanceData,
  month: string,
  asOf: string,
  options?: { horizon?: 6 | 12; accountId?: string },
): MonthlyReport {
  const horizon = options?.horizon ?? 6;
  const accountId = options?.accountId ?? "";
  const previousMonth = addMonths(`${month}-01`, -1).slice(0, 7);

  const currentSummary = summarizeMonth(data, month, asOf, accountId);
  const previousSummary = summarizeMonth(data, previousMonth, asOf, accountId);

  const periods: PeriodReportRow[] = Array.from({ length: horizon }, (_, i) => {
    const key = addMonths(`${month}-01`, i - (horizon - 1)).slice(0, 7);
    const summary = summarizeMonth(data, key, asOf, accountId);
    return {
      key,
      label: monthLabel(key).split(" ")[0].slice(0, 3),
      income: summary.income,
      expense: summary.expense,
      result: summary.result,
      savedInMonth: summary.savedInMonth,
      savingsRate: summary.savingsRate,
    };
  });

  const activePeriods = periods.filter((p) => p.income > 0 || p.expense > 0);
  const divisor = activePeriods.length || 1;
  const averages = {
    income: Math.round(
      sumCents(activePeriods.map((p) => p.income)) / divisor,
    ),
    expense: Math.round(
      sumCents(activePeriods.map((p) => p.expense)) / divisor,
    ),
    result: Math.round(
      sumCents(activePeriods.map((p) => p.result)) / divisor,
    ),
  };

  const accountNames = new Map(data.accounts.map((a) => [a.id, a.name]));
  const topExpenses: TopExpenseRow[] = [...currentSummary.expenseEntries]
    .sort(
      (a, b) =>
        b.amount_cents - a.amount_cents || b.date.localeCompare(a.date),
    )
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      description: e.description,
      category: e.category || "Outros",
      date: e.date,
      amount_cents: e.amount_cents,
      accountName: accountNames.get(e.source_account_id ?? "") ?? "—",
      isFixed: Boolean(e.recurrence_id || e.loan_id),
    }));

  const accountsToSummarize = accountId
    ? data.accounts.filter((a) => a.id === accountId)
    : data.accounts.filter((a) => a.kind !== "credit_card");

  const accountSummaries: AccountMonthlyRow[] = accountsToSummarize.map(
    (account) => {
      const accSummary = summarizeMonth(data, month, asOf, account.id);
      const currentBalance = balance(account, data.transactions, asOf);
      const currentReserved = reserved(account.id, data.contributions);
      const od = accountOverdraft(account, currentBalance, currentReserved);
      return {
        account,
        income: accSummary.income,
        expense: accSummary.expense,
        savedInMonth: accSummary.savedInMonth,
        balance: currentBalance,
        reserved: currentReserved,
        available: currentBalance - currentReserved,
        overdraftLimit: od.limitCents,
        overdraftUsed: od.usedCents,
        overdraftRemaining: od.remainingCents,
      };
    },
  );

  return {
    month,
    previousMonth,
    current: {
      income: currentSummary.income,
      expense: currentSummary.expense,
      result: currentSummary.result,
      savedInMonth: currentSummary.savedInMonth,
      savingsRate: currentSummary.savingsRate,
      fixedExpense: currentSummary.fixedExpense,
      variableExpense: currentSummary.variableExpense,
      plannedIncome: currentSummary.plannedIncome,
      plannedExpense: currentSummary.plannedExpense,
    },
    previous: {
      income: previousSummary.income,
      expense: previousSummary.expense,
      result: previousSummary.result,
      savedInMonth: previousSummary.savedInMonth,
    },
    deltas: {
      incomeDiff: sumCents([currentSummary.income, -previousSummary.income]),
      expenseDiff: sumCents([currentSummary.expense, -previousSummary.expense]),
      resultDiff: sumCents([currentSummary.result, -previousSummary.result]),
      incomePct:
        previousSummary.income > 0
          ? (currentSummary.income - previousSummary.income) /
            previousSummary.income
          : null,
      expensePct:
        previousSummary.expense > 0
          ? (currentSummary.expense - previousSummary.expense) /
            previousSummary.expense
          : null,
    },
    averages,
    periods,
    expenseCategories: groupCategories(currentSummary.expenseEntries),
    incomeCategories: groupCategories(currentSummary.incomeEntries),
    topExpenses,
    accountSummaries,
  };
}

