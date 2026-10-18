// @vitest-environment jsdom
import { beforeAll, afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  within,
  cleanup,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinanceApp from "../src/components/finance-app";
import AuthForm from "../src/components/auth-form";
import { formatMoney } from "../src/lib/finance/money";
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    value: function () {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    value: function () {
      this.open = false;
    },
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi
      .fn()
      .mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
  });
  window.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function navigate(name: string) {
  return userEvent.click(screen.getAllByRole("button", { name })[0]);
}
describe("fluxos React com dados fictícios", () => {
  it("cria, edita e exclui uma receita pela interface", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    let dialog = screen.getByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Tipo"), "income");
    await user.type(
      within(dialog).getByLabelText("Descrição"),
      "Freela de validação",
    );
    await user.type(
      within(dialog).getByLabelText("Valor líquido (R$)"),
      "123,45",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Conta de destino"),
      "00000000-0000-4000-8000-000000000010",
    );
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await navigate("Lançamentos");
    expect(screen.getByText("Freela de validação")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Editar Freela de validação" }),
    );
    dialog = screen.getByRole("dialog");
    const amount = within(dialog).getByLabelText("Valor líquido (R$)");
    await user.clear(amount);
    await user.type(amount, "124,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const row = screen.getByText("Freela de validação").closest(".entry-row")!;
    expect(row.querySelector(".entry-right strong")?.textContent).toBe(
      `+${formatMoney(12400)}`,
    );
    await user.click(
      screen.getByRole("button", { name: "Excluir Freela de validação" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Excluir",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Freela de validação")).toBeNull(),
    );
  });
  it("bloqueia aporte sem saldo e mantém o formulário com erro", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await navigate("Metas");
    await user.click(screen.getByRole("button", { name: "Novo aporte" }));
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(
      within(dialog).getByLabelText("Meta"),
      "00000000-0000-4000-8000-000000000020",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Conta com o recurso"),
      "00000000-0000-4000-8000-000000000011",
    );
    await user.type(within(dialog).getByLabelText("Reservar (R$)"), "1000,00");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("reservas"),
    );
  });
  it("salva aparência e navega pelo simulador", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await navigate("Preferências");
    await user.click(screen.getByRole("radio", { name: "Escuro" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.click(screen.getByRole("radio", { name: "Esmeralda" }));
    await user.click(
      screen.getByRole("button", { name: "Salvar preferências" }),
    );
    expect(document.documentElement.dataset.accent).toBe("emerald");
    await navigate("Simulador");
    const initial = screen.getByLabelText("Valor inicial (R$)");
    await user.clear(initial);
    await user.type(initial, "1000,00");
    const monthly = screen.getByLabelText("Aporte no fim do mês (R$)");
    await user.clear(monthly);
    await user.type(monthly, "0,00");
    const months = screen.getByLabelText("Prazo em meses");
    await user.clear(months);
    await user.type(months, "12");
    const rate = screen.getByLabelText("Rentabilidade anual (%)");
    await user.clear(rate);
    await user.type(rate, "12");
    await user.click(screen.getByRole("button", { name: "Simular futuro" }));
    expect(
      screen.getByRole("heading", { name: formatMoney(112000) }),
    ).toBeTruthy();
  });
  it("mostra todos os módulos sem erros de renderização", async () => {
    render(<FinanceApp demo />);
    for (const name of [
      "Minhas contas",
      "Investimentos",
      "Recorrências",
      "Planejamento",
      "Relatórios",
      "Preferências",
      "Visão geral",
    ]) {
      await navigate(name);
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    }
  });
  it("não apresenta autenticação falsa sem projeto configurado", () => {
    render(<AuthForm configured={false} />);
    expect(
      screen.getByRole("button", { name: "Entrar no meu espaço" }),
    ).toHaveProperty("disabled", true);
    expect(screen.getByText(/O acesso real precisa/)).toBeTruthy();
  });
});
