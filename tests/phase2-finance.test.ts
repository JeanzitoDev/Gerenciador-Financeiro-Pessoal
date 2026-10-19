import { describe, it, expect } from "vitest";
import {
  presentValue,
  simulateAmortization,
  loanSummary,
} from "../src/lib/finance/loans";
import { maskMoneyInput, finishMoneyInput } from "../src/lib/finance/input";
import { entryStatusLabel, isPaidEarly } from "../src/lib/finance/entry-status";
import { contentSecurityPolicy } from "../src/lib/csp";
import { exportEntries } from "../src/lib/finance/csv";
import { demoData } from "../src/lib/demo";
import type { Loan } from "../src/lib/types";
const loan: Loan = {
  id: "x",
  user_id: "u",
  name: "Teste",
  institution: "",
  kind: "loan",
  principal_cents: 100000,
  installment_cents: 10000,
  total_installments: 12,
  paid_before: 2,
  first_due_date: "2026-01-31",
  monthly_rate: 0.02,
  cet_annual_rate: 0.4,
  account_id: null,
};
describe("finanças da fase 2", () => {
  it("separa juros de CET e calcula valor presente das parcelas", () => {
    expect(presentValue(10000, 12, 0)).toBe(120000);
    expect(presentValue(10000, 12, 0.02)).toBe(105753);
    expect(presentValue(10000, 0, 0.02)).toBe(0);
    expect(() => presentValue(10000, 12, -1)).toThrow();
  });
  it("amortização reduz prazo e prestação em cenários independentes", () => {
    const a = simulateAmortization(10000, 12, 0, 30000);
    expect(a.months).toBe(9);
    expect(a.reducedPayment).toBe(7500);
    expect(a.saved).toBe(0);
    const b = simulateAmortization(10000, 12, 0.02, 30000);
    expect(b.months).toBeLessThan(12);
    expect(b.reducedPayment).toBeLessThan(10000);
    expect(b.saved).toBeGreaterThan(0);
    expect(() => simulateAmortization(10000, 12, 0, 200000)).toThrow();
  });
  it("quitação integral zera prazo sem criar juros ou movimento", () => {
    const balance = presentValue(10000, 12, 0.02);
    const a = simulateAmortization(10000, 12, 0.02, balance);
    expect(a.months).toBe(0);
    expect(a.newBalance).toBe(0);
    expect(a.reducedPayment).toBe(0);
  });
  it("histórico anterior conta parcelas e preserva a âncora de dia 31", () => {
    const summary = loanSummary(loan, []);
    expect(summary.paid).toBe(2);
    expect(summary.remaining).toHaveLength(10);
    expect(summary.gross).toBe(100000);
    expect(summary.schedule.slice(0, 3).map((s) => s.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    expect(
      loanSummary({ ...loan, monthly_rate: null }, []).estimatedBalance,
    ).toBeNull();
  });
  it("máscara permite digitação em reais, centavos, negativos e colagem", () => {
    expect(maskMoneyInput("1234,56")).toBe("1.234,56");
    expect(maskMoneyInput("R$ 12.345,67")).toBe("12.345,67");
    expect(maskMoneyInput("-1200,5")).toBe("-1.200,5");
    expect(maskMoneyInput("")).toBe("");
    expect(finishMoneyInput("12345,6")).toBe("12.345,60");
    expect(finishMoneyInput(",5")).toBe("0,50");
    expect(finishMoneyInput("1000,")).toBe("1.000,00");
    expect(finishMoneyInput("")).toBe("");
    expect(maskMoneyInput("1234567890123,45")).toBe("1.234.567.890.123,45");
  });
  it("distingue pagamentos e recebimentos adiantados dos itens ainda pendentes", () => {
    const entry = {
      ...demoData().transactions[0],
      recurrence_id: "regra",
      occurrence_date: "2026-12-25",
      date: "2026-12-20",
      status: "posted" as const,
    };
    expect(entryStatusLabel({ ...entry, kind: "expense" })).toBe(
      "Pago adiantado",
    );
    expect(entryStatusLabel({ ...entry, kind: "income" })).toBe(
      "Recebido adiantado",
    );
    expect(
      entryStatusLabel({ ...entry, kind: "expense", status: "planned" }),
    ).toBe("A pagar");
    expect(
      entryStatusLabel({
        ...entry,
        kind: "expense",
        date: entry.occurrence_date,
      }),
    ).toBe("Pago");
    expect(isPaidEarly({ ...entry, recurrence_id: null })).toBe(false);
    expect(
      exportEntries([{ ...entry, kind: "expense" }], demoData().accounts),
    ).toContain('"Pago adiantado"');
  });
  it("CSV sai em pt-BR e não executa fórmulas de planilha", () => {
    const data = demoData(),
      entry = { ...data.transactions[0], description: '=HYPERLINK("bad")' };
    const csv = exportEntries([entry], data.accounts);
    expect(csv).toContain('"Receita"');
    expect(csv).toContain('"Recebido"');
    expect(csv).not.toContain('"income"');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain(entry.date.split("-").reverse().join("/"));
  });
  it("CSP de produção exige nonce e bloqueia scripts inline não autorizados", () => {
    const csp = contentSecurityPolicy("nonce-test", false);
    expect(csp).toContain(
      "script-src 'self' 'nonce-nonce-test' 'strict-dynamic'",
    );
    expect(csp.split(";").find((x) => x.includes("script-src"))).not.toContain(
      "unsafe-inline",
    );
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("object-src 'none'");
  });
});
