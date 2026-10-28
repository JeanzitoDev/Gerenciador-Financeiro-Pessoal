import type { Account, Contribution, Entry, FinanceData, Goal } from "../types";
import { Decimal, checkedCents, sumCents } from "./money";
import { daysBetween, inclusiveMonths } from "./dates";
import { goalBlockers } from "./goal-dependencies";
export function balance(
  account: Account,
  entries: Entry[],
  asOf: string,
): number {
  if (account.opening_date > asOf) return 0;
  let total = new Decimal(account.opening_cents);
  for (const e of entries)
    if (e.status === "posted" && e.date <= asOf) {
      if (e.target_account_id === account.id)
        total = total.plus(e.amount_cents);
      if (e.source_account_id === account.id)
        total = total.minus(e.amount_cents);
    }
  return checkedCents(total);
}
export function reserved(
  accountId: string,
  contributions: Contribution[],
): number {
  return sumCents(
    contributions
      .filter((c) => c.account_id === accountId)
      .map((c) => c.amount_cents),
  );
}
export function goalFunded(
  goalId: string,
  contributions: Contribution[],
): number {
  return sumCents(
    contributions
      .filter((c) => c.goal_id === goalId)
      .map((c) => c.amount_cents),
  );
}
export function overview(data: FinanceData, month: string, asOf: string) {
  const posted = data.transactions.filter(
    (e) => e.status === "posted" && e.date.startsWith(month) && e.date <= asOf,
  );
  const benefit = new Set(
    data.accounts.filter((a) => a.kind === "benefit").map((a) => a.id),
  );
  const income = sumCents(
    posted
      .filter((e) => e.kind === "income" && !benefit.has(e.target_account_id!))
      .map((e) => e.amount_cents),
  );
  const expense = sumCents(
    posted
      .filter((e) => e.kind === "expense" && !benefit.has(e.source_account_id!))
      .map((e) => e.amount_cents),
  );
  const assets = sumCents(
    data.accounts
      .filter((a) => a.kind !== "benefit")
      .map((a) => balance(a, data.transactions, asOf)),
  );
  const benefits = sumCents(
    data.accounts
      .filter((a) => a.kind === "benefit")
      .map((a) => balance(a, data.transactions, asOf)),
  );
  const assigned = sumCents(data.contributions.map((c) => c.amount_cents));
  const liquid = sumCents(
    data.accounts
      .filter((a) => a.kind === "checking" || a.kind === "cash")
      .map(
        (a) =>
          balance(a, data.transactions, asOf) -
          reserved(a.id, data.contributions),
      ),
  );
  return {
    income,
    expense,
    result: sumCents([income, -expense]),
    assets,
    benefits,
    assigned,
    free: sumCents([assets, -assigned]),
    liquid,
  };
}
export type PlanningStrategy = "date" | "term" | "budget";
export function planGoals(
  goals: Goal[],
  contributions: Contribution[],
  budget: number,
  asOf: string,
  strategy: PlanningStrategy,
) {
  if (!Number.isSafeInteger(budget) || budget < 0)
    throw new Error("Orçamento inválido.");
  const sorted = [...goals].sort((a, b) =>
    strategy === "budget"
      ? a.priority - b.priority || a.target_date.localeCompare(b.target_date)
      : a.target_date.localeCompare(b.target_date) || a.priority - b.priority,
  );
  let remaining = budget;
  const rows = sorted.map((goal) => {
    const funded = goalFunded(goal.id, contributions);
    const blockers = goalBlockers(goal, goals, contributions);
    const missing = goal.completed
      ? 0
      : Math.max(0, goal.target_cents - funded);
    const months = inclusiveMonths(asOf, goal.target_date);
    const required = checkedCents(new Decimal(missing).div(months).ceil());
    const proposed = blockers.length
      ? 0
      : Math.min(remaining, required, goal.monthly_budget_cents ?? required);
    remaining -= proposed;
    return {
      goal,
      funded,
      missing,
      months,
      required,
      proposed,
      blockers,
      shortfall: blockers.length ? 0 : required - proposed,
      overdue: goal.target_date < asOf && missing > 0,
    };
  });
  return { rows, remaining, shortfall: sumCents(rows.map((r) => r.shortfall)) };
}
export interface ProjectionPoint {
  month: number;
  total: number;
  principal: number;
  interest: number;
  real: number;
}
export function project(
  initial: number,
  monthly: number,
  months: number,
  annual: number,
  inflation: number,
): ProjectionPoint[] {
  if (
    ![initial, monthly].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 600 ||
    !Number.isFinite(annual) ||
    annual <= -1 ||
    annual > 10 ||
    !Number.isFinite(inflation) ||
    inflation <= -1 ||
    inflation > 10
  )
    throw new Error(
      "Premissas inválidas. Prazo de 1 a 600 meses e taxas maiores que −100%.",
    );
  const factor = new Decimal(1).plus(annual).pow(new Decimal(1).div(12));
  let value = new Decimal(initial);
  const points: ProjectionPoint[] = [
    {
      month: 0,
      total: initial,
      principal: initial,
      interest: 0,
      real: initial,
    },
  ];
  for (let m = 1; m <= months; m++) {
    value = value.times(factor).plus(monthly);
    const principal = checkedCents(
      new Decimal(initial).plus(new Decimal(monthly).times(m)),
    );
    const total = checkedCents(value);
    const real = checkedCents(
      value.div(new Decimal(1).plus(inflation).pow(new Decimal(m).div(12))),
    );
    points.push({
      month: m,
      total,
      principal,
      interest: sumCents([total, -principal]),
      real,
    });
  }
  return points;
}
/** Modified Dietz over the account's full recorded history; positive cash flow enters the investment. */
export function investmentReturn(
  account: Account,
  entries: Entry[],
  asOf: string,
  inflation: number,
) {
  const duration = daysBetween(account.opening_date, asOf);
  const final = balance(account, entries, asOf);
  let flows = new Decimal(0),
    weighted = new Decimal(0);
  for (const e of entries)
    if (
      e.status === "posted" &&
      e.date <= asOf &&
      e.kind !== "yield" &&
      e.kind !== "expense"
    ) {
      const sign =
        e.target_account_id === account.id
          ? 1
          : e.source_account_id === account.id
            ? -1
            : 0;
      if (!sign) continue;
      const amount = new Decimal(e.amount_cents).times(sign);
      flows = flows.plus(amount);
      if (duration > 0)
        weighted = weighted.plus(
          amount.times(Math.max(0, daysBetween(e.date, asOf))).div(duration),
        );
    }
  const gain = checkedCents(
    new Decimal(final).minus(account.opening_cents).minus(flows),
  );
  const denominator = new Decimal(account.opening_cents).plus(weighted);
  const nominal =
    duration > 0 && denominator.gt(0)
      ? new Decimal(gain).div(denominator)
      : null;
  const real = nominal
    ? nominal
        .plus(1)
        .div(new Decimal(1).plus(inflation).pow(new Decimal(duration).div(365)))
        .minus(1)
        .toNumber()
    : null;
  return { final, gain, nominal: nominal?.toNumber() ?? null, real, duration };
}
export function expenseCategories(
  entries: Entry[],
  accounts: Account[],
  month: string,
  asOf: string,
) {
  const benefits = new Set(
    accounts.filter((a) => a.kind === "benefit").map((a) => a.id),
  );
  const sums = new Map<string, number>();
  for (const e of entries)
    if (
      e.kind === "expense" &&
      e.status === "posted" &&
      e.date.startsWith(month) &&
      e.date <= asOf &&
      !benefits.has(e.source_account_id!)
    )
      sums.set(
        e.category,
        sumCents([sums.get(e.category) ?? 0, e.amount_cents]),
      );
  return [...sums]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
