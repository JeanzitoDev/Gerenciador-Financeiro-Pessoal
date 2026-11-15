import type { ReactNode } from "react";
import { monthLabel } from "@/lib/finance/dates";
import type { AccountMonthlyRow, PeriodReportRow } from "@/lib/finance/reports";

type MoneyLabel = (cents: number) => string;

function ReportMobileRow({ title, caption, amountLabel, amount, children }: {
  title: string;
  caption?: string;
  amountLabel: string;
  amount: string;
  children: ReactNode;
}) {
  return (
    <details className="report-mobile-row">
      <summary>
        <span className="report-mobile-label">
          <strong>{title}</strong>
          {caption && <small>{caption}</small>}
        </span>
        <span className="report-mobile-amount">
          <small>{amountLabel}</small>
          <strong>{amount}</strong>
        </span>
      </summary>
      <dl>{children}</dl>
    </details>
  );
}

export function MobileAccountRows({ accounts, value }: {
  accounts: AccountMonthlyRow[];
  value: MoneyLabel;
}) {
  return (
    <div className="report-mobile-rows">
      {accounts.map((row) => (
        <ReportMobileRow
          key={row.account.id}
          title={row.account.name}
          caption={`Resultado no mês · ${value(row.income - row.expense)}`}
          amountLabel="Saldo atual"
          amount={value(row.balance)}
        >
          <div><dt>Entradas no mês</dt><dd>{value(row.income)}</dd></div>
          <div><dt>Saídas no mês</dt><dd>{value(row.expense)}</dd></div>
          <div><dt>Guardado em metas</dt><dd>{value(row.savedInMonth)}</dd></div>
          <div><dt>Livre para usar</dt><dd>{value(row.available)}</dd></div>
          {row.overdraftLimit > 0 && (
            <>
              <div><dt>Cheque especial usado</dt><dd>{value(row.overdraftUsed)}</dd></div>
              <div><dt>Cheque especial livre</dt><dd>{value(row.overdraftRemaining)}</dd></div>
            </>
          )}
        </ReportMobileRow>
      ))}
    </div>
  );
}

export function MobileHistoryRows({ periods, currentMonth, value, ratioLabel }: {
  periods: PeriodReportRow[];
  currentMonth: string;
  value: MoneyLabel;
  ratioLabel: (ratio: number) => string;
}) {
  return (
    <div className="report-mobile-rows">
      {[...periods].reverse().map((period) => (
        <ReportMobileRow
          key={period.key}
          title={monthLabel(period.key)}
          caption={period.key === currentMonth ? "Em andamento" : undefined}
          amountLabel="Resultado"
          amount={value(period.result)}
        >
          <div><dt>Receitas</dt><dd>{value(period.income)}</dd></div>
          <div><dt>Despesas</dt><dd>{value(period.expense)}</dd></div>
          <div><dt>Guardado em metas</dt><dd>{value(period.savedInMonth)}</dd></div>
          <div><dt>Margem</dt><dd>{period.savingsRate === null ? "—" : ratioLabel(period.savingsRate)}</dd></div>
        </ReportMobileRow>
      ))}
    </div>
  );
}
