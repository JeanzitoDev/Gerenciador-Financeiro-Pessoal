// @vitest-environment jsdom
import { beforeAll, afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  within,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinanceApp from "../src/components/finance-app";
import AuthForm from "../src/components/auth-form";
import { formatMoney } from "../src/lib/finance/money";
import { demoData } from "../src/lib/demo";
import type { Entry, Profile } from "../src/lib/types";
import DateControl, { MonthControl } from "../src/components/date-control";
import { useState } from "react";
import MoneyInput from "../src/components/money-input";
import Simulator from "../src/components/simulator";
import { today, monthLabel } from "../src/lib/finance/dates";
import RecordForm from "../src/components/record-form";
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
    value: vi.fn().mockImplementation(() => ({
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
  vi.unstubAllGlobals();
});
async function chooseOption(label: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(screen.getByRole("option", { name: option }));
}
function navigate(name: string) {
  return userEvent.click(screen.getAllByRole("button", { name })[0]);
}
describe("fluxos React com dados fictícios", () => {
  it("cria, edita e exclui uma receita pela interface", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await navigate("Preferências");
    await user.click(screen.getByRole("radio", { name: "Escuro" }));
    await chooseOption("Sua cor", "Azul");
    await chooseOption("Fundo do seu espaço", "Aurora");
    await navigate("Visão geral");
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    let dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: "Tipo" }));
    await user.click(within(dialog).getByRole("option", { name: "Receita" }));
    await user.type(
      within(dialog).getByLabelText("Descrição"),
      "Freela de validação",
    );
    await user.type(
      within(dialog).getByLabelText("Valor líquido (R$)"),
      "123,45",
    );
    await user.click(
      within(dialog).getByRole("combobox", { name: "Conta de destino" }),
    );
    await user.click(
      within(dialog).getByRole("option", { name: "Conta do dia a dia" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.documentElement.dataset).toMatchObject({
      theme: "dark",
      accent: "blue",
      background: "aurora",
    });
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
    expect(document.documentElement.dataset.theme).toBe("dark");
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
    expect(document.documentElement.dataset).toMatchObject({
      theme: "dark",
      accent: "blue",
      background: "aurora",
    });
  });
  it("bloqueia aporte sem saldo e mantém o formulário com erro", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await navigate("Metas");
    await user.click(screen.getByRole("button", { name: "Novo aporte" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("combobox", { name: "Meta" }));
    await user.click(
      within(dialog).getByRole("option", { name: "Reserva de emergência" }),
    );
    await user.click(
      within(dialog).getByRole("combobox", { name: "Conta com o recurso" }),
    );
    await user.click(within(dialog).getByRole("option", { name: "Carteira" }));
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
    await chooseOption("Sua cor", "Esmeralda");
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

describe("fase 2 — tarefas do dia a dia", () => {
  it("confirma uma recorrência sem abrir formulário e não a oferece novamente", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await navigate("Lançamentos");
    const panel = screen.getByRole("region", {
      name: "Recorrências para confirmar",
    });
    const button = within(panel).queryByRole("button", {
      name: "Confirmar Internet",
    });
    if (button) {
      await user.click(button);
      await waitFor(() =>
        expect(
          within(panel).queryByRole("button", { name: "Confirmar Internet" }),
        ).toBeNull(),
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    } else expect(within(panel).getByText(/Tudo em dia/)).toBeTruthy();
  });
  it("cria uma recorrência retroativa e permite pular uma ocorrência mantendo a regra", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await navigate("Recorrências");
    await user.click(screen.getByRole("button", { name: "Nova recorrência" }));
    const d = screen.getByRole("dialog");
    await user.type(within(d).getByLabelText("Descrição"), "Salário fase dois");
    await user.type(within(d).getByLabelText("Valor líquido (R$)"), "2500,00");
    await user.click(
      within(d).getByRole("combobox", { name: "Conta de destino" }),
    );
    await user.click(
      within(d).getByRole("option", { name: "Conta do dia a dia" }),
    );
    const date = within(d).getByRole("textbox", {
      name: "Primeira ocorrência",
    });
    await user.clear(date);
    await user.type(date, "01012026");
    await user.click(within(d).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(
      screen
        .getByRole("switch", { name: "Ativar ou pausar Salário fase dois" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    await navigate("Lançamentos");
    const pending = screen.getByRole("region", {
      name: "Recorrências para confirmar",
    });
    const skip = within(pending).getAllByRole("button", {
      name: "Pular Salário fase dois",
    })[0];
    await user.click(skip);
    await waitFor(() =>
      expect(
        screen.getByText("Este mês foi pulado. A recorrência continua ativa."),
      ).toBeTruthy(),
    );
    await navigate("Recorrências");
    expect(
      screen
        .getByRole("switch", { name: "Ativar ou pausar Salário fase dois" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });
  it("select funciona pelo teclado e calendário permite escolher dia sem sair do modal", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    const d = screen.getByRole("dialog");
    const type = within(d).getByRole("combobox", { name: "Tipo" });
    type.focus();
    await user.keyboard("{ArrowDown}{Home}{ArrowDown}{Enter}");
    expect(type.textContent).toContain("Receita");
    expect(within(d).queryByRole("combobox", { name: "Situação" })).toBeNull();
    await user.click(
      within(d).getByRole("button", { name: "Abrir calendário: Data" }),
    );
    expect(
      within(d).getByRole("group", { name: "Calendário: Data" }),
    ).toBeTruthy();
    await user.click(within(d).getByRole("button", { name: "Hoje" }));
    expect(
      within(d).queryByRole("group", { name: "Calendário: Data" }),
    ).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it("símbolo mantém o usuário no app e o menu superior mostra o perfil", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await navigate("Preferências");
    await user.click(
      screen.getByRole("button", { name: "Meu Norte: visão geral" }),
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Olá, Visitante",
    );
    await user.click(screen.getByRole("button", { name: "Abrir minha conta" }));
    expect(screen.getByText("visitante@demo.local")).toBeTruthy();
    expect(screen.getByText("Perfil e preferências")).toBeTruthy();
  });
});

describe("fase 2.1 — aparência e calendários", () => {
  it("preserva a aparência ao salvar lançamento e atualizar a conta real", async () => {
    const user = userEvent.setup();
    const server = demoData();
    server.profile.theme = "light";
    let reads = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/data") {
        reads++;
        return Response.json(structuredClone(server));
      }
      if (url === "/api/records/transactions") {
        server.transactions.unshift({
          ...JSON.parse(String(init?.body)),
          id: "nova-receita",
          user_id: server.profile.user_id,
        } as Entry);
      }
      if (url === "/api/preferences") {
        server.profile = JSON.parse(String(init?.body)) as Profile;
      }
      return Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<FinanceApp demo={false} />);
    await screen.findByRole("heading", { name: "Olá, Visitante!" });
    await navigate("Preferências");
    await user.click(screen.getByRole("radio", { name: "Escuro" }));
    await chooseOption("Sua cor", "Coral");
    await chooseOption("Fundo do seu espaço", "Gradiente suave");
    await navigate("Visão geral");
    await user.click(screen.getByRole("button", { name: "Novo lançamento" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("combobox", { name: "Tipo" }));
    await user.click(dialog.getByRole("option", { name: "Receita" }));
    await user.type(
      dialog.getByLabelText("Descrição"),
      "Receita mantém o tema",
    );
    await user.type(dialog.getByLabelText("Valor líquido (R$)"), "100,00");
    await user.click(
      dialog.getByRole("combobox", { name: "Conta de destino" }),
    );
    await user.click(
      dialog.getByRole("option", { name: "Conta do dia a dia" }),
    );
    await user.click(dialog.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Receita mantém o tema")).toBeTruthy();
    expect(document.documentElement.dataset).toMatchObject({
      theme: "dark",
      accent: "coral",
      background: "gradient",
    });
    // GET still returns the saved light profile until preferences are saved.
    expect(server.profile.theme).toBe("light");
    const previousReads = reads;
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(reads).toBeGreaterThan(previousReads));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await navigate("Preferências");
    await user.click(
      screen.getByRole("button", { name: "Salvar preferências" }),
    );
    await screen.findByText("Preferências salvas.");
    expect(server.profile.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    // A later server preference is visible after the draft was saved/cleared.
    server.profile.theme = "light";
    fireEvent(window, new Event("focus"));
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("light"),
    );
    expect(document.documentElement.dataset.accent).toBe("coral");
  });

  it("escolhe mês e ano e fecha o seletor por Escape devolvendo o foco", async () => {
    function Example() {
      const [value, setValue] = useState("2026-10");
      return <MonthControl value={value} onChange={setValue} />;
    }
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Escolher mês" });
    expect(trigger.textContent).toContain("outubro de 2026");
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Próximo ano" }));
    await user.click(screen.getByRole("button", { name: "março de 2027" }));
    expect(trigger.textContent).toContain("março de 2027");
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("group", { name: "Escolher mês e ano" }),
    ).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(trigger.textContent).toContain("fevereiro de 2027");
  });

  it("acomoda o calendário da coluna direita entre as bordas e cabeçalho do modal", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.classList.contains("date-control"))
          return new DOMRect(500, 475, 220, 44);
        if (this.tagName === "DIALOG") return new DOMRect(200, 100, 570, 500);
        if (this.classList.contains("dialog-head"))
          return new DOMRect(200, 100, 570, 70);
        if (this.classList.contains("dialog-foot"))
          return new DOMRect(200, 535, 570, 65);
        return new DOMRect();
      },
    );
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(400);
    const user = userEvent.setup();
    render(
      <dialog open>
        <div className="dialog-head" />
        <DateControl value="2026-10-18" onChange={() => {}} label="Data" />
        <div className="dialog-foot" />
      </dialog>,
    );
    await user.click(
      screen.getByRole("button", { name: "Abrir calendário: Data" }),
    );
    const popup = screen.getByRole("group", { name: "Calendário: Data" });
    const left = 500 + Number.parseFloat(popup.style.left);
    expect(popup.style.width).toBe("320px");
    expect(left).toBeGreaterThanOrEqual(212);
    expect(left + 320).toBeLessThanOrEqual(758);
    expect(popup.style.bottom).toBe("calc(100% + 8px)");
    expect(Number.parseFloat(popup.style.maxHeight)).toBeLessThanOrEqual(
      475 - 170 - 8,
    );
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Abrir calendário: Data" }),
    );
  });
});

describe("fase 2.2 — rotina e consistência", () => {
  it("troca mês e ano pelo seletor compartilhado e mantém Escape dentro do calendário", async () => {
    function Example() {
      const [value, set] = useState("2026-10-18");
      return <DateControl label="Dia" value={value} onChange={set} />;
    }
    const user = userEvent.setup();
    render(<Example />);
    await user.click(
      screen.getByRole("button", { name: "Abrir calendário: Dia" }),
    );
    await user.click(
      screen.getByRole("combobox", { name: "Mês do calendário" }),
    );
    await user.keyboard("{Escape}");
    expect(screen.getByRole("group", { name: "Calendário: Dia" })).toBeTruthy();
    await chooseOption("Mês do calendário", "maio");
    await chooseOption("Ano do calendário", "2027");
    expect(document.querySelectorAll("select")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "11/05/2027" }));
    expect(screen.getByLabelText("Dia")).toHaveProperty("value", "11/05/2027");
    expect(screen.queryByRole("group", { name: "Calendário: Dia" })).toBeNull();
  });
  it("carrega o pagamento salvo mesmo se a sincronização de recorrências falhar", async () => {
    const user = userEvent.setup();
    const server = demoData();
    const planned = {
      ...server.transactions[0],
      id: "adiantada",
      kind: "expense" as const,
      description: "Parcela que já paguei",
      source_account_id: server.accounts[0].id,
      target_account_id: null,
      gross_cents: null,
      deductions_cents: null,
      amount_cents: 10000,
      date: today(),
      status: "planned" as const,
      recurrence_id: server.recurrences[0].id,
      occurrence_date: `${Number(today().slice(0, 4)) + 1}-01-01`,
    };
    server.transactions.push(planned);
    let syncFails = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/data") return Response.json(structuredClone(server));
        if (url === "/api/recurrences/sync" && syncFails)
          return Response.json({ error: "Indisponível" }, { status: 503 });
        if (url === "/api/records/transactions") {
          const payload = JSON.parse(String(init?.body));
          server.transactions = server.transactions.map((entry) =>
            entry.id === payload.id ? { ...entry, ...payload } : entry,
          );
          syncFails = true;
        }
        return Response.json({ ok: true });
      }),
    );
    render(<FinanceApp demo={false} />);
    await screen.findByRole("heading", { name: "Olá, Visitante!" });
    await navigate("Lançamentos");
    await user.click(
      screen.getByRole("button", { name: "Editar Parcela que já paguei" }),
    );
    await chooseOption("Situação", "Já paguei");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Salvar",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Pago adiantado")).toBeTruthy();
    expect(screen.getByText(/Seus dados foram carregados/)).toBeTruthy();
    expect(
      server.transactions.find((entry) => entry.id === planned.id)?.status,
    ).toBe("posted");
  });
  it("inicia escuro e usa o mesmo seletor de cor e fundo sem breadcrumb repetido", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.queryByText("Meu espaço")).toBeNull();
    await navigate("Preferências");
    expect(screen.getByRole("radio", { name: "Escuro" })).toHaveProperty(
      "checked",
      true,
    );
    expect(document.querySelectorAll("select")).toHaveLength(0);
    await chooseOption("Sua cor", "Turquesa");
    await chooseOption("Fundo do seu espaço", "Ondas suaves");
    expect(document.documentElement.dataset).toMatchObject({
      theme: "dark",
      accent: "teal",
      background: "waves",
    });
    await user.click(
      screen.getByRole("button", { name: "Salvar preferências" }),
    );
    await navigate("Minhas contas");
    expect(
      screen.getByRole("heading", { name: "Vale alimentação" }),
    ).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
  it("formata dinheiro ao digitar, completa centavos e permite editar no meio", async () => {
    function Example() {
      const [v, set] = useState("1000,00");
      return (
        <>
          <MoneyInput aria-label="Dinheiro" value={v} onValueChange={set} />
          <button>Fora</button>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Example />);
    const input = screen.getByRole("textbox", {
      name: "Dinheiro",
    }) as HTMLInputElement;
    expect(input.value).toBe("1.000,00");
    await user.clear(input);
    await user.type(input, "12345,6");
    expect(input.value).toBe("12.345,6");
    await user.click(screen.getByRole("button", { name: "Fora" }));
    expect(input.value).toBe("12.345,60");
    input.focus();
    input.setSelectionRange(1, 1);
    await user.keyboard("9");
    expect(input.value).toBe("192.345,60");
    expect(input.selectionStart).toBe(2);
  });
  it("simula valores com milhar e centavos sem mudar os campos de taxa e prazo", async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const initial = screen.getByLabelText("Valor inicial (R$)");
    const monthly = screen.getByLabelText("Aporte no fim do mês (R$)");
    expect(initial).toHaveProperty("value", "1.000,00");
    await user.clear(initial);
    await user.type(initial, "1234567,8");
    await user.clear(monthly);
    await user.type(monthly, "1234,56");
    for (const [name, value] of [
      ["Prazo em meses", "1"],
      ["Rentabilidade anual (%)", "0"],
      ["Inflação anual (%)", "0"],
    ]) {
      const field = screen.getByLabelText(name);
      await user.clear(field);
      await user.type(field, value);
    }
    expect(initial).toHaveProperty("value", "1.234.567,80");
    expect(monthly).toHaveProperty("value", "1.234,56");
    await user.click(screen.getByRole("button", { name: "Simular futuro" }));
    expect(
      screen.getByRole("heading", { name: formatMoney(123580236) }),
    ).toBeTruthy();
  });
  it("repete o clique no menu subindo suavemente e respeita a redução de movimento", async () => {
    render(<FinanceApp demo />);
    await navigate("Minhas contas");
    await navigate("Minhas contas");
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 0,
      behavior: "smooth",
    });
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query.includes("reduced-motion"),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    await navigate("Minhas contas");
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 0,
      behavior: "instant",
    });
  });
  it("paga uma recorrência futura pelo lançamento e mantém uma única ocorrência confirmada", async () => {
    const user = userEvent.setup();
    const now = today();
    const date = new Date(`${now}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 2);
    const future = date.toISOString().slice(0, 10);
    render(<FinanceApp demo />);
    await navigate("Recorrências");
    await user.click(screen.getByRole("button", { name: "Nova recorrência" }));
    let dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("combobox", { name: "Tipo" }));
    await user.click(dialog.getByRole("option", { name: "Despesa" }));
    await user.type(
      dialog.getByLabelText("Descrição"),
      "Assinatura antecipada",
    );
    await user.type(dialog.getByLabelText("Valor líquido (R$)"), "99,90");
    const first = dialog.getByLabelText("Primeira ocorrência");
    await user.clear(first);
    await user.type(first, future.split("-").reverse().join(""));
    await user.click(dialog.getByRole("combobox", { name: "Conta de origem" }));
    await user.click(
      dialog.getByRole("option", { name: "Conta do dia a dia" }),
    );
    await user.click(dialog.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await navigate("Lançamentos");
    if (future.slice(0, 7) !== now.slice(0, 7))
      await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    await chooseOption("Filtrar situação", "A pagar e a receber");
    await user.click(
      screen.getByRole("button", { name: "Editar Assinatura antecipada" }),
    );
    dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("combobox", { name: "Situação" }));
    await user.click(dialog.getByRole("option", { name: "Já paguei" }));
    expect(dialog.getByLabelText("Data do pagamento")).toHaveProperty(
      "value",
      now.split("-").reverse().join("/"),
    );
    await user.click(dialog.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const row = screen
      .getByText("Assinatura antecipada")
      .closest(".entry-row")!;
    expect(within(row as HTMLElement).getByText("Pago adiantado")).toBeTruthy();
    expect(row.textContent).not.toContain("Previsto");
    expect(
      screen.getByRole("button", { name: "Escolher mês" }).textContent,
    ).toContain(monthLabel(now.slice(0, 7)));
    expect(
      screen.getByRole("combobox", { name: "Filtrar situação" }).textContent,
    ).toContain("Todas as situações");
    await navigate("Recorrências");
    await navigate("Lançamentos");
    expect(screen.getAllByText("Assinatura antecipada")).toHaveLength(1);
    expect(screen.getByText("Pago adiantado")).toBeTruthy();
  });
  it("editar uma receita recorrente pendente não a recebe automaticamente", async () => {
    const data = demoData();
    const future = `${Number(today().slice(0, 4)) + 1}-01-15`;
    const record = {
      ...data.transactions[0],
      status: "planned",
      recurrence_id: data.recurrences[0].id,
      occurrence_date: future,
      date: future,
    };
    const submit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <RecordForm
        state={{ entity: "transactions", record }}
        data={data}
        onSubmit={submit}
        onClose={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(submit).toHaveBeenLastCalledWith(
      "transactions",
      "PUT",
      expect.objectContaining({ status: "planned", date: future }),
    );
    await chooseOption("Situação", "Já recebi");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(submit).toHaveBeenLastCalledWith(
      "transactions",
      "PUT",
      expect.objectContaining({ status: "posted", date: today() }),
    );
  });
});

describe("contratos pela interface", () => {
  it("registra uma parcela em uma única despesa e atualiza o progresso", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await navigate("Empréstimos e financiamentos");
    await user.click(screen.getByRole("button", { name: "Novo contrato" }));
    const d = screen.getByRole("dialog");
    await user.type(within(d).getByLabelText("Nome"), "Contrato de teste");
    await user.type(
      within(d).getByLabelText("Valor da parcela (R$)"),
      "500,00",
    );
    await user.click(
      within(d).getByRole("combobox", { name: "Conta sugerida para pagar" }),
    );
    await user.click(
      within(d).getByRole("option", { name: "Conta do dia a dia" }),
    );
    await user.click(within(d).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("0 de 12 parcelas pagas")).toBeTruthy();
    await user.click(screen.getByText("Registrar pagamento da parcela"));
    await user.click(
      screen.getByRole("button", { name: "Paguei esta parcela" }),
    );
    await waitFor(() =>
      expect(screen.getByText("1 de 12 parcelas pagas")).toBeTruthy(),
    );
    await navigate("Lançamentos");
    expect(
      screen.getAllByText("Contrato de teste · Parcela 1/12"),
    ).toHaveLength(1);
  });
});
