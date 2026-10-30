"use client";
import { useMemo, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import type { Account, Contribution, Goal } from "@/lib/types";
import { formatMoney } from "@/lib/finance/money";
import { today } from "@/lib/finance/dates";
import {
  extractMarkedNumbers,
  formatPiggyBankNote,
  inferPiggyBankSize,
  isPiggyBankGoal,
  piggyBankTotalCents,
} from "@/lib/finance/piggy-bank";
import SelectControl from "./select-control";

export default function PiggyBankBoard({
  goal,
  contributions,
  accounts,
  onReserve,
}: {
  goal: Goal;
  contributions: Contribution[];
  accounts: Account[];
  onReserve: (payload: {
    goal_id: string;
    account_id: string;
    amount_cents: number;
    date: string;
    note: string;
  }) => Promise<void>;
}) {
  const goalContributions = useMemo(
    () => contributions.filter((c) => c.goal_id === goal.id),
    [contributions, goal.id],
  );
  const isCofrinho = useMemo(
    () => isPiggyBankGoal(goal, goalContributions),
    [goal, goalContributions],
  );
  const boardSize = useMemo(
    () => inferPiggyBankSize(goal, goalContributions),
    [goal, goalContributions],
  );
  const markedMap = useMemo(
    () => extractMarkedNumbers(goalContributions, boardSize),
    [goalContributions, boardSize],
  );

  const validAccounts = useMemo(
    () => accounts.filter((a) => a.kind !== "benefit"),
    [accounts],
  );
  const [accountId, setAccountId] = useState(
    () => validAccounts[0]?.id ?? "",
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [rangePage, setRangePage] = useState<string>(() =>
    boardSize > 100 ? "1-100" : "all",
  );
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "marked"
  >("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ranges = useMemo(() => {
    const list: [string, string][] = [];
    if (boardSize > 100) {
      for (let start = 1; start <= boardSize; start += 100) {
        const end = Math.min(boardSize, start + 99);
        list.push([`${start}-${end}`, `${start}–${end}`]);
      }
    }
    list.push(["all", `1 a ${boardSize}`]);
    return list;
  }, [boardSize]);

  const visibleNumbers = useMemo(() => {
    let start = 1;
    let end = boardSize;
    if (rangePage !== "all") {
      const [s, e] = rangePage.split("-").map(Number);
      if (s && e) {
        start = s;
        end = e;
      }
    }
    const nums: number[] = [];
    for (let n = start; n <= end; n++) {
      const isMarked = markedMap.has(n);
      if (statusFilter === "pending" && isMarked) continue;
      if (statusFilter === "marked" && !isMarked) continue;
      nums.push(n);
    }
    return nums;
  }, [boardSize, markedMap, rangePage, statusFilter]);

  const selectedCents = useMemo(
    () => selected.reduce((acc, n) => acc + n * 100, 0),
    [selected],
  );
  const markedTotalCents = useMemo(() => {
    let sum = 0;
    for (const n of markedMap.keys()) sum += n * 100;
    return sum;
  }, [markedMap]);

  function toggleNumber(n: number) {
    if (markedMap.has(n)) return;
    setError("");
    setSelected((current) =>
      current.includes(n)
        ? current.filter((x) => x !== n)
        : [...current, n].sort((a, b) => a - b),
    );
  }

  async function confirmSelected() {
    if (!selected.length) return;
    const chosenAccount = accountId || validAccounts[0]?.id || "";
    if (!chosenAccount) {
      setError("Crie ou escolha uma conta com saldo disponível antes de marcar.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onReserve({
        goal_id: goal.id,
        account_id: chosenAccount,
        amount_cents: selectedCents,
        date: today(),
        note: formatPiggyBankNote(selected),
      });
      setSelected([]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível registrar os números no cofrinho.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!isCofrinho) return null;

  return (
    <details className="piggy-bank-details" open>
      <summary>
        <Sparkles size={15} />
        <span>
          Cofrinho progressivo (1 a {boardSize}) · {markedMap.size} de{" "}
          {boardSize} marcados
        </span>
      </summary>
      <div className="piggy-bank-box">
        <div className="piggy-bank-head">
          <div>
            <strong>
              Cartela de 1 a {boardSize} ({formatMoney(piggyBankTotalCents(boardSize))})
            </strong>
            <p className="small-note">
              Toque nos números que você guardou neste mês para marcá-los no
              cofrinho. Marcados na cartela: {formatMoney(markedTotalCents)}.
            </p>
          </div>
          <div className="piggy-bank-filters">
            {ranges.length > 1 && (
              <div className="segmented" role="group" aria-label="Faixa de números">
                {ranges.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={rangePage === key ? "selected active" : ""}
                    onClick={() => setRangePage(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="segmented" role="group" aria-label="Filtrar cartela">
              {(
                [
                  ["all", "Todos"],
                  ["pending", "Livres"],
                  ["marked", "Marcados"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={statusFilter === key ? "selected active" : ""}
                  onClick={() => setStatusFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className="piggy-bank-grid"
          role="group"
          aria-label={`Cartela do cofrinho de 1 a ${boardSize}`}
        >
          {visibleNumbers.map((n) => {
            const isMarked = markedMap.has(n);
            const isSelected = selected.includes(n);
            return (
              <button
                key={n}
                type="button"
                disabled={isMarked || busy}
                className={`piggy-cell ${
                  isMarked ? "marked" : isSelected ? "selected" : ""
                }`}
                onClick={() => toggleNumber(n)}
                aria-pressed={isMarked || isSelected}
                aria-label={
                  isMarked
                    ? `R$ ${n} (já guardado)`
                    : `R$ ${n} (disponível)`
                }
                title={
                  isMarked
                    ? `R$ ${n},00 já guardado no cofrinho`
                    : `Guardar R$ ${n},00 (#${n})`
                }
              >
                <span>{n}</span>
                {isMarked && <Check size={11} />}
              </button>
            );
          })}
          {visibleNumbers.length === 0 && (
            <p className="empty-inline">
              {statusFilter === "marked"
                ? "Nenhum número marcado nesta faixa ainda. Toque nos números livres na aba Todos ou Livres para guardar no cofrinho."
                : statusFilter === "pending"
                  ? "Todos os números desta faixa já foram marcados no cofrinho!"
                  : "Nenhum número nesta faixa com o filtro selecionado."}
            </p>
          )}
        </div>

        {selected.length > 0 && (
          <div className="piggy-bank-action">
            <div className="piggy-bank-selection">
              <strong>
                {selected.length}{" "}
                {selected.length === 1 ? "número selecionado" : "números selecionados"}:{" "}
                {formatMoney(selectedCents)}
              </strong>
              <small>
                Números:{" "}
                {selected
                  .slice(0, 12)
                  .map((n) => `#${n}`)
                  .join(", ")}
                {selected.length > 12 ? ` e +${selected.length - 12}` : ""}
              </small>
            </div>
            <div className="piggy-bank-controls">
              {validAccounts.length > 0 && (
                <div className="form-field">
                  <span>Conta onde o valor está guardado</span>
                  <SelectControl
                    label="Conta onde o valor está guardado"
                    allowEmpty={false}
                    value={accountId || validAccounts[0].id}
                    onChange={setAccountId}
                    options={validAccounts.map((a) => [a.id, a.name])}
                  />
                </div>
              )}
              <div className="button-row">
                <button
                  type="button"
                  className="button ghost"
                  disabled={busy}
                  onClick={() => setSelected([])}
                >
                  Limpar seleção
                </button>
                <button
                  type="button"
                  className="button primary"
                  disabled={busy}
                  onClick={confirmSelected}
                >
                  {busy
                    ? "Marcando…"
                    : `Marcar no cofrinho (${formatMoney(selectedCents)})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}

