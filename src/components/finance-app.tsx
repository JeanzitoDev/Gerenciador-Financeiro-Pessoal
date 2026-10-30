"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Compass,
  FileChartColumn,
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
  syncDemo,
  payLoanDemo,
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
  accountOverdraft,
  balance,
  overview,
  goalFunded,
  reserved,
  expenseCategories,
  planGoals,
  type PlanningStrategy,
} from "@/lib/finance/engine";
import { exportEntries } from "@/lib/finance/csv";
import RecordForm, { type FormState } from "./record-form";
import FinanceChart from "./charts";
import Simulator from "./simulator";
import GettingStarted from "./getting-started";
import { goalBlockers } from "@/lib/finance/goal-dependencies";
import ConfirmDialog from "./confirm-dialog";
import BrandMark from "./brand-mark";
import PendingRecurrences from "./pending-recurrences";
import LoansSection, { type LoanPayment } from "./loans-section";
import DeleteAccount from "./delete-account";
import MobileSheet from "./mobile-sheet";
import { MonthControl } from "./date-control";
import { APP_VERSION } from "@/lib/version";
import MoneyInput from "./money-input";
import SelectControl from "./select-control";
import PiggyBankBoard from "./piggy-bank-board";
import { entryStatusLabel, isPaidEarly } from "@/lib/finance/entry-status";
import { buildMonthlyReport } from "@/lib/finance/reports";
type Screen =
  | "overview"
  | "transactions"
  | "accounts"
  | "goals"
  | "loans"
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
  { id: "loans", label: "Empréstimos e financiamentos", icon: Landmark },
  { id: "recurrences", label: "Recorrências", icon: CalendarClock },
  { id: "planning", label: "Planejamento", icon: Compass },
  { id: "simulator", label: "Cabe no meu bolso?", icon: Calculator },
  { id: "reports", label: "Relatórios", icon: FileChartColumn },
];
const screenLabel = (screen: Screen) =>
  screen === "settings"
    ? "Preferências"
    : nav.find((n) => n.id === screen)?.label;

