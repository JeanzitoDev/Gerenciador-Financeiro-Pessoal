import type { Metadata } from "next";
import Link from "next/link";
import BrandMark from "@/components/brand-mark";
import { APP_VERSION } from "@/lib/version";

export const metadata: Metadata = {
  title: "Privacidade dos dados · Meu Norte",
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
      <h1>Seus dados, com clareza.</h1>
      <p>Meu Norte · v{APP_VERSION} · aviso atualizado em 22/10/2026.</p>
      <section className="panel privacy-notice">
        <h2>Quem pode acessar?</h2>
        <p>
          As permissões do banco separam os registros de cada usuário. Uma conta
          comum não pode consultar ou alterar os dados de outra conta.
        </p>
        <p>
          <strong>
            O administrador do projeto tem acesso técnico aos dados financeiros
            pelo banco.
          </strong>{" "}
          Esta versão não usa criptografia de ponta a ponta nem uma chave que só
          você possui. Não prometemos que o responsável pelo projeto seja
          tecnicamente incapaz de ler esses dados.
        </p>
        <p>
          Se você está conhecendo o app e prefere não compartilhar informações
          reais, use valores fictícios ou a{" "}
          <Link href="/demo">demonstração</Link>.
        </p>
      </section>
      <section className="panel">
        <h2>O que fica guardado?</h2>
        <p>
          Seu nome, e-mail e preferências, além das contas, lançamentos,
          recorrências, metas, aportes e contratos que você cadastrar. O app não
          se conecta ao seu banco e não precisa da senha do seu banco.
        </p>
        <p>
          A autenticação e o banco usam Supabase; a hospedagem usa Vercel. Para
          servir o app, esses provedores também processam dados técnicos de
          conexão e operação. O Supabase armazena um hash da senha de acesso
          para verificá-la, em vez de guardá-la como texto legível.
        </p>
        <p>
          As consultas de juros ao Banco Central pedem apenas séries públicas
          predefinidas. Os valores da sua simulação e seus dados pessoais não
          são enviados nessa consulta.
        </p>
      </section>
      <section className="panel">
        <h2>Quais são as proteções e os limites?</h2>
        <p>
          O app utiliza sessão autenticada, permissões por usuário no banco e
          validação de dados no servidor. A versão publicada deve usar HTTPS.
          Nenhuma dessas medidas equivale a tornar os dados invisíveis ao
          administrador ou a garantir ausência de falhas.
        </p>
        <p>
          A confirmação de endereço e a recuperação por e-mail estão adiadas
          nesta fase. Criar uma conta não comprova a titularidade da caixa de
          e-mail.
        </p>
      </section>
      <section className="panel">
        <h2>Como consultar ou excluir?</h2>
        <p>
          Você pode consultar seus registros no app, baixar os lançamentos em
          CSV nos Relatórios e excluir a conta em menu da conta → Perfil e
          preferências → Apagar minha conta. A exclusão remove o cadastro e os
          registros financeiros vinculados do banco ativo.
        </p>
        <p>
          Isso não apaga arquivos que você já exportou nem significa remoção
          instantânea de todas as cópias de segurança e registros técnicos dos
          provedores, que têm seus próprios prazos de retenção.
        </p>
        <p>
          Responsável pelo projeto:{" "}
          <a
            href="https://github.com/JeanzitoDev"
            target="_blank"
            rel="noopener noreferrer"
          >
            JeanzitoDev
          </a>
          . Para questões de privacidade, procure o responsável pelo canal em
          que recebeu o convite para testar; evite publicar seus dados
          financeiros em comentários públicos.
        </p>
      </section>
    </main>
  );
}
