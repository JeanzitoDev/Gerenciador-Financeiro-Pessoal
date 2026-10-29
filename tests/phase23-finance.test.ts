import { describe, it, expect } from "vitest";
import {
  simulatePurchase,
  purchaseSuggestions,
  type PurchaseInput,
} from "../src/lib/finance/purchase";
import {
  piggyBankTotalCents,
  progressiveMonthlyTotalCents,
  formatPiggyBankNote,
  extractMarkedNumbers,
  inferPiggyBankSize,
  isPiggyBankGoal,
} from "../src/lib/finance/piggy-bank";
import {
  goalBlockers,
  validateGoalGraph,
} from "../src/lib/finance/goal-dependencies";
import {
  accountOverdraft,
  balance,
  overview,
  planGoals,
} from "../src/lib/finance/engine";
import { buildMonthlyReport } from "../src/lib/finance/reports";
import { demoData, mutateDemo } from "../src/lib/demo";
import { accountSchema } from "../src/lib/validation";
import { today } from "../src/lib/finance/dates";
const scenario: PurchaseInput = {
  mode: "purchase",
  payment: "cash",
  system: "price",
  price: 100000,
  income: 400000,
  expenses: 250000,
  replacedExpenses: 0,
  savings: 50000,
  reserve: 10000,
  fees: 10000,
  ongoing: 10000,
  buffer: 30000,
  months: 12,
  monthlyRate: 0,
  monthlySaving: 20000,
};
describe("Cabe no meu bolso?", () => {
  it("considera reserva, taxas, custos mensais e tempo de juntar sem rendimento fictício", () => {
    const r = simulatePurchase(scenario);
    expect(r).toMatchObject({
      fits: false,
      ceiling: 30000,
      missingCash: 70000,
      monthsToSave: 4,
      total: 110000,
      remainingMonthly: 140000,
      capacity: 110000,
      purchaseCashTarget: 110000,
    });
  });
  it("calcula parcelas sem juros e o limite inverso em centavos", () => {
    const r = simulatePurchase({
      ...scenario,
      payment: "financed",
      savings: 20000,
      reserve: 0,
      fees: 0,
      price: 120000,
      months: 10,
      income: 200000,
      expenses: 180000,
      ongoing: 0,
      buffer: 5000,
    });
    expect(r).toMatchObject({
      fits: true,
      principal: 100000,
      firstPayment: 10000,
      total: 120000,
      ceiling: 170000,
    });
  });
  it("distingue Price e SAC com números conhecidos", () => {
    const input = {
      ...scenario,
      payment: "financed" as const,
      price: 120000,
      savings: 0,
      reserve: 0,
      fees: 0,
      months: 12,
      monthlyRate: 0.01,
    };
    expect(simulatePurchase({ ...input, system: "sac" })).toMatchObject({
      firstPayment: 11200,
      lastPayment: 10100,
      interest: 7800,
      total: 127800,
    });
    expect(
      simulatePurchase({ ...input, price: 100000, system: "price" }),
    ).toMatchObject({ firstPayment: 8885, interest: 6619, total: 106619 });
  });
  it("respeita o orçamento até o centavo em juros e prazos distintos", () => {
    for (const system of ["price", "sac"] as const)
      for (const monthlyRate of [0, 0.01, 0.017349, 0.5])
        for (const months of [1, 12, 360]) {
          const r = simulatePurchase({
            ...scenario,
            payment: "financed",
            mode: "ceiling",
            system,
            monthlyRate,
            months,
          });
          expect(r.firstPayment).toBeLessThanOrEqual(r.capacity);
          expect(r.fits).toBe(true);
        }
  });
  it("não transforma renda insuficiente ou custos substituídos inválidos em aprovação", () => {
    expect(simulatePurchase({ ...scenario, income: 0 }).fits).toBe(false);
    expect(
      simulatePurchase({ ...scenario, income: 250000, monthlySaving: 20000 }),
    ).toMatchObject({ monthsToSave: null, saving: 0, savingsAdjusted: true });
    expect(() =>
      simulatePurchase({ ...scenario, replacedExpenses: 9999999 }),
    ).toThrow(/gastos atuais/);
    for (const monthlyRate of [-1, NaN, Infinity, 2])
      expect(() => simulatePurchase({ ...scenario, monthlyRate })).toThrow();
  });
  it("substitui apenas gastos que deixam de existir depois da compra", () => {
    expect(
      simulatePurchase({
        ...scenario,
        replacedExpenses: 50000,
        savings: 150000,
      }),
    ).toMatchObject({ fits: true, remainingMonthly: 190000 });
  });
  it("importa despesas avulsas e recorrentes sem duplicar a ocorrência, excluindo VA/VR", () => {
    const d = demoData();
    const base = purchaseSuggestions(d, today());
    const rule = d.recurrences[0];
    d.transactions.push({
      ...d.transactions[0],
      id: "recorrente",
      occurrence_date: rule.start_date,
      kind: "expense",
      recurrence_id: rule.id,
      date: today(),
      amount_cents: rule.amount_cents,
      source_account_id: rule.source_account_id,
      target_account_id: null,
    });
    expect(purchaseSuggestions(d, today()).expenses).toBe(base.expenses);
    d.transactions.push({
      ...d.transactions.at(-1)!,
      id: "avulsa",
      recurrence_id: null,
      amount_cents: 1000,
    });
    expect(purchaseSuggestions(d, today()).expenses).toBe(base.expenses + 1000);
    const withBenefit = {
      ...d,
      transactions: d.transactions.filter(
        (entry) =>
          entry.target_account_id !==
          d.accounts.find((a) => a.kind === "benefit")!.id,
      ),
    };
    expect(purchaseSuggestions(withBenefit, today()).income).toBe(
      purchaseSuggestions(d, today()).income,
    );
  });
});
describe("metas com condições", () => {
  it("aguarda conclusão e valor reservado reais; libera quando TODAS as condições se cumprem", () => {
    const d = demoData(),
      [reserve, moving, phone] = d.goals;
    phone.dependencies = [
      { goal_id: moving.id, minimum_cents: null },
      { goal_id: reserve.id, minimum_cents: 1000000 },
    ];
    expect(goalBlockers(phone, d.goals, d.contributions)).toHaveLength(2);
    const plan = () =>
      planGoals(d.goals, d.contributions, 1000000, today(), "budget");
    expect(plan().rows.find((r) => r.goal.id === phone.id)?.proposed).toBe(0);
    moving.completed = true;
    expect(goalBlockers(phone, d.goals, d.contributions)).toHaveLength(1);
    d.contributions.find((c) => c.goal_id === reserve.id)!.amount_cents =
      1000000;
    expect(goalBlockers(phone, d.goals, d.contributions)).toHaveLength(0);
    expect(
      plan().rows.find((r) => r.goal.id === phone.id)!.proposed,
    ).toBeGreaterThan(0);
    expect(plan().rows.find((r) => r.goal.id === moving.id)?.proposed).toBe(0);
    d.contributions.find((c) => c.goal_id === reserve.id)!.amount_cents--;
    expect(goalBlockers(phone, d.goals, d.contributions)).toHaveLength(1);
  });
  it("recusa ciclos indiretos, autorreferência e metas alheias", () => {
    const d = demoData(),
      [a, b, c] = d.goals;
    a.dependencies = [{ goal_id: b.id, minimum_cents: null }];
    b.dependencies = [{ goal_id: c.id, minimum_cents: null }];
    c.dependencies = [{ goal_id: a.id, minimum_cents: null }];
    expect(() => validateGoalGraph(d.goals)).toThrow(/ciclo/);
    c.dependencies = [];
    b.user_id = "other";
    expect(() => validateGoalGraph(d.goals)).toThrow(/sua conta/);
    a.dependencies = [{ goal_id: a.id, minimum_cents: null }];
    expect(() => validateGoalGraph(d.goals)).toThrow(/ciclo/);
  });
});

