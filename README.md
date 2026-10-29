# Meu Norte · v2.3.4

Gerenciador financeiro pessoal em **Next.js, TypeScript, Tailwind CSS, Supabase Auth e PostgreSQL**. PWA com finanças online, BRL em centavos e dados separados por usuário.

## Atualizar a versão já publicada

Para quem está na **v2.3.3**, **v2.3.2** ou **v2.3.1**, siga **[a atualização 2.3.4](docs/FASE-2.3.4.md)** e aplique a migração incremental `supabase/migrations/202610290006_phase234.sql` no SQL Editor do Supabase antes do deploy. Para quem está na **v2.3.0**, aplique antes `202610220005_phase231.sql`. Quem está na 2.2.0/2.2.1 precisa aplicar também a migration da fase 2.3, conforme o guia.

**Privacidade (Beta):** esta é uma versão de testes (beta) sem criptografia de ponta a ponta; as contas têm permissões por usuário (RLS), mas o administrador possui acesso técnico ao banco. A versão inclui aviso público detalhado em `/privacidade` sobre a fase beta e o plano de criptografia e chaves de acesso para a versão Produto. Leia [a análise de uso e criptografia](docs/USABILIDADE-E-PRIVACIDADE.md).

Para atualizar a v1, leia primeiro **[o roteiro da fase 2](docs/FASE-2.md)**. Use a migração incremental `202610180002_phase2.sql`, depois atualize o código e faça o deploy. **Não execute novamente a migração inicial em um banco já existente.**

## Rodar localmente

Node.js 22.12+ (ou Node 24 LTS) e npm:

```bash
npm ci
```

Copie `.env.example` para `.env.local` e configure as duas variáveis públicas do Supabase. Para a origem local, use `APP_ORIGIN=http://localhost:3000`.

```bash
npm run dev
```

Abra `http://localhost:3000`. `/demo` usa dados fictícios somente em memória; recarregar descarta alterações. Uma conta real começa vazia.

Se o Node no Windows corporativo retornar `SELF_SIGNED_CERT_IN_CHAIN`, versões 22.19+ ou 24.6+ permitem usar as autoridades certificadoras confiáveis do Windows. No **PowerShell**, antes de iniciar:

```powershell
$env:NODE_USE_SYSTEM_CA="1"
npm run dev
```

Mantenha a validação de certificados habilitada. Se o certificado corporativo não estiver na lista do Windows, solicite a configuração à TI.

## Configurar Supabase e Vercel

- Projeto novo: aplique, em ordem, os arquivos em `supabase/migrations/`.
- Projeto existente: aplique somente as migrações que ainda faltam, em ordem. Para v2.2.x, somente `202610220004_phase23.sql`; veja o roteiro 2.3.
- Authentication → Sign In / Providers → Email: **Confirm Email desativado** nesta fase. Permita novos cadastros e use senha mínima de 8 caracteres.
- Configure `NEXT_PUBLIC_AUTH_EMAIL_ENABLED=false`. Cadastro pede nome, e-mail e senha, encerra a sessão criada automaticamente pelo Supabase e mostra a tela Entrar com o e-mail preenchido. Recuperação por e-mail está desabilitada; alteração de senha autenticada permanece disponível.
- Na Vercel, use a raiz com `package.json`, instalação `npm ci`, build `npm run build`, Node 24 LTS e saída padrão do Next.js.
- Configure as variáveis públicas e `APP_ORIGIN=https://meunorte-financeiro.vercel.app`, sem `/app`. Reinicie localmente ou faça novo deploy após mudar variáveis.
- Para habilitar a exclusão da conta, configure **`SUPABASE_SECRET_KEY` somente no servidor** com a chave privada do mesmo projeto. A rota verifica a senha atual antes de executar a exclusão atômica; nenhum identificador de usuário vindo do navegador escolhe a conta a apagar.
- Para executar as recorrências mesmo com o app fechado, habilite `pg_cron` em Database → Extensions e execute `supabase/phase2-cron.sql`. É um agendamento SQL diário; não envolve SMTP, Turnstile, serviço pago de cron ou backup automático. Sem esse job, a sincronização ocorre ao abrir/atualizar o app, ao voltar para a janela e a cada minuto enquanto ele estiver visível e sem formulário aberto.