function MenuCredits() {
  return (
    <div className="menu-credits">
      <span>Meu Norte · v{APP_VERSION}</span>
      <span>
        © {new Date().getFullYear()}{" "}
        <a
          href="https://github.com/JeanzitoDev"
          target="_blank"
          rel="noopener noreferrer"
        >
          JeanzitoDev
        </a>
      </span>
    </div>
  );
}
const descriptions: Record<Screen, string> = {
  overview: "Um olhar tranquilo para sua vida financeira.",
  transactions: "Cada movimento conta para o seu próximo passo.",
  accounts: "Seu dinheiro, em cada lugar.",
  goals: "Dê um destino aos seus planos.",
  recurrences: "O app lembra. Você só confirma.",
  loans: "Veja o que já pagou e o que falta.",
  planning: "Escolha o que vem primeiro.",
  simulator: "Veja como sua próxima conquista cabe no seu momento.",
  reports: "Transforme seus movimentos em clareza.",
  settings: "Deixe seu espaço com a sua cara.",
};
const accountNames = {
  checking: "Conta corrente",
  cash: "Dinheiro",
  benefit: "Benefício",
  investment: "Dinheiro guardado",
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
      demo ? syncDemo(demoData()) : null,
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
  const [planBudget, setPlanBudget] = useState("0,00"),
    [strategy, setStrategy] = useState<PlanningStrategy>("date");
  const [profileMenu, setProfileMenu] = useState(false),
    [deletingAccount, setDeletingAccount] = useState(false),
    [accountFilter, setAccountFilter] = useState("");
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [reportHorizon, setReportHorizon] = useState<6 | 12>(6);
  const [reportAccount, setReportAccount] = useState("");
  const [reportTarget, setReportTarget] = useState<
    "categories" | "flow" | null
  >(null);
  const categoriesRef = useRef<HTMLElement>(null);
  const flowRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (screen !== "reports" || !reportTarget) return;
    const target =
      reportTarget === "categories" ? categoriesRef.current : flowRef.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
    setReportTarget(null);
  }, [screen, reportTarget]);
  const [preferenceDraft, setPreferenceDraft] = useState<{
      userId: string;
      changes: Partial<Omit<Profile, "user_id">>;
    } | null>(null),
    [savingPrefs, setSavingPrefs] = useState(false);
  const preferences = data
    ? {
        ...data.profile,
        ...(preferenceDraft?.userId === data.profile.user_id
          ? preferenceDraft.changes
          : {}),
      }
    : null;
  function changePreferences(changes: Partial<Omit<Profile, "user_id">>) {
    if (!data) return;
    setPreferenceDraft((current) => ({
      userId: data.profile.user_id,
      changes: {
        ...(current?.userId === data.profile.user_id ? current.changes : {}),
        ...changes,
      },
    }));
  }
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
  const load = useCallback(
    async ({ background = false } = {}) => {
      try {
        if (!background) setLoading(true);
        let syncError = "";
        try {
          await request("/api/recurrences/sync", {
            method: "POST",
            body: "{}",
          });
        } catch {
          syncError =
            "Seus dados foram carregados, mas não foi possível atualizar os agendamentos. Tente atualizar novamente.";
        }
        const result = await request("/api/data");
        setData(result);
        setError(syncError);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível carregar.",
        );
      } finally {
        if (!background) setLoading(false);
      }
    },
    [request],
  );
  useEffect(() => {
    if (!demo) void load();
  }, [demo, load]);
  useEffect(() => {
    if (demo) return;
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        !form &&
        !remove &&
        !savingPrefs &&
        !savingOnboarding
      )
        void load({ background: true });
    };
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [demo, load, form, remove, savingPrefs, savingOnboarding]);
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
  // Financial refreshes must preserve the appearance being previewed locally.
  const activePrefs = preferences;
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
    document.title = `${screenLabel(screen)} · Meu Norte`;
  }, [screen]);
  function go(next: Screen) {
    setScreen(next);
    setMenu(false);
    setProfileMenu(false);
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
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
      setData(syncDemo(mutateDemo(data!, entity, method, payload)));
    } else {
      await request(`/api/records/${entity}`, {
        method,
        body: JSON.stringify(payload),
      });
      if (entity === "transactions" && method === "PUT")
        setData((current) =>
          current
            ? {
                ...current,
                transactions: current.transactions.map((entry) =>
                  entry.id === payload.id
                    ? ({ ...entry, ...payload } as Entry)
                    : entry,
                ),
              }
            : current,
        );
      await load();
    }
    if (
      entity === "contributions" &&
      method === "POST" &&
      form?.preset?.from_planning
    ) {
      setPlanBudget((current) =>
        moneyInput(
          Math.max(0, parseMoney(current) - Number(payload.amount_cents)),
        ),
      );
    }
    if (
      entity === "transactions" &&
      payload.status === "posted" &&
      typeof payload.date === "string"
    ) {
      setMonth(payload.date.slice(0, 7));
      if (status === "planned") setStatus("all");
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
            (!accountFilter ||
              e.source_account_id === accountFilter ||
              e.target_account_id === accountFilter) &&
            (kind === "all" || e.kind === kind) &&
            (status === "all" || e.status === status) &&
            `${e.description} ${e.category}`
              .toLocaleLowerCase("pt-BR")
              .includes(search.toLocaleLowerCase("pt-BR")),
        )
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            (b.created_at ?? "").localeCompare(a.created_at ?? "") ||
            b.id.localeCompare(a.id),
        ) ?? [],
    [data, month, kind, status, search, accountFilter],
  );
  if (!data)
    return (
      <main className="loading-page">
        <span className="brand-symbol">
          <BrandMark size={48} />
        </span>
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
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.created_at ?? "").localeCompare(a.created_at ?? "") ||
        b.id.localeCompare(a.id),
    );
  const report = buildMonthlyReport(data, month, asOf, {
    horizon: reportHorizon,
    accountId: reportAccount,
  });
  const reportPeriodKeys = new Set(report.periods.map((p) => p.key));
  const reportPeriodEntries = data.transactions
    .filter(
      (e) =>
        e.status !== "cancelled" &&
        reportPeriodKeys.has(e.date.slice(0, 7)) &&
        (!reportAccount ||
          e.source_account_id === reportAccount ||
          e.target_account_id === reportAccount),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.created_at ?? "").localeCompare(a.created_at ?? "") ||
        b.id.localeCompare(a.id),
    );
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
  const availableAccounts = data.accounts
    .filter((a) => a.kind !== "benefit")
    .map((a) => ({
      account: a,
      available: Math.max(
        0,
        balance(a, data.transactions, asOf) -
          reserved(a.id, data.contributions),
      ),
    }))
    .sort((a, b) => b.available - a.available);
  const onboardingStep = data.profile.onboarding_dismissed
    ? 4
    : data.profile.onboarding_step === 4 &&
        !data.profile.onboarding_completed_at
      ? 0
      : (data.profile.onboarding_step ?? 0);
  function downloadCSV(entries: Entry[] = visibleEntries) {
    const blob = new Blob([exportEntries(entries, data!.accounts)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `lancamentos-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function confirmOccurrence(
    entry: Entry,
    action: "confirm" | "skip",
    date?: string,
    amount?: number,
  ) {
    if (demo) {
      const next = structuredClone(data!);
      const row = next.transactions.find((e) => e.id === entry.id)!;
      if (row.status === "planned") {
        row.status = action === "skip" ? "cancelled" : "posted";
        if (action === "confirm") row.date = date ?? today();
        if (amount !== undefined) row.amount_cents = amount;
      }
      const { validateDemo } = await import("@/lib/demo");
      validateDemo(next);
      setData(next);
    } else {
      await request("/api/recurrences/confirm", {
        method: "POST",
        body: JSON.stringify({
          id: entry.id,
          action,
          date,
          amount_cents: amount,
        }),
      });
      await load();
    }
    if (action === "confirm") {
      setMonth((date ?? today()).slice(0, 7));
      if (status === "planned") setStatus("all");
    }
    setToast(
      action === "skip"
        ? "Este mês foi pulado. A recorrência continua ativa."
        : "Pronto! O saldo foi atualizado.",
    );
  }
  async function payLoan(payment: LoanPayment) {
    if (demo)
      setData(
        payLoanDemo(
          data!,
          payment.id,
          payment.number,
          payment.account_id,
          payment.date,
          payment.amount_cents,
        ),
      );
    else {
      await request("/api/loans/pay", {
        method: "POST",
        body: JSON.stringify(payment),
      });
      await load();
    }
    setToast("Parcela paga e registrada nos Lançamentos.");
  }
  async function setOnboarding(step: number, dismissed = false) {
    setSavingOnboarding(true);
    try {
      const result = demo
        ? {
            completed_at:
              step === 4 && !dismissed ? new Date().toISOString() : null,
          }
        : await request("/api/onboarding", {
            method: "PUT",
            body: JSON.stringify({ step, dismissed }),
          });
      setData((current) =>
        current
          ? {
              ...current,
              profile: {
                ...current.profile,
                onboarding_step: step,
                onboarding_dismissed: dismissed,
                onboarding_completed_at: result.completed_at,
              },
            }
          : current,
      );
      if (step === 0 && !dismissed) go("overview");
    } catch (e) {
      setToast(
        e instanceof Error ? e.message : "Não foi possível salvar a etapa.",
      );
    } finally {
      setSavingOnboarding(false);
    }
  }
  async function logout() {
    try {
      await request("/api/auth", {
        method: "POST",
        body: JSON.stringify({ action: "logout" }),
      });
      window.location.assign("/entrar");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Não foi possível sair.");
    }
  }
  const pending = data.transactions
    .filter((e) => e.recurrence_id && e.status === "planned" && e.date <= asOf)
    .sort((a, b) => a.date.localeCompare(b.date));
  const dependencies = remove
    ? (() => {
        const links: { label: string; onClick: () => void }[] = [];
        const id = remove.id;
        if (remove.entity === "accounts") {
          if (
            data.transactions.some(
              (e) => e.source_account_id === id || e.target_account_id === id,
            )
          )
            links.push({
              label: "Lançamentos desta conta",
              onClick: () => {
                setAccountFilter(id);
                setKind("all");
                setStatus("all");
                setSearch("");
                setMonth(
                  data.transactions
                    .filter(
                      (e) =>
                        e.source_account_id === id ||
                        e.target_account_id === id,
                    )
                    .sort((a, b) => b.date.localeCompare(a.date))[0]
                    .date.slice(0, 7),
                );
                go("transactions");
              },
            });
          if (data.contributions.some((c) => c.account_id === id))
            links.push({
              label: "Aportes vinculados às metas",
              onClick: () => go("goals"),
            });
          if (
            data.recurrences.some(
              (r) => r.source_account_id === id || r.target_account_id === id,
            )
          )
            links.push({
              label: "Recorrências desta conta",
              onClick: () => go("recurrences"),
            });
          if (data.loans?.some((l) => l.account_id === id))
            links.push({
              label: "Contratos vinculados à conta",
              onClick: () => go("loans"),
            });
        }
        if (
          remove.entity === "loans" &&
          data.transactions.some((e) => e.loan_id === id)
        )
          links.push({
            label: "Pagamentos do contrato nos Lançamentos",
            onClick: () => {
              setSearch(data.loans?.find((l) => l.id === id)?.name ?? "");
              setKind("expense");
              setAccountFilter("");
              setStatus("all");
              go("transactions");
            },
          });
        if (
          remove.entity === "goals" &&
          data.contributions.some((c) => c.goal_id === id)
        )
          links.push({
            label: "Aportes desta meta",
            onClick: () => go("goals"),
          });
        if (
          remove.entity === "goals" &&
          data.goals.some((g) => g.dependencies?.some((d) => d.goal_id === id))
        )
          links.push({
            label: "Metas que dependem desta",
            onClick: () => go("goals"),
          });
        return links;
      })()
    : [];
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
                  <span
                    className={
                      entry.status === "posted" ? "entry-confirmed" : undefined
                    }
                  >
                    {entryStatusLabel(entry)}
                  </span>
                  {" · "}
                  {formatDate(entry.date).slice(0, 5)}
                </span>
                {isPaidEarly(entry) && (
                  <small className="entry-due">
                    Vencia em {formatDate(entry.occurrence_date!)}
                  </small>
                )}
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
    const blockers = goalBlockers(goal, data!.goals, data!.contributions);
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
        {goal.completed ? (
          <span className="badge success">Concluída</span>
        ) : blockers.length > 0 ? (
          <div className="goal-waiting">
            <span className="badge warning">Um passo antes</span>
            {blockers.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
          </div>
        ) : goal.dependencies?.length ? (
          <span className="badge success">Condições atendidas</span>
        ) : null}
        <p className="goal-date">
          Até {formatDate(goal.target_date)}
          {!goal.completed && goal.target_date < asOf && remaining > 0 && (
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
          <span>
            {goal.completed
              ? "Objetivo concluído"
              : `${Math.round(progress)}% do caminho`}
          </span>
          <span>
            {goal.completed
              ? `Reservado ${value(funded)}`
              : `Faltam ${value(remaining)}`}
          </span>
        </div>
        <button
          className="button secondary wide"
          onClick={() => newRecord("contributions", { goal_id: goal.id })}
          disabled={remaining === 0 || goal.completed}
        >
          <Plus size={16} />
          {goal.completed
            ? "Meta concluída"
            : remaining === 0
              ? "Meta alcançada"
              : blockers.length
                ? "Reservar mesmo assim"
                : "Reservar um aporte"}
        </button>
        {screen === "goals" && !goal.completed && (
          <PiggyBankBoard
            goal={goal}
            contributions={data!.contributions}
            accounts={availableAccounts.map((x) => x.account)}
            onReserve={(payload) => save("contributions", "POST", payload)}
          />
        )}
      </article>
    );
  }
  return (
    <div className={`app-layout ${hidden ? "privacy-mode" : ""}`}>
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <button
          type="button"
          onClick={() => go("overview")}
          className="brand brand-home"
          aria-label="Meu Norte: visão geral"
        >
          <span className="brand-symbol">
            <BrandMark size={36} />
          </span>
          meu norte<span className="brand-dot">.</span>
        </button>
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
        <MenuCredits />
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
            <BrandMark size={29} />
            <strong>meu norte.</strong>
          </div>
          <div
            className="header-actions"
            onKeyDown={(e) => {
              if (e.key === "Escape") setProfileMenu(false);
            }}
          >
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
              aria-label="Abrir minha conta"
              aria-expanded={profileMenu}
              onClick={() => setProfileMenu(!profileMenu)}
            >
              {(data.profile.display_name || "V").slice(0, 1).toUpperCase()}
            </button>
            {profileMenu && (
              <>
                <button
                  className="profile-dismiss"
                  aria-label="Fechar menu da conta"
                  onClick={() => setProfileMenu(false)}
                />
                <div className="profile-popover" aria-label="Minha conta">
                  <strong>{data.profile.display_name || "Minha conta"}</strong>
                  <small>{data.email || "Demonstração"}</small>
                  <button
                    className="text-button"
                    onClick={() => go("settings")}
                  >
                    Perfil e preferências
                  </button>
                  <Link href="/privacidade">Privacidade dos dados</Link>
                  {!demo && (
                    <>
                      <Link href="/nova-senha">Alterar senha</Link>
                      <button
                        className="text-button"
                        onClick={() => void logout()}
                      >
                        Sair da conta
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </header>
        <main key={screen} id="main-content" className="app-main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <h1>
                {screen === "overview"
                  ? data.profile.display_name
                    ? `Olá, ${data.profile.display_name.split(" ")[0]}!`
                    : "Seu dinheiro, com direção."
                  : screenLabel(screen)}
              </h1>
              <p>{descriptions[screen]}</p>
            </div>
            <div className="page-heading-actions">
              {["overview", "transactions", "reports"].includes(screen) && (
                <MonthControl value={month} onChange={setMonth} />
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
              <GettingStarted
                step={onboardingStep}
                busy={savingOnboarding}
                hasAccounts={data.accounts.length > 0}
                onStep={(step) => void setOnboarding(step)}
                onDismiss={() => void setOnboarding(onboardingStep, true)}
                onAction={() => {
                  const step = onboardingStep;
                  if (step === 0) {
                    newRecord("accounts");
                  } else if (step === 1) {
                    newRecord("recurrences");
                  } else if (step === 2) {
                    newRecord("loans");
                  } else go("transactions");
                }}
              />
              <div className="summary-grid">
                <section className="balance-hero">
                  <div className="hero-top">
                    <span className="hero-label">
                      <Wallet size={18} /> Dinheiro livre para seus planos
                    </span>
                    <span className="hero-chip">Saldo atual</span>
                  </div>
                  <strong className="hero-value">{value(stats.free)}</strong>
                  <p>
                    Seu saldo nas contas, descontando o reservado para metas.
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
                {stats.overdraftLimit > 0 && (
                  <span>
                    {stats.overdraftUsed > 0 ? (
                      <>
                        Cheque especial em uso{" "}
                        <strong className="negative">
                          {value(stats.overdraftUsed)}
                        </strong>{" "}
                        (restam {value(stats.overdraftAvailable)})
                      </>
                    ) : (
                      <>
                        Cheque especial disponível{" "}
                        <strong>{value(stats.overdraftAvailable)}</strong>
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="two-column">
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <h2>Seu fluxo, em perspectiva</h2>
                      <p>Receitas e despesas · últimos 6 meses</p>
                    </div>
                    <button
                      className="panel-link"
                      aria-label="Ver relatórios"
                      onClick={() => {
                        go("reports");
                        setReportTarget("flow");
                      }}
                    >
                      <span>Ver fluxo</span>
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                  <FinanceChart
                    hideValues={hidden}
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
                    <button
                      className="panel-link"
                      aria-label="Ver todas as categorias"
                      onClick={() => {
                        go("reports");
                        setReportTarget("categories");
                      }}
                    >
                      <span>Ver categorias</span>
                      <ArrowUpRight size={19} />
                    </button>
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
              <PendingRecurrences
                entries={pending}
                onAction={confirmOccurrence}
                hidden={hidden}
              />
              {accountFilter && (
                <div className="info-box">
                  Mostrando movimentos de {nameOf(accountFilter)}.
                  <button
                    className="text-button"
                    onClick={() => setAccountFilter("")}
                  >
                    Mostrar todas as contas
                  </button>
                </div>
              )}
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
                  <div className="filter-select">
                    <SelectControl
                      label="Filtrar situação"
                      allowEmpty={false}
                      value={status}
                      onChange={setStatus}
                      options={[
                        ["all", "Todas as situações"],
                        ["posted", "Realizados"],
                        ["planned", "A pagar e a receber"],
                      ]}
                    />
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => downloadCSV()}
                  >
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
                  Saldo atualizado com os movimentos confirmados até{" "}
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
                      r = reserved(a.id, data.contributions),
                      od = accountOverdraft(a, b, r);
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
                        <strong
                          className={`account-balance ${b < 0 ? "negative" : ""}`}
                        >
                          {value(b)}
                        </strong>
                        <div className="account-details">
                          <span>
                            Reservado para metas<strong>{value(r)}</strong>
                          </span>
                          <span>
                            {a.kind === "benefit"
                              ? "Uso restrito · VA/VR"
                              : "Livre de reservas"}
                            <strong className={b - r < 0 ? "negative" : ""}>
                              {value(b - r)}
                            </strong>
                          </span>
                        </div>
                        {od.hasOverdraft && (
                          <div
                            className={`overdraft-box ${od.usedCents > 0 ? "active" : ""}`}
                          >
                            <div className="overdraft-head">
                              <span>
                                {od.usedCents > 0
                                  ? "Em uso do cheque especial"
                                  : "Cheque especial contratado"}
                              </span>
                              <strong>
                                {od.usedCents > 0
                                  ? `${Math.round(od.usageRatio * 100)}% usado`
                                  : "100% livre"}
                              </strong>
                            </div>
                            <div
                              className="overdraft-track"
                              aria-label="Consumo do cheque especial"
                            >
                              <span
                                style={{ width: `${od.usageRatio * 100}%` }}
                              />
                            </div>
                            <div className="overdraft-metrics">
                              <span>
                                Limite do cheque especial
                                <strong>{value(od.limitCents)}</strong>
                              </span>
                              <span>
                                Comprometido do limite
                                <strong
                                  className={od.usedCents > 0 ? "negative" : ""}
                                >
                                  {value(od.usedCents)}
                                </strong>
                              </span>
                              <span>
                                Limite disponível
                                <strong>{value(od.remainingCents)}</strong>
                              </span>
                            </div>
                            {od.usedCents > 0 && (
                              <small className="overdraft-note">
                                Novas entradas compensam o limite até a conta
                                chegar no zero novamente.
                              </small>
                            )}
                          </div>
                        )}
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
                <div className="button-row">
                  <button
                    className="button secondary"
                    onClick={() =>
                      newRecord("goals", {
                        goal_model: "piggy",
                        target_cents: 12525000,
                        target_date: addMonths(asOf, 12),
                      })
                    }
                  >
                    <Sparkles size={16} />
                    Cofrinho 1 a 500
                  </button>
                  <button
                    className="button primary"
                    onClick={() => newRecord("goals")}
                  >
                    <Plus size={17} />
                    Nova meta
                  </button>
                </div>
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
                      Dinheiro separado para suas metas, dentro do seu
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
          {screen === "loans" && (
            <LoansSection
              data={data}
              hidden={hidden}
              onNew={() => newRecord("loans")}
              onEdit={(l) => edit("loans", l)}
              onDelete={(l) => askDelete("loans", l, l.name)}
              onPay={payLoan}
            />
          )}
          {screen === "recurrences" && (
            <>
              <div className="toolbar">
                <p className="muted">
                  Cadastre uma vez. As próximas datas aparecem sozinhas nos
                  Lançamentos.
                </p>
                <button
                  className="button primary"
                  onClick={() => newRecord("recurrences")}
                >
                  <Plus size={17} />
                  Nova recorrência
                </button>
              </div>
              <section className="panel recurrence-explainer">
                <CalendarClock size={23} />
                <div>
                  <h2>Seu mês, sem repetir trabalho</h2>
                  <p>
                    Por padrão, você confirma com “Recebi” ou “Paguei”. Use
                    “Pular” para férias ou mudanças naquele mês. O registro
                    automático é opcional e começa na data em que você o ativa.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => go("transactions")}
                  >
                    Ir para confirmar{" "}
                    {pending.length ? "(" + pending.length + ")" : ""}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </section>
              <div className="stack">
                {data.recurrences.map((r) => (
                  <article className="panel recurrence-card" key={r.id}>
                    <span className="square-icon">
                      <CalendarClock size={20} />
                    </span>
                    <div className="recurrence-info">
                      <h3>{r.description}</h3>
                      <p>
                        {frequencyNames[r.frequency]} · desde{" "}
                        {formatDate(r.start_date)} · {entryNames[r.kind]} ·{" "}
                        {nameOf(r.source_account_id || r.target_account_id)}
                      </p>
                      <small>
                        {r.auto_post
                          ? "Registro automático a partir de " +
                            formatDate(r.auto_from ?? asOf)
                          : "Você confirma quando acontecer"}
                      </small>
                    </div>
                    <strong>{value(r.amount_cents)}</strong>
                    <div className="row-actions">
                      <button
                        role="switch"
                        aria-checked={r.active}
                        aria-label={`Ativar ou pausar ${r.description}`}
                        className={`toggle-switch ${r.active ? "on" : ""}`}
                        onClick={async () => {
                          try {
                            await save("recurrences", "PUT", {
                              ...r,
                              active: !r.active,
                            });
                          } catch (e) {
                            setToast(
                              e instanceof Error
                                ? e.message
                                : "Não foi possível alterar.",
                            );
                          }
                        }}
                      >
                        <span />
                        <small>{r.active ? "Ativa" : "Pausada"}</small>
                      </button>
                      <Actions
                        label={r.description}
                        onEdit={() => edit("recurrences", r)}
                        onDelete={() =>
                          askDelete("recurrences", r, r.description)
                        }
                      />
                    </div>
                  </article>
                ))}
              </div>
              {!data.recurrences.length && (
                <section className="panel">
                  <Empty
                    icon={CalendarClock}
                    title="O que se repete no seu mês?"
                    text="Salário, aluguel, internet. Cadastre uma vez e confirme com um toque."
                    action={() => newRecord("recurrences")}
                    label="Criar recorrência"
                  />
                </section>
              )}
            </>
          )}
          {screen === "planning" && (
            <>
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Onde colocar meu próximo dinheiro?</h2>
                    <p>
                      Escolha um valor, veja o que vem primeiro e reserve para
                      suas metas.
                    </p>
                  </div>
                  <Compass size={24} />
                </div>
                <div className="planning-controls">
                  <label className="form-field">
                    <span>Quanto ainda quero separar neste mês? (R$)</span>
                    <MoneyInput
                      value={planBudget}
                      onValueChange={setPlanBudget}
                    />
                  </label>
                  <div className="form-field">
                    <span>Priorizar por</span>
                    <SelectControl
                      label="Priorizar por"
                      allowEmpty={false}
                      value={strategy}
                      onChange={(v) => setStrategy(v as PlanningStrategy)}
                      options={[
                        ["date", "Meta com a data mais próxima"],
                        ["term", "Meta com menos tempo restante"],
                        ["budget", "Minha prioridade e limite mensal"],
                      ]}
                    />
                  </div>
                </div>
                <div className="planning-available">
                  <p>
                    Dinheiro livre hoje <strong>{value(stats.free)}</strong>
                  </p>
                  <button
                    className="button secondary"
                    onClick={() =>
                      setPlanBudget(moneyInput(Math.max(0, stats.free)))
                    }
                  >
                    Usar saldo livre
                  </button>
                </div>
                <p className="info-box">
                  <Info size={18} />
                  <span>
                    O saldo livre ainda pode ser necessário para suas próximas
                    contas. Escolha quanto pode guardar sem apertar o mês. Você
                    revisa cada aporte antes de salvar; ao reservar por aqui,
                    esse valor sai do orçamento deste plano.
                  </span>
                </p>
                {planning.error && (
                  <p role="alert" className="form-error">
                    {planning.error}
                  </p>
                )}
                {planning.data && (
                  <>
                    <div className="planning-actions">
                      {planning.data.rows.map((r) => {
                        const source = availableAccounts[0];
                        const amount = Math.min(
                          r.proposed,
                          source?.available ?? 0,
                        );
                        return (
                          <article
                            className="planning-action"
                            key={r.goal.id}
                            aria-label={`Plano para ${r.goal.name}`}
                          >
                            <div className="section-head">
                              <h3>{r.goal.name}</h3>
                              <span
                                className={`badge ${r.blockers.length ? "warning" : r.missing === 0 ? "success" : ""}`}
                              >
                                {r.blockers.length
                                  ? "Antes, cuide das condições"
                                  : r.missing === 0
                                    ? "Tudo reservado"
                                    : "Próximo passo"}
                              </span>
                            </div>
                            {r.blockers.length ? (
                              <>
                                <p>Esta meta espera:</p>
                                <ul>
                                  {r.blockers.map((reason) => (
                                    <li key={reason}>{reason}</li>
                                  ))}
                                </ul>
                                <button
                                  className="button secondary"
                                  onClick={() => edit("goals", r.goal)}
                                >
                                  Revisar condições de {r.goal.name}
                                </button>
                              </>
                            ) : r.missing === 0 ? (
                              <p>
                                {r.goal.completed
                                  ? "Você marcou esta meta como concluída."
                                  : "O valor da meta já está reservado."}
                              </p>
                            ) : (
                              <>
                                <p>
                                  Sugestão para agora{" "}
                                  <strong className="planning-amount">
                                    {value(r.proposed)}
                                  </strong>
                                </p>
                                <p>
                                  Para chegar no prazo: {value(r.required)} por
                                  mês.{" "}
                                  {r.overdue
                                    ? "A data passou; vale revisar seu prazo."
                                    : `Faltam ${value(r.missing)} para esta meta.`}
                                </p>
                                {r.proposed === 0 && (
                                  <p className="small-note">
                                    Informe um valor para o plano ou ajuste a
                                    prioridade desta meta.
                                  </p>
                                )}
                                {r.proposed > 0 && amount === 0 && (
                                  <p className="small-note">
                                    Não há saldo livre em uma conta para
                                    reservar agora. Confira seus saldos em
                                    Minhas contas.
                                  </p>
                                )}
                                {amount > 0 && amount < r.proposed && (
                                  <p className="small-note">
                                    Vamos começar com {value(amount)},
                                    disponível em {source.account.name}. O
                                    restante pode vir de outra conta.
                                  </p>
                                )}
                                <button
                                  className="button primary"
                                  disabled={amount <= 0}
                                  aria-label={`Revisar e reservar para ${r.goal.name}`}
                                  onClick={() =>
                                    newRecord("contributions", {
                                      goal_id: r.goal.id,
                                      account_id: source.account.id,
                                      amount_cents: amount,
                                      date: today(),
                                      from_planning: true,
                                    })
                                  }
                                >
                                  Revisar e reservar <ArrowRight size={16} />
                                </button>
                              </>
                            )}
                          </article>
                        );
                      })}
                    </div>
                    <details className="planning-details">
                      <summary>Ver as contas do plano</summary>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Meta</th>
                              <th>Prazo</th>
                              <th>Falta</th>
                              <th>Precisa por mês</th>
                              <th>Sugestão</th>
                              <th>Falta por mês</th>
                            </tr>
                          </thead>
                          <tbody>
                            {planning.data.rows.map((r) => (
                              <tr key={r.goal.id}>
                                <td>
                                  <strong>{r.goal.name}</strong>
                                  {r.goal.completed && (
                                    <span className="badge success">
                                      Concluída
                                    </span>
                                  )}
                                  {r.blockers.length > 0 && (
                                    <div className="goal-waiting">
                                      <span className="badge warning">
                                        Aguardando condições
                                      </span>
                                      {r.blockers.map((reason) => (
                                        <p key={reason}>{reason}</p>
                                      ))}
                                    </div>
                                  )}
                                  {r.overdue && (
                                    <span className="badge warning">
                                      Vencida
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {r.months} {r.months === 1 ? "mês" : "meses"}
                                </td>
                                <td>{value(r.missing)}</td>
                                <td>{value(r.required)}</td>
                                <td className="positive">
                                  {value(r.proposed)}
                                </td>
                                <td className={r.shortfall ? "negative" : ""}>
                                  {value(r.shortfall)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                    <div className="planning-totals">
                      <span>
                        Ainda sem destino neste plano
                        <strong>{value(planning.data.remaining)}</strong>
                      </span>
                      <span>
                        Falta por mês nas metas liberadas
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
          {screen === "simulator" && (
            <Simulator
              data={data}
              demo={demo}
              onCreateGoal={(preset) => newRecord("goals", preset)}
            />
          )}
          {screen === "reports" && (
            <>
              <div className="toolbar reports-toolbar">
                <div
                  className="segmented-tabs"
                  role="group"
                  aria-label="Período do histórico"
                >
                  {([6, 12] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={reportHorizon === h ? "active" : ""}
                      aria-pressed={reportHorizon === h}
                      onClick={() => setReportHorizon(h)}
                    >
                      Últimos {h} meses
                    </button>
                  ))}
                </div>
                <div className="reports-account-filter">
                  <SelectControl
                    label="Filtrar conta nos relatórios"
                    value={reportAccount}
                    onChange={setReportAccount}
                    options={[
                      ["", "Todas as contas (sem benefícios)"],
                      ...data.accounts.map(
                        (a): [string, string] => [a.id, a.name],
                      ),
                    ]}
                  />
                </div>
              </div>
              <div className="report-stats report-stats-four">
                <section className="stat-card">
                  <p>Entradas realizadas</p>
                  <strong>{value(report.current.income)}</strong>
                  <small>
                    {report.previous.income > 0
                      ? `${report.deltas.incomeDiff >= 0 ? "+" : "−"}${value(Math.abs(report.deltas.incomeDiff))} vs. ${monthLabel(report.previousMonth).split(" ")[0]}`
                      : reportAccount
                        ? nameOf(reportAccount)
                        : "Benefícios separados"}{" "}
                    · Média {value(report.averages.income)}
                  </small>
                </section>
                <section className="stat-card">
                  <p>Saídas realizadas</p>
                  <strong>{value(report.current.expense)}</strong>
                  <small>
                    {report.previous.expense > 0
                      ? `${report.deltas.expenseDiff >= 0 ? "+" : "−"}${value(Math.abs(report.deltas.expenseDiff))} vs. ${monthLabel(report.previousMonth).split(" ")[0]}`
                      : "Transferências excluídas"}{" "}
                    · Média {value(report.averages.expense)}
                  </small>
                </section>
                <section className="stat-card">
                  <p>Resultado do mês</p>
                  <strong
                    className={
                      report.current.result >= 0 ? "positive" : "negative"
                    }
                  >
                    {value(report.current.result)}
                  </strong>
                  <small>
                    {monthLabel(month)} · Média {value(report.averages.result)}
                  </small>
                </section>
                <section className="stat-card">
                  <p>Economia e metas</p>
                  <strong
                    className={
                      (report.current.savingsRate ?? 0) >= 0.1
                        ? "positive"
                        : ""
                    }
                  >
                    {report.current.savingsRate !== null
                      ? percent(Math.max(0, report.current.savingsRate))
                      : "0%"}
                  </strong>
                  <small>
                    da renda preservada · Guardado:{" "}
                    {value(report.current.savedInMonth)}
                  </small>
                </section>
              </div>
              <div className="two-column">
                <section
                  className="panel scroll-destination"
                  ref={flowRef}
                  tabIndex={-1}
                  aria-label="Evolução do caixa"
                >
                  <div className="section-head">
                    <div>
                      <h2>Evolução do caixa</h2>
                      <p>
                        {reportAccount
                          ? `Entradas e saídas em ${nameOf(reportAccount)}.`
                          : "Receitas e despesas livres de benefícios."}
                      </p>
                    </div>
                  </div>
                  <FinanceChart
                    hideValues={hidden}
                    labels={report.periods.map((p) => p.label)}
                    primary={report.periods.map((p) => p.income)}
                    secondary={report.periods.map((p) => p.expense)}
                  />
                </section>
                <section
                  className="panel scroll-destination"
                  ref={categoriesRef}
                  tabIndex={-1}
                  aria-label="Composição das despesas"
                >
                  <div className="section-head">
                    <div>
                      <h2>Composição das despesas</h2>
                      <p>Clique em uma categoria para filtrar nos Lançamentos.</p>
                    </div>
                  </div>
                  <div className="category-list">
                    {report.expenseCategories.map((c, i) => (
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
                              width: `${c.share * 100}%`,
                            }}
                          />
                        </div>
                        <div className="category-meta">
                          <small>{percent(c.share)}</small>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => {
                              setSearch(c.name);
                              setKind("expense");
                              if (reportAccount) setAccountFilter(reportAccount);
                              go("transactions");
                            }}
                          >
                            Ver lançamentos
                          </button>
                        </div>
                      </div>
                    ))}
                    {!report.expenseCategories.length && (
                      <p className="empty-inline">
                        Nenhuma despesa realizada neste mês.
                      </p>
                    )}
                  </div>
                </section>
              </div>
              <div className="two-column">
                <section
                  className="panel"
                  aria-label="Raio-X do orçamento"
                >
                  <div className="section-head">
                    <div>
                      <h2>Raio-X do orçamento</h2>
                      <p>
                        Como seu dinheiro se dividiu entre gastos fixos,
                        variáveis e sobra no mês.
                      </p>
                    </div>
                  </div>
                  {(() => {
                    const base = Math.max(
                      report.current.income,
                      report.current.expense,
                      1,
                    );
                    const fixedShare = report.current.fixedExpense / base;
                    const variableShare = report.current.variableExpense / base;
                    const surplus = Math.max(0, report.current.result);
                    const surplusShare = surplus / base;
                    return (
                      <div className="budget-xray">
                        <div
                          className="xray-bar"
                          aria-label="Proporção entre fixos, variáveis e sobra"
                        >
                          {fixedShare > 0 && (
                            <span
                              className="xray-segment fixed"
                              style={{ width: `${fixedShare * 100}%` }}
                            />
                          )}
                          {variableShare > 0 && (
                            <span
                              className="xray-segment variable"
                              style={{ width: `${variableShare * 100}%` }}
                            />
                          )}
                          {surplusShare > 0 && (
                            <span
                              className="xray-segment surplus"
                              style={{ width: `${surplusShare * 100}%` }}
                            />
                          )}
                        </div>
                        <div className="xray-grid">
                          <div className="xray-item">
                            <span>
                              <i className="category-dot cat-0" />
                              Compromissos fixos e parcelas
                            </span>
                            <strong>{value(report.current.fixedExpense)}</strong>
                            <small>
                              {percent(fixedShare)} do movimento · Recorrências e
                              dívidas
                            </small>
                          </div>
                          <div className="xray-item">
                            <span>
                              <i className="category-dot cat-2" />
                              Gastos variáveis do dia a dia
                            </span>
                            <strong>
                              {value(report.current.variableExpense)}
                            </strong>
                            <small>
                              {percent(variableShare)} do movimento · Compras e
                              avulsos
                            </small>
                          </div>
                          <div className="xray-item">
                            <span>
                              <i className="category-dot cat-1" />
                              Sobra livre no mês
                            </span>
                            <strong
                              className={surplus > 0 ? "positive" : undefined}
                            >
                              {value(surplus)}
                            </strong>
                            <small>
                              {percent(surplusShare)} preservado · Guardado em
                              metas: {value(report.current.savedInMonth)}
                            </small>
                          </div>
                        </div>
                        {(report.current.plannedIncome > 0 ||
                          report.current.plannedExpense > 0) && (
                          <div className="callout subtle">
                            <Info size={16} />
                            <span>
                              Previstos ainda em aberto em {monthLabel(month)}:{" "}
                              <strong>
                                +{value(report.current.plannedIncome)}
                              </strong>{" "}
                              em receitas e{" "}
                              <strong>
                                −{value(report.current.plannedExpense)}
                              </strong>{" "}
                              em despesas.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </section>
                <section
                  className="panel"
                  aria-label="Maiores gastos do mês"
                >
                  <div className="section-head">
                    <div>
                      <h2>Maiores gastos e origem das receitas</h2>
                      <p>
                        Os lançamentos que mais pesaram em {monthLabel(month)}.
                      </p>
                    </div>
                  </div>
                  {report.topExpenses.length ? (
                    <div className="top-expenses-list">
                      {report.topExpenses.map((item, idx) => (
                        <div className="top-expense-row" key={item.id}>
                          <div>
                            <strong>
                              {idx + 1}. {item.description}
                            </strong>
                            <small>
                              {item.category} · {formatDate(item.date)} ·{" "}
                              {item.accountName} ·{" "}
                              {item.isFixed ? "Fixo/Parcela" : "Variável"}
                            </small>
                          </div>
                          <strong className="negative">
                            −{value(item.amount_cents)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-inline">
                      Sem despesas registradas neste período.
                    </p>
                  )}
                  {report.incomeCategories.length > 0 && (
                    <div className="income-sources-box">
                      <h3>Origem das receitas no mês</h3>
                      <div className="income-sources-list">
                        {report.incomeCategories.map((inc) => (
                          <div className="income-source-chip" key={inc.name}>
                            <span>{inc.name}</span>
                            <strong>{value(inc.value)}</strong>
                            <small>{percent(inc.share)}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </div>
              <section className="panel" aria-label="Balanço por conta">
                <div className="section-head">
                  <div>
                    <h2>Balanço por conta</h2>
                    <p>
                      Movimentação em {monthLabel(month)} e saldo atual de cada
                      conta.
                    </p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Conta</th>
                        <th>Entradas no mês</th>
                        <th>Saídas no mês</th>
                        <th>Guardado em metas</th>
                        <th>Saldo atual</th>
                        <th>Livre para usar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.accountSummaries.map((row) => (
                        <tr key={row.account.id}>
                          <td>
                            <div>{row.account.name}</div>
                            {row.overdraftLimit > 0 && (
                              <small className="muted">
                                {row.overdraftUsed > 0
                                  ? `Cheque especial: ${value(row.overdraftUsed)} usado · ${value(row.overdraftRemaining)} livre`
                                  : `Cheque especial livre: ${value(row.overdraftRemaining)}`}
                              </small>
                            )}
                          </td>
                          <td>{value(row.income)}</td>
                          <td>{value(row.expense)}</td>
                          <td>{value(row.savedInMonth)}</td>
                          <td>{value(row.balance)}</td>
                          <td
                            className={
                              row.available >= 0 ? "positive" : "negative"
                            }
                          >
                            {value(row.available)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>Fechamento por mês</h2>
                    <p>
                      Histórico dos últimos {reportHorizon} meses com taxa de
                      economia e reservas.
                    </p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Receitas</th>
                        <th>Despesas</th>
                        <th>Guardado em metas</th>
                        <th>% Poupado</th>
                        <th>Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.periods.map((p) => (
                        <tr key={p.key}>
                          <td>{monthLabel(p.key)}</td>
                          <td>{value(p.income)}</td>
                          <td>{value(p.expense)}</td>
                          <td>{value(p.savedInMonth)}</td>
                          <td>
                            {p.savingsRate !== null
                              ? percent(Math.max(0, p.savingsRate))
                              : "—"}
                          </td>
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
                  Rendimentos recebidos podem ser registrados nos Lançamentos.
                  Previsto e cancelado não compõem estes totais. Patrimônio
                  atual: {value(stats.assets)} · VA/VR: {value(stats.benefits)}.
                </p>
                <div className="button-row">
                  <button
                    className="button secondary"
                    onClick={() => downloadCSV(monthlyEntries)}
                  >
                    <Download size={16} />
                    Baixar lançamentos de {monthLabel(month)} (CSV)
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => downloadCSV(reportPeriodEntries)}
                  >
                    <Download size={16} />
                    Exportar período ({reportHorizon} meses) (CSV)
                  </button>
                </div>
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
                        setData((current) =>
                          current
                            ? { ...current, profile: preferences }
                            : current,
                        );
                        await load();
                      }
                      setPreferenceDraft((current) =>
                        current?.userId === preferences.user_id
                          ? {
                              ...current,
                              changes: Object.fromEntries(
                                Object.entries(current.changes).filter(
                                  ([key, value]) =>
                                    value !== preferences[key as keyof Profile],
                                ),
                              ),
                            }
                          : current,
                      );
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
                        changePreferences({ display_name: e.target.value })
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
                            onChange={() => changePreferences({ theme: id })}
                          />
                          <Icon size={22} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="form-field">
                    <span>Sua cor</span>
                    <SelectControl
                      label="Sua cor"
                      value={preferences.accent}
                      allowEmpty={false}
                      onChange={(v) =>
                        changePreferences({ accent: v as Profile["accent"] })
                      }
                      options={[
                        ["violet", "Violeta"],
                        ["emerald", "Esmeralda"],
                        ["blue", "Azul"],
                        ["rose", "Rosa"],
                        ["amber", "Âmbar"],
                        ["teal", "Turquesa"],
                        ["indigo", "Índigo"],
                        ["coral", "Coral"],
                      ]}
                      swatches={{
                        violet: "#7160d8",
                        emerald: "#258572",
                        blue: "#3874d4",
                        rose: "#ba527d",
                        amber: "#a36a17",
                        teal: "#0e8b99",
                        indigo: "#5962c8",
                        coral: "#c45f43",
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <span>Fundo do seu espaço</span>
                    <SelectControl
                      label="Fundo do seu espaço"
                      allowEmpty={false}
                      value={preferences.background}
                      onChange={(v) =>
                        changePreferences({
                          background: v as Profile["background"],
                        })
                      }
                      options={[
                        ["plain", "Liso"],
                        ["gradient", "Gradiente suave"],
                        ["dots", "Pontos discretos"],
                        ["aurora", "Aurora"],
                        ["grid", "Linhas sutis"],
                        ["waves", "Ondas suaves"],
                      ]}
                    />
                  </div>
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
                    Instale o Meu Norte no celular para abrir direto pela tela
                    inicial, com visual de aplicativo.
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
                <section className="panel onboarding-help">
                  <h2>Primeiros passos</h2>
                  <p>
                    Revise a ordem para organizar contas, recorrências,
                    contratos e lançamentos na Visão geral.
                  </p>
                  <button
                    className="button secondary"
                    disabled={savingOnboarding}
                    onClick={() => {
                      void setOnboarding(
                        (data.profile.onboarding_step ?? 4) < 4
                          ? data.profile.onboarding_step!
                          : 0,
                      );
                      go("overview");
                    }}
                  >
                    Ver tutorial inicial
                  </button>
                </section>
                <section
                  className="panel privacy-notice"
                  aria-label="Privacidade dos seus dados"
                >
                  <h2>Quem pode ver meus dados?</h2>
                  <p>
                    Outros usuários não podem consultar seus registros pelas
                    permissões do app. Como esta é uma versão beta (teste) sem
                    criptografia de ponta a ponta, o administrador do projeto
                    tem acesso técnico ao banco nesta fase.
                  </p>
                  <Link className="text-button" href="/privacidade">
                    Entender a privacidade dos dados <ArrowRight size={16} />
                  </Link>
                </section>
                <section className="panel">
                  <div className="section-title">
                    <ShieldCheck size={22} />
                    <h2>Seu acesso</h2>
                  </div>
                  <p className="muted">
                    {demo
                      ? "Você está explorando uma demonstração com dados fictícios."
                      : `${data.profile.display_name || "Sua conta"} · ${data.email || ""}`}
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
                      <hr />
                      <button
                        className="button destructive wide"
                        onClick={() => setDeletingAccount(true)}
                        disabled={!data.can_delete_account}
                      >
                        Apagar minha conta e meus dados
                      </button>
                      {!data.can_delete_account && (
                        <p className="small-note">
                          A exclusão da conta ainda não está disponível neste
                          ambiente.
                        </p>
                      )}
                    </>
                  )}
                </section>
              </div>
            </div>
          )}
        </main>
      </div>
      {deletingAccount && (
        <DeleteAccount
          onClose={() => setDeletingAccount(false)}
          onDelete={async (password, confirmation) => {
            await request("/api/account", {
              method: "DELETE",
              body: JSON.stringify({ password, confirmation }),
            });
            window.location.assign("/entrar");
          }}
        />
      )}
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
        <MobileSheet onClose={() => setMenu(false)}>
          <nav aria-label="Todas as páginas">
            {nav.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item ${screen === id ? "active" : ""}`}
                onClick={() => go(id)}
                aria-current={screen === id ? "page" : undefined}
              >
                <Icon size={19} />
                {label}
              </button>
            ))}
          </nav>
          <MenuCredits />
        </MobileSheet>
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
          links={dependencies}
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
