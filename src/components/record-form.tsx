"use client";
import { useEffect, useRef, useState } from "react";
import { X, ArrowRight, Info } from "lucide-react";
import type { Entity, FinanceData, GoalDependency } from "@/lib/types";
import GoalConditions, {
  draftConditions,
  parseConditions,
} from "./goal-conditions";
import { formatMoney, moneyInput, parseMoney } from "@/lib/finance/money";
import DateControl from "./date-control";
import SelectControl from "./select-control";
import CategoryInput from "./category-input";
import MoneyInput from "./money-input";
import { addMonths, today } from "@/lib/finance/dates";
import { goalBlockers } from "@/lib/finance/goal-dependencies";
import {
  piggyBankTotalCents,
  progressiveMonthlyTotalCents,
} from "@/lib/finance/piggy-bank";
import {
  buildCreditCardSchedule,
  calculateFirstDueDate,
  clampDay,
  creditCardSummary,
  defaultClosingDay,
  formatCreditCardExternalId,
} from "@/lib/finance/credit-cards";
export type FormState = {
  entity: Entity;
  record?: Record<string, unknown>;
  preset?: Record<string, unknown>;
};
const labels: Record<Entity, string> = {
  accounts: "conta",
  transactions: "lançamento",
  goals: "meta",
  contributions: "aporte",
  investments: "investimento",
  recurrences: "recorrência",
  loans: "contrato",
};
const kinds = [
  ["income", "Receita"],
  ["expense", "Despesa"],
  ["transfer", "Transferência"],
  ["yield", "Rendimento"],
];
const accountKinds = [
  ["checking", "Conta corrente"],
  ["cash", "Dinheiro"],
  ["benefit", "Benefícios · VA/VR"],
  ["investment", "Dinheiro guardado"],
  ["credit_card", "Cartão de crédito (segregado)"],
];
const popularCardBanks = [
  "Nubank",
  "Itaú",
  "Inter",
  "Bradesco",
  "Santander",
  "Banco do Brasil",
  "C6 Bank",
  "Caixa",
  "XP",
  "BTG",
];
const emptyDefaults = {
  name: "",
  kind: "expense",
  description: "",
  amount_cents: "",
  opening_cents: "0,00",
  opening_date: today(),
  date: today(),
  status: "posted",
  source_account_id: "",
  target_account_id: "",
  category: "Outros",
  gross_cents: "",
  deductions_cents: "",
  target_cents: "",
  target_date: "",
  priority: "1",
  completed: "false",
  monthly_budget_cents: "",
  goal_id: "",
  account_id: "",
  note: "",
  annual_rate: "10",
  inflation_rate: "4,5",
  frequency: "monthly",
  start_date: today(),
  end_date: "",
  active: "true",
  auto_post: "false",
  institution: "",
  principal_cents: "",
  installment_cents: "",
  total_installments: "12",
  paid_before: "0",
  first_due_date: today(),
  monthly_rate: "",
  cet_annual_rate: "",
  overdraft_cents: "",
  credit_limit_cents: "",
  due_day: "10",
  closing_day: "3",
};
const currencyKeys = [
  "principal_cents",
  "installment_cents",
  "amount_cents",
  "opening_cents",
  "overdraft_cents",
  "credit_limit_cents",
  "gross_cents",
  "deductions_cents",
  "target_cents",
  "monthly_budget_cents",
];
export default function RecordForm({
  state,
  data,
  onClose,
  onSubmit,
}: {
  state: FormState;
  data: FinanceData;
  onClose: () => void;
  onSubmit: (
    entity: Entity,
    method: "POST" | "PUT",
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const [conditions, setConditions] = useState(() =>
    draftConditions(
      (state.record?.dependencies as GoalDependency[] | undefined) ?? [],
    ),
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const row = { ...state.record, ...state.preset },
      base = {
        ...emptyDefaults,
        kind:
          state.entity === "accounts"
            ? "checking"
            : state.entity === "loans"
              ? "loan"
              : state.entity === "transactions"
                ? "expense"
                : "income",
      } as Record<string, string>;
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) base[key] = "";
      else if (currencyKeys.includes(key))
        base[key] = moneyInput(Number(value));
      else if (
        [
          "annual_rate",
          "inflation_rate",
          "monthly_rate",
          "cet_annual_rate",
        ].includes(key)
      )
        base[key] = String(Number(value) * 100).replace(".", ",");
      else base[key] = String(value);
    }
    return base;
  });
  const [ipca, setIpca] = useState("");
  const [fetchingIpca, setFetchingIpca] = useState(false);
  const [goalModel, setGoalModel] = useState<"free" | "piggy" | "progressive">(
    () => (state.preset?.goal_model === "piggy" ? "piggy" : "free"),
  );
  const [piggyMax, setPiggyMax] = useState("500");
  const [customPiggyMax, setCustomPiggyMax] = useState("150");
  const effectivePiggyMax =
    piggyMax === "custom"
      ? Math.max(2, Math.min(2000, Math.trunc(Number(customPiggyMax) || 150)))
      : Math.max(2, Math.min(2000, Number(piggyMax) || 500));
  const [progStart, setProgStart] = useState("100,00");
  const [progStep, setProgStep] = useState("50,00");
  const [progMonths, setProgMonths] = useState("12");
  const [hasOverdraft, setHasOverdraft] = useState(
    () =>
      Number(
        state.record?.overdraft_cents ?? state.preset?.overdraft_cents ?? 0,
      ) > 0,
  );
  const [customClosingDay, setCustomClosingDay] = useState(() =>
    Boolean(state.record?.closing_day),
  );
  const [ccPaymentMode, setCcPaymentMode] = useState<"single" | "installments">(
    () =>
      state.preset?.cc_mode === "installments" ? "installments" : "single",
  );
  const [ccInstallments, setCcInstallments] = useState("2");
  const [ccPaidBefore, setCcPaidBefore] = useState("0");
  const [ccMonthOffset, setCcMonthOffset] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    const first = d?.querySelector<HTMLInputElement>("input,select");
    first?.focus();
    return () => {
      d?.close();
    };
  }, []);
  const update = (key: string, value: string) =>
    setValues((v) => ({
      ...v,
      [key]: value,
      ...(key === "kind"
        ? {
            source_account_id: "",
            target_account_id: "",
            gross_cents: "",
            deductions_cents: "",
            status: "posted",
          }
        : {}),
    }));
  const field = (
    key: string,
    label: string,
    options?: {
      type?: string;
      required?: boolean;
      hint?: string;
      min?: string;
      max?: string;
      placeholder?: string;
    },
  ) => (
    <label className="form-field" key={key}>
      <span>{label}</span>
      {options?.type === "date" ? (
        <DateControl
          label={label}
          value={values[key] ?? ""}
          onChange={(v) => update(key, v)}
          min={options?.min}
          max={options?.max}
          required={options?.required ?? true}
        />
      ) : currencyKeys.includes(key) ? (
        <MoneyInput
          name={key}
          value={values[key] ?? ""}
          aria-label={label}
          onValueChange={(v) => update(key, v)}
          required={options?.required ?? true}
        />
      ) : (
        <input
          name={key}
          value={values[key] ?? ""}
          aria-label={label}
          placeholder={options?.placeholder}
          onChange={(e) => update(key, e.target.value)}
          type={options?.type ?? "text"}
          required={options?.required ?? true}
          inputMode={key.includes("rate") ? "decimal" : undefined}
          min={options?.min}
          max={options?.max}
          maxLength={
            key === "description" ? 140 : key === "note" ? 200 : undefined
          }
        />
      )}
      {options?.hint && <small>{options.hint}</small>}
    </label>
  );
  const select = (
    key: string,
    label: string,
    options: string[][],
    required = true,
  ) => (
    <div className="form-field" key={key}>
      <span>
        {label}
        {!required ? " (opcional)" : ""}
      </span>
      <SelectControl
        name={key}
        label={label}
        value={values[key]}
        onChange={(v) => update(key, v)}
        options={options}
      />
    </div>
  );
  const nonCreditAccounts = data.accounts
    .filter((a) => a.kind !== "credit_card")
    .map((a) => [a.id, a.name]);
  const expenseSourceAccounts = data.accounts.map((a) => [
    a.id,
    a.kind === "credit_card"
      ? `💳 ${a.name}${a.institution ? ` (${a.institution})` : ""} · Cartão`
      : a.name,
  ]);
  const selectedCreditCard =
    state.entity === "transactions" &&
    values.kind === "expense" &&
    !state.record
      ? data.accounts.find(
          (a) => a.id === values.source_account_id && a.kind === "credit_card",
        )
      : undefined;
  const money = (key: string, optional = false) =>
    optional && !values[key] ? null : parseMoney(values[key]);
  const rate = (key: string) => {
    const text = values[key].trim();
    if (!/^-?\d+(?:,\d{1,6})?$/.test(text))
      throw new Error("Use uma taxa como 10 ou 4,5.");
    return Number(text.replace(",", ".")) / 100;
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const v = values;
      let payload: Record<string, unknown> = {};
      switch (state.entity) {
        case "loans":
          payload = {
            name: v.name,
            institution: v.institution,
            kind: v.kind,
            principal_cents: money("principal_cents", true),
            installment_cents: money("installment_cents"),
            total_installments: Number(v.total_installments),
            paid_before: Number(v.paid_before),
            first_due_date: v.first_due_date,
            monthly_rate: v.monthly_rate ? rate("monthly_rate") : null,
            cet_annual_rate: v.cet_annual_rate ? rate("cet_annual_rate") : null,
            account_id: v.account_id || null,
          };
          break;
        case "accounts": {
          if (v.kind === "credit_card") {
            const limit = money("credit_limit_cents") ?? 0;
            if (limit <= 0)
              throw new Error(
                "Informe um limite total maior que zero para o cartão de crédito.",
              );
            const dueDay = Number(v.due_day);
            const closingDay = Number(v.closing_day);
            if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)
              throw new Error("Informe o dia de vencimento da fatura (1 a 31).");
            if (
              !Number.isInteger(closingDay) ||
              closingDay < 1 ||
              closingDay > 31
            )
              throw new Error(
                "Informe o dia de fechamento da fatura (1 a 31).",
              );
            const cleanInst = v.institution.trim();
            const cleanName =
              v.name.trim() ||
              (cleanInst ? `Cartão ${cleanInst}` : "Cartão de crédito");
            payload = {
              name: cleanName,
              kind: "credit_card",
              institution: cleanInst,
              credit_limit_cents: limit,
              due_day: dueDay,
              closing_day: closingDay,
              opening_cents: 0,
              opening_date: "2000-01-01",
              overdraft_cents: 0,
            };
            break;
          }
          const overdraft =
            v.kind === "checking" && hasOverdraft
              ? (money("overdraft_cents") ?? 0)
              : 0;
          if (v.kind === "checking" && hasOverdraft && overdraft <= 0)
            throw new Error(
              "Informe um limite de cheque especial maior que zero.",
            );
          payload = {
            name: v.name,
            kind: v.kind,
            opening_cents: money("opening_cents"),
            opening_date: v.opening_date,
            ...(overdraft > 0 ||
            Number(state.record?.overdraft_cents ?? 0) > 0
              ? { overdraft_cents: overdraft }
              : {}),
          };
          break;
        }
        case "goals": {
          const fallbackName =
            goalModel === "piggy"
              ? `Cofrinho 1 a ${effectivePiggyMax}`
              : goalModel === "progressive"
                ? `Cofrinho progressivo (${Math.max(2, Math.min(240, Number(progMonths) || 12))} meses)`
                : "";
          payload = {
            name: v.name.trim() || fallbackName,
            target_cents: money("target_cents"),
            target_date: v.target_date,
            priority: Number(v.priority),
            monthly_budget_cents: money("monthly_budget_cents", true),
            completed: v.completed === "true",
            dependencies: parseConditions(conditions),
          };
          break;
        }
        case "contributions":
          payload = {
            goal_id: v.goal_id,
            account_id: v.account_id,
            amount_cents: money("amount_cents"),
            date: v.date,
            note: v.note,
          };
          break;
        case "investments":
          payload = {
            name: v.name,
            account_id: v.account_id,
            annual_rate: rate("annual_rate"),
            inflation_rate: rate("inflation_rate"),
          };
          break;
        case "transactions": {
          if (selectedCreditCard) {
            const rawAmount = money("amount_cents") ?? 0;
            if (rawAmount <= 0)
              throw new Error("Informe um valor positivo para a compra.");
            const totalInst =
              ccPaymentMode === "installments"
                ? Math.max(2, Math.min(60, Math.trunc(Number(ccInstallments) || 2)))
                : 1;
            const paidBefore =
              ccPaymentMode === "installments"
                ? Math.max(
                    0,
                    Math.min(
                      totalInst - 1,
                      Math.trunc(Number(ccPaidBefore) || 0),
                    ),
                  )
                : 0;
            const dueDay = clampDay(selectedCreditCard.due_day ?? 10, 10);
            const closingDay = clampDay(
              selectedCreditCard.closing_day ?? defaultClosingDay(dueDay),
              defaultClosingDay(dueDay),
            );
            const firstDue = calculateFirstDueDate(
              v.date,
              dueDay,
              closingDay,
              ccMonthOffset,
            );
            const schedule = buildCreditCardSchedule({
              purchaseDate: v.date,
              dueDay,
              closingDay,
              installmentCents: rawAmount,
              totalInstallments: totalInst,
              paidBefore,
              firstDueDateOverride: firstDue,
            });
            const groupId = crypto.randomUUID().slice(0, 8);
            const cleanDesc = v.description.trim();
            if (!cleanDesc) throw new Error("Informe a descrição da compra.");
            const now = today();
            const batchEntries = schedule.items.map((item) => ({
              kind: "expense",
              description:
                totalInst > 1
                  ? `${cleanDesc} (${item.number}/${item.total})`
                  : cleanDesc,
              amount_cents: item.amountCents,
              date:
                item.status === "posted"
                  ? item.dueDate <= now
                    ? item.dueDate
                    : now
                  : item.dueDate,
              status: item.status,
              source_account_id: selectedCreditCard.id,
              target_account_id: null,
              category: v.category.trim() || "Cartão de crédito",
              gross_cents: null,
              deductions_cents: null,
              external_id: formatCreditCardExternalId({
                groupId,
                installmentNumber: item.number,
                totalInstallments: item.total,
                purchaseDate: v.date,
                dueDate: item.dueDate,
              }),
            }));
            payload = { batch_entries: batchEntries };
            break;
          }
          payload = {
            kind: v.kind,
            description: v.description,
            amount_cents: money("amount_cents"),
            date: v.date,
            status:
              v.kind === "income" && !state.record?.recurrence_id
                ? "posted"
                : v.status,
            source_account_id: ["expense", "transfer"].includes(v.kind)
              ? v.source_account_id || null
              : null,
            target_account_id:
              v.kind !== "expense" ? v.target_account_id || null : null,
            category: v.category,
            gross_cents:
              v.kind === "income" ? money("gross_cents", true) : null,
            deductions_cents:
              v.kind === "income" ? money("deductions_cents", true) : null,
            ...(typeof state.record?.external_id === "string"
              ? { external_id: state.record.external_id }
              : {}),
          };
          break;
        }
        case "recurrences":
          payload = {
            kind: v.kind,
            description: v.description,
            amount_cents: money("amount_cents"),
            source_account_id:
              v.kind === "expense" ? v.source_account_id || null : null,
            target_account_id:
              v.kind === "income" ? v.target_account_id || null : null,
            category: v.category,
            frequency: v.frequency,
            start_date: v.start_date,
            end_date: v.end_date || null,
            active: v.active === "true",
            auto_post: v.auto_post === "true",
          };
          break;
      }
      if (state.record) payload.id = state.record.id;
      await onSubmit(state.entity, state.record ? "PUT" : "POST", payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  const e = state.entity;
  return (
    <dialog
      ref={ref}
      className="record-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      aria-labelledby="form-title"
    >
      <form onSubmit={submit}>
        <div className="dialog-head">
          <div>
            <p className="eyebrow">ORGANIZAR É O PRIMEIRO PASSO</p>
            <h2 id="form-title">
              {e === "accounts" && values.kind === "credit_card"
                ? state.record
                  ? "Editar cartão de crédito"
                  : "Novo cartão de crédito"
                : selectedCreditCard
                  ? "Nova compra no cartão"
                  : `${
                      state.record
                        ? "Editar"
                        : ["accounts", "goals", "recurrences"].includes(e)
                          ? "Nova"
                          : "Novo"
                    } ${labels[e]}`}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar formulário"
          >
            <X size={20} />
          </button>
        </div>
        <div className="dialog-fields">
          {(e === "accounts" ||
            e === "goals" ||
            e === "investments" ||
            e === "loans") &&
            field(
              "name",
              e === "accounts" && values.kind === "credit_card"
                ? "Nome ou apelido do cartão"
                : "Nome",
              {
                required:
                  (e !== "goals" || goalModel === "free") &&
                  !(e === "accounts" && values.kind === "credit_card"),
                placeholder:
                  e === "goals"
                    ? goalModel === "piggy"
                      ? "Ex.: Cofrinho da viagem, Reserva 1 a 500, Meu carro..."
                      : goalModel === "progressive"
                        ? "Ex.: Cofrinho de 12 meses, Reserva de fim de ano..."
                        : "Ex.: Reserva de emergência, Próxima viagem..."
                    : e === "accounts"
                      ? values.kind === "credit_card"
                        ? "Ex.: Nubank Ultravioleta, Itaú Click, Cartão principal..."
                        : "Ex.: Conta do dia a dia, Carteira, Reserva..."
                      : undefined,
              },
            )}
          {e === "accounts" && (
            <>
              {select("kind", "Tipo de conta", accountKinds)}
              {values.kind === "credit_card" ? (
                <>
                  {field("institution", "Banco ou instituição do cartão", {
                    required: false,
                    placeholder: "Ex.: Nubank, Itaú, Inter, Bradesco, C6...",
                  })}
                  <div className="cc-bank-chips">
                    {popularCardBanks.map((bankName) => (
                      <button
                        key={bankName}
                        type="button"
                        className={`cc-bank-chip ${
                          values.institution.toLowerCase() ===
                          bankName.toLowerCase()
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => {
                          setValues((old) => ({
                            ...old,
                            institution: bankName,
                            name: old.name.trim()
                              ? old.name
                              : `Cartão ${bankName}`,
                          }));
                        }}
                      >
                        {bankName}
                      </button>
                    ))}
                  </div>
                  {field("credit_limit_cents", "Limite total do cartão (R$)", {
                    placeholder: "Ex.: 5.000,00",
                  })}
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Dia de vencimento da fatura</span>
                      <input
                        type="number"
                        name="due_day"
                        aria-label="Dia de vencimento da fatura"
                        min={1}
                        max={31}
                        required
                        value={values.due_day ?? "10"}
                        onChange={(ev) => {
                          const nextDue = ev.target.value;
                          const numDue = Number(nextDue);
                          setValues((old) => ({
                            ...old,
                            due_day: nextDue,
                            closing_day: customClosingDay
                              ? old.closing_day
                              : String(
                                  defaultClosingDay(
                                    Number.isFinite(numDue) ? numDue : 10,
                                  ),
                                ),
                          }));
                        }}
                      />
                      <small>Dia em que a fatura vence (1 a 31).</small>
                    </label>
                    <label className="form-field">
                      <span>Dia de fechamento (melhor dia de compra)</span>
                      <input
                        type="number"
                        name="closing_day"
                        aria-label="Dia de fechamento (melhor dia de compra)"
                        min={1}
                        max={31}
                        required
                        value={values.closing_day ?? "3"}
                        onChange={(ev) => {
                          setCustomClosingDay(true);
                          update("closing_day", ev.target.value);
                        }}
                      />
                      <small>Geralmente 7 dias antes do vencimento.</small>
                    </label>
                  </div>
                  {(() => {
                    const dDay = clampDay(Number(values.due_day || 10), 10);
                    const cDay = clampDay(
                      Number(values.closing_day || defaultClosingDay(dDay)),
                      defaultClosingDay(dDay),
                    );
                    let lim = 0;
                    try {
                      lim = values.credit_limit_cents
                        ? parseMoney(values.credit_limit_cents)
                        : 0;
                    } catch {
                      lim = 0;
                    }
                    return (
                      <div className="goal-conditions stack">
                        <p className="form-help">
                          Compras feitas antes do dia <strong>{cDay}</strong>{" "}
                          entram na fatura que vence no dia{" "}
                          <strong>{dDay}</strong>. Compras feitas a partir do
                          dia <strong>{cDay}</strong> entram automaticamente na
                          fatura do mês seguinte.
                          {lim > 0 && (
                            <>
                              {" "}
                              As compras à vista ou parceladas comprometem o
                              limite de <strong>{formatMoney(lim)}</strong> e{" "}
                              <strong>
                                ficam segregadas do saldo das suas contas
                                bancárias
                              </strong>
                              .
                            </>
                          )}
                        </p>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  <div className="form-grid">
                    {field("opening_cents", "Saldo inicial (R$)")}
                    {field("opening_date", "Data do saldo inicial", {
                      type: "date",
                      max: today(),
                    })}
                  </div>
                  {values.kind === "checking" && (
                    <>
                      <div className="account-sign-row">
                        <span className="muted">
                          Situação do saldo inicial:
                        </span>
                        <div className="segmented compact">
                          <button
                            type="button"
                            className={
                              !values.opening_cents.trim().startsWith("-")
                                ? "selected"
                                : ""
                            }
                            onClick={() =>
                              update(
                                "opening_cents",
                                values.opening_cents.replace(/^-+/, ""),
                              )
                            }
                          >
                            Saldo positivo (+)
                          </button>
                          <button
                            type="button"
                            className={
                              values.opening_cents.trim().startsWith("-")
                                ? "selected"
                                : ""
                            }
                            onClick={() => {
                              const clean = values.opening_cents.replace(
                                /^-+/,
                                "",
                              );
                              if (clean && clean !== "0,00" && clean !== "0")
                                update("opening_cents", `-${clean}`);
                            }}
                          >
                            No cheque especial (−)
                          </button>
                        </div>
                      </div>
                      <label className="checkbox-field">
                        <input
                          type="checkbox"
                          checked={hasOverdraft}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setHasOverdraft(checked);
                            if (!checked) update("overdraft_cents", "");
                          }}
                        />
                        <span>Esta conta possui limite de cheque especial</span>
                      </label>
                      {hasOverdraft && (
                        <div className="goal-conditions stack">
                          {field(
                            "overdraft_cents",
                            "Limite do cheque especial (R$)",
                            {
                              placeholder: "Ex.: 1.500,00",
                            },
                          )}
                          {(() => {
                            let opening = 0,
                              limit = 0;
                            try {
                              opening = parseMoney(
                                values.opening_cents || "0,00",
                              );
                            } catch {
                              opening = 0;
                            }
                            try {
                              limit = values.overdraft_cents
                                ? parseMoney(values.overdraft_cents)
                                : 0;
                            } catch {
                              limit = 0;
                            }
                            if (limit <= 0)
                              return (
                                <p className="form-help">
                                  Informe quanto o banco disponibiliza de cheque
                                  especial. Quando uma despesa paga ultrapassar
                                  o saldo em conta, a diferença consumirá este
                                  limite e deixará a conta negativa.
                                </p>
                              );
                            const used =
                              opening < 0
                                ? Math.min(limit, Math.abs(opening))
                                : 0;
                            const remaining = Math.max(
                              0,
                              limit - Math.max(0, -opening),
                            );
                            return (
                              <p className="form-help">
                                {opening < 0 ? (
                                  <>
                                    O saldo inicial negativo (
                                    <strong>{formatMoney(opening)}</strong>)
                                    compromete{" "}
                                    <strong>{formatMoney(used)}</strong> do
                                    cheque especial · Restam{" "}
                                    <strong>{formatMoney(remaining)}</strong> de
                                    limite disponível. Sempre que entrar valor
                                    na conta, o limite do cheque especial vai
                                    sendo compensado até chegar no zero
                                    novamente.
                                  </>
                                ) : (
                                  <>
                                    Se uma despesa paga for maior que o saldo da
                                    conta (
                                    <strong>{formatMoney(opening)}</strong>),
                                    vai subtrair os{" "}
                                    <strong>{formatMoney(opening)}</strong> do
                                    saldo e descontar a diferença do limite de{" "}
                                    <strong>{formatMoney(limit)}</strong> do
                                    cheque especial, deixando a conta negativa.
                                    Sempre que entrar valor na conta, o limite
                                    do cheque especial vai sendo compensado até
                                    chegar no zero novamente.
                                  </>
                                )}
                              </p>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  )}
                  <p className="form-help">
                    Informe o saldo na data de início. Os próximos movimentos
                    atualizam o saldo automaticamente.
                  </p>
                </>
              )}
            </>
          )}
          {(e === "transactions" || e === "recurrences") && (
            <>
              {!state.preset?.lock_credit_card &&
                select(
                  "kind",
                  "Tipo",
                  e === "recurrences" ? kinds.slice(0, 2) : kinds,
                )}
              {field("description", selectedCreditCard ? "Descrição da compra" : "Descrição", {
                placeholder: selectedCreditCard
                  ? "Ex.: Supermercado, Geladeira, Passagem aérea..."
                  : undefined,
              })}
              {["expense", "transfer"].includes(values.kind) &&
                select(
                  "source_account_id",
                  selectedCreditCard
                    ? "Cartão de crédito utilizado"
                    : values.kind === "expense"
                      ? "Conta ou cartão de origem"
                      : "Conta de origem",
                  e === "transactions" && values.kind === "expense"
                    ? expenseSourceAccounts
                    : nonCreditAccounts,
                )}
              {selectedCreditCard ? (
                <>
                  <div className="account-sign-row">
                    <span className="muted">Modalidade da compra:</span>
                    <div className="segmented compact">
                      <button
                        type="button"
                        className={
                          ccPaymentMode === "single" ? "selected" : ""
                        }
                        onClick={() => setCcPaymentMode("single")}
                      >
                        À vista no crédito (1x)
                      </button>
                      <button
                        type="button"
                        className={
                          ccPaymentMode === "installments" ? "selected" : ""
                        }
                        onClick={() => setCcPaymentMode("installments")}
                      >
                        Parcelado
                      </button>
                    </div>
                  </div>
                  <div className="form-grid">
                    {field(
                      "amount_cents",
                      ccPaymentMode === "installments"
                        ? "Valor de cada parcela (R$)"
                        : "Valor da compra à vista (R$)",
                    )}
                    {field("date", "Data da compra", {
                      type: "date",
                      max: today(),
                    })}
                  </div>
                  {ccPaymentMode === "installments" && (
                    <div className="form-grid">
                      <label className="form-field">
                        <span>Quantidade de parcelas</span>
                        <input
                          type="number"
                          aria-label="Quantidade de parcelas"
                          min={2}
                          max={60}
                          required
                          value={ccInstallments}
                          onChange={(ev) => setCcInstallments(ev.target.value)}
                        />
                        <small>De 2x até 60x sem alterar o saldo da conta.</small>
                      </label>
                      <label className="form-field">
                        <span>Parcelas já pagas anteriormente</span>
                        <input
                          type="number"
                          aria-label="Parcelas já pagas anteriormente"
                          min={0}
                          max={Math.max(
                            0,
                            (Number(ccInstallments) || 2) - 1,
                          )}
                          value={ccPaidBefore}
                          onChange={(ev) => setCcPaidBefore(ev.target.value)}
                        />
                        <small>Use se a compra parcelada já estava em andamento.</small>
                      </label>
                    </div>
                  )}
                  <CategoryInput
                    value={values.category}
                    onChange={(v) => update("category", v)}
                    entries={data.transactions}
                  />
                  {(() => {
                    const dueDay = clampDay(selectedCreditCard.due_day ?? 10, 10);
                    const closingDay = clampDay(
                      selectedCreditCard.closing_day ??
                        defaultClosingDay(dueDay),
                      defaultClosingDay(dueDay),
                    );
                    const totalInst =
                      ccPaymentMode === "installments"
                        ? Math.max(
                            2,
                            Math.min(60, Math.trunc(Number(ccInstallments) || 2)),
                          )
                        : 1;
                    const paidBefore =
                      ccPaymentMode === "installments"
                        ? Math.max(
                            0,
                            Math.min(
                              totalInst - 1,
                              Math.trunc(Number(ccPaidBefore) || 0),
                            ),
                          )
                        : 0;
                    let instCents = 0;
                    try {
                      instCents = values.amount_cents
                        ? parseMoney(values.amount_cents)
                        : 0;
                    } catch {
                      instCents = 0;
                    }
                    const firstDue = calculateFirstDueDate(
                      values.date,
                      dueDay,
                      closingDay,
                      ccMonthOffset,
                    );
                    const schedule = buildCreditCardSchedule({
                      purchaseDate: values.date,
                      dueDay,
                      closingDay,
                      installmentCents: instCents,
                      totalInstallments: totalInst,
                      paidBefore,
                      firstDueDateOverride: firstDue,
                    });
                    const cardStat = creditCardSummary(
                      selectedCreditCard,
                      data.transactions,
                      today().slice(0, 7),
                      today(),
                    );
                    const remainingAfter =
                      cardStat.availableCents - schedule.openCents;
                    const fmtDate = (iso: string) =>
                      iso.split("-").reverse().join("/");
                    return (
                      <div className="goal-conditions stack cc-schedule-preview">
                        <div className="cc-schedule-head">
                          <div className="cc-schedule-title">
                            <strong>Previsão de vencimentos no cartão</strong>
                            <small className="muted">
                              {selectedCreditCard.name}
                              {selectedCreditCard.institution
                                ? ` · ${selectedCreditCard.institution}`
                                : ""}{" "}
                              (Fecha dia {closingDay} · Vence dia {dueDay})
                            </small>
                          </div>
                          <div className="segmented compact">
                            <button
                              type="button"
                              className={ccMonthOffset === -1 ? "selected" : ""}
                              onClick={() => setCcMonthOffset(-1)}
                              title="Antecipar 1º vencimento em 1 mês"
                            >
                              −1 mês
                            </button>
                            <button
                              type="button"
                              className={ccMonthOffset === 0 ? "selected" : ""}
                              onClick={() => setCcMonthOffset(0)}
                            >
                              Automático
                            </button>
                            <button
                              type="button"
                              className={ccMonthOffset === 1 ? "selected" : ""}
                              onClick={() => setCcMonthOffset(1)}
                              title="Adiar 1º vencimento em 1 mês"
                            >
                              +1 mês
                            </button>
                          </div>
                        </div>
                        <div className="cc-preview-grid">
                          <div>
                            <small className="muted">1º vencimento</small>
                            <strong>{fmtDate(schedule.firstDueDate)}</strong>
                          </div>
                          <div>
                            <small className="muted">
                              {totalInst > 1
                                ? `Último vencimento (${totalInst}/${totalInst})`
                                : "Modalidade"}
                            </small>
                            <strong>
                              {totalInst > 1
                                ? fmtDate(schedule.lastDueDate)
                                : "À vista (1x)"}
                            </strong>
                          </div>
                          <div>
                            <small className="muted">Total da compra</small>
                            <strong>
                              {instCents > 0
                                ? formatMoney(schedule.totalCents)
                                : "—"}
                            </strong>
                          </div>
                          <div>
                            <small className="muted">
                              Limite após a compra
                            </small>
                            <strong
                              className={
                                remainingAfter < 0 ? "negative" : "positive"
                              }
                            >
                              {formatMoney(remainingAfter)}
                            </strong>
                          </div>
                        </div>
                        {totalInst > 1 && (
                          <div className="cc-installment-pills">
                            {schedule.items.slice(0, 12).map((item) => (
                              <span
                                key={item.number}
                                className={`badge ${
                                  item.status === "posted" ? "ok" : ""
                                }`}
                              >
                                {item.number}/{item.total}:{" "}
                                {fmtDate(item.dueDate)}
                                {instCents > 0
                                  ? ` · ${formatMoney(item.amountCents)}`
                                  : ""}
                              </span>
                            ))}
                            {schedule.items.length > 12 && (
                              <span className="badge">
                                +{schedule.items.length - 12} parcelas até{" "}
                                {fmtDate(schedule.lastDueDate)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  <div className="form-grid">
                    {field(
                      "amount_cents",
                      values.kind === "yield"
                        ? "Rendimento em R$ (aceita perda)"
                        : "Valor líquido (R$)",
                    )}
                    {e === "recurrences" &&
                      field("start_date", "Primeira ocorrência", {
                        type: "date",
                      })}
                  </div>
                  {values.kind !== "expense" &&
                    select(
                      "target_account_id",
                      "Conta de destino",
                      values.kind === "yield"
                        ? data.accounts
                            .filter((a) => a.kind === "investment")
                            .map((a) => [a.id, a.name])
                        : nonCreditAccounts,
                    )}
                  <CategoryInput
                    value={values.category}
                    onChange={(v) => update("category", v)}
                    entries={data.transactions}
                  />
                  {e === "transactions" && (
                    <>
                      {(values.kind !== "income" ||
                        !!state.record?.recurrence_id) && (
                        <div className="form-field">
                          <span>Situação</span>
                          <SelectControl
                            label="Situação"
                            value={values.status}
                            onChange={(v) =>
                              setValues((old) => ({
                                ...old,
                                status: v,
                                date: v === "posted" ? today() : old.date,
                              }))
                            }
                            options={[
                              [
                                "posted",
                                values.kind === "expense"
                                  ? "Já paguei"
                                  : values.kind === "income"
                                    ? "Já recebi"
                                    : "Realizado",
                              ],
                              [
                                "planned",
                                values.kind === "expense"
                                  ? "A pagar"
                                  : values.kind === "income"
                                    ? "A receber"
                                    : "Agendado",
                              ],
                            ]}
                          />
                        </div>
                      )}
                      {field(
                        "date",
                        values.kind === "expense" && values.status === "planned"
                          ? "Data de vencimento"
                          : values.kind === "expense"
                            ? "Data do pagamento"
                            : "Data",
                        {
                          type: "date",
                          max:
                            values.status === "posted" ||
                            (values.kind === "income" &&
                              !state.record?.recurrence_id)
                              ? today()
                              : undefined,
                        },
                      )}
                      {values.status === "posted" &&
                        state.record?.occurrence_date && (
                          <p className="form-help">
                            Data prevista:{" "}
                            {String(state.record.occurrence_date)
                              .split("-")
                              .reverse()
                              .join("/")}
                            .
                            {values.date < String(state.record.occurrence_date)
                              ? ` Este lançamento será marcado como ${values.kind === "expense" ? "pago" : "recebido"} adiantado e entra no saldo na data informada.`
                              : " O saldo usa a data em que o dinheiro entrou ou saiu."}
                          </p>
                        )}
                      {values.kind === "income" &&
                        !state.record?.recurrence_id && (
                          <p className="form-help">
                            Registre o que já recebeu. Para repetir nos próximos
                            meses, use Recorrências.
                          </p>
                        )}
                    </>
                  )}
                  {e === "transactions" && values.kind === "income" && (
                    <details className="salary-details">
                      <summary>
                        Salário: informar bruto e descontos (opcional)
                      </summary>
                      <div className="form-grid">
                        {field("gross_cents", "Bruto (R$)", {
                          required: false,
                        })}
                        {field("deductions_cents", "Descontos (R$)", {
                          required: false,
                        })}
                      </div>
                      <small>
                        Bruto − descontos deve ser igual ao valor líquido. VA/VR
                        entra em conta de benefícios.
                      </small>
                    </details>
                  )}
                </>
              )}
              {e === "recurrences" && (
                <>
                  <div className="form-grid">
                    {select("frequency", "Repetir", [
                      ["monthly", "Todo mês"],
                      ["weekly", "Toda semana"],
                      ["yearly", "Todo ano"],
                    ])}
                    {field("end_date", "Encerrar em (opcional)", {
                      type: "date",
                      required: false,
                    })}
                  </div>
                  {select("active", "Estado", [
                    ["true", "Ativa"],
                    ["false", "Pausada"],
                  ])}
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={values.auto_post === "true"}
                      onChange={(e) =>
                        update("auto_post", String(e.target.checked))
                      }
                    />
                    <span>Registrar automaticamente na data</span>
                  </label>
                  <p className="form-help">
                    Sem essa opção, o item aparecerá em “Para confirmar”, nos
                    Lançamentos. Você recebe, paga ou pula o mês com um toque. O
                    registro automático começa hoje; datas anteriores sempre
                    aguardam sua confirmação.
                  </p>
                  {(() => {
                    const account = data.accounts.find(
                      (a) =>
                        a.id ===
                        (values.kind === "income"
                          ? values.target_account_id
                          : values.source_account_id),
                    );
                    return account &&
                      values.start_date < account.opening_date ? (
                      <p className="info-box">
                        <Info size={18} />
                        Esta conta começa em{" "}
                        {account.opening_date.split("-").reverse().join("/")}.
                        Só vamos incluir ocorrências a partir dessa data. Para
                        registrar antes, confira a data e o saldo inicial em
                        Minhas contas.
                      </p>
                    ) : null;
                  })()}
                  {values.start_date && values.start_date < today() && (
                    <p className="info-box">
                      <Info size={18} />
                      As ocorrências anteriores a hoje, dentro do histórico
                      desta conta, serão incluídas como pendentes. Revise em
                      Lançamentos; seu saldo antigo será mantido até você
                      confirmar.
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {e === "goals" && (
            <>
              <div className="form-field">
                <span>Formato da meta</span>
                <SelectControl
                  label="Formato da meta"
                  allowEmpty={false}
                  value={goalModel}
                  onChange={(v) => {
                    const nextModel = v as "free" | "piggy" | "progressive";
                    setGoalModel(nextModel);
                    if (nextModel === "piggy") {
                      const total = piggyBankTotalCents(effectivePiggyMax);
                      setValues((old) => ({
                        ...old,
                        target_cents: moneyInput(total),
                        target_date: old.target_date || addMonths(today(), 12),
                      }));
                    }
                  }}
                  options={[
                    ["free", "Meta tradicional (valor fixo)"],
                    [
                      "piggy",
                      "Desafio do Cofrinho (cartela de 1 a 500 = R$ 125.250)",
                    ],
                    [
                      "progressive",
                      "Cofrinho mensal progressivo (guardar mais a cada mês)",
                    ],
                  ]}
                />
              </div>
              {goalModel === "piggy" && (
                <div className="goal-conditions stack">
                  <div className="form-grid">
                    <div className="form-field">
                      <span>Tamanho da cartela do cofrinho</span>
                      <SelectControl
                        label="Tamanho da cartela do cofrinho"
                        allowEmpty={false}
                        value={piggyMax}
                        onChange={(v) => {
                          setPiggyMax(v);
                          const n =
                            v === "custom"
                              ? Math.max(
                                  2,
                                  Math.min(
                                    2000,
                                    Math.trunc(Number(customPiggyMax) || 150),
                                  ),
                                )
                              : Number(v) || 500;
                          const total = piggyBankTotalCents(n);
                          setValues((old) => ({
                            ...old,
                            target_cents: moneyInput(total),
                          }));
                        }}
                        options={[
                          ["500", "1 a 500 reais (Total: R$ 125.250,00)"],
                          ["365", "1 a 365 reais (Total: R$ 66.795,00)"],
                          ["200", "1 a 200 reais (Total: R$ 20.100,00)"],
                          ["100", "1 a 100 reais (Total: R$ 5.050,00)"],
                          ["custom", "Outro tamanho (personalizado)"],
                        ]}
                      />
                    </div>
                    {piggyMax === "custom" && (
                      <label className="form-field">
                        <span>Quantidade de números (de 1 até...)</span>
                        <input
                          type="number"
                          aria-label="Quantidade de números (de 1 até...)"
                          min={2}
                          max={2000}
                          placeholder="Ex.: 50, 150, 250..."
                          value={customPiggyMax}
                          onChange={(ev) => {
                            const raw = ev.target.value;
                            setCustomPiggyMax(raw);
                            const parsed = Number(raw);
                            if (Number.isFinite(parsed) && parsed >= 2) {
                              const clamped = Math.max(
                                2,
                                Math.min(2000, Math.trunc(parsed)),
                              );
                              const total = piggyBankTotalCents(clamped);
                              setValues((old) => ({
                                ...old,
                                target_cents: moneyInput(total),
                              }));
                            }
                          }}
                        />
                        <small>
                          Total de 1 a {effectivePiggyMax}:{" "}
                          <strong>
                            {formatMoney(piggyBankTotalCents(effectivePiggyMax))}
                          </strong>
                        </small>
                      </label>
                    )}
                  </div>
                  <p className="form-help">
                    Ao salvar, sua meta terá um retângulo interativo com os
                    números de 1 a {effectivePiggyMax} (total de{" "}
                    {formatMoney(piggyBankTotalCents(effectivePiggyMax))}).
                    Conforme você reservar cada valor, basta clicar nos números
                    para marcá-los.
                  </p>
                </div>
              )}
              {goalModel === "progressive" && (
                <div className="goal-conditions stack">
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Guardar no 1º mês (R$)</span>
                      <MoneyInput
                        aria-label="Guardar no 1º mês (R$)"
                        value={progStart}
                        onValueChange={setProgStart}
                      />
                    </label>
                    <label className="form-field">
                      <span>Aumentar por mês (R$)</span>
                      <MoneyInput
                        aria-label="Aumentar por mês (R$)"
                        value={progStep}
                        onValueChange={setProgStep}
                      />
                    </label>
                  </div>
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Durante quantos meses?</span>
                      <input
                        type="number"
                        min={2}
                        max={240}
                        value={progMonths}
                        onChange={(ev) => setProgMonths(ev.target.value)}
                      />
                    </label>
                    <div className="form-field">
                      <span>Aplicar cálculo progressivo</span>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => {
                          try {
                            const s = parseMoney(progStart || "0,00");
                            const step = parseMoney(progStep || "0,00");
                            const m = Math.max(
                              2,
                              Math.min(240, Number(progMonths) || 12),
                            );
                            const total = progressiveMonthlyTotalCents(
                              s,
                              step,
                              m,
                            );
                            setValues((old) => ({
                              ...old,
                              target_cents: moneyInput(total),
                              target_date: addMonths(today(), m),
                            }));
                          } catch {
                            // Ignore invalid money format while typing
                          }
                        }}
                      >
                        Preencher meta progressiva
                      </button>
                    </div>
                  </div>
                  {(() => {
                    try {
                      const s = parseMoney(progStart || "0,00");
                      const step = parseMoney(progStep || "0,00");
                      const m = Math.max(
                        2,
                        Math.min(240, Number(progMonths) || 12),
                      );
                      const lastMonth = s + (m - 1) * step;
                      const total = progressiveMonthlyTotalCents(s, step, m);
                      return (
                        <p className="form-help">
                          Começando com {formatMoney(s)} no mês 1 e subindo{" "}
                          {formatMoney(step)} por mês, no mês {m} você guarda{" "}
                          {formatMoney(lastMonth)} e acumula{" "}
                          <strong>{formatMoney(total)}</strong>.
                        </p>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                </div>
              )}
              <div className="form-grid">
                {field("target_cents", "Valor da meta (R$)")}
                {field("target_date", "Data alvo", { type: "date" })}
              </div>
              <div className="form-grid">
                {field("priority", "Prioridade (1 = maior)", {
                  type: "number",
                  min: "1",
                  max: "99",
                })}
                {field("monthly_budget_cents", "Teto mensal (R$)", {
                  required: false,
                  hint: "Vazio = sem teto no planejamento.",
                })}
              </div>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={values.completed === "true"}
                  onChange={(event) =>
                    update("completed", String(event.target.checked))
                  }
                />
                <span>Esta meta já foi concluída</span>
              </label>
              <p className="form-help">
                Marque quando o objetivo acontecer, como finalizar a mudança. O
                saldo reservado continua visível para você administrar.
              </p>
              <GoalConditions
                goals={data.goals}
                goalId={state.record?.id as string | undefined}
                value={conditions}
                onChange={setConditions}
              />
            </>
          )}
          {e === "contributions" && (
            <>
              {select(
                "goal_id",
                "Meta",
                data.goals.map((g) => [g.id, g.name]),
              )}
              {(() => {
                const goal = data.goals.find((g) => g.id === values.goal_id);
                const blockers = goal
                  ? goalBlockers(goal, data.goals, data.contributions)
                  : [];
                return blockers.length ? (
                  <p className="info-box">
                    No Planejamento, esta meta aguarda: {blockers.join("; ")}.
                    Você está escolhendo fazer um aporte manual mesmo assim.
                  </p>
                ) : null;
              })()}
              {select(
                "account_id",
                "Conta com o recurso",
                data.accounts
                  .filter(
                    (a) => a.kind !== "benefit" && a.kind !== "credit_card",
                  )
                  .map((a) => [a.id, a.name]),
              )}
              <div className="form-grid">
                {field("amount_cents", "Reservar (R$)")}
                {field("date", "Data", { type: "date", max: today() })}
              </div>
              {field("note", "Observação (opcional)", { required: false })}
              <p className="info-box">
                <Info size={18} /> Reservar para uma meta não movimenta
                dinheiro. O valor deve estar disponível na conta escolhida.
              </p>
            </>
          )}
          {e === "investments" && (
            <>
              {select(
                "account_id",
                "Conta de investimento",
                data.accounts
                  .filter((a) => a.kind === "investment")
                  .map((a) => [a.id, a.name]),
              )}
              <div className="form-grid">
                {field("annual_rate", "Taxa anual esperada (%)")}
                {field("inflation_rate", "Inflação anual assumida (%)")}
              </div>
              <button
                type="button"
                className="button secondary"
                disabled={fetchingIpca}
                onClick={async () => {
                  setFetchingIpca(true);
                  try {
                    const r = await fetch("/api/indicators/ipca");
                    const b = await r.json();
                    if (!r.ok) throw new Error(b.error);
                    update(
                      "inflation_rate",
                      (b.annual_rate * 100).toFixed(4).replace(".", ","),
                    );
                    setIpca(
                      `IPCA observado em 12 meses, de ${b.from} a ${b.until}. Fonte: ${b.source}. Usá-lo na projeção é uma hipótese, não uma previsão.`,
                    );
                  } catch (e) {
                    setIpca(
                      e instanceof Error
                        ? e.message
                        : "Não foi possível consultar. Informe uma taxa manual.",
                    );
                  } finally {
                    setFetchingIpca(false);
                  }
                }}
              >
                {fetchingIpca ? "Consultando…" : "Usar último IPCA de 12 meses"}
              </button>
              {ipca && (
                <p className="form-help" role="status">
                  {ipca}
                </p>
              )}
              <p className="form-help">
                Você encontra a taxa da aplicação na carteira ou no contrato do
                seu banco. Informe a taxa anual efetiva, não o percentual do
                CDI. Taxas são hipóteses para simular. Aplicações e resgates
                usam transferências; rendimentos realizados são informados
                separadamente.
              </p>
            </>
          )}
          {e === "loans" && (
            <>
              {select("kind", "Tipo de contrato", [
                ["loan", "Empréstimo"],
                ["financing", "Financiamento"],
              ])}
              {field("institution", "Banco ou instituição (opcional)", {
                required: false,
              })}
              <div className="form-grid">
                {field("principal_cents", "Valor financiado (R$), opcional", {
                  required: false,
                })}
                {field("installment_cents", "Valor da parcela (R$)")}
              </div>
              <div className="form-grid">
                {field("total_installments", "Total de parcelas", {
                  type: "number",
                  min: "1",
                  max: "1200",
                })}
                {field("paid_before", "Parcelas pagas antes de usar o app", {
                  type: "number",
                  min: "0",
                  max: values.total_installments,
                })}
              </div>
              {field(
                "first_due_date",
                "Vencimento da primeira parcela do contrato",
                { type: "date" },
              )}
              <div className="form-grid">
                {field("monthly_rate", "Juros mensais (%), opcional", {
                  required: false,
                })}
                {field("cet_annual_rate", "CET anual (%), opcional", {
                  required: false,
                })}
              </div>
              {select(
                "account_id",
                "Conta sugerida para pagar",
                data.accounts
                  .filter((a) => ["checking", "cash"].includes(a.kind))
                  .map((a) => [a.id, a.name]),
                false,
              )}
              <p className="form-help">
                O histórico já pago não cria despesas antigas. Cada novo
                pagamento entra uma vez nos Lançamentos. Juros mensais e CET são
                informações diferentes; consulte o contrato. Esta versão
                acompanha parcelas fixas.
              </p>
            </>
          )}
          {data.accounts.length === 0 && e !== "accounts" && e !== "goals" && (
            <p className="info-box">
              Crie uma conta antes de registrar movimentos ou aportes.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-foot">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </dialog>
  );
}
