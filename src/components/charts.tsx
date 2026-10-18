"use client";
import { useId } from "react";
import { formatMoney } from "@/lib/finance/money";
export default function FinanceChart({
  labels,
  primary,
  secondary,
  primaryLabel = "Receitas",
  secondaryLabel = "Despesas",
}: {
  labels: string[];
  primary: number[];
  secondary: number[];
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
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
          <i className="dot accent" />
          {primaryLabel}
        </span>
        <span>
          <i className="dot muted-dot" />
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
            <stop offset="0%" stopColor="var(--accent)" stopOpacity=".18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
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
              {Math.round((min + span * f) / 100).toLocaleString("pt-BR")}
            </text>
          </g>
        ))}
        <polygon points={area} fill={`url(#${id})`} />
        <polyline
          points={points(secondary)}
          fill="none"
          stroke="var(--chart-secondary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={primaryPoints}
          fill="none"
          stroke="var(--accent)"
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
      <span className="sr-only">
        Último período: {primaryLabel} {formatMoney(primary.at(-1) ?? 0)},{" "}
        {secondaryLabel} {formatMoney(secondary.at(-1) ?? 0)}.
      </span>
    </div>
  );
}
