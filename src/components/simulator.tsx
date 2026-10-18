"use client";
import { useState } from "react";
import { Calculator, ArrowUpRight, Info } from "lucide-react";
import { project, type ProjectionPoint } from "@/lib/finance/engine";
import { parseMoney, formatMoney, percent } from "@/lib/finance/money";
import FinanceChart from "./charts";
export default function Simulator() {
  const [values, setValues] = useState({
    initial: "1000,00",
    monthly: "200,00",
    months: "24",
    annual: "10",
    inflation: "4,5",
  });
  const [points, setPoints] = useState<ProjectionPoint[]>(() =>
    project(100000, 20000, 24, 0.1, 0.045),
  );
  const [error, setError] = useState("");
  const [assumptions, setAssumptions] = useState({
    annual: 0.1,
    inflation: 0.045,
    monthly: 20000,
    initial: 100000,
  });
  const last = points.at(-1)!;
  const set = (key: string, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  function simulate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const annual = parseRate(values.annual),
        inflation = parseRate(values.inflation),
        initial = parseMoney(values.initial),
        monthly = parseMoney(values.monthly);
      setPoints(
        project(initial, monthly, Number(values.months), annual, inflation),
      );
      setAssumptions({ annual, inflation, initial, monthly });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revise os valores.");
    }
  }
  function parseRate(s: string) {
    if (!/^-?\d+(?:,\d{1,6})?$/.test(s))
      throw new Error("Use taxas como 10 ou 4,5.");
    return Number(s.replace(",", ".")) / 100;
  }
  const field = (key: keyof typeof values, label: string, type = "text") => (
    <label className="form-field">
      <span>{label}</span>
      <input
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        type={type}
        inputMode={type === "number" ? "numeric" : "decimal"}
        min={type === "number" ? 1 : undefined}
        max={type === "number" ? 600 : undefined}
        required
      />
    </label>
  );
  return (
    <div className="simulator-layout">
      <section className="panel simulator-form">
        <div className="section-title">
          <span className="square-icon">
            <Calculator size={20} />
          </span>
          <h2>Crie um cenário</h2>
        </div>
        <form onSubmit={simulate}>
          {field("initial", "Valor inicial (R$)")}
          {field("monthly", "Aporte no fim do mês (R$)")}
          {field("months", "Prazo em meses", "number")}
          {field("annual", "Rentabilidade anual (%)")}
          {field("inflation", "Inflação anual (%)")}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button primary wide">
            Simular futuro
            <ArrowUpRight size={17} />
          </button>
        </form>
      </section>
      <div className="stack">
        <section className="panel">
          <p className="eyebrow">POSSIBILIDADES, EM NÚMEROS</p>
          <h2 className="result-value">{formatMoney(last.total)}</h2>
          <p className="muted">Valor nominal projetado em {last.month} meses</p>
          <div className="sim-results">
            <div>
              <span>Capital aplicado</span>
              <strong>{formatMoney(last.principal)}</strong>
            </div>
            <div>
              <span>Rendimento projetado</span>
              <strong className="positive">{formatMoney(last.interest)}</strong>
            </div>
            <div>
              <span>Poder de compra atual</span>
              <strong>{formatMoney(last.real)}</strong>
            </div>
          </div>
          <FinanceChart
            labels={points.map((p) => String(p.month))}
            primary={points.map((p) => p.total)}
            secondary={points.map((p) => p.principal)}
            primaryLabel="Saldo nominal"
            secondaryLabel="Capital aplicado"
          />
          <p className="chart-note">
            Eixo horizontal: meses · eixo vertical: reais
          </p>
          <details>
            <summary>Ver evolução mensal</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Aplicado</th>
                    <th>Nominal</th>
                    <th>Real</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.month}>
                      <td>{p.month}</td>
                      <td>{formatMoney(p.principal)}</td>
                      <td>{formatMoney(p.total)}</td>
                      <td>{formatMoney(p.real)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <p className="info-box">
          <Info size={18} />
          <span>
            Premissas: {percent(assumptions.annual)} a.a., inflação de{" "}
            {percent(assumptions.inflation)} a.a., aportes de{" "}
            {formatMoney(assumptions.monthly)} no fim de cada mês. Taxas
            equivalentes compostas. Sem impostos automáticos. Esta simulação não
            altera suas metas nem seu saldo.
          </span>
        </p>
      </div>
    </div>
  );
}