Nunca envie `.env.local` ao Git. A chave pública é diferente da chave privada. Segredos não podem usar prefixo `NEXT_PUBLIC_`.

## Funcionalidades

- Contas, receitas, despesas e recorrências, com opção de **limite de cheque especial** nas contas correntes (consumo automático do limite quando despesas pagas superam o saldo em conta). Confirmação Recebi/Paguei em Lançamentos; registro automático é opcional. Dinheiro guardado e VA/VR têm tratamento próprio.
- Metas com aportes, conclusão, condições entre objetivos, **Desafio do Cofrinho (cartela interativa de 1 a 500 = R$ 125.250)** e **Cofrinho mensal progressivo**. Planejamento distribui o orçamento entre as metas disponíveis e explica as que aguardam.
- **Cabe no meu bolso?**: compras, projetos em geral e **aluguel de imóvel** (com caução ou seguro fiança), preço desejado ou teto de gasto, à vista ou parcelado, entrada, custos de uso, folga mensal, juros, prazo para juntar e criação de meta.
- Referências gratuitas de juros de veículos/imóveis pelo servidor do app, sem enviar dados pessoais ao provedor. Price/SAC, fonte/data e taxa manual como alternativa.
- Empréstimos e financiamentos com parcelas fixas, histórico, pagamentos e simulação de amortização. Juros e CET são campos diferentes.
- Tutorial por usuário, nome no cadastro, aviso de e-mail existente, alteração de senha autenticada e exclusão completa com verificação de senha.
- Relatórios/CSV em português, tema escuro inicial, cores/fundos personalizados, fonte Geist local, modais/listas/calendários arredondados, máscara monetária BR, animações e navegação por teclado.
- Autorização no servidor, RLS/vínculos por dono, integridade financeira no banco, CSP com nonce, limite de escritas e payload em bytes. Cache do PWA restrito a ativos públicos.

## Regras financeiras

Dinheiro realizado e projeções permanecem separados. Transferências não viram receitas/despesas. VA/VR ficam em contas restritas; não viram recursos livres. Aportes em metas reservam dinheiro existente e não criam novos ativos. Uma ocorrência anterior à abertura da conta não é gerada: reveja data/saldo inicial da conta antes de incluir movimentos antigos.

As despesas futuras não são consideradas pagas pelo simples vencimento. Ocorrências puladas não voltam ao sincronizar. Pausar a regra interrompe novas ocorrências e o registro automático; lançamentos já criados continuam disponíveis para revisão. Alterar uma regra não reescreve pagamentos passados. Configure cada aplicação em uma conta de investimento distinta.

## Verificar

```bash
npm test
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=high
```

Os testes cobrem domínio financeiro, RLS, regras de banco, Auth simulado, rotas e tarefas React. Não substituem a homologação no seu Supabase/Vercel e nos aparelhos reais. O teste remoto opcional é `scripts/smoke-supabase.mjs`; veja suas variáveis no próprio arquivo e use duas contas exclusivamente de teste.

## Documentação

- [Atualização 2.3.2](docs/FASE-2.3.2.md)
- [Atualização 2.3.1](docs/FASE-2.3.1.md)
- [Atualização 2.3 e roteiro de conferência](docs/FASE-2.3.md)
- [Atualização e homologação da fase 2](docs/FASE-2.md)
- [Controles e limites de segurança](docs/SEGURANCA.md)
- [Validação](docs/VALIDACAO.md)
- [Especificação original da fase 1](docs/ESPECIFICACAO.md)
- [Modelo inicial do banco](docs/MODELO.md)

SMTP/validação do e-mail e recuperação por e-mail ficam para fases futuras. Turnstile e backups automáticos estão adiados para fase 3/4. Sem integração bancária, importador de extratos ou movimentação de dinheiro real. Os dados da API de inflação são uma referência observada; projeções futuras continuam sendo hipóteses.
