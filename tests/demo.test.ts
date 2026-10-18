import { describe, it, expect } from "vitest";
import {
  demoData,
  mutateDemo,
  validateDemo,
  generateDemo,
} from "../src/lib/demo";
import { today } from "../src/lib/finance/dates";
import { overview, balance } from "../src/lib/finance/engine";
describe("demonstração e invariantes de domínio", () => {
  it("dados fictícios são consistentes e aportes não duplicam patrimônio", () => {
    const d = demoData();
    expect(() => validateDemo(d)).not.toThrow();
    const stats = overview(d, today().slice(0, 7), today());
    expect(stats.assets - stats.assigned).toBe(stats.free);
    expect(stats.benefits).toBeGreaterThan(0);
  });
  it("cria, edita e exclui uma receita, recalculando saldo", () => {
    const d = demoData(),
      a = d.accounts[0],
      initial = balance(a, d.transactions, today());
    const payload = {
      kind: "income",
      description: "Freela",
      amount_cents: 12345,
      date: today(),
      status: "posted",
      source_account_id: null,
      target_account_id: a.id,
      category: "Trabalho",
      gross_cents: null,
      deductions_cents: null,
    };
    const added = mutateDemo(d, "transactions", "POST", payload);
    const row = added.transactions.at(-1)!;
    expect(balance(a, added.transactions, today())).toBe(initial + 12345);
    const edited = mutateDemo(added, "transactions", "PUT", {
      ...row,
      amount_cents: 12346,
    });
    expect(balance(a, edited.transactions, today())).toBe(initial + 12346);
    const deleted = mutateDemo(edited, "transactions", "DELETE", {
      id: row.id,
    });
    expect(balance(a, deleted.transactions, today())).toBe(initial);
  });
  it("não permite apagar conta vinculada ou gastar valor reservado", () => {
    const d = demoData();
    expect(() =>
      mutateDemo(d, "accounts", "DELETE", { id: d.accounts[0].id }),
    ).toThrow(/vínculos/);
    const c = d.contributions[0];
    expect(() =>
      mutateDemo(d, "transactions", "POST", {
        kind: "transfer",
        description: "Resgatar tudo",
        amount_cents: balance(d.accounts[2], d.transactions, today()),
        date: today(),
        status: "posted",
        source_account_id: c.account_id,
        target_account_id: d.accounts[0].id,
        category: "Resgate",
        gross_cents: null,
        deductions_cents: null,
      }),
    ).toThrow(/reservas/);
  });
  it("reexecutar geração mantém ocorrências canceladas", () => {
    const d = demoData(),
      r = d.recurrences[0],
      start = r.start_date;
    const a = generateDemo(d, start, start);
    expect(a.count).toBe(1);
    const e = a.data.transactions.at(-1)!;
    const deleted = mutateDemo(a.data, "transactions", "DELETE", { id: e.id });
    expect(deleted.transactions.at(-1)!.status).toBe("cancelled");
    expect(generateDemo(deleted, start, start).count).toBe(0);
  });
});
