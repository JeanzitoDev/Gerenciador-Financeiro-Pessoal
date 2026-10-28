"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Calculator, Target, RefreshCw } from "lucide-react";
import type { FinanceData } from "@/lib/types";
import {
  moneyInput,
  parseMoney,
  formatMoney,
  percent,
} from "@/lib/finance/money";
import { today, addMonths } from "@/lib/finance/dates";
import {
  purchaseSuggestions,
  simulatePurchase,
  type PurchaseInput,
  type RentGuarantee,
} from "@/lib/finance/purchase";
import MoneyInput from "./money-input";
import SelectControl from "./select-control";

type Reference = {
  monthly_rate: number;
  source: string;
  source_url: string;
  date: string;
};
const defaults = {
  name: "",
  category: "other",
  mode: "purchase",
  payment: "cash",
  system: "price",
  price: "",
  income: "",
  expenses: "0,00",
  replacedExpenses: "0,00",
  savings: "0,00",
  reserve: "0,00",
  fees: "0,00",
  ongoing: "0,00",
  buffer: "0,00",
  monthlySaving: "0,00",
  months: "12",
  monthlyRate: "0",
  rentGuarantee: "none",
  deposit: "0,00",
  rentInsurance: "0,00",
};
type Values = typeof defaults;
export default function Simulator({
  data,
  onCreateGoal,
}: {
  data?: FinanceData;
  onCreateGoal?: (preset: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Values>(defaults);
  const [result, setResult] = useState<ReturnType<
    typeof simulatePurchase
  > | null>(null);
  const [error, setError] = useState("");
  const [reference, setReference] = useState<Reference | null>(null);
  const [referenceError, setReferenceError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [usedData, setUsedData] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  const isRent = values.category === "rent";

  useEffect(() => {
    if (!result) return;
    resultRef.current?.focus({ preventScroll: true });
    resultRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }, [result]);
  useEffect(() => () => controller.current?.abort(), []);
  function update(key: keyof Values, value: string) {
    if (key === "monthlyRate" || key === "category") {
      controller.current?.abort();
      setFetching(false);
      setReference(null);
      setReferenceError("");
    }
    setValues((old) => ({
      ...old,
      [key]: value,
      ...(key === "category"
        ? {
            monthlyRate: "0",
            ...(value === "rent" ? { payment: "cash" } : {}),
          }
        : {}),
    }));
    setResult(null);
    setError("");
  }
  const cash = (key: keyof Values, label: string, required = true) => (
    <label className="form-field">
      <span>{label}</span>
      <MoneyInput
        value={values[key]}
        aria-label={label}
        onValueChange={(value) => update(key, value)}
        required={required}
      />
    </label>
  );
  const choice = (key: keyof Values, label: string, options: string[][]) => (
    <div className="form-field">
      <span>{label}</span>
      <SelectControl
        label={label}
        allowEmpty={false}
        value={values[key]}
        onChange={(value) => update(key, value)}
        options={options}
      />
    </div>
  );
  function importBudget() {
    if (!data) return;
    const suggested = purchaseSuggestions(data, today());
    setValues((old) => ({
      ...old,
      income: moneyInput(suggested.income),
      expenses: moneyInput(suggested.expenses),
      savings: moneyInput(suggested.savings),
      monthlySaving: moneyInput(
        Math.max(0, suggested.income - suggested.expenses),
      ),
    }));
    setUsedData(true);
    setResult(null);
    setError("");
  }
  function applyThreeMonthsDeposit() {
    try {
      const rentCents = parseMoney(values.price || "0,00");
      if (rentCents > 0) {
        update("deposit", moneyInput(rentCents * 3));
      }
    } catch {
      // Ignore invalid price input while typing
    }
  }
  async function fetchReference() {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setFetching(true);
    setReferenceError("");
    try {
      const response = await fetch(
        `/api/indicators/credit?kind=${values.category}`,
        { signal: active.signal, cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (
        typeof body.monthly_rate !== "number" ||
        !Number.isFinite(body.monthly_rate) ||
        body.monthly_rate < 0 ||
        body.monthly_rate > 1
      )
        throw new Error("Referência inválida. Informe a taxa manualmente.");
      if (active.signal.aborted) return;
      setValues((old) => ({
        ...old,
        monthlyRate: (body.monthly_rate * 100).toFixed(6).replace(".", ","),
      }));
      setReference(body);
      setResult(null);
    } catch (e) {
      if (!active.signal.aborted)
        setReferenceError(
          e instanceof Error
            ? e.message
            : "Informe a taxa da proposta para continuar.",
        );
    } finally {
      if (!active.signal.aborted) setFetching(false);
    }
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    try {
      const v = values;
      if (
        !isRent &&
        v.payment === "financed" &&
        !/^\d+(?:,\d{1,6})?$/.test(v.monthlyRate)
      )
        throw new Error(
          "Use uma taxa como 1,5. Para parcelas sem juros, informe 0.",
        );
      setResult(
        simulatePurchase({
          category: v.category,
          mode: v.mode as PurchaseInput["mode"],
          payment: isRent ? "cash" : (v.payment as PurchaseInput["payment"]),
          system: v.system as PurchaseInput["system"],
          price: v.mode === "ceiling" ? 0 : parseMoney(v.price),
          income: parseMoney(v.income),
          expenses: parseMoney(v.expenses),
          replacedExpenses: parseMoney(v.replacedExpenses),
          savings: parseMoney(v.savings),
          reserve: parseMoney(v.reserve),
          fees: parseMoney(v.fees),
          ongoing: parseMoney(v.ongoing),
          buffer: parseMoney(v.buffer),
          monthlySaving: parseMoney(v.monthlySaving),
          months: isRent || v.payment === "cash" ? 1 : Number(v.months),
          monthlyRate:
            isRent || v.payment === "cash"
              ? 0
              : Number(v.monthlyRate.replace(",", ".")) / 100,
          rentGuarantee: v.rentGuarantee as RentGuarantee,
          deposit:
            isRent && v.rentGuarantee === "deposit"
              ? parseMoney(v.deposit)
              : 0,
          rentInsurance:
            isRent && v.rentGuarantee === "insurance"
              ? parseMoney(v.rentInsurance)
              : 0,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revise os valores.");
    }
  }
  const labels: Record<string, string> = {
    vehicle: "meu carro",
    home: "meu imóvel",
    rent: "meu aluguel",
    electronics: "meu eletrônico",
    furniture: "meus móveis",
    travel: "minha viagem",
    other: "minha conquista",
  };
  const purchaseName = values.name.trim() || labels[values.category] || "minha conquista";
  return (
    <div className="simulator-layout purchase-layout">
      <section className="panel simulator-form">
        <div className="section-title">
          <span className="square-icon">
            <Calculator size={20} />
          </span>
          <h2>Uma conquista de cada vez</h2>
        </div>
        <p className="muted">
          Um celular, uma mudança, um aluguel, uma viagem ou algo maior. Veja
          como encaixar no seu momento.
        </p>
        <form onSubmit={submit}>
          {choice("category", "O que você está planejando?", [
            ["other", "Outra compra ou projeto"],
            ["electronics", "Celular ou eletrônico"],
            ["furniture", "Móveis ou eletrodomésticos"],
            ["travel", "Viagem ou experiência"],
            ["vehicle", "Carro ou moto"],
            ["home", "Casa ou apartamento"],
            ["rent", "Aluguel de imóvel"],
          ])}
          <label className="form-field">
            <span>Qual é a sua conquista? (opcional)</span>
            <input
              value={values.name}
              maxLength={60}
              placeholder={
                isRent ? "Ex.: alugar apartamento" : "Ex.: trocar de celular"
              }
              onChange={(e) => update("name", e.target.value)}
            />
          </label>
          {choice(
            "mode",
            "O que quer descobrir?",
            isRent
              ? [
                  ["purchase", "Este aluguel cabe no meu bolso?"],
                  ["ceiling", "Até quanto posso pagar de aluguel?"],
                ]
              : [
                  ["purchase", "Esta compra cabe no meu bolso?"],
                  ["ceiling", "Até quanto posso gastar?"],
                ],
          )}
          {values.mode === "purchase" &&
            cash(
              "price",
              isRent ? "Valor do aluguel mensal (R$)" : "Preço da compra (R$)",
            )}
          {data && (
            <button
              className="button secondary"
              type="button"
              onClick={importBudget}
            >
              Usar valores do meu app
            </button>
          )}
          {usedData && (
            <p className="small-note">
              Sugestões do mês atual: confira salário e todos os gastos,
              incluindo os que ainda não cadastrou. VA/VR e dinheiro reservado
              para metas ficam fora do valor disponível.
            </p>
          )}
          <div className="form-grid">
            {cash("income", "Renda líquida por mês (R$)")}
            {cash("expenses", "Gastos mensais atuais, com parcelas (R$)")}
          </div>
          <div className="form-grid">
            {cash("savings", "Dinheiro disponível para este plano (R$)")}
            {cash("reserve", "Deste dinheiro, quanto quer preservar? (R$)")}
          </div>
          {isRent ? (
            <>
              {choice("rentGuarantee", "Garantia da locação (opcional)", [
                ["none", "Sem custo extra (fiador ou sem garantia)"],
                ["deposit", "Caução (depósito antecipado)"],
                ["insurance", "Seguro fiança (valor mensal)"],
              ])}
              {values.rentGuarantee === "deposit" && (
                <div className="stack">
                  <div className="form-grid">
                    {cash("deposit", "Valor da caução (R$)")}
                    <div
                      className="form-field"
                      style={{ justifyContent: "flex-end" }}
                    >
                      <span>Atalho comum (3 aluguéis)</span>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={applyThreeMonthsDeposit}
                      >
                        Usar 3x o aluguel
                      </button>
                    </div>
                  </div>
                  <p className="small-note">
                    A caução costuma ser de até 3 meses de aluguel, paga na
                    entrada do contrato, e fica depositada como garantia.
                  </p>
                </div>
              )}
              {values.rentGuarantee === "insurance" && (
                <div className="stack">
                  {cash("rentInsurance", "Seguro fiança por mês (R$)")}
                  <p className="small-note">
                    O seguro fiança substitui o depósito de caução ou fiador por
                    um custo mensal somado ao aluguel, que não retorna ao final
                    do contrato.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {choice("payment", "Como pretende pagar?", [
                ["cash", "À vista / juntar antes de comprar"],
                ["financed", "Parcelado ou financiado"],
              ])}
              {values.payment === "financed" && (
                <>
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Número de parcelas</span>
                      <input
                        type="number"
                        min={1}
                        max={600}
                        value={values.months}
                        onChange={(e) => update("months", e.target.value)}
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span>Juros por mês (%)</span>
                      <input
                        inputMode="decimal"
                        value={values.monthlyRate}
                        onChange={(e) => update("monthlyRate", e.target.value)}
                        maxLength={12}
                        required
                      />
                    </label>
                  </div>
                  {choice("system", "Como serão as parcelas?", [
                    ["price", "Parcelas iguais · Price"],
                    ["sac", "Parcelas que diminuem · SAC"],
                  ])}
                  {["vehicle", "home"].includes(values.category) && (
                    <button
                      className="button secondary"
                      type="button"
                      disabled={fetching}
                      onClick={() => void fetchReference()}
                    >
                      <RefreshCw size={16} />
                      {fetching
                        ? "Consultando juros…"
                        : "Usar juros médios do Banco Central"}
                    </button>
                  )}
                  {reference && (
                    <p className="small-note">
                      <a
                        href={reference.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {reference.source}
                      </a>{" "}
                      · referência de {reference.date} ·{" "}
                      {percent(reference.monthly_rate)} ao mês. Você pode
                      substituir pela taxa da proposta.
                    </p>
                  )}
                  {referenceError && (
                    <p className="form-error" role="alert">
                      {referenceError}
                    </p>
                  )}
                  <p className="small-note">
                    Use os juros da proposta. Para parcelamento sem juros,
                    informe 0. Taxas e seguros pagos à parte entram nos custos
                    abaixo.
                  </p>
                </>
              )}
            </>
          )}
          <details className="purchase-costs" open>
            <summary>
              {isRent
                ? "Custos da mudança, condomínio e folga no orçamento"
                : "Custos da compra e folga no orçamento"}
            </summary>
            <div className="form-grid">
              {cash(
                "fees",
                isRent
                  ? "Mudança, pintura ou vistoria (R$)"
                  : "Custos iniciais extras (R$)",
              )}
              {cash(
                "ongoing",
                isRent
                  ? "Condomínio, IPTU e contas por mês (R$)"
                  : "Custo mensal depois da compra (R$)",
              )}
            </div>
            <p className="small-note">
              {isRent
                ? "Inclua frete de mudança e pintura nos custos iniciais, e condomínio, IPTU e contas da casa no custo mensal."
                : "Inclua frete, instalação e taxas. Para veículos: combustível, seguro, impostos e manutenção. Para imóveis: condomínio, IPTU, seguros e despesas de aquisição. Divida os gastos anuais por 12."}
            </p>
            <div className="form-grid">
              {cash("replacedExpenses", "Gastos atuais que vão acabar (R$)")}
              {cash("buffer", "Quanto quero deixar livre por mês (R$)")}
            </div>
            <p className="small-note">
              Exemplo: o aluguel atual que deixará de pagar ao se mudar. Informe
              apenas gastos que já estão no total mensal acima.
            </p>
            {cash("monthlySaving", "Quanto pretendo guardar por mês (R$)")}
          </details>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary wide" type="submit">
            Ver se cabe no meu bolso <ArrowRight size={17} />
          </button>
        </form>
      </section>
      <div className="stack">
        {result ? (
          <>
            <section
              className="panel purchase-result scroll-destination"
              ref={resultRef}
              tabIndex={-1}
              aria-label="Resultado da compra"
            >
              <p className="eyebrow">{purchaseName}</p>
              <h2 aria-live="polite">
                {result.fits
                  ? "Cabe no orçamento informado"
                  : result.monthlyRoom < 0
                    ? "O mês ficaria no vermelho"
                    : "Vamos ajustar esse plano"}
              </h2>
              <p>
                {values.mode === "ceiling"
                  ? isRent
                    ? "Teto estimado de aluguel mensal com os valores informados"
                    : "Teto estimado de compra com os valores informados"
                  : isRent
                    ? "Aluguel mensal que você quer pagar"
                    : "Preço que você quer pagar"}
              </p>
              <strong className="result-value">
                {formatMoney(result.price)}
              </strong>
              <div className="sim-results">
                <div>
                  <span>
                    {isRent
                      ? "Teto de aluguel neste cenário"
                      : "Até quanto cabe neste cenário"}
                  </span>
                  <strong>{formatMoney(result.ceiling)}</strong>
                </div>
                {isRent ? (
                  <>
                    <div>
                      <span>Custo mensal total da moradia</span>
                      <strong>{formatMoney(result.monthlyCommitment)}</strong>
                    </div>
                    {result.rentGuarantee === "deposit" && (
                      <div>
                        <span>Caução na entrada</span>
                        <strong>{formatMoney(result.deposit)}</strong>
                      </div>
                    )}
                    {result.rentGuarantee === "insurance" && (
                      <div>
                        <span>Seguro fiança por mês</span>
                        <strong>{formatMoney(result.rentInsurance)}</strong>
                      </div>
                    )}
                    <div>
                      <span>Total inicial (caução + mudança)</span>
                      <strong>{formatMoney(result.total)}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span>
                        {values.payment === "cash"
                          ? "Valor à vista"
                          : "Entrada disponível usada"}
                      </span>
                      <strong>{formatMoney(result.entry)}</strong>
                    </div>
                    {values.payment === "financed" && (
                      <>
                        <div>
                          <span>Valor financiado</span>
                          <strong>{formatMoney(result.principal)}</strong>
                        </div>
                        <div>
                          <span>
                            {values.system === "sac"
                              ? "Primeira parcela (a maior)"
                              : "Parcela estimada"}
                          </span>
                          <strong>{formatMoney(result.firstPayment)}</strong>
                        </div>
                        {values.system === "sac" && (
                          <div>
                            <span>Última parcela estimada</span>
                            <strong>{formatMoney(result.lastPayment)}</strong>
                          </div>
                        )}
                        <div>
                          <span>Juros no prazo</span>
                          <strong>{formatMoney(result.interest)}</strong>
                        </div>
                      </>
                    )}
                    <div>
                      <span>Total da compra com custos iniciais</span>
                      <strong>{formatMoney(result.total)}</strong>
                    </div>
                  </>
                )}
                <div>
                  <span>
                    {isRent
                      ? "Sobra mensal após o aluguel"
                      : "Sobra mensal após a compra"}
                  </span>
                  <strong
                    className={
                      result.remainingMonthly < 0 ? "negative" : "positive"
                    }
                  >
                    {formatMoney(result.remainingMonthly)}
                  </strong>
                </div>
                <div>
                  <span>Dessa sobra, você quer preservar</span>
                  <strong>{formatMoney(parseMoney(values.buffer))}</strong>
                </div>
              </div>
              <p className="small-note">
                {isRent
                  ? "Condomínio, IPTU, contas e eventual seguro fiança já estão descontados da sobra mensal."
                  : "Os custos mensais de uso já estão descontados da sobra. O total da compra acima inclui juros e custos iniciais; gastos de uso continuam mês a mês."}
              </p>
            </section>
            <section className="panel purchase-next-step">
              <h2>Seu próximo passo</h2>
              <p>
                {result.missingCash
                  ? isRent
                    ? `Faltam ${formatMoney(result.missingCash)} para cobrir a caução e os custos iniciais da mudança, mantendo o dinheiro que você quer preservar.`
                    : `Faltam ${formatMoney(result.missingCash)} para a entrada ou compra à vista, mantendo o dinheiro que você quer preservar.`
                  : "Você já tem o dinheiro inicial necessário para este cenário."}
              </p>
              {result.monthsToSave !== null && result.monthsToSave > 0 && (
                <p>
                  Guardando {formatMoney(result.saving)} por mês, você chega lá
                  em cerca de <strong>{result.monthsToSave} meses</strong>.
                </p>
              )}
              {result.monthsToSave === null && (
                <p>
                  Informe quanto consegue guardar por mês para estimar o prazo.
                  Se ainda não há sobra no orçamento, reveja os gastos ou o
                  preço.
                </p>
              )}
              {result.savingsAdjusted && (
                <p className="small-note">
                  O prazo usa a sobra atual do orçamento, que é menor que o
                  valor que você gostaria de guardar.
                </p>
              )}
              {result.firstPayment > result.capacity && (
                <p>
                  {isRent
                    ? "Para manter a folga mensal escolhida, procure um aluguel ou encargos menores, ou reveja os gastos atuais."
                    : "Para manter a folga mensal escolhida, aumente a entrada, reduza o preço ou reveja o prazo e os juros."}
                </p>
              )}
              {onCreateGoal && result.price > 0 && (
                <button
                  className="button primary"
                  onClick={() =>
                    onCreateGoal({
                      name: `${isRent ? "Reserva para " : values.payment === "financed" ? "Entrada para " : "Conquistar "}${purchaseName}`.slice(
                        0,
                        80,
                      ),
                      target_cents: result.purchaseCashTarget || result.price,
                      target_date:
                        result.monthsToSave !== null &&
                        result.monthsToSave <= 600
                          ? addMonths(today(), Math.max(1, result.monthsToSave))
                          : "",
                      monthly_budget_cents: result.saving || null,
                    })
                  }
                >
                  <Target size={17} />
                  Transformar em meta
                </button>
              )}
              <p className="small-note">
                A meta abre para você conferir e escolher as condições. Reservar
                dinheiro é uma ação feita em Metas.
              </p>
            </section>
          </>
        ) : (
          <section className="panel purchase-intro">
            <span className="square-icon">
              <Calculator size={26} />
            </span>
            <h2>O que você quer conquistar?</h2>
            <p>
              Preencha seu cenário para ver quanto cabe, quanto falta juntar e
              como ficaria o mês depois da compra ou do aluguel.
            </p>
            <p className="small-note">
              Você escolhe o que quer planejar. Os custos e a margem para
              imprevistos ficam sob seu controle.
            </p>
          </section>
        )}
        <p className="small-note">
          Estimativa com os valores informados, sem rendimento sobre o dinheiro
          guardado. Preços e juros podem mudar durante o prazo. Financiamentos e
          locações podem incluir seguros, tarifas e reajustes por índices:
          inclua os custos conhecidos e confira o contrato. A análise do
          orçamento não representa aprovação de crédito ou ficha cadastral.
        </p>
      </div>
    </div>
  );
}
