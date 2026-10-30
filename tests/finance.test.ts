import { describe, it, expect } from "vitest";
import {
  parseMoney,
  formatMoney,
  moneyInput,
  sumCents,
  MAX_CENTS,
} from "../src/lib/finance/money";
import {
  addMonths,
  validDate,
  inclusiveMonths,
} from "../src/lib/finance/dates";
import { recurrenceDates } from "../src/lib/finance/recurrence";
import {
  balance,
  overview,
  planGoals,
  project,
  investmentReturn,
} from "../src/lib/finance/engine";
import { csvCell } from "../src/lib/finance/csv";
import type { Account, Entry, FinanceData, Goal } from "../src/lib/types";
const a: Account = {
  id: "a",
  user_id: "u",
  name: "Banco",
  kind: "checking",
  opening_cents: 10000,
  opening_date: "2026-01-01",
};
const entry = (extra: Partial<Entry>): Entry => ({
  id: "e",
  user_id: "u",
  kind: "income",
  description: "Teste",
  amount_cents: 1000,
  date: "2026-01-02",
  status: "posted",
  source_account_id: null,
  target_account_id: "a",
  category: "Outros",
  gross_cents: null,
  deductions_cents: null,
  recurrence_id: null,
  occurrence_date: null,
  source: "manual",
  external_id: null,
  import_batch_id: null,
  categorization_rule_id: null,
  ...extra,
});
describe("moeda e datas", () => {
  it("formata agregados grandes sem perder centavos", () => {
    expect(formatMoney(Number.MAX_SAFE_INTEGER)).toBe(
      "R$\u00a090.071.992.547.409,91",
    );
    expect(formatMoney(-1)).toBe("-R$\u00a00,01");
  });
  it("preserva centavos brasileiros e negativos", () => {
    expect(parseMoney("R$ 1.234,56")).toBe(123456);
    expect(parseMoney("-0,01")).toBe(-1);
    expect(sumCents([10, 20])).toBe(30);
    expect(moneyInput(123456)).toBe("1234,56");
  });
  it.each(["1.23", "1,234", "1e3", "NaN", "", "1.2.3", "R$ 2,000"])(
    "rejeita entrada ambígua %s",
    (v) => expect(() => parseMoney(v)).toThrow(),
  );
  it("protege limite e datas impossíveis", () => {
    expect(sumCents([MAX_CENTS, 1])).toBe(MAX_CENTS + 1);
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow();
    expect(validDate("2026-02-29")).toBe(false);
    expect(validDate("2024-02-29")).toBe(true);
    expect(inclusiveMonths("2026-10-18", "2027-01-02")).toBe(4);
  });
  it("não deriva dia mensal depois de fevereiro", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
  });
});
describe("recorrências", () => {
  it("mensal e anual ancoradas", () => {
    expect(
      recurrenceDates("2026-01-31", "monthly", "2026-01-01", "2026-03-31"),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(
      recurrenceDates("2024-02-29", "yearly", "2028-01-01", "2028-12-31"),
    ).toEqual(["2028-02-29"]);
  });
  it("respeita fim e janela", () => {
    expect(
      recurrenceDates(
        "2026-01-01",
        "weekly",
        "2026-01-01",
        "2026-02-01",
        "2026-01-10",
      ),
    ).toEqual(["2026-01-01", "2026-01-08"]);
    expect(() =>
      recurrenceDates("2026-01-01", "monthly", "2026-01-01", "2028-01-01"),
    ).toThrow();
  });
});
describe("saldos e relatórios", () => {
  it("previsões e cancelamentos não alteram caixa; transferência preserva patrimônio", () => {
    const b = { ...a, id: "b", kind: "investment" as const, opening_cents: 0 };
    const entries = [
      entry({
        kind: "transfer",
        source_account_id: "a",
        target_account_id: "b",
        amount_cents: 5000,
      }),
      entry({ status: "planned" }),
      entry({ status: "cancelled" }),
    ];
    expect(balance(a, entries, "2026-01-31")).toBe(5000);
    expect(balance(b, entries, "2026-01-31")).toBe(5000);
  });
  it("separa VA/VR e não duplica reservas", () => {
    const data: FinanceData = {
      accounts: [a, { ...a, id: "va", kind: "benefit", opening_cents: 2000 }],
      transactions: [
        entry({}),
        entry({ id: "v", target_account_id: "va", amount_cents: 3000 }),
      ],
      contributions: [
        {
          id: "c",
          user_id: "u",
          goal_id: "g",
          account_id: "a",
          amount_cents: 2000,
          date: "2026-01-01",
          note: "",
        },
      ],
      goals: [],
      investments: [],
      recurrences: [],
      profile: {
        user_id: "u",
        display_name: "",
        theme: "light",
        accent: "violet",
        background: "plain",
      },
    };
    expect(overview(data, "2026-01", "2026-01-31")).toMatchObject({
      income: 1000,
      assets: 11000,
      benefits: 5000,
      assigned: 2000,
      free: 9000,
      liquid: 9000,
    });
  });
  it("exibe o que restou disponível quando despesas consomem o cheque especial", () => {
    const data: FinanceData = {
      accounts: [
        {
          id: "c1",
          user_id: "u",
          name: "Conta Principal",
          kind: "checking",
          opening_cents: 9909,
          opening_date: "2026-10-01",
          overdraft_cents: 10000,
        },
      ],
      transactions: [
        entry({
          id: "exp1",
          kind: "expense",
          source_account_id: "c1",
          target_account_id: null,
          amount_cents: 18056,
          date: "2026-10-15",
        }),
      ],
      contributions: [],
      goals: [],
      investments: [],
      recurrences: [],
      profile: {
        user_id: "u",
        display_name: "",
        theme: "light",
        accent: "violet",
        background: "plain",
      },
    };
    expect(overview(data, "2026-10", "2026-10-30")).toMatchObject({
      expense: 18056,
      free: -8147,
      liquid: -8147,
      overdraftLimit: 10000,
      overdraftUsed: 8147,
      overdraftAvailable: 1853,
    });
  });
});
describe("metas e simulação", () => {
  const goals: Goal[] = [
    {
      id: "g",
      user_id: "u",
      name: "Reserva",
      target_cents: 120000,
      target_date: "2026-12-31",
      priority: 2,
      monthly_budget_cents: null,
    },
    {
      id: "h",
      user_id: "u",
      name: "Curso",
      target_cents: 90000,
      target_date: "2026-10-31",
      priority: 1,
      monthly_budget_cents: 20000,
    },
  ];
  it("nunca aloca acima da verba e respeita teto", () => {
    const p = planGoals(goals, [], 50000, "2026-10-18", "date");
    expect(p.rows.map((r) => r.proposed)).toEqual([20000, 30000]);
    expect(p.remaining).toBe(0);
    expect(p.shortfall).toBe(80000);
  });
  it("juros anuais equivalentes e aporte ao fim do mês", () => {
    const p = project(100000, 0, 12, 0.12, 0.06).at(-1)!;
    expect(p.total).toBe(112000);
    expect(p.real).toBe(105660);
    expect(project(0, 10000, 12, 0, 0).at(-1)!.total).toBe(120000);
  });
  it("perdas e taxas inválidas", () => {
    expect(project(100000, 0, 12, -0.1, 0).at(-1)!.total).toBe(90000);
    expect(() => project(0, 0, 12, -1, 0)).toThrow();
    expect(() => project(0, -1, 12, 0, 0)).toThrow();
  });
  it("Modified Dietz não trata aporte como rendimento", () => {
    const inv = { ...a, kind: "investment" as const };
    const entries = [
      entry({
        date: "2026-01-01",
        kind: "transfer",
        source_account_id: "b",
        amount_cents: 10000,
      }),
      entry({ date: "2027-01-01", kind: "yield", amount_cents: 2000 }),
    ];
    const r = investmentReturn(inv, entries, "2027-01-01", 0.05);
    expect(r.gain).toBe(2000);
    expect(r.nominal).toBeCloseTo(0.1);
    expect(r.real).toBeCloseTo(1.1 / 1.05 - 1);
    expect(
      investmentReturn({ ...inv, opening_cents: 0 }, [], "2026-01-01", 0)
        .nominal,
    ).toBeNull();
  });
  it("neutraliza fórmulas CSV", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("Normal")).toBe('"Normal"');
  });
});
