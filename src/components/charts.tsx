"use client";
import { useId } from "react";
import { formatMoney } from "@/lib/finance/money";
export default function FinanceChart({
  labels,
  primary,
  secondary,
  primaryLabel = "Receitas",
  secondaryLabel = "Despesas",
  cashFlow = true,
  hideValues = false,
}: {
  labels: string[];
  primary: number[];
  secondary: number[];
  primaryLabel?: string;
  secondaryLabel?: string;
  cashFlow?: boolean;
  hideValues?: boolean;
}) {
  const primaryColor = cashFlow ? "var(--green)" : "var(--accent)";
  const secondaryColor = cashFlow ? "var(--red)" : "var(--chart-secondary)";
  const id = useId().replaceAll(":", "");
  const max = Math.max(...primary, ...secondary, 1),
    min = Math.min(...primary, ...secondary, 0);
  const span = max - min || 1;
  const x = (i: number) => 44 + i * (510 / Math.max(labels.length - 1, 1));
  const y = (v: number) => 160 - ((v - min) / span) * 130;
  const points = (data: number[]) =>
    data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const primaryPoints = points(primary),
    area = `44,${y(min)} ${primaryPoints} ${x(primary.length - 1)},${y(min)}`;
  const visibleLabels = labels.map((l, i) =>
    i === 0 ||
    i === labels.length - 1 ||
    labels.length <= 6 ||
    i % Math.ceil(labels.length / 5) === 0
      ? l
      : "",
  );
  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span>
          <i className="dot" style={{ background: primaryColor }} />
          {primaryLabel}
        </span>
        <span>
          <i className="dot" style={{ background: secondaryColor }} />
          {secondaryLabel}
        </span>
      </div>
      <svg
        viewBox="0 0 600 204"
        role="img"
        aria-label={`${primaryLabel} e ${secondaryLabel}: gráfico com ${labels.length} períodos. Consulte os valores na tabela de detalhes.`}
        className="finance-chart"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primaryColor} stopOpacity=".18" />
            <stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1="44"
              y1={160 - f * 130}
              x2="554"
              y2={160 - f * 130}
              stroke="var(--line)"
              strokeDasharray="4 5"
            />
            <text
              x="38"
              y={164 - f * 130}
              textAnchor="end"
              fill="var(--muted)"
              fontSize="9"
            >
              {hideValues
                ? "—"
                : Math.round((min + span * f) / 100).toLocaleString("pt-BR")}
            </text>
          </g>
        ))}
        <polygon points={area} fill={`url(#${id})`} />
        <polyline
          points={points(secondary)}
          fill="none"
          stroke={secondaryColor}
          strokeDasharray={cashFlow ? "7 4" : undefined}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={primaryPoints}
          fill="none"
          stroke={primaryColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {visibleLabels.map(
          (l, i) =>
            l && (
              <text
                key={i}
                x={x(i)}
                y="190"
                textAnchor="middle"
                fill="var(--muted)"
                fontSize="11"
              >
                {l}
              </text>
            ),
        )}
      </svg>
      {cashFlow && (
        <details className="chart-values">
          <summary>Ver valores do gráfico</summary>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                Valores por período: {primaryLabel} e {secondaryLabel}
              </caption>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>{primaryLabel}</th>
                  <th>{secondaryLabel}</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((label, i) => (
                  <tr key={i}>
                    <td>{label}</td>
                    <td>
                      {hideValues ? "Oculto" : formatMoney(primary[i] ?? 0)}
                    </td>
                    <td>
                      {hideValues ? "Oculto" : formatMoney(secondary[i] ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <span className="sr-only">
        {hideValues
          ? "Valores ocultos."
          : `Último período: ${primaryLabel} ${formatMoney(primary.at(-1) ?? 0)}, ${secondaryLabel} ${formatMoney(secondary.at(-1) ?? 0)}.`}
      </span>
    </div>
  );
}
