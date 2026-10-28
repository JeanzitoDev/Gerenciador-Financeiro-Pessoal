import { describe, it, expect } from "vitest";
import {
  simulatePurchase,
  purchaseSuggestions,
  type PurchaseInput,
} from "../src/lib/finance/purchase";
import {
  goalBlockers,
  validateGoalGraph,
} from "../src/lib/finance/goal-dependencies";
import { planGoals } from "../src/lib/finance/engine";
import { demoData } from "../src/lib/demo";
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
