import type { Loan, Entry } from "../types";
import { addMonths } from "./dates";
import { Decimal, checkedCents, MAX_CENTS, sumCents } from "./money";

export function loanSchedule(loan: Loan, entries: Entry[]) {
  const payments = new Map(
    entries
      .filter((e) => e.loan_id === loan.id && e.status === "posted")
      .map((e) => [e.installment_number, e]),
  );
  return Array.from({ length: loan.total_installments }, (_, i) => {
    const number = i + 1,
      payment = payments.get(number);
    return {
      number,
      date: addMonths(loan.first_due_date, i),
      amount: payment?.amount_cents ?? loan.installment_cents,
      paid: number <= loan.paid_before || !!payment,
      historical: number <= loan.paid_before,
      payment,
    };
  });
}
/** Present value of the remaining FIXED monthly payments; CET is not substituted for the interest rate. */
export function presentValue(
  paymentCents: number,
  count: number,
  monthlyRate: number,
): number {
  if (
    !Number.isSafeInteger(paymentCents) ||
    paymentCents < 0 ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > 1200 ||
    !Number.isFinite(monthlyRate) ||
    monthlyRate < 0 ||
    monthlyRate > 10
  )
    throw new Error("Dados do contrato inválidos.");
  if (!count) return 0;
  const r = new Decimal(monthlyRate);
  return checkedCents(
    r.isZero()
      ? new Decimal(paymentCents).times(count)
      : new Decimal(paymentCents)
          .times(new Decimal(1).minus(r.plus(1).pow(-count)))
          .div(r),
    MAX_CENTS,
  );
}
export function loanSummary(loan: Loan, entries: Entry[]) {
  const schedule = loanSchedule(loan, entries),
    remaining = schedule.filter((i) => !i.paid);
  const paid = schedule.length - remaining.length;
  const gross = sumCents(remaining.map((i) => i.amount));
  let seenUnpaid = false,
    consecutive = true;
  for (const item of schedule) {
    if (!item.paid) seenUnpaid = true;
    else if (seenUnpaid) consecutive = false;
  }
  return {
    schedule,
    remaining,
    paid,
    gross,
    consecutive,
    estimatedBalance:
      loan.monthly_rate === null || !consecutive
        ? null
        : presentValue(
            loan.installment_cents,
            remaining.length,
            loan.monthly_rate,
          ),
  };
}
export function simulateAmortization(
  paymentCents: number,
  remaining: number,
  monthlyRate: number,
  extraCents: number,
) {
  if (!Number.isSafeInteger(extraCents) || extraCents < 0)
    throw new Error("Informe um valor de amortização válido.");
  const balance = presentValue(paymentCents, remaining, monthlyRate);
  if (extraCents > balance)
    throw new Error("A amortização excede o saldo estimado.");
  const principal = new Decimal(balance).minus(extraCents),
    r = new Decimal(monthlyRate);
  let months = 0;
  if (principal.gt(0)) {
    months = r.isZero()
      ? principal.div(paymentCents).ceil().toNumber()
      : principal
          .times(r)
          .div(paymentCents)
          .neg()
          .plus(1)
          .ln()
          .neg()
          .div(r.plus(1).ln())
          .ceil()
          .toNumber();
    months = Math.min(remaining, months);
  }
  // Simulate the final partial payment exactly instead of charging a full final installment.
  let outstanding = principal,
    future = new Decimal(0);
  for (let n = 0; n < months; n++) {
    const due = outstanding.times(r.plus(1));
    const payment = Decimal.min(paymentCents, due);
    future = future.plus(payment);
    outstanding = due.minus(payment);
  }
  const newPayment =
    remaining === 0
      ? new Decimal(0)
      : r.isZero()
        ? principal.div(remaining)
        : principal
            .times(r)
            .div(new Decimal(1).minus(r.plus(1).pow(-remaining)));
  return {
    balance,
    months,
    reducedPayment: checkedCents(newPayment, MAX_CENTS),
    saved: checkedCents(
      Decimal.max(
        0,
        new Decimal(paymentCents)
          .times(remaining)
          .minus(extraCents)
          .minus(future),
      ),
    ),
    newBalance: checkedCents(principal, MAX_CENTS),
  };
}
