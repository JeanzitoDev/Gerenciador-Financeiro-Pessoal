// @vitest-environment jsdom
import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import {
  render,
  screen,
  within,
  cleanup,
  waitFor,
  fireEvent,
  act,
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
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.mocked(HTMLElement.prototype.scrollIntoView).mockClear();
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
async function navigate(name: string) {
  if (name === "Preferências") {
    await userEvent.click(
      screen.getByRole("button", { name: "Abrir minha conta" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Perfil e preferências" }),
    );
    return;
  }
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
    await navigate("Cabe no meu bolso?");
    await user.type(screen.getByLabelText("Preço da compra (R$)"), "1000,00");
    await user.type(
      screen.getByLabelText("Renda líquida por mês (R$)"),
      "2000,00",
    );
    const available = screen.getByLabelText(
      "Dinheiro disponível para este plano (R$)",
    );
    await user.clear(available);
    await user.type(available, "1500,00");
    await user.click(
      screen.getByRole("button", { name: "Ver se cabe no meu bolso" }),
    );
    expect(
      screen.getByRole("heading", { name: "Cabe no orçamento informado" })
        .textContent,
    ).toContain("Cabe no orçamento informado");
  });
  it("mostra todos os módulos sem erros de renderização", async () => {
    render(<FinanceApp demo />);
    for (const name of [
      "Minhas contas",
      "Cabe no meu bolso?",
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
  it("atualiza em segundo plano ao voltar à janela e a cada minuto sem mostrar popup", async () => {
    const server = demoData();
    let syncGate: Promise<Response> | null = null;
    let dataFails = false;
    const interval = vi.spyOn(globalThis, "setInterval");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/recurrences/sync")
          return syncGate ?? Response.json({ ok: true });
        if (dataFails)
          return Response.json(
            { error: "Conexão indisponível." },
            { status: 503 },
          );
        return Response.json(structuredClone(server));
      }),
    );
    render(<FinanceApp demo={false} />);
    await screen.findByRole("heading", { name: "Olá, Visitante!" });
    const refresh = interval.mock.calls.find(
      ([, delay]) => delay === 60000,
    )?.[0];
    expect(typeof refresh).toBe("function");
    for (const name of ["Foco", "Minuto"]) {
      server.profile.display_name = name;
      let release!: (response: Response) => void;
      syncGate = new Promise((resolve) => {
        release = resolve;
      });
      if (name === "Foco") fireEvent(window, new Event("focus"));
      else
        act(() => {
          if (typeof refresh === "function") refresh();
        });
      expect(screen.queryByText("Atualizando…")).toBeNull();
      // Keep the request pending until after checking the UI, then verify new data arrives.
      await act(async () => {
        release(Response.json({ ok: true }));
      });
      await screen.findByRole("heading", { name: `Olá, ${name}!` });
    }
    syncGate = null;
    dataFails = true;
    fireEvent(window, new Event("focus"));
    await screen.findByRole("alert");
    expect(screen.getByText("Conexão indisponível.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Olá, Minuto!" })).toBeTruthy();
    // Manual retries retain progress feedback and clear the error on success.
    let release!: (response: Response) => void;
    syncGate = new Promise((resolve) => {
      release = resolve;
    });
    dataFails = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(screen.getByText("Atualizando…")).toBeTruthy();
    await act(async () => {
      release(Response.json({ ok: true }));
    });
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByText("Atualizando…")).toBeNull();
    });
  });
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
  it("simula compras com máscaras de milhar e centavos", async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    const price = screen.getByLabelText("Preço da compra (R$)");
    await user.type(price, "1234567,8");
    await user.type(
      screen.getByLabelText("Renda líquida por mês (R$)"),
      "2000,00",
    );
    const available = screen.getByLabelText(
      "Dinheiro disponível para este plano (R$)",
    );
    await user.clear(available);
    await user.type(available, "2000000,00");
    await user.click(
      screen.getByRole("button", { name: "Ver se cabe no meu bolso" }),
    );
    expect(price).toHaveProperty("value", "1.234.567,80");
    expect(
      screen.getByRole("region", { name: "Resultado da compra" }).textContent,
    ).toContain(formatMoney(123456780));
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

describe("fase 2.3 — primeiros passos e decisões", () => {
  it("leva o cadastro duplicado para Entrar com e-mail mantido e senha limpa", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: "Já existe uma conta com esse e-mail. Entre para continuar.",
          },
          { status: 409 },
        ),
      ),
    );
    render(<AuthForm configured />);
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    await user.type(screen.getByLabelText("Como podemos te chamar?"), "Jean");
    await user.type(screen.getByLabelText("E-mail"), "jean@example.com");
    await user.type(screen.getByLabelText("Senha"), "12345678");
    await user.click(screen.getByRole("button", { name: "Criar minha conta" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Ir para entrar" }));
    expect(screen.getByLabelText("E-mail")).toHaveProperty(
      "value",
      "jean@example.com",
    );
    expect(screen.getByLabelText("Senha")).toHaveProperty("value", "");
    expect(
      screen.getByRole("button", { name: "Entrar no meu espaço" }),
    ).toBeTruthy();
  });
  it("orienta uma nova conta, persiste as etapas e permite rever o guia", async () => {
    const user = userEvent.setup();
    const server = demoData();
    server.accounts = [];
    server.transactions = [];
    server.goals = [];
    server.contributions = [];
    server.investments = [];
    server.recurrences = [];
    server.profile.onboarding_step = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/data") return Response.json(structuredClone(server));
        if (url === "/api/records/accounts")
          server.accounts.push({
            ...JSON.parse(String(init?.body)),
            id: "00000000-0000-4000-8000-000000000099",
            user_id: server.profile.user_id,
          });
        if (url === "/api/onboarding") {
          const body = JSON.parse(String(init?.body));
          server.profile.onboarding_step = body.step;
          server.profile.onboarding_dismissed = body.dismissed;
          server.profile.onboarding_completed_at =
            body.step === 4 && !body.dismissed
              ? new Date().toISOString()
              : null;
          return Response.json({
            ok: true,
            completed_at: server.profile.onboarding_completed_at,
          });
        }
        return Response.json({ ok: true });
      }),
    );
    render(<FinanceApp demo={false} />);
    await screen.findByRole("region", { name: "Primeiros passos" });
    await user.click(
      screen.getByRole("button", { name: "Cadastrar uma conta" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Nome"), "Minha conta");
    await user.click(dialog.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(
      screen.getByRole("button", { name: "Já cadastrei minhas contas" }),
    );
    await screen.findByRole("heading", { name: "Conte o que se repete" });
    expect(server.profile.onboarding_step).toBe(1);
    await user.click(
      screen.getByRole("button", { name: "Continuar tutorial depois" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Primeiros passos" }),
      ).toBeNull(),
    );
    expect(server.profile.onboarding_dismissed).toBe(true);
    await navigate("Preferências");
    await user.click(
      screen.getByRole("button", { name: "Ver tutorial inicial" }),
    );
    await screen.findByRole("heading", { name: "Conte o que se repete" });
    expect(server.profile.onboarding_step).toBe(1);
    expect(server.profile.onboarding_dismissed).toBe(false);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", {
      name: "Inclua as parcelas que já existem",
    });
    await user.click(
      screen.getByRole("button", { name: "Continuar / não tenho contratos" }),
    );
    await screen.findByRole("heading", {
      name: "Pronto para cuidar do dia a dia",
    });
    await user.click(
      screen.getByRole("button", { name: "Conhecer os lançamentos" }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Lançamentos" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "Primeiros passos" }),
    ).toBeNull();
    await navigate("Visão geral");
    await user.click(
      screen.getByRole("button", { name: "Concluir primeiros passos" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Primeiros passos" }),
      ).toBeNull(),
    );
    expect(server.profile.onboarding_step).toBe(4);
    await navigate("Preferências");
    await user.click(
      screen.getByRole("button", { name: "Ver tutorial inicial" }),
    );
    await screen.findByRole("heading", {
      name: "Comece pelo dinheiro que você tem",
    });
    expect(server.profile.onboarding_step).toBe(0);
  });
  it("transforma uma compra genérica em meta sem reservar dinheiro automaticamente", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    expect(screen.queryByRole("button", { name: "Investimentos" })).toBeNull();
    await navigate("Cabe no meu bolso?");
    await chooseOption("O que você está planejando?", "Celular ou eletrônico");
    await user.type(
      screen.getByLabelText("Qual é a sua conquista? (opcional)"),
      "iPhone",
    );
    await user.type(screen.getByLabelText("Preço da compra (R$)"), "5000,00");
    await user.type(
      screen.getByLabelText("Renda líquida por mês (R$)"),
      "4000,00",
    );
    for (const [label, value] of [
      ["Gastos mensais atuais, com parcelas (R$)", "3000,00"],
      ["Dinheiro disponível para este plano (R$)", "1000,00"],
      ["Quanto pretendo guardar por mês (R$)", "500,00"],
    ]) {
      const input = screen.getByLabelText(label);
      await user.clear(input);
      await user.type(input, value);
    }
    await user.click(
      screen.getByRole("button", { name: "Ver se cabe no meu bolso" }),
    );
    expect(screen.getByText(/8 meses/)).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "Resultado da compra" }),
    );
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenLastCalledWith({
      behavior: "smooth",
      block: "start",
    });
    await user.click(
      screen.getByRole("button", { name: "Transformar em meta" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByLabelText("Nome")).toHaveProperty(
      "value",
      "Conquistar iPhone",
    );
    expect(dialog.getByLabelText("Valor da meta (R$)")).toHaveProperty(
      "value",
      "5.000,00",
    );
    await user.click(dialog.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await navigate("Metas");
    expect(
      screen.getByRole("heading", { name: "Conquistar iPhone" }),
    ).toBeTruthy();
    const card = screen
      .getByRole("heading", { name: "Conquistar iPhone" })
      .closest("article")!;
    expect(within(card).getByText("0% do caminho")).toBeTruthy();
  });
  it("configura conclusão e valor mínimo como condições e explica a espera no planejamento", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await navigate("Metas");
    await user.click(
      screen.getByRole("button", { name: "Editar Investir em mim" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Adicionar condição" }),
    );
    await chooseOption("Meta da condição 1", "Próxima viagem");
    await user.click(
      screen.getByRole("button", { name: "Adicionar condição" }),
    );
    await chooseOption("Meta da condição 2", "Reserva de emergência");
    await chooseOption("Condição 2", "Ter um valor reservado");
    await user.type(
      screen.getByLabelText("Valor da condição 2 (R$)"),
      "10000,00",
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Salvar",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await navigate("Planejamento");
    await user.click(screen.getByText("Ver as contas do plano"));
    const row = screen.getByRole("row", { name: /Investir em mim/ });
    expect(within(row).getByText("Concluir Próxima viagem")).toBeTruthy();
    expect(
      within(row).getByText(/Reservar mais R\$.*2.200,00 em Reserva/),
    ).toBeTruthy();
    expect(within(row).getAllByRole("cell")[4].textContent).toBe(
      formatMoney(0),
    );
    await navigate("Metas");
    await user.click(
      screen.getByRole("button", { name: "Editar Próxima viagem" }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Esta meta já foi concluída" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Salvar",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await navigate("Planejamento");
    await user.click(screen.getByText("Ver as contas do plano"));
    const after = screen.getByRole("row", { name: /Investir em mim/ });
    expect(within(after).queryByText("Concluir Próxima viagem")).toBeNull();
    expect(within(after).getByText(/Reservar mais/)).toBeTruthy();
  });
});

describe("referência de juros na interface", () => {
  it("uma consulta atrasada não substitui os juros que a pessoa digitou", async () => {
    const user = userEvent.setup();
    let release!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );
    render(<Simulator />);
    await chooseOption("O que você está planejando?", "Casa ou apartamento");
    await chooseOption("Como pretende pagar?", "Parcelado ou financiado");
    await user.click(
      screen.getByRole("button", {
        name: "Usar juros médios do Banco Central",
      }),
    );
    const rate = screen.getByLabelText("Juros por mês (%)");
    await user.clear(rate);
    await user.type(rate, "1,8");
    await act(async () =>
      release(
        Response.json({
          monthly_rate: 0.02,
          source: "Banco Central",
          source_url: "https://dadosabertos.bcb.gov.br",
          date: "01/08/2026",
        }),
      ),
    );
    expect(rate).toHaveProperty("value", "1,8");
    expect(screen.queryByText(/referência de 01/)).toBeNull();
  });
});

describe("fase 2.3.1 — caminhos de uso", () => {
  it("leva ao resultado sem animação quando a pessoa pede movimento reduzido", async () => {
    const user = userEvent.setup();
    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    render(<Simulator />);
    await user.type(screen.getByLabelText("Preço da compra (R$)"), "100,00");
    await user.type(
      screen.getByLabelText("Renda líquida por mês (R$)"),
      "5000,00",
    );
    await user.click(
      screen.getByRole("button", { name: "Ver se cabe no meu bolso" }),
    );
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "Resultado da compra" }),
    );
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenLastCalledWith({
      behavior: "instant",
      block: "start",
    });
  });
  it("abre o tutorial para uma conta antiga e não volta a mostrá-lo após concluir e recarregar", async () => {
    const user = userEvent.setup();
    const server = demoData();
    server.profile.onboarding_step = 4;
    server.profile.onboarding_completed_at = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/data") return Response.json(structuredClone(server));
        if (url === "/api/onboarding") {
          const body = JSON.parse(String(init?.body));
          Object.assign(server.profile, {
            onboarding_step: body.step,
            onboarding_dismissed: body.dismissed,
            onboarding_completed_at:
              body.step === 4 && !body.dismissed
                ? new Date().toISOString()
                : null,
          });
          return Response.json({
            ok: true,
            completed_at: server.profile.onboarding_completed_at,
          });
        }
        return Response.json({ ok: true });
      }),
    );
    const first = render(<FinanceApp demo={false} />);
    await screen.findByRole("heading", {
      name: "Comece pelo dinheiro que você tem",
    });
    for (const name of [
      "Já cadastrei minhas contas",
      "Continuar",
      "Continuar / não tenho contratos",
      "Concluir primeiros passos",
    ]) {
      await user.click(await screen.findByRole("button", { name }));
    }
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Primeiros passos" }),
      ).toBeNull(),
    );
    expect(server.profile.onboarding_completed_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
    first.unmount();
    render(<FinanceApp demo={false} />);
    await screen.findByRole("heading", { name: "Olá, Visitante!" });
    expect(
      screen.queryByRole("region", { name: "Primeiros passos" }),
    ).toBeNull();
  });

  it("abre todas as categorias pela seta e mantém preferências e créditos num só lugar", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    expect(screen.queryByText("BEM-VINDO, VISITANTE")).toBeNull();
    const navigation = screen.getByRole("navigation", {
      name: "Navegação principal",
    });
    expect(
      within(navigation).queryByRole("button", { name: "Preferências" }),
    ).toBeNull();
    expect(
      within(screen.getByRole("main")).queryByText("JeanzitoDev"),
    ).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Ver todas as categorias" }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Relatórios" }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "Composição das despesas" }),
    );
    await navigate("Visão geral");
    await user.click(screen.getByRole("button", { name: "Ver relatórios" }));
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "Evolução do caixa" }),
    );
    await navigate("Preferências");
    expect(
      screen.getByRole("heading", { level: 1, name: "Preferências" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Privacidade dos seus dados" })
        .textContent,
    ).toContain("administrador do projeto");
  });

  it("revisa e salva uma reserva pelo planejamento e desconta o valor do plano", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await navigate("Planejamento");
    const budget = screen.getByLabelText(
      "Quanto ainda quero separar neste mês? (R$)",
    );
    await user.clear(budget);
    await user.type(budget, "100,00");
    const reserve = screen
      .getAllByRole("button", { name: /^Revisar e reservar para/ })
      .find((button) => !(button as HTMLButtonElement).disabled)!;
    await user.click(reserve);
    let dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByLabelText("Reservar (R$)")).toHaveProperty(
      "value",
      "100,00",
    );
    await user.click(dialog.getByRole("button", { name: "Cancelar" }));
    expect(budget).toHaveProperty("value", "100,00");
    await user.click(reserve);
    dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(budget).toHaveProperty("value", "0,00");
    expect(
      screen
        .getAllByRole("button", { name: /^Revisar e reservar para/ })
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
  });
});

