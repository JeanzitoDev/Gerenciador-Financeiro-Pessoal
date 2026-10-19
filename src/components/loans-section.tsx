"use client";
import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  Landmark,
  Calculator,
} from "lucide-react";
import type { FinanceData, Loan } from "@/lib/types";
import { loanSummary, simulateAmortization } from "@/lib/finance/loans";
import {
  formatMoney,
  moneyInput,
  parseMoney,
  percent,
  sumCents,
} from "@/lib/finance/money";
import { today, formatDate } from "@/lib/finance/dates";
import MoneyInput from "./money-input";
import SelectControl from "./select-control";
import DateControl from "./date-control";
export type LoanPayment = {
  id: string;
  number: number;
  account_id: string;
  date: string;
  amount_cents: number;
};
function LoanCard({
  loan,
  data,
  hidden,
  onEdit,
  onDelete,
  onPay,
}: {
  loan: Loan;
  data: FinanceData;
  hidden: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPay: (p: LoanPayment) => Promise<void>;
}) {
  const summary = loanSummary(loan, data.transactions),
    next = summary.remaining[0];
  const [number, setNumber] = useState(String(next?.number ?? "")),
    [account, setAccount] = useState(loan.account_id ?? ""),
    [amount, setAmount] = useState(moneyInput(loan.installment_cents)),
    [date, setDate] = useState(today()),
    [extra, setExtra] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const cash = data.accounts.filter((a) =>
    ["cash", "checking"].includes(a.kind),
  );
  const value = (n: number) => (hidden ? "R$ •••••" : formatMoney(n));
  const simulation = (() => {
    if (!extra || loan.monthly_rate === null || !summary.consecutive)
      return null;
    try {
      return {
        data: simulateAmortization(
          loan.installment_cents,
          summary.remaining.length,
          loan.monthly_rate,
          parseMoney(extra),
        ),
        error: "",
      };
    } catch (e) {
      return {
        data: null,
        error: e instanceof Error ? e.message : "Revise o valor.",
      };
    }
  })();
  return (
    <article className="panel loan-card">
      <div className="section-head">
        <span className="square-icon">
          <Landmark size={21} />
        </span>
        <div className="row-actions">
          <button
            className="icon-button"
            aria-label={`Editar ${loan.name}`}
            onClick={onEdit}
          >
            <Pencil size={16} />
          </button>
          <button
            className="icon-button"
            aria-label={`Excluir ${loan.name}`}
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <p className="eyebrow">
        {loan.kind === "financing" ? "Financiamento" : "Empréstimo"}
        {loan.institution ? ` · ${loan.institution}` : ""}
      </p>
      <h2>{loan.name}</h2>
      <strong className="account-balance">
        {value(loan.installment_cents)}
        <small> / mês</small>
      </strong>
      <p className="muted">
        {summary.paid} de {loan.total_installments} parcelas pagas
      </p>
      <progress
        value={summary.paid}
        max={loan.total_installments}
        aria-label={`Parcelas pagas de ${loan.name}`}
      />
      <div className="loan-totals">
        <div>
          <span>Parcelas que faltam pagar</span>
          <strong>{value(summary.gross)}</strong>
        </div>
        <div>
          <span>Saldo para quitar, estimado</span>
          <strong>
            {summary.estimatedBalance === null
              ? "Informe os juros"
              : value(summary.estimatedBalance)}
          </strong>
        </div>
      </div>
      <p className="small-note">
        Juros:{" "}
        {loan.monthly_rate === null
          ? "não informados"
          : `${percent(loan.monthly_rate)} ao mês`}{" "}
        · CET:{" "}
        {loan.cet_annual_rate === null
          ? "não informado"
          : `${percent(loan.cet_annual_rate)} ao ano`}
        {loan.principal_cents !== null
          ? ` · Valor financiado: ${value(loan.principal_cents)}`
          : ""}
      </p>
      {!!next && (
        <details className="loan-details">
          <summary>Registrar pagamento da parcela</summary>
          <form
            className="loan-payment-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const details = e.currentTarget.closest("details");
              setBusy(true);
              setError("");
              try {
                const selected = summary.remaining.some(
                  (i) => i.number === Number(number),
                )
                  ? Number(number)
                  : next.number;
                await onPay({
                  id: loan.id,
                  number: selected,
                  account_id: account,
                  date,
                  amount_cents: parseMoney(amount),
                });
                setNumber("");
                if (details) details.open = false;
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Não foi possível pagar.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <div className="form-field">
                <span>Parcela</span>
                <SelectControl
                  label={`Parcela de ${loan.name}`}
                  value={
                    summary.remaining.some((i) => String(i.number) === number)
                      ? number
                      : String(next.number)
                  }
                  onChange={setNumber}
                  options={summary.remaining.map((i) => [
                    String(i.number),
                    `${i.number}/${loan.total_installments} · ${formatDate(i.date)}`,
                  ])}
                />
              </div>
              <div className="form-field">
                <span>Conta do pagamento</span>
                <SelectControl
                  label={`Conta de ${loan.name}`}
                  value={account}
                  onChange={setAccount}
                  options={cash.map((a) => [a.id, a.name])}
                />
              </div>
            </div>
            <div className="form-grid">
              <label className="form-field">
                <span>Valor pago (R$)</span>
                <MoneyInput
                  aria-label={`Valor pago em ${loan.name}`}
                  required
                  value={amount}
                  onValueChange={setAmount}
                />
              </label>
              <div className="form-field">
                <span>Data do pagamento</span>
                <DateControl
                  label={`Pagamento de ${loan.name}`}
                  value={date}
                  onChange={setDate}
                  max={today()}
                />
              </div>
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="button primary"
              disabled={busy || !account}
            >
              <Check size={16} />
              {busy ? "Registrando…" : "Paguei esta parcela"}
            </button>
            <p className="small-note">
              Cria uma única despesa vinculada ao contrato. Não lance o mesmo
              pagamento manualmente.
            </p>
          </form>
        </details>
      )}
      {!!summary.remaining.length && (
        <details className="loan-details">
          <summary>
            <Calculator size={16} />E se eu amortizar?
          </summary>
          {loan.monthly_rate === null ? (
            <p className="form-help">
              Edite o contrato e informe a taxa de juros mensal. O CET sozinho
              não serve para este cálculo.
            </p>
          ) : !summary.consecutive ? (
            <p className="form-help">
              A estimativa considera parcelas pagas em sequência. Confira os
              pagamentos fora de ordem antes de simular.
            </p>
          ) : (
            <>
              <label className="form-field">
                <span>Quanto você quer antecipar? (R$)</span>
                <MoneyInput value={extra} onValueChange={setExtra} />
              </label>
              {simulation?.data && (
                <div className="amortization-results" role="status">
                  <p>
                    <strong>Reduzindo o prazo:</strong> cerca de{" "}
                    {simulation.data.months} parcelas restantes e economia
                    estimada de {value(simulation.data.saved)}.
                  </p>
                  <p>
                    <strong>Mantendo o prazo:</strong> parcela estimada de{" "}
                    {value(simulation.data.reducedPayment)}.
                  </p>
                </div>
              )}
              {simulation?.error && (
                <p role="alert" className="form-error">
                  {simulation.error}
                </p>
              )}
              <p className="small-note">
                Estimativa de parcelas fixas mensais (modelo Price),
                imediatamente após o último pagamento, sem taxas extras, atraso
                ou correção monetária. O banco informa o valor definitivo.
                Simular não movimenta seu dinheiro.
              </p>
            </>
          )}
        </details>
      )}
      <details className="loan-details">
        <summary>Ver parcelas e histórico</summary>
        <div className="installment-list">
          {summary.schedule.map((i) => (
            <div key={i.number}>
              <span>
                {i.number}/{loan.total_installments} · {formatDate(i.date)}
              </span>
              <strong>{value(i.amount)}</strong>
              <span className={`badge ${i.paid ? "success" : ""}`}>
                {i.historical
                  ? "Paga antes do app"
                  : i.paid
                    ? "Paga"
                    : "A pagar"}
              </span>
            </div>
          ))}
        </div>
      </details>
    </article>
  );
}
export default function LoansSection({
  data,
  hidden,
  onNew,
  onEdit,
  onDelete,
  onPay,
}: {
  data: FinanceData;
  hidden: boolean;
  onNew: () => void;
  onEdit: (l: Loan) => void;
  onDelete: (l: Loan) => void;
  onPay: (p: LoanPayment) => Promise<void>;
}) {
  const loans = data.loans ?? [];
  const remaining = sumCents(
    loans.map((l) => loanSummary(l, data.transactions).gross),
  );
  return (
    <>
      <div className="toolbar">
        <div className="inline-summary">
          <span>Parcelas restantes de todos os contratos</span>
          <strong>{hidden ? "R$ •••••" : formatMoney(remaining)}</strong>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={17} />
          Novo contrato
        </button>
      </div>
      {loans.length ? (
        <div className="loans-grid">
          {loans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              data={data}
              hidden={hidden}
              onEdit={() => onEdit(loan)}
              onDelete={() => onDelete(loan)}
              onPay={onPay}
            />
          ))}
        </div>
      ) : (
        <section className="panel empty-state">
          <Landmark size={30} />
          <h2>Seus contratos, sem perder a conta</h2>
          <p>
            Acompanhe empréstimos e financiamentos com parcelas fixas, o que já
            pagou e o que falta.
          </p>
          <button className="button primary" onClick={onNew}>
            Cadastrar primeiro contrato
          </button>
        </section>
      )}
      <p className="small-note">
        O valor contratado não é lançado como receita automaticamente. As
        parcelas pagas entram nas despesas; parcelas futuras não reduzem o saldo
        atual.
      </p>
    </>
  );
}
