"use client";
import { useEffect, useRef, useState } from "react";
import { X, ArrowRight, Info } from "lucide-react";
import type { Entity, FinanceData } from "@/lib/types";
import { moneyInput, parseMoney } from "@/lib/finance/money";
import DateControl from "./date-control";
import SelectControl from "./select-control";
import CategoryInput from "./category-input";
import MoneyInput from "./money-input";
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
  auto_post: "false",
  institution: "",
  principal_cents: "",
  installment_cents: "",
  total_installments: "12",
  paid_before: "0",
  first_due_date: today(),
  monthly_rate: "",
  cet_annual_rate: "",
};
const currencyKeys = [
  "principal_cents",
  "installment_cents",
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
          {(e === "accounts" ||
            e === "goals" ||
            e === "investments" ||
            e === "loans") &&
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
                {e === "recurrences" &&
                  field("start_date", "Primeira ocorrência", { type: "date" })}
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
                  {values.kind === "income" && !state.record?.recurrence_id && (
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
