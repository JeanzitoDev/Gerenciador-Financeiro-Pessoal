import Link from "next/link";
import BrandMark from "@/components/brand-mark";
import { APP_VERSION } from "@/lib/version";
import {
  Compass,
  ArrowRight,
  Wallet,
  Target,
  TrendingUp,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
export default function Home() {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <BrandMark size={36} />
          </span>
          meu norte<span className="brand-dot">.</span>
        </Link>
        <div className="landing-actions">
          <Link href="/demo" className="button ghost">
            Conhecer o app
          </Link>
          <Link href="/entrar" className="button secondary">
            Meu espaço
            <ArrowRight size={15} />
          </Link>
        </div>
      </nav>
      <section className="landing-content">
        <div className="landing-copy">
          <p className="eyebrow">FINANÇAS PESSOAIS, NO SEU RITMO</p>
          <h1>
            Seu dinheiro.
            <br />
            Seus planos.
            <br />
            <em>Um novo norte.</em>
          </h1>
          <p>
            Organize o que entra, entenda o que sai e aproxime seus próximos
            planos da realidade. Um passo de cada vez.
          </p>
          <div className="landing-cta">
            <Link href="/entrar" className="button primary">
              Começar meu caminho
              <ArrowRight size={17} />
            </Link>
            <Link href="/demo" className="button secondary">
              Explorar demonstração
            </Link>
          </div>
          <span className="landing-trust">
            <ShieldCheck size={15} />
            Seu espaço pessoal · mobile · sem integração bancária
          </span>
        </div>
        <div
          className="landing-preview"
          aria-label="Exemplo ilustrativo da interface, com valores fictícios"
        >
          <div className="preview-card">
            <p className="eyebrow">UM OLHAR PARA OS SEUS PLANOS</p>
            <h2>
              Pequenos passos.
              <br />
              Grandes possibilidades.
            </h2>
            <div className="preview-balance">
              <span>Exemplo de valor reservado para metas</span>
              <strong>R$ 8.400,00</strong>
            </div>
            <div className="preview-goal">
              <span className="square-icon">
                <Target size={20} />
              </span>
              <div>
                <strong>Minha reserva</strong>
                <small>Cada aporte faz diferença.</small>
              </div>
              <span>70%</span>
            </div>
            <div className="progress-track">
              <div style={{ width: "70%" }} />
            </div>
            <div className="preview-goal">
              <span className="square-icon">
                <Sparkles size={20} />
              </span>
              <div>
                <strong>Próxima conquista</strong>
                <small>Um plano com data e direção.</small>
              </div>
              <ArrowRight size={18} />
            </div>
          </div>
          <p className="preview-caption">
            Ilustração com valores fictícios. Suas contas começam vazias.
          </p>
        </div>
      </section>
      <section className="landing-features">
        {[
          {
            icon: Wallet,
            title: "O presente, organizado.",
            text: "Contas, receitas e despesas juntas. Benefícios separados para saber o que está disponível.",
          },
          {
            icon: Target,
            title: "Planos com direção.",
            text: "Metas com prazo e aportes reservados. Priorize o que faz sentido para o seu momento.",
          },
          {
            icon: TrendingUp,
            title: "O futuro, em perspectiva.",
            text: "Acompanhe rendimentos realizados e explore simulações com juros compostos e inflação.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <article className="landing-feature" key={title}>
            <span className="square-icon">
              <Icon size={20} />
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <footer className="landing-footer">
        Meu Norte · v{APP_VERSION} · © {new Date().getFullYear()}{" "}
        <a
          href="https://github.com/JeanzitoDev"
          target="_blank"
          rel="noopener noreferrer"
        >
          JeanzitoDev
        </a>
      </footer>
    </main>
  );
}
