"use client";
import { useEffect, useRef, useState } from "react";
import { X, ArrowRight, Info } from "lucide-react";
import type { Entity, FinanceData } from "@/lib/types";
import { moneyInput, parseMoney } from "@/lib/finance/money";
import { today } from "@/lib/finance/dates";
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
  ["investment", "Investimento"],
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
};
const currencyKeys = [
  "amount_cents",
  "opening_cents",
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
  const [values, setValues] = useState<Record<string, string>>(() => {
    const row = { ...state.record, ...state.preset },
      base = {
        ...emptyDefaults,
        kind:
          state.entity === "accounts"
            ? "checking"
            : state.entity === "transactions"
              ? "expense"
              : "income",
      } as Record<string, string>;
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) base[key] = "";
      else if (currencyKeys.includes(key))
        base[key] = moneyInput(Number(value));
      else if (key === "annual_rate" || key === "inflation_rate")
        base[key] = String(Number(value) * 100).replace(".", ",");
      else base[key] = String(value);
    }
    return base;
  });
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
    },
  ) => (
    <label className="form-field" key={key}>
      <span>{label}</span>
      <input
        name={key}
        value={values[key] ?? ""}
        onChange={(e) => update(key, e.target.value)}
        type={options?.type ?? "text"}
        required={options?.required ?? true}
        inputMode={
          currencyKeys.includes(key) || key.includes("rate")
            ? "decimal"
            : undefined
        }
        min={options?.min}
        max={options?.max}
        maxLength={
          key === "description" ? 140 : key === "note" ? 200 : undefined
        }
        placeholder={currencyKeys.includes(key) ? "0,00" : undefined}
      />
      {options?.hint && <small>{options.hint}</small>}
    </label>
  );
  const select = (
    key: string,
    label: string,
    options: string[][],
    required = true,
  ) => (
    <label className="form-field" key={key}>
      <span>{label}</span>
      <select
        name={key}
        value={values[key]}
        onChange={(e) => update(key, e.target.value)}
        required={required}
      >
        <option value="">Selecione</option>
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
  const accounts = data.accounts.map((a) => [a.id, a.name]);
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
        case "accounts":
          payload = {
            name: v.name,
            kind: v.kind,
            opening_cents: money("opening_cents"),
            opening_date: v.opening_date,
          };
          break;
        case "goals":
          payload = {
            name: v.name,
            target_cents: money("target_cents"),
            target_date: v.target_date,
            priority: Number(v.priority),
            monthly_budget_cents: money("monthly_budget_cents", true),
          };
          break;
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
        case "transactions":
          payload = {
            kind: v.kind,
            description: v.description,
            amount_cents: money("amount_cents"),
            date: v.date,
            status: v.status,
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
          };
          break;
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
              {state.record ? "Editar" : "Novo"} {labels[e]}
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
          {(e === "accounts" || e === "goals" || e === "investments") &&
            field("name", "Nome")}
          {e === "accounts" && (
            <>
              {select("kind", "Tipo de conta", accountKinds)}
              <div className="form-grid">
                {field("opening_cents", "Saldo inicial (R$)")}
                {field("opening_date", "Data do saldo inicial", {
                  type: "date",
                  max: today(),
                })}
              </div>
              <p className="form-help">
                Informe o saldo na data de início. Os próximos movimentos
                atualizam o saldo automaticamente.
              </p>
            </>
          )}
          {(e === "transactions" || e === "recurrences") && (
            <>
              {select(
                "kind",
                "Tipo",
                e === "recurrences" ? kinds.slice(0, 2) : kinds,
              )}
              {field("description", "Descrição")}
              <div className="form-grid">
                {field(
                  "amount_cents",
                  values.kind === "yield"
                    ? "Rendimento em R$ (aceita perda)"
                    : "Valor líquido (R$)",
                )}
                {e === "transactions"
                  ? field("date", "Data", {
                      type: "date",
                      max: values.status === "posted" ? today() : undefined,
                    })
                  : field("start_date", "Primeira ocorrência", {
                      type: "date",
                    })}
              </div>
              {["expense", "transfer"].includes(values.kind) &&
                select("source_account_id", "Conta de origem", accounts)}
              {values.kind !== "expense" &&
                select(
                  "target_account_id",
                  "Conta de destino",
                  values.kind === "yield"
                    ? data.accounts
                        .filter((a) => a.kind === "investment")
                        .map((a) => [a.id, a.name])
                    : accounts,
                )}
              {field("category", "Categoria")}
              {e === "transactions" &&
                select("status", "Situação", [
                  ["posted", "Realizado"],
                  ["planned", "Previsto"],
                ])}
              {e === "transactions" && values.kind === "income" && (
                <details className="salary-details">
                  <summary>
                    Salário: informar bruto e descontos (opcional)
                  </summary>
                  <div className="form-grid">
                    {field("gross_cents", "Bruto (R$)", { required: false })}
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
                  <p className="form-help">
                    Gere previsões na tela de recorrências. Cada pagamento é
                    confirmado por você nos lançamentos.
                  </p>
                </>
              )}
            </>
          )}
          {e === "goals" && (
            <>
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
            </>
          )}
          {e === "contributions" && (
            <>
              {select(
                "goal_id",
                "Meta",
                data.goals.map((g) => [g.id, g.name]),
              )}
              {select(
                "account_id",
                "Conta com o recurso",
                data.accounts
                  .filter((a) => a.kind !== "benefit")
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
              <p className="form-help">
                Taxas são premissas para simular. Aplicações e resgates usam
                transferências; rendimentos realizados são informados
                separadamente.
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
