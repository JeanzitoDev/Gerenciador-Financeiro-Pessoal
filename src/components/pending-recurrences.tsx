"use client";
import { useState } from "react";
import { Check, SkipForward, SlidersHorizontal } from "lucide-react";
import type { Entry } from "@/lib/types";
import { formatDate, today } from "@/lib/finance/dates";
import { formatMoney, moneyInput, parseMoney } from "@/lib/finance/money";
import MoneyInput from "./money-input";
import DateControl from "./date-control";
function PendingItem({
  entry,
  onAction,
  hidden,
}: {
  entry: Entry;
  hidden: boolean;
  onAction: (
    entry: Entry,
    action: "confirm" | "skip",
    date?: string,
    amount?: number,
  ) => Promise<void>;
}) {
  const [adjust, setAdjust] = useState(false),
    [date, setDate] = useState(today()),
    [amount, setAmount] = useState(moneyInput(entry.amount_cents)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function act(action: "confirm" | "skip") {
    setBusy(true);
    setError("");
    try {
      await onAction(
        entry,
        action,
        action === "confirm" ? (adjust ? date : today()) : undefined,
        action === "confirm" && adjust ? parseMoney(amount) : undefined,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível confirmar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="pending-item">
      <div className="pending-info">
        <span
          className={`badge ${entry.kind === "income" ? "success" : "warning"}`}
        >
          {entry.kind === "income" ? "A receber" : "A pagar"}
        </span>
        <strong>{entry.description}</strong>
        <small>
          Previsto para {formatDate(entry.occurrence_date ?? entry.date)}
        </small>
      </div>
      <strong className="pending-amount">
        {hidden ? "R$ •••••" : formatMoney(entry.amount_cents)}
      </strong>
      <div className="button-row">
        <button
          type="button"
          className="button primary small"
          disabled={busy}
          onClick={() => void act("confirm")}
          aria-label={`Confirmar ${entry.description}`}
        >
          <Check size={16} />
          {entry.kind === "income" ? "Recebi" : "Paguei"}
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`Ajustar ${entry.description}`}
          aria-expanded={adjust}
          disabled={busy}
          onClick={() => setAdjust(!adjust)}
        >
          <SlidersHorizontal size={17} />
        </button>
        <button
          type="button"
          className="button ghost small"
          disabled={busy}
          onClick={() => void act("skip")}
          aria-label={`Pular ${entry.description}`}
        >
          <SkipForward size={16} />
          Pular
        </button>
      </div>
      {adjust && (
        <div className="pending-adjust form-grid">
          <label className="form-field">
            <span>Valor recebido ou pago (R$)</span>
            <MoneyInput
              aria-label={`Valor de ${entry.description}`}
              value={amount}
              onValueChange={setAmount}
            />
          </label>
          <div className="form-field">
            <span>Quando aconteceu?</span>
            <DateControl
              value={date}
              onChange={setDate}
              label={`Data de ${entry.description}`}
              max={today()}
            />
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </article>
  );
}
export default function PendingRecurrences({
  entries,
  onAction,
  hidden,
}: {
  entries: Entry[];
  onAction: (
    entry: Entry,
    action: "confirm" | "skip",
    date?: string,
    amount?: number,
  ) => Promise<void>;
  hidden: boolean;
}) {
  const [all, setAll] = useState(false);
  return (
    <section
      className="panel pending-panel"
      aria-label="Recorrências para confirmar"
    >
      <div className="section-head">
        <div>
          <p className="eyebrow">UM TOQUE E PRONTO</p>
          <h2>
            Para confirmar <span className="count-pill">{entries.length}</span>
          </h2>
          <p>
            Já recebeu ou pagou? Confirme aqui. Se não aconteceu neste mês, pule
            essa vez.
          </p>
        </div>
      </div>
      {entries.length ? (
        <>
          <div className="pending-list">
            {(all ? entries : entries.slice(0, 5)).map((entry) => (
              <PendingItem
                key={entry.id}
                entry={entry}
                onAction={onAction}
                hidden={hidden}
              />
            ))}
          </div>
          {entries.length > 5 && (
            <button className="text-button" onClick={() => setAll(!all)}>
              {all ? "Mostrar menos" : `Ver os ${entries.length} itens`}
            </button>
          )}
        </>
      ) : (
        <p className="empty-inline">
          Tudo em dia. Os próximos itens aparecem aqui quando chegar a data.
        </p>
      )}
    </section>
  );
}
