"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { formatDate, monthLabel } from "@/lib/finance/dates";
import { formatMoney, percent } from "@/lib/finance/money";
import type { MonthlyReport } from "@/lib/finance/reports";

const budgetGuide = "https://www.bcb.gov.br/meubc/faqs/s/educacao-financeira-sub";

function monthBalance(report: MonthlyReport, hidden: boolean) {
  if (report.current.income === 0 && report.current.expense === 0) return "Sem receitas ou despesas confirmadas";
  if (hidden) return "Resultado do período";
  if (report.current.result > 0) return "As receitas superaram as despesas";
  if (report.current.result < 0) return "As despesas superaram as receitas";
  return "As receitas cobriram as despesas";
}

function reportMoney(cents: number, hidden: boolean) {
  return hidden ? "R$ •••••" : formatMoney(cents);
}

function ReportTotals({ report, hidden, compare = false }: {
  report: MonthlyReport;
  hidden: boolean;
  compare?: boolean;
}) {
  const rows = [
    { label: "Receitas", amount: report.current.income, delta: report.deltas.incomeDiff },
    { label: "Despesas", amount: report.current.expense, delta: report.deltas.expenseDiff },
    { label: "Resultado", amount: report.current.result, delta: report.deltas.resultDiff },
  ];
  return (
    <dl className="report-reading-totals">
      {rows.map(({ label, amount, delta }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{reportMoney(amount, hidden)}</dd>
          {compare && report.comparison.hasPreviousActivity && (
            <dd className="report-delta">
              {hidden ? "Variação oculta" : delta === 0 ? "Sem variação" : `${delta > 0 ? "+" : "−"}${formatMoney(Math.abs(delta))}`}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

function SpendingChange({ report, hidden }: { report: MonthlyReport; hidden: boolean }) {
  const change = report.comparison.expenseChange;
  if (report.current.income === 0 && report.current.expense === 0) {
    return <p>O período precisa de receitas ou despesas confirmadas para a comparação.</p>;
  }
  if (!report.comparison.hasPreviousActivity) {
    return <p>O mês anterior ainda não tem receitas ou despesas confirmadas para comparar.</p>;
  }
  if (!change) return <p>As despesas por categoria ficaram iguais ao período de comparação.</p>;
  return (
    <p>
      <strong>{change.name}</strong> teve a maior variação nas despesas
      {hidden ? "." : `, com ${formatMoney(Math.abs(change.difference))} ${change.difference > 0 ? "a mais" : "a menos"}.`}
    </p>
  );
}

export function MonthlyReportReading({ report, asOf, hidden, reviewMonth, onReview }: {
  report: MonthlyReport;
  asOf: string;
  hidden: boolean;
  reviewMonth: string;
  onReview: () => void;
}) {
  const currentMonth = asOf.slice(0, 7);
  const active = report.month === currentMonth;
  const future = report.month > currentMonth;
  const top = report.expenseCategories[0];
  const comparable = report.comparison.hasPreviousActivity && !future &&
    (report.current.income > 0 || report.current.expense > 0);
  return (
    <section className="panel report-reading" aria-label="Análise do mês">
      <div className="report-reading-head">
        <div>
          <p className="eyebrow">{monthLabel(report.month)}</p>
          <h2>{future ? "Mês futuro" : monthBalance(report, hidden)}</h2>
          {active && <p className="muted">Mês em andamento · realizados até {formatDate(asOf)}</p>}
          {!active && !future && <p className="muted">Mês fechado</p>}
        </div>
        <button type="button" className="button primary" onClick={onReview}>
          Retrospectiva de {monthLabel(reviewMonth)} <ArrowRight size={16} />
        </button>
      </div>
      {!future && (
        <p className="report-comparison-label">
          {comparable
            ? report.comparison.through
              ? `Variação comparada ao acumulado até ${formatDate(report.comparison.through)}`
              : `Variação em relação a ${monthLabel(report.previousMonth)}`
            : "Receitas e despesas realizadas"}
        </p>
      )}
      <ReportTotals report={report} hidden={hidden} compare={comparable} />
      {!future && (
        <div className="report-reading-insights">
          {top && (
            <p><strong>{top.name}</strong> liderou as despesas{hidden ? "." : ` com ${percent(top.share)} do total.`}</p>
          )}
          <SpendingChange report={report} hidden={hidden} />
        </div>
      )}
    </section>
  );
}

const chapters = ["Como o mês fechou", "Onde o dinheiro foi", "O que mudou", "Sinais do orçamento"];

export function MonthlyRetrospective({ report, hidden, scope, onClose }: {
  report: MonthlyReport;
  hidden: boolean;
  scope: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [chapter, setChapter] = useState(0);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const current = report.current;
  const primaryIncome = report.incomeCategories[0];
  const pending = current.plannedIncome > 0 || current.plannedExpense > 0;

  return (
    <dialog
      ref={dialog}
      className="record-dialog monthly-retrospective"
      aria-label={`Retrospectiva de ${monthLabel(report.month)}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-head">
        <div>
          <p className="eyebrow">Retrospectiva · {scope}</p>
          <h2>{monthLabel(report.month)}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar retrospectiva">
          <X size={20} />
        </button>
      </div>
      <div className="dialog-fields retrospective-body">
        <div className="retrospective-progress" aria-label={`Capítulo ${chapter + 1} de ${chapters.length}`}>
          {chapters.map((title, index) => (
            <button type="button" key={title} onClick={() => setChapter(index)} aria-label={title} aria-pressed={index === chapter} />
          ))}
        </div>
        <section aria-live="polite">
          <h3>{chapters[chapter]}</h3>
          {chapter === 0 && (
            <>
              <p>{monthBalance(report, hidden)}.</p>
              <ReportTotals report={report} hidden={hidden} />
              {primaryIncome && <p><strong>{primaryIncome.name}</strong> foi a maior origem de receitas.</p>}
            </>
          )}
          {chapter === 1 && (
            <>
              {report.expenseCategories.length > 0 ? (
                <dl className="retrospective-categories">
                  {report.expenseCategories.slice(0, 3).map((category) => (
                    <div key={category.name}>
                      <dt>{category.name}</dt>
                      <dd>{reportMoney(category.value, hidden)}{!hidden && ` · ${percent(category.share)}`}</dd>
                    </div>
                  ))}
                </dl>
              ) : <p>Nenhuma despesa confirmada no período.</p>}
            </>
          )}
          {chapter === 2 && (
            <>
              <p>Comparação com {monthLabel(report.previousMonth)}.</p>
              {report.comparison.hasPreviousActivity && (current.income > 0 || current.expense > 0) && (
                <ReportTotals report={report} hidden={hidden} compare />
              )}
              <SpendingChange report={report} hidden={hidden} />
            </>
          )}
          {chapter === 3 && (
            <>
              <p>{monthBalance(report, hidden)}.</p>
              <dl className="report-reading-totals">
                <div>
                  <dt>Margem sobre as receitas</dt>
                  <dd>{hidden ? "•••••" : current.savingsRate === null ? "Sem receita registrada" : percent(current.savingsRate)}</dd>
                </div>
                <div>
                  <dt>Aportes a metas</dt>
                  <dd>{reportMoney(current.savedInMonth, hidden)}</dd>
                </div>
                <div>
                  <dt>Recorrências e dívidas</dt>
                  <dd>{reportMoney(current.fixedExpense, hidden)}</dd>
                </div>
              </dl>
              {pending && <p>Há lançamentos previstos em aberto. Eles ficam fora dos totais realizados.</p>}
              <p className="small-note">
                Cobrir as despesas com as receitas é uma referência para equilibrar o orçamento. A margem mostra a diferença proporcional e os aportes mostram o que foi destinado às metas.{" "}
                <a href={budgetGuide} target="_blank" rel="noreferrer">Educação financeira do Banco Central</a>
              </p>
            </>
          )}
        </section>
      </div>
      <div className="dialog-foot">
        <button type="button" className="button secondary" disabled={chapter === 0} onClick={() => setChapter(chapter - 1)}>Voltar</button>
        <button type="button" className="button primary" onClick={() => chapter === chapters.length - 1 ? onClose() : setChapter(chapter + 1)}>
          {chapter === chapters.length - 1 ? "Concluir" : "Continuar"}
        </button>
      </div>
    </dialog>
  );
}