describe("fase 2.3.2 — cofrinho 1 a 500 e aluguel de imóvel", () => {
  it("cria o cofrinho de 1 a 500 com máscara de exemplo ou tamanho personalizado e marca números", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await navigate("Metas");
    await user.click(screen.getByRole("button", { name: "Cofrinho 1 a 500" }));
    const dialog = within(screen.getByRole("dialog"));
    const nameInput = dialog.getByLabelText("Nome") as HTMLInputElement;
    expect(nameInput.value).toBe("");
    expect(nameInput.placeholder).toContain("Cofrinho da viagem");
    expect(dialog.getByLabelText("Valor da meta (R$)")).toHaveProperty(
      "value",
      "125.250,00",
    );
    await chooseOption(
      "Tamanho da cartela do cofrinho",
      "Outro tamanho (personalizado)",
    );
    const customSizeInput = dialog.getByLabelText(
      "Quantidade de números (de 1 até...)",
    );
    await user.clear(customSizeInput);
    await user.type(customSizeInput, "50");
    expect(dialog.getByLabelText("Valor da meta (R$)")).toHaveProperty(
      "value",
      "1.275,00",
    );
    await user.click(dialog.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(
      screen.getByRole("button", { name: "R$ 10 (disponível)" }),
    );
    await user.click(
      screen.getByRole("button", { name: "R$ 20 (disponível)" }),
    );
    await user.click(
      screen.getByRole("button", { name: /Marcar no cofrinho/ }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "R$ 10 (já guardado)" }),
      ).toBeTruthy(),
    );
    expect(
      screen.getByRole("button", { name: "R$ 20 (já guardado)" }),
    ).toBeTruthy();
  });

  it("exibe relatórios detalhados com raio-X do orçamento, maiores gastos e histórico de 12 meses", async () => {
    const user = userEvent.setup();
    render(<FinanceApp demo />);
    await navigate("Relatórios");
    expect(
      screen.getByRole("region", { name: "Raio-X do orçamento" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Maiores gastos do mês" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Balanço por conta" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Últimos 12 meses" }));
    expect(
      screen.getByText(/Histórico dos últimos 12 meses/),
    ).toBeTruthy();
  });

  it("simula aluguel de imóvel com caução de 3x o aluguel", async () => {
    const user = userEvent.setup();
    render(<Simulator />);
    await chooseOption("O que você está planejando?", "Aluguel de imóvel");
    await user.type(
      screen.getByLabelText("Valor do aluguel mensal (R$)"),
      "1500,00",
    );
    await user.type(
      screen.getByLabelText("Renda líquida por mês (R$)"),
      "5000,00",
    );
    await chooseOption(
      "Garantia da locação (opcional)",
      "Caução (depósito antecipado)",
    );
    await user.click(
      screen.getByRole("button", { name: "Usar 3x o aluguel" }),
    );
    expect(screen.getByLabelText("Valor da caução (R$)")).toHaveProperty(
      "value",
      "4.500,00",
    );
    await user.click(
      screen.getByRole("button", { name: "Ver se cabe no meu bolso" }),
    );
    expect(
      screen.getByRole("region", { name: "Resultado da compra" }).textContent,
    ).toContain("Caução na entrada");
  });
});
