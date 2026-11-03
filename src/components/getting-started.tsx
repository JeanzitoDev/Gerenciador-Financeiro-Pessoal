"use client";
import { ArrowRight, Check, Compass, Upload, X } from "lucide-react";
const steps = [
  {
    title: "Comece pelo dinheiro que você tem",
    text: "Cadastre sua conta do banco, cartão, carteira ou dinheiro guardado. Informe o saldo inicial; depois você poderá lançar manualmente ou importar seu extrato direto do banco.",
    action: "Cadastrar uma conta",
    done: "Já cadastrei minhas contas",
  },
  {
    title: "Conte o que se repete",
    text: "Adicione seu salário líquido, aluguel, assinaturas e outras receitas ou despesas recorrentes. Em Lançamentos, você confirma o que recebeu ou pagou.",
    action: "Adicionar recorrência",
    done: "Continuar",
  },
  {
    title: "Inclua as parcelas que já existem",
    text: "Se você tem empréstimo ou financiamento, cadastre o contrato e as parcelas já pagas. Ter o contrato cadastrado ajuda a enxergar o que falta.",
    action: "Cadastrar contrato",
    done: "Continuar / não tenho contratos",
  },
  {
    title: "Pronto para cuidar do dia a dia",
    text: "Não quer digitar tudo manualmente? Importe o extrato do banco ou a fatura do cartão (.OFX, .CSV, .PDF ou foto) para o app identificar, categorizar e organizar tudo sozinho — ou cadastre manualmente em Lançamentos.",
    action: "Conhecer os lançamentos",
    done: "Concluir primeiros passos",
  },
];
export default function GettingStarted({
  step,
  busy,
  hasAccounts,
  onAction,
  onImport,
  onStep,
  onDismiss,
}: {
  step: number;
  busy: boolean;
  hasAccounts: boolean;
  onAction: () => void;
  onImport?: () => void;
  onStep: (step: number) => void;
  onDismiss: () => void;
}) {
  if (step >= steps.length) return null;
  const current = steps[step];
  return (
    <section className="panel getting-started" aria-label="Primeiros passos">
      <div className="section-head">
        <span className="eyebrow">
          <Compass size={17} /> PRIMEIROS PASSOS · {step + 1} DE 4
        </span>
        <button
          className="icon-button"
          disabled={busy}
          aria-label="Continuar tutorial depois"
          onClick={onDismiss}
        >
          <X size={18} />
        </button>
      </div>
      <div
        className="onboarding-progress"
        aria-label={`Etapa ${step + 1} de 4`}
      >
        {steps.map((s, i) => (
          <span key={s.title} className={i <= step ? "active" : ""} />
        ))}
      </div>
      <h2>{current.title}</h2>
      <p>{current.text}</p>
      <div className="button-row">
        <button
          className="button primary"
          disabled={busy || (step > 0 && !hasAccounts)}
          onClick={onAction}
        >
          {current.action}
          <ArrowRight size={16} />
        </button>
        {onImport && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onImport}
          >
            <Upload size={16} />
            Importar extrato / fatura
          </button>
        )}
        <button
          className="button secondary"
          disabled={busy || (step === 0 && !hasAccounts)}
          onClick={() => onStep(step + 1)}
        >
          <Check size={16} />
          {busy ? "Salvando…" : current.done}
        </button>
      </div>
      <p className="small-note">
        Prefere não inserir manualmente? Clique em{" "}
        <strong>Importar extrato / fatura</strong> para anexar o arquivo ou
        print do seu banco e organizar seus gastos automaticamente.
      </p>
      {!hasAccounts && step > 0 && (
        <p className="small-note">
          Cadastre uma conta em Minhas contas para vincular seus movimentos.
        </p>
      )}
      <p className="small-note">
        Você pode retomar este guia no menu da sua conta → Perfil e preferências
        → Primeiros passos.
      </p>
    </section>
  );
}
