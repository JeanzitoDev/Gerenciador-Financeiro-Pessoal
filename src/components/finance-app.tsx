"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ArrowRight,
  Plus,
  LayoutDashboard,
  Wallet,
  Target,
  ChartNoAxesCombined,
  CalendarClock,
  SlidersHorizontal,
  LogOut,
  Menu,
  X,
  Search,
  Pencil,
  Trash2,
  Download,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  Info,
  Sun,
  Moon,
  Monitor,
  WifiOff,
  Landmark,
  Banknote,
  Gift,
  Calculator,
  FileChartColumn,
  Compass,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  Account,
  Entity,
  FinanceData,
  Goal,
  Entry,
  Profile,
} from "@/lib/types";
import {
  demoData,
  mutateDemo,
  generateDemo,
  updateDemoProfile,
} from "@/lib/demo";
import { today, addMonths, formatDate, monthLabel } from "@/lib/finance/dates";
import {
  formatMoney,
  moneyInput,
  parseMoney,
  percent,
  sumCents,
} from "@/lib/finance/money";
import {
  balance,
  overview,
  goalFunded,
  reserved,
  expenseCategories,
  planGoals,
  project,
  investmentReturn,
  type PlanningStrategy,
} from "@/lib/finance/engine";
import { exportEntries } from "@/lib/finance/csv";
import RecordForm, { type FormState } from "./record-form";
import FinanceChart from "./charts";
import Simulator from "./simulator";
import ConfirmDialog from "./confirm-dialog";
type Screen =
  | "overview"
  | "transactions"
  | "accounts"
  | "goals"
  | "investments"
  | "recurrences"
  | "planning"
  | "reports"
  | "settings"
  | "simulator";
