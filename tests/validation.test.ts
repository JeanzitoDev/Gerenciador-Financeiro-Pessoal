import { describe, it, expect } from "vitest";
import { schemas, isEntity, profileSchema } from "../src/lib/validation";
const account = "00000000-0000-4000-8000-000000000010";
describe("contratos de entrada", () => {
  it("exclui campos de dono enviados pelo cliente", () => {
    const result = schemas.accounts.parse({
      name: "Conta",
      kind: "checking",
      opening_cents: 100,
      opening_date: "2026-01-01",
      user_id: "outro",
      id: "injetado",
    });
    expect(result).not.toHaveProperty("user_id");
    expect(result).not.toHaveProperty("id");
  });
  it("rejeita float em centavos e contas iguais na transferência", () => {
    expect(
      schemas.accounts.safeParse({
        name: "Conta",
        kind: "checking",
        opening_cents: 10.2,
        opening_date: "2026-01-01",
      }).success,
    ).toBe(false);
    expect(
      schemas.transactions.safeParse({
        kind: "transfer",
        description: "Transferir",
        amount_cents: 100,
        date: "2026-01-01",
        status: "posted",
        source_account_id: account,
        target_account_id: account,
        category: "Outros",
      }).success,
    ).toBe(false);
  });
  it("valida o líquido e mantém investimentos na faixa", () => {
    const base = {
      kind: "income",
      description: "Salário",
      amount_cents: 250000,
      date: "2026-01-01",
      status: "posted",
      source_account_id: null,
      target_account_id: account,
      category: "Salário",
      gross_cents: 300000,
      deductions_cents: 50000,
    };
    expect(schemas.transactions.safeParse(base).success).toBe(true);
    expect(
      schemas.transactions.safeParse({ ...base, deductions_cents: 40000 })
        .success,
    ).toBe(false);
    expect(
      schemas.investments.safeParse({
        name: "Aplicação",
        account_id: account,
        annual_rate: -1,
        inflation_rate: 0,
      }).success,
    ).toBe(false);
  });
  it("não expõe entidades de importação nem preferências livres", () => {
    expect(isEntity("import_batches")).toBe(false);
    expect(isEntity("__proto__")).toBe(false);
    expect(
      profileSchema.safeParse({
        display_name: "A",
        theme: "other",
        accent: "violet",
        background: "gradient",
      }).success,
    ).toBe(false);
  });
});