describe("fase 2.3.2 — aluguel de imóvel e cofrinho progressivo", () => {
  it("simula aluguel com caução (depósito inicial) e seguro fiança (custo mensal)", () => {
    const withDeposit = simulatePurchase({
      ...scenario,
      category: "rent",
      price: 200000,
      ongoing: 50000,
      fees: 50000,
      savings: 400000,
      reserve: 100000,
      rentGuarantee: "deposit",
      deposit: 600000,
    });
    expect(withDeposit).toMatchObject({
      fits: false,
      price: 200000,
      deposit: 600000,
      total: 650000,
      purchaseCashTarget: 650000,
      missingCash: 350000,
      monthsToSave: 18,
      monthlyCommitment: 250000,
    });

    const withInsurance = simulatePurchase({
      ...scenario,
      category: "rent",
      price: 80000,
      ongoing: 20000,
      fees: 0,
      savings: 50000,
      reserve: 10000,
      rentGuarantee: "insurance",
      rentInsurance: 15000,
    });
    expect(withInsurance).toMatchObject({
      fits: true,
      price: 80000,
      rentInsurance: 15000,
      monthlyCommitment: 115000,
      remainingMonthly: 35000,
      missingCash: 0,
    });
  });

  it("calcula cartela do cofrinho de 1 a 500 (R$ 125.250,00) e extrai números marcados", () => {
    expect(piggyBankTotalCents(500)).toBe(12525000);
    expect(progressiveMonthlyTotalCents(10000, 5000, 12)).toBe(450000);
    const note = formatPiggyBankNote([10, 1, 500, 1]);
    expect(note).toBe("Cofrinho #1, #10, #500");
    const marked = extractMarkedNumbers(
      [
        {
          id: "c1",
          user_id: "u",
          goal_id: "g1",
          account_id: "a1",
          amount_cents: 51100,
          date: "2026-10-28",
          note,
        },
      ],
      500,
    );
    expect([...marked.keys()]).toEqual([1, 10, 500]);
    const goal = {
      id: "g1",
      user_id: "u",
      name: "Cofrinho 1 a 500",
      target_cents: 12525000,
      target_date: "2027-10-28",
      priority: 3 as const,
      monthly_budget_cents: null,
    };
    expect(inferPiggyBankSize(goal)).toBe(500);
    expect(isPiggyBankGoal(goal, [])).toBe(true);

    const customGoal = {
      ...goal,
      name: "Minha reserva especial",
      target_cents: piggyBankTotalCents(150),
    };
    expect(inferPiggyBankSize(customGoal)).toBe(150);
    expect(isPiggyBankGoal(customGoal, [])).toBe(true);
  });

  it("gera relatório analítico com raio-X de fixos e variáveis, top gastos e filtro por conta", () => {
    const d = demoData();
    const currentMonth = today().slice(0, 7);
    const r6 = buildMonthlyReport(d, currentMonth, today(), { horizon: 6 });
    expect(r6.periods).toHaveLength(6);
    expect(r6.current.income).toBeGreaterThan(0);
    expect(
      r6.current.fixedExpense + r6.current.variableExpense,
    ).toBe(r6.current.expense);
    expect(r6.topExpenses.length).toBeGreaterThan(0);
    expect(r6.accountSummaries.length).toBe(d.accounts.length);

    const r12 = buildMonthlyReport(d, currentMonth, today(), {
      horizon: 12,
      accountId: d.accounts[0].id,
    });
    expect(r12.periods).toHaveLength(12);
    expect(r12.accountSummaries).toHaveLength(1);
  });

  it("consome o limite do cheque especial quando a despesa paga ultrapassa o saldo inicial", () => {
    expect(
      accountSchema.safeParse({
        name: "Carteira",
        kind: "cash",
        opening_cents: 1000,
        opening_date: "2026-01-01",
        overdraft_cents: 50000,
      }).success,
    ).toBe(false);
    expect(
      accountSchema.safeParse({
        name: "Conta Corrente",
        kind: "checking",
        opening_cents: -120000,
        opening_date: "2026-01-01",
        overdraft_cents: 100000,
      }).success,
    ).toBe(false);

    let d = demoData();
    d = mutateDemo(d, "accounts", "POST", {
      name: "Conta Cheque Especial",
      kind: "checking",
      opening_cents: 30000, // R$ 300,00
      opening_date: "2026-01-01",
      overdraft_cents: 100000, // R$ 1.000,00 de limite
    });
    const acc = d.accounts.find((a) => a.name === "Conta Cheque Especial")!;
    expect(accountOverdraft(acc, balance(acc, d.transactions, today()))).toEqual(
      {
        hasOverdraft: true,
        limitCents: 100000,
        usedCents: 0,
        remainingCents: 100000,
        exceededCents: 0,
        totalAvailableCents: 130000,
        usageRatio: 0,
      },
    );

    // Despesa paga de R$ 800,00 (maior que o saldo inicial de R$ 300,00) -> consome R$ 500,00 do cheque especial
    d = mutateDemo(d, "transactions", "POST", {
      kind: "expense",
      description: "Conserto urgente",
      amount_cents: 80000,
      date: today(),
      status: "posted",
      source_account_id: acc.id,
      target_account_id: null,
      category: "Imprevistos",
    });
    const currentBal = balance(acc, d.transactions, today());
    expect(currentBal).toBe(-50000);
    expect(accountOverdraft(acc, currentBal)).toEqual({
      hasOverdraft: true,
      limitCents: 100000,
      usedCents: 50000,
      remainingCents: 50000,
      exceededCents: 0,
      totalAvailableCents: 50000,
      usageRatio: 0.5,
    });
    const ov = overview(d, today().slice(0, 7), today());
    expect(ov.overdraftUsed).toBe(50000);

    // Despesa que ultrapassa o limite restante de R$ 500,00 deve ser bloqueada
    expect(() =>
      mutateDemo(d, "transactions", "POST", {
        kind: "expense",
        description: "Acima do cheque especial",
        amount_cents: 60000,
        date: today(),
        status: "posted",
        source_account_id: acc.id,
        target_account_id: null,
        category: "Outros",
      }),
    ).toThrow(/cheque especial/);
  });
});
