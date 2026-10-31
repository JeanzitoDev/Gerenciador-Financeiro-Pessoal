import type { Metadata } from "next";
import Link from "next/link";
import BrandMark from "@/components/brand-mark";
import { APP_VERSION } from "@/lib/version";

export const metadata: Metadata = {
  title: "Privacidade e Proteção de Dados (LGPD) · Meu Norte",
};

export default function Privacy() {
  return (
    <main className="privacy-page">
      <header>
        <Link className="brand" href="/">
          <BrandMark size={32} /> meu norte.
        </Link>
        <Link className="button secondary" href="/app">
          Ir para meu espaço
        </Link>
      </header>
      <h1>Seus dados, com clareza e proteção.</h1>
      <p>
        Meu Norte · v{APP_VERSION} · Aviso de Privacidade e Proteção de Dados
        (LGPD) atualizado em 31/10/2026.
      </p>

      <section className="panel privacy-notice">
        <h2>1. Como protegemos a sua privacidade financeira</h2>
        <p>
          O <strong>Meu Norte</strong> foi desenhado para que você organize sua
          vida financeira com tranquilidade e sigilo. Adotamos três camadas de
          proteção técnica sobre as informações cadastradas:
        </p>
        <p>
          <strong>Isolamento por usuário (Row Level Security):</strong> cada
          conta possui políticas restritivas diretamente no banco de dados. Um
          usuário autenticado jamais consegue consultar, listar ou modificar
          registros de outro usuário.
        </p>
        <p>
          <strong>
            Ofuscação criptográfica de descrições e nomes no banco:
          </strong>{" "}
          os textos identificadores da sua rotina — como nomes de contas,
          cartões, carteiras digitais, metas, contratos e descrições dos seus
          lançamentos — passam por{" "}
          <strong>
            criptografia de camada de aplicação (AES-256-CTR + HMAC)
          </strong>{" "}
          vinculada ao identificador único da sua conta antes de serem gravados.
          Assim, mesmo em rotinas de manutenção técnica da infraestrutura, as
          descrições permanecem embaralhadas (<code>enc:...</code>) nas tabelas
          do banco de dados.
        </p>
        <p>
          <strong>Separação de identidade nas tabelas financeiras:</strong> os
          registros financeiros são vinculados apenas a um código técnico
          aleatório (<code>UUID</code>), sem exibir seu nome ou endereço de
          e-mail nas linhas de transações, metas ou saldos.
        </p>
      </section>

      <section className="panel">
        <h2>2. Tratamento de dados segundo a LGPD (Lei nº 13.709/2018)</h2>
        <p>
          Em conformidade com a{" "}
          <strong>Lei Geral de Proteção de Dados Pessoais (LGPD)</strong>, o
          tratamento dos dados informados no aplicativo ocorre exclusivamente
          para a <strong>execução do serviço solicitado pelo titular</strong>{" "}
          (Art. 7º, inciso V da LGPD), permitindo calcular saldos, projetar
          faturas, simular metas e gerar relatórios para o próprio usuário.
        </p>
        <p>
          <strong>Compromisso de não comercialização:</strong> o Meu Norte não
          vende, não aluga, não compartilha dados com birôs de crédito ou redes
          de anúncios e não realiza perfilamento comportamental para oferta de
          empréstimos ou produtos de terceiros.
        </p>
      </section>

      <section className="panel">
        <h2>3. O que fica armazenado e infraestrutura</h2>
        <p>
          Armazenamos apenas o necessário para o funcionamento do seu espaço:
          nome de exibição, e-mail de acesso, preferências visuais e os
          registros que você decidir cadastrar (contas, cartões, lançamentos,
          recorrências, metas e contratos). O app não pede senhas bancárias nem
          movimenta valores reais.
        </p>
        <p>
          A autenticação e o banco de dados utilizam infraestrutura{" "}
          <strong>Supabase</strong> com criptografia em trânsito (HTTPS/TLS) e
          em repouso no disco (AES-256); a hospedagem web utiliza{" "}
          <strong>Vercel</strong>. Sua senha de acesso nunca é salva em texto
          aberto, sendo armazenada apenas como hash criptográfico.
        </p>
        <p>
          As consultas de taxas médias ao Banco Central buscam apenas séries
          estatísticas públicas predefinidas, sem enviar seus dados pessoais ou
          valores simulados ao provedor externo.
        </p>
      </section>

      <section className="panel">
        <h2>4. Política de Cookies (Diretrizes da ANPD)</h2>
        <p>
          Seguindo o Guia Orientativo de Cookies da{" "}
          <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>,
          informamos que o Meu Norte utiliza{" "}
          <strong>apenas cookies técnicos estritamente necessários</strong> para
          manter sua sessão autenticada ativa com segurança e proteger suas
          requisições contra falsificação.
        </p>
        <p>
          Não utilizamos cookies de publicidade, pixels de rastreamento de redes
          sociais ou ferramentas invasivas de monitoramento entre sites.
        </p>
      </section>

      <section className="panel">
        <h2>5. Seus direitos como titular (Portabilidade e Exclusão)</h2>
        <p>
          Você possui controle direto e imediato sobre seus dados dentro do
          próprio aplicativo, em atendimento ao Art. 18 da LGPD:
        </p>
        <p>
          <strong>Acesso, correção e portabilidade:</strong> você pode editar ou
          remover qualquer lançamento a qualquer momento e exportar todo o seu
          histórico em formato aberto (<strong>Baixar CSV</strong> na aba
          Relatórios).
        </p>
        <p>
          <strong>Eliminação imediata e atômica:</strong> em{" "}
          <em>Menu da conta → Preferências → Apagar minha conta e meus dados</em>
          , você pode excluir definitivamente seu cadastro. A operação remove em
          cascata todas as suas transações, contas, metas, contratos, perfil e
          credenciais de acesso do banco de dados ativo mediante confirmação da
          sua senha.
        </p>
        <p>
          Caso prefira conhecer a ferramenta sem criar conta, utilize livremente
          a <Link href="/demo">demonstração interativa</Link> com dados
          fictícios.
        </p>
        <p>
          Responsável técnico pelo projeto:{" "}
          <a
            href="https://github.com/JeanzitoDev"
            target="_blank"
            rel="noopener noreferrer"
          >
            JeanzitoDev
          </a>
          .
        </p>
      </section>
    </main>
  );
}