const nav: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "transactions", label: "Lançamentos", icon: ArrowLeftRight },
  { id: "accounts", label: "Minhas contas", icon: Wallet },
  { id: "goals", label: "Metas", icon: Target },
  { id: "investments", label: "Investimentos", icon: ChartNoAxesCombined },
  { id: "recurrences", label: "Recorrências", icon: CalendarClock },
  { id: "planning", label: "Planejamento", icon: Compass },
  { id: "simulator", label: "Simulador", icon: Calculator },
  { id: "reports", label: "Relatórios", icon: FileChartColumn },
  { id: "settings", label: "Preferências", icon: SlidersHorizontal },
];
const descriptions: Record<Screen, string> = {
  overview: "Um olhar tranquilo para sua vida financeira.",
  transactions: "Cada movimento conta para o seu próximo passo.",
  accounts: "Seu dinheiro, em cada lugar.",
  goals: "Dê um destino aos seus planos.",
  investments: "Acompanhe o que já rendeu. Imagine o que pode render.",
  recurrences: "Menos repetição. Mais organização.",
  planning: "Escolha o que vem primeiro.",
  simulator: "Explore as possibilidades do seu dinheiro.",
  reports: "Transforme seus movimentos em clareza.",
  settings: "Deixe seu espaço com a sua cara.",
};
const accountNames = {
  checking: "Conta corrente",
  cash: "Dinheiro",
  benefit: "Benefício",
  investment: "Investimento",
};
const accountIcons: Record<Account["kind"], LucideIcon> = {
  checking: Landmark,
  cash: Banknote,
  benefit: Gift,
  investment: TrendingUp,
};
const entryNames = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
  yield: "Rendimento",
};
const frequencyNames = {
  monthly: "Mensal",
  weekly: "Semanal",
  yearly: "Anual",
};
const asRecord = (value: unknown) => value as Record<string, unknown>;
function Empty({
  icon: Icon = Wallet,
  title,
  text,
  action,
  label,
}: {
  icon?: LucideIcon;
  title: string;
  text: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button primary" onClick={action}>
          <Plus size={17} />
          {label ?? "Começar"}
        </button>
      )}
    </div>
  );
}
function Actions({
  onEdit,
  onDelete,
  label,
}: {
  onEdit: () => void;
  onDelete: () => void;
  label: string;
}) {
  return (
    <div className="row-actions">
      <button
        className="icon-button"
        aria-label={`Editar ${label}`}
        onClick={onEdit}
      >
        <Pencil size={16} />
      </button>
      <button
        className="icon-button"
        aria-label={`Excluir ${label}`}
        onClick={onDelete}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
export default function FinanceApp({ demo }: { demo: boolean }) {
  const [data, setData] = useState<FinanceData | null>(() =>
      demo ? demoData() : null,
    ),
    [screen, setScreen] = useState<Screen>("overview"),
    [month, setMonth] = useState(today().slice(0, 7));
  const [form, setForm] = useState<FormState | null>(null),
    [remove, setRemove] = useState<{
      entity: Entity;
      id: string;
      label: string;
    } | null>(null);
  const [loading, setLoading] = useState(!demo),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false),
    [hidden, setHidden] = useState(false),
    [offline, setOffline] = useState(false);
  const [search, setSearch] = useState(""),
    [kind, setKind] = useState("all"),
    [status, setStatus] = useState("all");
  const [planBudget, setPlanBudget] = useState("1000,00"),
    [strategy, setStrategy] = useState<PlanningStrategy>("date");
  const [generateFrom, setGenerateFrom] = useState(`${month}-01`),
    [generateUntil, setGenerateUntil] = useState(addMonths(`${month}-01`, 1)),
    [generating, setGenerating] = useState(false);
  const [preferences, setPreferences] = useState<Profile | null>(null),
    [savingPrefs, setSavingPrefs] = useState(false);
  const asOf = today();
  const request = useCallback(async (path: string, options?: RequestInit) => {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error ?? "Não foi possível concluir a solicitação.",
      );
    return result;
  }, []);
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await request("/api/data");
      setData(result);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível carregar.",
      );
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    if (!demo) void load();
  }, [demo, load]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (data) setPreferences(data.profile);
  }, [data?.profile]);
  const activePrefs = preferences ?? data?.profile;
  useEffect(() => {
    if (!activePrefs) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      document.documentElement.dataset.theme =
        activePrefs.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : activePrefs.theme;
    };
    update();
    document.documentElement.dataset.accent = activePrefs.accent;
    document.documentElement.dataset.background = activePrefs.background;
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [activePrefs?.theme, activePrefs?.accent, activePrefs?.background]);
  useEffect(() => {
    document.title = `${nav.find((n) => n.id === screen)?.label} · Meu Norte`;
  }, [screen]);
  function go(next: Screen) {
    setScreen(next);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function newRecord(entity: Entity, preset?: Record<string, unknown>) {
    setForm({ entity, preset });
  }
  function edit(entity: Entity, record: unknown) {
    setForm({ entity, record: asRecord(record) });
  }
  async function save(
    entity: Entity,
    method: "POST" | "PUT",
    payload: Record<string, unknown>,
  ) {
    if (demo) {
      setData(mutateDemo(data!, entity, method, payload));
    } else {
      await request(`/api/records/${entity}`, {
        method,
        body: JSON.stringify(payload),
      });
      await load();
    }
    setToast(
      method === "POST" ? "Pronto! Registro criado." : "Alterações salvas.",
    );
  }
  async function deleteRecord() {
    if (!remove) return;
    if (demo)
      setData(mutateDemo(data!, remove.entity, "DELETE", { id: remove.id }));
    else {
      await request(`/api/records/${remove.entity}`, {
        method: "DELETE",
        body: JSON.stringify({ id: remove.id }),
      });
      await load();
    }
    setToast("Registro excluído.");
  }
  const askDelete = (entity: Entity, row: { id: string }, label: string) =>
    setRemove({ entity, id: row.id, label });
  const visibleEntries = useMemo(
    () =>
      data?.transactions
        .filter(
          (e) =>
            e.status !== "cancelled" &&
            e.date.startsWith(month) &&
            (kind === "all" || e.kind === kind) &&
            (status === "all" || e.status === status) &&
            `${e.description} ${e.category}`
              .toLocaleLowerCase("pt-BR")
              .includes(search.toLocaleLowerCase("pt-BR")),
        )
        .sort(
          (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
        ) ?? [],
    [data, month, kind, status, search],
  );
  if (!data)
    return (
      <main className="loading-page">
        <Compass size={38} />
        <h1>Meu Norte</h1>
        {loading ? (
          <p>Preparando seu espaço…</p>
        ) : (
          <>
            <p role="alert">{error}</p>
            <button className="button primary" onClick={() => void load()}>
              Tentar novamente
            </button>
            <Link href="/entrar">Entrar novamente</Link>
          </>
        )}
      </main>
    );
  const stats = overview(data, month, asOf),
    categories = expenseCategories(
      data.transactions,
      data.accounts,
      month,
      asOf,
    );
  const value = (cents: number) => (hidden ? "R$ •••••" : formatMoney(cents));
  const periods = Array.from({ length: 6 }, (_, i) => {
    const key = addMonths(`${month}-01`, i - 5).slice(0, 7);
    return {
      key,
      label: monthLabel(key).split(" ")[0].slice(0, 3),
      ...overview(data, key, asOf),
    };
  });
  const monthlyEntries = data.transactions
    .filter((e) => e.date.startsWith(month) && e.status !== "cancelled")
    .sort((a, b) => b.date.localeCompare(a.date));
  const nameOf = (id: string | null) =>
    data.accounts.find((a) => a.id === id)?.name ?? "—";
  const totalCategories = sumCents(categories.map((c) => c.value));
  const netCaption =
    stats.result >= 0
      ? "Você recebeu mais do que gastou."
      : "As despesas superaram as receitas.";
  const planning = (() => {
    try {
      return {
        data: planGoals(
          data.goals,
          data.contributions,
          parseMoney(planBudget),
          asOf,
          strategy,
        ),
        error: "",
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : "Orçamento inválido.",
      };
    }
  })();
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      let count: number;
      if (demo) {
        const result = generateDemo(data!, generateFrom, generateUntil);
        count = result.count;
        setData(result.data);
      } else {
        const result = await request("/api/recurrences/generate", {
          method: "POST",
          body: JSON.stringify({ from: generateFrom, until: generateUntil }),
        });
        count = result.count;
        await load();
      }
      setToast(
        `${count} ${count === 1 ? "previsão gerada" : "previsões geradas"}. Confirme os pagamentos nos lançamentos.`,
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Não foi possível gerar.");
    } finally {
      setGenerating(false);
    }
  }
  function downloadCSV() {
    const blob = new Blob([exportEntries(visibleEntries, data!.accounts)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `lancamentos-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function entryList(entries: Entry[], compact = false) {
    return entries.length ? (
      <div className="entry-list">
        {entries.map((entry) => {
          const Icon =
            entry.kind === "income"
              ? ArrowDownLeft
              : entry.kind === "expense"
                ? ArrowUpRight
                : entry.kind === "transfer"
                  ? ArrowLeftRight
                  : TrendingUp;
          return (
            <div className="entry-row" key={entry.id}>
              <span className={`entry-icon ${entry.kind}`}>
                <Icon size={19} />
              </span>
              <div className="entry-description">
                <strong>{entry.description}</strong>
                <span>
                  {entry.category} <b>·</b>{" "}
                  {entry.kind === "expense"
                    ? nameOf(entry.source_account_id)
                    : nameOf(entry.target_account_id)}
                  {entry.kind === "transfer" &&
                    ` ← ${nameOf(entry.source_account_id)}`}
                </span>
              </div>
              <div className="entry-right">
                <strong
                  className={
                    entry.amount_cents < 0
                      ? "negative"
                      : entry.kind === "income" || entry.kind === "yield"
                        ? "positive"
                        : ""
                  }
                >
                  {entry.kind === "expense"
                    ? "−"
                    : entry.kind === "transfer"
                      ? ""
                      : entry.amount_cents < 0
                        ? ""
                        : "+"}
                  {value(entry.amount_cents)}
                </strong>
                <span
                  className={
                    entry.status === "planned" ? "planned-text" : "muted"
                  }
                >
                  {entry.status === "planned" ? "Previsto · " : ""}
                  {formatDate(entry.date).slice(0, 5)}
                </span>
              </div>
              {!compact && (
                <Actions
                  label={entry.description}
                  onEdit={() => edit("transactions", entry)}
                  onDelete={() =>
                    askDelete("transactions", entry, entry.description)
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    ) : (
      <Empty
        title="Nenhum movimento por aqui"
        text="Registre seu primeiro lançamento ou ajuste os filtros."
        action={() => newRecord("transactions")}
        label="Novo lançamento"
      />
    );
  }
  function goalCard(goal: Goal, index: number) {
    const funded = goalFunded(goal.id, data!.contributions),
      progress = Math.min(100, (funded / goal.target_cents) * 100),
      remaining = Math.max(0, goal.target_cents - funded);
    return (
      <article className="goal-card" key={goal.id}>
        <div className="goal-card-head">
          <span className={`goal-icon goal-color-${index % 3}`}>
            <Target size={22} />
          </span>
          <Actions
            label={goal.name}
            onEdit={() => edit("goals", goal)}
            onDelete={() => askDelete("goals", goal, goal.name)}
          />
        </div>
        <h3>{goal.name}</h3>
        <p className="goal-date">
          Até {formatDate(goal.target_date)}
          {goal.target_date < asOf && remaining > 0 && (
            <span className="badge warning">Prazo vencido</span>
          )}
        </p>
        <div className="goal-amount">
          <strong>{value(funded)}</strong>
          <span>de {value(goal.target_cents)}</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={goal.name}
        >
          <div style={{ width: `${progress}%` }} />
        </div>
        <div className="goal-progress-label">
          <span>{Math.round(progress)}% do caminho</span>
          <span>Faltam {value(remaining)}</span>
        </div>
        <button
          className="button secondary wide"
          onClick={() => newRecord("contributions", { goal_id: goal.id })}
          disabled={remaining === 0}
        >
          <Plus size={16} />
          {remaining === 0 ? "Meta alcançada" : "Reservar um aporte"}
        </button>
      </article>
    );
  }
  return (
    <div className={`app-layout ${hidden ? "privacy-mode" : ""}`}>
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <Compass size={25} />
          </span>
          meu norte<span className="brand-dot">.</span>
        </Link>
        <p className="sidebar-caption">UM PASSO DE CADA VEZ</p>
        <nav aria-label="Navegação principal">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${screen === id ? "active" : ""}`}
              onClick={() => go(id)}
              aria-current={screen === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {screen === id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-message">
            <span className="square-icon">
              <Sparkles size={18} />
            </span>
            <strong>
              Planos pequenos.
              <br />
              Conquistas grandes.
            </strong>
            <p>Seu próximo passo começa aqui.</p>
          </div>
          <button className="profile-button" onClick={() => go("settings")}>
            <span className="avatar">
              {(data.profile.display_name || "V").slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{data.profile.display_name || "Seu espaço"}</strong>
              <small>
                {demo ? "Conta demonstrativa" : "Finanças pessoais"}
              </small>
            </span>
            <SlidersHorizontal size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        {demo && (
          <div className="demo-banner">
            <span>
              <Sparkles size={14} />
              <strong>Demonstração</strong>
              <span className="demo-note">
                Dados fictícios · alterações só nesta sessão
              </span>
            </span>
            <Link href="/entrar">
              Usar minha conta
              <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
        {offline && (
          <div className="offline-banner" role="status">
            <WifiOff size={16} />
            Você está sem conexão. Reconecte para consultar ou salvar sua conta.
          </div>
        )}
        <header className="app-header">
          <div className="mobile-brand">
            <Compass size={22} />
            <strong>meu norte.</strong>
          </div>
          <div className="breadcrumb">
            <span>Meu espaço</span>
            <ChevronRight size={14} />
            <strong>{nav.find((n) => n.id === screen)?.label}</strong>
          </div>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
              onClick={() => setHidden(!hidden)}
            >
              {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
            <span className="header-divider" />
            <button
              className="header-avatar avatar"
              aria-label="Abrir preferências"
              onClick={() => go("settings")}
            >
              {(data.profile.display_name || "V").slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main id="main-content" className="app-main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {screen === "overview"
                  ? `BEM-VINDO${data.profile.display_name ? ", " + data.profile.display_name.toLocaleUpperCase("pt-BR") : ""}`
                  : "SEU ESPAÇO FINANCEIRO"}
              </p>
              <h1>
                {screen === "overview"
                  ? "Seu dinheiro, com direção."
                  : nav.find((n) => n.id === screen)?.label}
              </h1>
              <p>{descriptions[screen]}</p>
            </div>
            <div className="page-heading-actions">
              {["overview", "transactions", "reports"].includes(screen) && (
                <div className="month-control">
                  <button
                    aria-label="Mês anterior"
                    onClick={() =>
                      setMonth(addMonths(`${month}-01`, -1).slice(0, 7))
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <input
                    aria-label="Competência"
                    type="month"
                    value={month}
                    min="2000-01"
                    max="2100-12"
                    onChange={(e) => {
                      if (/^\d{4}-\d{2}$/.test(e.target.value))
                        setMonth(e.target.value);
                    }}
                  />
                  <button
                    aria-label="Próximo mês"
                    onClick={() =>
                      setMonth(addMonths(`${month}-01`, 1).slice(0, 7))
                    }
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
              {screen === "overview" && (
                <button
                  className="button primary"
                  onClick={() => newRecord("transactions")}
                >
                  <Plus size={17} />
                  Novo lançamento
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button className="text-button" onClick={() => void load()}>
                Tentar novamente
              </button>
            </div>
          )}
          {screen === "overview" && (
            <>
              <div className="summary-grid">
                <section className="balance-hero">
                  <div className="hero-top">
                    <span className="hero-label">
                      <Wallet size={18} /> Patrimônio livre para seus planos
                    </span>
                    <span className="hero-chip">Saldo atual</span>
                  </div>
                  <strong className="hero-value">{value(stats.free)}</strong>
                  <p>
                    Patrimônio em dinheiro e aplicações, descontando reservas.
                  </p>
                  <div className="hero-footer">
                    <span>
                      <i /> Metas com recursos reservados{" "}
                      <strong>{value(stats.assigned)}</strong>
                    </span>
                    <button
                      onClick={() => go("accounts")}
                      aria-label="Ver minhas contas"
                    >
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                  <div className="hero-orbit one" />
                  <div className="hero-orbit two" />
                </section>
                <div className="mini-stat-grid">
                  <section className="stat-card">
                    <span className="entry-icon income">
                      <ArrowDownLeft size={19} />
                    </span>
                    <p>Receitas do mês</p>
                    <strong>{value(stats.income)}</strong>
                    <small>Entradas realizadas · sem VA/VR</small>
                  </section>
                  <section className="stat-card">
                    <span className="entry-icon expense">
                      <ArrowUpRight size={19} />
                    </span>
                    <p>Despesas do mês</p>
                    <strong>{value(stats.expense)}</strong>
                    <small>Saídas realizadas · sem VA/VR</small>
                  </section>
                </div>
              </div>
              <div className="overview-metrics">
                <span>
                  <i className="dot accent" />
                  Resultado de {monthLabel(month)}{" "}
                  <strong
                    className={stats.result >= 0 ? "positive" : "negative"}
                  >
                    {value(stats.result)}
                  </strong>
                </span>
                <span>
                  Disponível em contas líquidas{" "}
                  <strong>{value(stats.liquid)}</strong>
                </span>
                <span>
                  VA/VR separado <strong>{value(stats.benefits)}</strong>
                </span>
              </div>
              <div className="two-column">
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <h2>Seu fluxo, em perspectiva</h2>
                      <p>Receitas e despesas · últimos 6 meses</p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Ver relatórios"
                      onClick={() => go("reports")}
                    >
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                  <FinanceChart
                    labels={periods.map((p) => p.label)}
                    primary={periods.map((p) => p.income)}
                    secondary={periods.map((p) => p.expense)}
                  />
                  <p className="chart-note">Valores em reais · {netCaption}</p>
                </section>
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <h2>Para onde foi?</h2>
                      <p>Despesas de {monthLabel(month)}</p>
                    </div>
                    <span className="square-icon subtle">
                      <ArrowUpRight size={19} />
                    </span>
                  </div>
                  {categories.length ? (
                    <div className="category-list">
                      {categories.slice(0, 4).map((c, i) => (
                        <div className="category-row" key={c.name}>
                          <div>
                            <span>
                              <i className={`category-dot cat-${i % 4}`} />
                              {c.name}
                            </span>
                            <strong>{value(c.value)}</strong>
                          </div>
                          <div className="category-track">
                            <span
                              style={{
                                width: `${(c.value / totalCategories) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      <button
                        className="text-button"
                        onClick={() => go("reports")}
                      >
                        Ver todas as categorias
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  ) : (
                    <Empty
                      title="Tudo pronto para começar"
                      text="Suas despesas aparecerão aqui."
                    />
                  )}
                </section>
              </div>
              <div className="section-head standalone">
                <div>
                  <h2>
                    Planos que estão ganhando forma
                    <span className="count-badge">{data.goals.length}</span>
                  </h2>
                  <p>Cada aporte te aproxima de uma conquista.</p>
                </div>
                <button className="text-button" onClick={() => go("goals")}>
                  Todas as metas
                  <ArrowRight size={15} />
                </button>
              </div>
              {data.goals.length ? (
                <div className="goals-grid">
                  {data.goals.slice(0, 3).map(goalCard)}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    icon={Target}
                    title="Qual é seu próximo plano?"
                    text="Crie uma meta e acompanhe cada passo até lá."
                    label="Criar minha primeira meta"
                    action={() => newRecord("goals")}
                  />
                </section>
              )}
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Últimos movimentos</h2>
                    <p>Seu mês em pequenos detalhes.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => go("transactions")}
                  >
                    Ver todos
                    <ArrowRight size={15} />
                  </button>
                </div>
                {entryList(monthlyEntries.slice(0, 5), true)}
              </section>
            </>
          )}
          {screen === "transactions" && (
            <>
              <div className="toolbar">
                <div className="segmented scroll-tabs">
                  {[
                    ["all", "Todos"],
                    ["income", "Receitas"],
                    ["expense", "Despesas"],
                    ["transfer", "Transferências"],
                    ["yield", "Rendimentos"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={kind === id ? "selected" : ""}
                      onClick={() => setKind(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  className="button primary"
                  onClick={() => newRecord("transactions")}
                >
                  <Plus size={17} />
                  Novo lançamento
                </button>
              </div>
              <section className="panel">
                <div className="list-filters">
                  <label className="search-input">
                    <Search size={18} />
                    <input
                      aria-label="Buscar lançamentos"
                      placeholder="Buscar por descrição ou categoria"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <label className="filter-select">
                    <span className="sr-only">Filtrar situação</span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="all">Todas as situações</option>
                      <option value="posted">Realizados</option>
                      <option value="planned">Previstos</option>
                    </select>
                  </label>
                  <button className="button secondary" onClick={downloadCSV}>
                    <Download size={16} />
                    CSV
                  </button>
                </div>
                {entryList(visibleEntries)}
                <div className="list-footer">
                  <span>{visibleEntries.length} lançamentos encontrados</span>
                  <span>Previstos não alteram seu saldo.</span>
                </div>
              </section>
            </>
          )}
          {screen === "accounts" && (
            <>
              <div className="toolbar">
                <p className="muted">
                  Saldo derivado dos movimentos realizados até{" "}
                  {formatDate(asOf)}.
                </p>
                <button
                  className="button primary"
                  onClick={() => newRecord("accounts")}
                >
                  <Plus size={17} />
                  Nova conta
                </button>
              </div>
              {data.accounts.length ? (
                <div className="accounts-grid">
                  {data.accounts.map((a) => {
                    const Icon = accountIcons[a.kind],
                      b = balance(a, data.transactions, asOf),
                      r = reserved(a.id, data.contributions);
                    return (
                      <article className="panel account-card" key={a.id}>
                        <div className="section-head">
                          <span
                            className={`square-icon ${a.kind === "benefit" ? "amber" : ""}`}
                          >
                            <Icon size={22} />
                          </span>
                          <Actions
                            label={a.name}
                            onEdit={() => edit("accounts", a)}
                            onDelete={() => askDelete("accounts", a, a.name)}
                          />
                        </div>
                        <p className="eyebrow">{accountNames[a.kind]}</p>
                        <h2>{a.name}</h2>
                        <strong className="account-balance">{value(b)}</strong>
                        <div className="account-details">
                          <span>
                            Reservado para metas<strong>{value(r)}</strong>
                          </span>
                          <span>
                            {a.kind === "benefit"
                              ? "Uso restrito · VA/VR"
                              : "Livre de reservas"}
                            <strong>{value(b - r)}</strong>
                          </span>
                        </div>
                        <button
                          className="text-button"
                          onClick={() =>
                            newRecord(
                              "transactions",
                              a.kind === "investment"
                                ? { kind: "transfer", target_account_id: a.id }
                                : { kind: "expense", source_account_id: a.id },
                            )
                          }
                        >
                          Registrar movimento
                          <ArrowRight size={16} />
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    title="Seu dinheiro começa aqui"
                    text="Cadastre uma conta com o saldo que você tem hoje."
                    action={() => newRecord("accounts")}
                    label="Criar conta"
                  />
                </section>
              )}
            </>
          )}
          {screen === "goals" && (
            <>
              <div className="toolbar">
                <div className="inline-summary">
                  <span>Total reservado</span>
                  <strong>{value(stats.assigned)}</strong>
                </div>
                <button
                  className="button primary"
                  onClick={() => newRecord("goals")}
                >
                  <Plus size={17} />
                  Nova meta
                </button>
              </div>
              {data.goals.length ? (
                <div className="goals-grid">{data.goals.map(goalCard)}</div>
              ) : (
                <section className="panel">
                  <Empty
                    icon={Target}
                    title="O que você quer conquistar?"
                    text="Uma reserva, uma viagem, um curso. Transforme vontade em plano."
                    action={() => newRecord("goals")}
                    label="Criar meta"
                  />
                </section>
              )}
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Seus aportes</h2>
                    <p>
                      Reservas de dinheiro existente, sem duplicar seu
                      patrimônio.
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => newRecord("contributions")}
                    disabled={!data.goals.length}
                  >
                    <Plus size={16} />
                    Novo aporte
                  </button>
                </div>
                {data.contributions.length ? (
                  <div className="entry-list">
                    {data.contributions.map((c) => (
                      <div className="entry-row" key={c.id}>
                        <span className="entry-icon income">
                          <Target size={18} />
                        </span>
                        <div className="entry-description">
                          <strong>
                            {data.goals.find((g) => g.id === c.goal_id)?.name}
                          </strong>
                          <span>
                            {nameOf(c.account_id)} · {formatDate(c.date)}
                            {c.note && ` · ${c.note}`}
                          </span>
                        </div>
                        <strong className="entry-right">
                          {value(c.amount_cents)}
                        </strong>
                        <Actions
                          label="aporte"
                          onEdit={() => edit("contributions", c)}
                          onDelete={() =>
                            askDelete("contributions", c, "este aporte")
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-inline">
                    Seus aportes aparecerão aqui. Primeiro, crie uma meta e
                    tenha saldo em uma conta.
                  </p>
                )}
              </section>
            </>
          )}
          {screen === "investments" && (
            <>
              <div className="toolbar">
                <p className="muted">
                  Valores realizados e cenários futuros, sempre separados.
                </p>
                <button
                  className="button primary"
                  onClick={() => newRecord("investments")}
                >
                  <Plus size={17} />
                  Configurar investimento
                </button>
              </div>
              <p className="info-box">
                <Info size={18} />
                <span>
                  Crie uma conta do tipo investimento, configure-a abaixo e use
                  transferências para aplicar ou resgatar. Rendimentos são
                  informados manualmente.
                </span>
              </p>
              {data.investments.length ? (
                <div className="investments-grid">
                  {data.investments.map((i) => {
                    const account = data.accounts.find(
                      (a) => a.id === i.account_id,
                    )!;
                    const result = investmentReturn(
                      account,
                      data.transactions,
                      asOf,
                      i.inflation_rate,
                    );
                    const forecast = (() => {
                      try {
                        return project(
                          result.final,
                          0,
                          12,
                          i.annual_rate,
                          i.inflation_rate,
                        ).at(-1)!;
                      } catch {
                        return null;
                      }
                    })();
                    return (
                      <article className="panel investment-card" key={i.id}>
                        <div className="section-head">
                          <span className="square-icon">
                            <TrendingUp size={23} />
                          </span>
                          <Actions
                            label={i.name}
                            onEdit={() => edit("investments", i)}
                            onDelete={() => askDelete("investments", i, i.name)}
                          />
                        </div>
                        <p className="eyebrow">{account.name}</p>
                        <h2>{i.name}</h2>
                        <strong className="account-balance">
                          {value(result.final)}
                        </strong>
                        <span className="badge success">Saldo realizado</span>
                        <div className="investment-results">
                          <div>
                            <span>Ganho realizado</span>
                            <strong
                              className={
                                result.gain >= 0 ? "positive" : "negative"
                              }
                            >
                              {value(result.gain)}
                            </strong>
                          </div>
                          <div>
                            <span>Retorno nominal¹</span>
                            <strong>{percent(result.nominal)}</strong>
                          </div>
                          <div>
                            <span>Retorno real²</span>
                            <strong>{percent(result.real)}</strong>
                          </div>
                        </div>
                        <div className="investment-premises">
                          <span>
                            Projeção{" "}
                            <strong>{percent(i.annual_rate)} a.a.</strong>
                          </span>
                          <span>
                            Inflação assumida{" "}
                            <strong>{percent(i.inflation_rate)} a.a.</strong>
                          </span>
                        </div>
                        <div className="investment-forecast">
                          <span className="eyebrow">
                            CENÁRIO DE 12 MESES · SEM NOVOS APORTES
                          </span>
                          {forecast ? (
                            <>
                              <div>
                                <span>Saldo nominal projetado</span>
                                <strong>{value(forecast.total)}</strong>
                              </div>
                              <div>
                                <span>Valor real (poder de compra)</span>
                                <strong>{value(forecast.real)}</strong>
                              </div>
                            </>
                          ) : (
                            <p>Projeção excede o limite de cálculo.</p>
                          )}
                        </div>
                        <p className="small-note">
                          Desde {formatDate(account.opening_date)} · ¹ Modified
                          Dietz. ² Descontada a inflação assumida proporcional
                          ao período. Sem cotações ou impostos automáticos.
                        </p>
                        <div className="button-row">
                          <button
                            className="button secondary"
                            onClick={() =>
                              newRecord("transactions", {
                                kind: "transfer",
                                target_account_id: account.id,
                              })
                            }
                          >
                            <ArrowLeftRight size={16} />
                            Aplicar / resgatar
                          </button>
                          <button
                            className="button primary"
                            onClick={() =>
                              newRecord("transactions", {
                                kind: "yield",
                                target_account_id: account.id,
                                category: "Rendimentos",
                              })
                            }
                          >
                            Rendimento
                            <Plus size={16} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    icon={TrendingUp}
                    title="Acompanhe seu dinheiro crescendo"
                    text="Cadastre uma conta de investimento e configure suas premissas."
                    action={() => newRecord("accounts", { kind: "investment" })}
                    label="Criar conta de investimento"
                  />
                </section>
              )}
              <section className="callout">
                <span className="square-icon">
                  <Calculator size={23} />
                </span>
                <div>
                  <h3>E se você investisse um pouco todo mês?</h3>
                  <p>Veja cenários com juros compostos e inflação.</p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => go("simulator")}
                >
                  Abrir simulador
                  <ArrowRight size={17} />
                </button>
              </section>
            </>
          )}
          {screen === "recurrences" && (
            <>
              <div className="toolbar">
                <p className="muted">
                  Planeje o que se repete. Confirme quando acontecer.
                </p>
                <button
                  className="button primary"
                  onClick={() => newRecord("recurrences")}
                >
                  <Plus size={17} />
                  Nova recorrência
                </button>
              </div>
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Gerar previsões</h2>
                    <p>Ação idempotente: repetir não duplica lançamentos.</p>
                  </div>
                  <CalendarClock size={22} />
                </div>
                <form className="generate-form" onSubmit={generate}>
                  <label className="form-field">
                    <span>De</span>
                    <input
                      type="date"
                      value={generateFrom}
                      onChange={(e) => setGenerateFrom(e.target.value)}
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span>Até (máximo 12 meses)</span>
                    <input
                      type="date"
                      value={generateUntil}
                      onChange={(e) => setGenerateUntil(e.target.value)}
                      required
                    />
                  </label>
                  <button
                    className="button primary"
                    disabled={
                      generating || !data.recurrences.some((r) => r.active)
                    }
                    type="submit"
                  >
                    <RefreshCw size={16} />
                    {generating ? "Gerando…" : "Gerar previsões"}
                  </button>
                </form>
                <p className="small-note">
                  Mensal no dia 31 usa o último dia dos meses curtos. Alterações
                  em regras valem para novas ocorrências; as já geradas são
                  editadas nos lançamentos.
                </p>
              </section>
              <section className="panel">
                {data.recurrences.length ? (
                  <div className="entry-list">
                    {data.recurrences.map((r) => (
                      <div className="entry-row" key={r.id}>
                        <span className="entry-icon transfer">
                          <CalendarClock size={20} />
                        </span>
                        <div className="entry-description">
                          <strong>
                            {r.description}
                            <span
                              className={`badge ${r.active ? "success" : ""}`}
                            >
                              {r.active ? "Ativa" : "Pausada"}
                            </span>
                          </strong>
                          <span>
                            {frequencyNames[r.frequency]} · desde{" "}
                            {formatDate(r.start_date)} · {entryNames[r.kind]}
                          </span>
                        </div>
                        <strong className="entry-right">
                          {value(r.amount_cents)}
                        </strong>
                        <Actions
                          label={r.description}
                          onEdit={() => edit("recurrences", r)}
                          onDelete={() =>
                            askDelete("recurrences", r, r.description)
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={CalendarClock}
                    title="Sua rotina, organizada"
                    text="Crie regras para salário, aluguel e outras contas recorrentes."
                    action={() => newRecord("recurrences")}
                    label="Criar recorrência"
                  />
                )}
              </section>
            </>
          )}
          {screen === "planning" && (
            <>
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Um plano possível para este mês</h2>
                    <p>Defina uma verba e escolha a ordem das suas metas.</p>
                  </div>
                  <Compass size={24} />
                </div>
                <div className="planning-controls">
                  <label className="form-field">
                    <span>Orçamento mensal para metas (R$)</span>
                    <input
                      inputMode="decimal"
                      value={planBudget}
                      onChange={(e) => setPlanBudget(e.target.value)}
                    />
                  </label>
                  <label className="form-field">
                    <span>Priorizar por</span>
                    <select
                      value={strategy}
                      onChange={(e) =>
                        setStrategy(e.target.value as PlanningStrategy)
                      }
                    >
                      <option value="date">Data alvo mais próxima</option>
                      <option value="term">Menor prazo restante</option>
                      <option value="budget">Prioridade e orçamento</option>
                    </select>
                  </label>
                </div>
                <p className="info-box">
                  <Info size={18} />
                  <span>
                    Esta é uma sugestão para o orçamento informado. As reservas
                    reais exigem saldo em uma conta. O mês atual conta como uma
                    parcela; data e prazo produzem a mesma ordem quando têm a
                    mesma data-base.
                  </span>
                </p>
                {planning.error && (
                  <p role="alert" className="form-error">
                    {planning.error}
                  </p>
                )}
                {planning.data && (
                  <>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Meta</th>
                            <th>Prazo</th>
                            <th>Falta</th>
                            <th>Necessário / mês</th>
                            <th>Sugestão</th>
                            <th>Déficit / mês</th>
                          </tr>
                        </thead>
                        <tbody>
                          {planning.data.rows.map((r) => (
                            <tr key={r.goal.id}>
                              <td>
                                <strong>{r.goal.name}</strong>
                                {r.overdue && (
                                  <span className="badge warning">Vencida</span>
                                )}
                              </td>
                              <td>
                                {r.months} {r.months === 1 ? "mês" : "meses"}
                              </td>
                              <td>{value(r.missing)}</td>
                              <td>{value(r.required)}</td>
                              <td className="positive">{value(r.proposed)}</td>
                              <td className={r.shortfall ? "negative" : ""}>
                                {value(r.shortfall)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="planning-totals">
                      <span>
                        Verba não distribuída
                        <strong>{value(planning.data.remaining)}</strong>
                      </span>
                      <span>
                        Déficit mensal total
                        <strong
                          className={
                            planning.data.shortfall ? "negative" : "positive"
                          }
                        >
                          {value(planning.data.shortfall)}
                        </strong>
                      </span>
                    </div>
                    {!planning.data.rows.length && (
                      <Empty
                        icon={Target}
                        title="Seu plano precisa de um destino"
                        text="Crie metas para distribuir o orçamento entre elas."
                        action={() => newRecord("goals")}
                        label="Criar meta"
                      />
                    )}
                  </>
                )}
              </section>
              <section className="callout">
                <div>
                  <h3>Planejamento é uma direção, não uma cobrança.</h3>
                  <p>
                    Se o orçamento não fechar, ajuste o prazo, o valor ou a
                    prioridade de cada meta.
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => go("goals")}
                >
                  Revisar metas
                  <ArrowRight size={16} />
                </button>
              </section>
            </>
          )}
          {screen === "simulator" && <Simulator />}
          {screen === "reports" && (
            <>
              <div className="report-stats">
                <section className="stat-card">
                  <p>Entradas realizadas</p>
                  <strong>{value(stats.income)}</strong>
                  <small>Benefícios separados</small>
                </section>
                <section className="stat-card">
                  <p>Saídas realizadas</p>
                  <strong>{value(stats.expense)}</strong>
                  <small>Transferências excluídas</small>
                </section>
                <section className="stat-card">
                  <p>Resultado do mês</p>
                  <strong
                    className={stats.result >= 0 ? "positive" : "negative"}
                  >
                    {value(stats.result)}
                  </strong>
                  <small>{monthLabel(month)}</small>
                </section>
              </div>
              <div className="two-column">
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <h2>Evolução do caixa</h2>
                      <p>Receitas e despesas livres de benefícios.</p>
                    </div>
                  </div>
                  <FinanceChart
                    labels={periods.map((p) => p.label)}
                    primary={periods.map((p) => p.income)}
                    secondary={periods.map((p) => p.expense)}
                  />
                </section>
                <section className="panel">
                  <h2>Composição das despesas</h2>
                  <div className="category-list">
                    {categories.map((c, i) => (
                      <div className="category-row" key={c.name}>
                        <div>
                          <span>
                            <i className={`category-dot cat-${i % 4}`} />
                            {c.name}
                          </span>
                          <strong>{value(c.value)}</strong>
                        </div>
                        <div className="category-track">
                          <span
                            style={{
                              width: `${(c.value / totalCategories) * 100}%`,
                            }}
                          />
                        </div>
                        <small>{percent(c.value / totalCategories)}</small>
                      </div>
                    ))}
                    {!categories.length && (
                      <p className="empty-inline">
                        Nenhuma despesa realizada nesta competência.
                      </p>
                    )}
                  </div>
                </section>
              </div>
              <section className="panel">
                <h2>Fechamento por mês</h2>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Competência</th>
                        <th>Receitas</th>
                        <th>Despesas</th>
                        <th>Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((p) => (
                        <tr key={p.key}>
                          <td>{monthLabel(p.key)}</td>
                          <td>{value(p.income)}</td>
                          <td>{value(p.expense)}</td>
                          <td
                            className={p.result >= 0 ? "positive" : "negative"}
                          >
                            {value(p.result)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="small-note">
                  Rendimentos de investimentos são exibidos em Investimentos.
                  Previsto e cancelado não compõem estes totais. Patrimônio
                  atual: {value(stats.assets)} · VA/VR: {value(stats.benefits)}.
                </p>
                <button
                  className="button secondary"
                  onClick={() => {
                    setKind("all");
                    setStatus("all");
                    setSearch("");
                    go("transactions");
                  }}
                >
                  <Download size={16} />
                  Abrir lançamentos para exportar
                </button>
              </section>
            </>
          )}
          {screen === "settings" && preferences && (
            <div className="settings-layout">
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Seu espaço, seu jeito</h2>
                    <p>As cores mudam. O foco nos seus planos continua.</p>
                  </div>
                  <SlidersHorizontal size={23} />
                </div>
                <form
                  className="settings-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSavingPrefs(true);
                    try {
                      if (demo) setData(updateDemoProfile(data, preferences));
                      else {
                        await request("/api/preferences", {
                          method: "PUT",
                          body: JSON.stringify(preferences),
                        });
                        await load();
                      }
                      setToast("Preferências salvas.");
                    } catch (err) {
                      setToast(
                        err instanceof Error
                          ? err.message
                          : "Não foi possível salvar.",
                      );
                    } finally {
                      setSavingPrefs(false);
                    }
                  }}
                >
                  <label className="form-field">
                    <span>Como podemos te chamar?</span>
                    <input
                      value={preferences.display_name}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          display_name: e.target.value,
                        })
                      }
                      maxLength={80}
                    />
                  </label>
                  <fieldset>
                    <legend>Aparência</legend>
                    <div className="theme-options">
                      {(
                        [
                          { id: "light", label: "Claro", icon: Sun },
                          { id: "dark", label: "Escuro", icon: Moon },
                          { id: "system", label: "Sistema", icon: Monitor },
                        ] as const
                      ).map(({ id, label, icon: Icon }) => (
                        <label
                          className={`theme-option ${preferences.theme === id ? "chosen" : ""}`}
                          key={id}
                        >
                          <input
                            type="radio"
                            name="theme"
                            value={id}
                            checked={preferences.theme === id}
                            onChange={() =>
                              setPreferences({ ...preferences, theme: id })
                            }
                          />
                          <Icon size={22} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Sua cor</legend>
                    <div className="color-options">
                      {(
                        [
                          { id: "violet", label: "Violeta" },
                          { id: "emerald", label: "Esmeralda" },
                          { id: "blue", label: "Azul" },
                          { id: "rose", label: "Rosa" },
                        ] as const
                      ).map(({ id, label }) => (
                        <label key={id} className={`color-option ${id}`}>
                          <input
                            type="radio"
                            name="accent"
                            aria-label={label}
                            checked={preferences.accent === id}
                            onChange={() =>
                              setPreferences({ ...preferences, accent: id })
                            }
                          />
                          <span>
                            {preferences.accent === id && <Check size={17} />}
                          </span>
                          <small>{label}</small>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="form-field">
                    <span>Fundo do seu espaço</span>
                    <select
                      value={preferences.background}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          background: e.target.value as Profile["background"],
                        })
                      }
                    >
                      <option value="plain">Liso</option>
                      <option value="gradient">Gradiente suave</option>
                      <option value="dots">Pontos discretos</option>
                    </select>
                  </label>
                  <button
                    className="button primary"
                    disabled={savingPrefs}
                    type="submit"
                  >
                    {savingPrefs ? "Salvando…" : "Salvar preferências"}
                    <Check size={17} />
                  </button>
                </form>
              </section>
              <div className="stack">
                <section className="panel">
                  <span className="square-icon">
                    <Download size={22} />
                  </span>
                  <h2 className="spaced-title">Sempre à mão</h2>
                  <p className="muted">
                    Instale o Meu Norte para abrir direto pela tela inicial.
                  </p>
                  <ol className="install-steps">
                    <li>
                      <strong>iPhone / Safari</strong>Toque em Compartilhar →
                      Adicionar à Tela de Início.
                    </li>
                    <li>
                      <strong>Android / Chrome</strong>Abra o menu ⋮ → Instalar
                      aplicativo.
                    </li>
                  </ol>
                  <p className="small-note">
                    É preciso conexão para consultar e salvar suas finanças.
                    Dados financeiros não são armazenados para uso offline.
                  </p>
                </section>
                <section className="panel">
                  <div className="section-title">
                    <ShieldCheck size={22} />
                    <h2>Seu acesso</h2>
                  </div>
                  <p className="muted">
                    {demo
                      ? "Você está explorando uma demonstração com dados fictícios."
                      : "Seus dados ficam vinculados à sua conta."}
                  </p>
                  {demo ? (
                    <Link href="/entrar" className="button primary wide">
                      Acessar minha conta
                      <ArrowRight size={17} />
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/nova-senha"
                        className="button secondary wide"
                      >
                        Alterar senha
                      </Link>
                      <button
                        className="button ghost wide"
                        onClick={async () => {
                          try {
                            await request("/api/auth", {
                              method: "POST",
                              body: JSON.stringify({ action: "logout" }),
                            });
                            window.location.assign("/entrar");
                          } catch (err) {
                            setToast(
                              err instanceof Error
                                ? err.message
                                : "Não foi possível sair.",
                            );
                          }
                        }}
                      >
                        <LogOut size={16} />
                        Sair da conta
                      </button>
                    </>
                  )}
                </section>
              </div>
            </div>
          )}
          <footer className="app-footer">
            <span>
              <Compass size={14} /> Meu Norte · Seu dinheiro, seus caminhos.
            </span>
            <span>BRL · Valores realizados até {formatDate(asOf)}</span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Navegação mobile">
        {nav
          .filter((n) => ["overview", "transactions", "goals"].includes(n.id))
          .map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={screen === id ? "active" : ""}
              onClick={() => go(id)}
              aria-current={screen === id ? "page" : undefined}
            >
              <Icon size={21} />
              <span>{label === "Visão geral" ? "Início" : label}</span>
            </button>
          ))}
        <button
          className={menu ? "active" : ""}
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
        >
          <Menu size={22} />
          <span>Mais</span>
        </button>
      </nav>
      {menu && (
        <div className="mobile-menu-backdrop" onClick={() => setMenu(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="section-head">
              <h2>Seu espaço</h2>
              <button
                className="icon-button"
                onClick={() => setMenu(false)}
                aria-label="Fechar menu"
              >
                <X size={21} />
              </button>
            </div>
            <nav>
              {nav.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`nav-item ${screen === id ? "active" : ""}`}
                  onClick={() => go(id)}
                >
                  <Icon size={20} />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}
      {form && (
        <RecordForm
          key={`${form.entity}-${form.record?.id ?? "new"}`}
          state={form}
          data={data}
          onClose={() => setForm(null)}
          onSubmit={save}
        />
      )}
      {remove && (
        <ConfirmDialog
          label={remove.label}
          onClose={() => setRemove(null)}
          onConfirm={deleteRecord}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Info size={18} />
          <span>{toast}</span>
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label="Fechar aviso"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {loading && data && !demo && (
        <div className="refresh-indicator" role="status">
          <RefreshCw size={15} />
          Atualizando…
        </div>
      )}
    </div>
  );
}
