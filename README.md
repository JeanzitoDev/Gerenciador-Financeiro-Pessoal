# Meu Norte — Gerenciador Financeiro Pessoal

PWA mobile em **Next.js + TypeScript + Tailwind CSS + Supabase Auth + PostgreSQL**. Organiza receitas, despesas, contas, metas, aportes e investimentos, com recorrências, relatórios e simulações.

> Implementação local entregue com testes automatizados. O funcionamento contra seu Supabase, os e-mails de autenticação e a instalação em dispositivos precisam ser homologados após configurar/publicar. Sem projeto configurado, o app informa essa condição; não simula autenticação nem grava finanças em localStorage.

## Começar

Pré-requisito: Node.js 22.12+ ou 24 LTS e npm. As versões exatas das dependências estão no package-lock.json.

```bash
npm ci
npm run dev
```

Abra http://localhost:3000. A demonstração em http://localhost:3000/demo funciona sem credenciais, com **dados fictícios somente em memória**. Recarregar descarta alterações. A conta real começa vazia.

## Documentação produzida antes do código

- [Especificação funcional, arquitetura, modelo relacional, regras e fases](docs/ESPECIFICACAO.md)
- [Modelo relacional em diagrama](docs/MODELO.md)
- [Validação e gates de liberação](docs/VALIDACAO.md)
- [Roteiro de homologação](docs/HOMOLOGACAO.md)

A referência solicitada foi recuperada parcialmente pelo contexto da conversa. O protótipo anterior não foi localizado; a identidade visual “Meu Norte” é uma proposta inicial, não uma reprodução dele. Não usamos valores pessoais como seed real.

## Conectar ao Supabase

1. Crie ou selecione um projeto Supabase. No **SQL Editor**, execute integralmente `supabase/migrations/202610180001_initial.sql` uma única vez em um projeto novo. Ela cria tabelas, constraints, índices, políticas RLS, triggers e RPCs. A migração é transacional e não usa extensões pagas.
2. Copie `.env.example` para `.env.local` e preencha a URL e a **publishable key** do projeto (Connect → API details). Não use a secret/service_role key.
3. Em **Authentication → URL Configuration**, configure Site URL como `http://localhost:3000` em desenvolvimento. Permita as URLs de redirecionamento `http://localhost:3000/auth/callback` e `http://localhost:3000/auth/callback?next=/nova-senha`. Na produção, adicione as equivalentes com seu domínio HTTPS.
4. Mantenha confirmação de e-mail habilitada. Verifique o envio de e-mails de Auth/SMTP e seus limites. O app usa fluxo PKCE com `code` e troca de sessão no callback. O link deve ser aberto no mesmo navegador em que o cadastro/recuperação começou (o verificador PKCE fica no cookie).
5. Reinicie o Next.js após alterar variáveis. Abra `/entrar`, crie uma conta, confirme o e-mail e entre. A trigger de Auth cria o perfil vazio; as tabelas financeiras permanecem vazias.
6. Cadastre uma conta com saldo inicial e data. Registre movimentos a partir dessa data. Crie metas e reserve valores das contas com saldo.

Se usar Supabase CLI, inicialize a configuração local (`npx supabase init`), vincule seu projeto (`npx supabase link --project-ref SEU_PROJECT_REF`) e use `npx supabase db push` em vez de executar manualmente a migração. Não aplique duas vezes pelo SQL Editor e CLI ao mesmo projeto; mantenha o histórico de migrações coerente.

## Publicar na Vercel

1. Coloque este diretório em um repositório Git pessoal e importe-o na Vercel como **Next.js**.
2. Defina a raiz do projeto no diretório que contém package.json. Use Node 24 LTS, instalação `npm ci`, build `npm run build` e saída padrão do Next.js.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` nos ambientes desejados. A chave publishable é pública por projeto; dados são protegidos por Auth, RLS e FKs compostas. Não há chave privilegiada no app.
4. Publique e ajuste **Site URL/Redirect URLs** no Supabase para o domínio HTTPS final. Se alterar variáveis, faça novo deploy.
5. Execute os testes e o roteiro `docs/HOMOLOGACAO.md` no domínio final, incluindo duas contas independentes.
6. No iPhone/Safari: Compartilhar → Adicionar à Tela de Início. No Android/Chrome: menu → Instalar aplicativo. O service worker só é registrado no build de produção; `npm run dev` não ativa cache PWA.

A aplicação está preparada para Vercel, mas **não foi implantada em sua conta nesta entrega**. O uso de Vercel Hobby é pessoal/não comercial. Supabase Free possui cotas e pode pausar projetos inativos; acompanhe uso no painel. Não há cron, polling, integração bancária ou dependência de serviço pago na arquitetura do MVP.

## Testes

```bash
npm test                 # domínio, PostgreSQL, contratos de API, componentes e PWA
npm run test:domain      # dinheiro, datas, metas, juros e inflação
npm run test:db          # migração/RLS/triggers em PostgreSQL WASM (PGlite)
npm run typecheck
npm run build
npm run check            # suíte + TypeScript + build
npm audit --omit=dev
```

Os testes do banco executam a migração real em **PostgreSQL embutido**, com duas identidades e papéis anon/authenticated. Apenas auth.users/auth.uid() são adaptados ao ambiente de teste; não há Supabase Auth remoto nem JWT real nesse conjunto. Os testes de API usam cliente Supabase substituído, para validar a fronteira HTTP, e não provam o funcionamento do serviço remoto. Os testes React usam jsdom: verificam fluxo e estado, não layout visual ou instalação PWA no sistema operacional.

### Smoke contra o Supabase real

Prepare duas contas de **teste**, confirme os e-mails e configure estas variáveis **apenas no terminal local ou CI protegido**:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
TEST_EMAIL_A
TEST_PASSWORD_A
TEST_EMAIL_B
TEST_PASSWORD_B
```

```bash
node --env-file=.env.local scripts/smoke-supabase.mjs
```

O script usa somente as duas sessões de teste, cria registros temporários, verifica RLS e FKs cruzadas e remove os registros que criou. Não cria usuários, não envia e-mails e não usa service_role. Nunca coloque as senhas em variáveis NEXT_PUBLIC nem no repositório. Consulte o resultado antes de liberar o app.

## Como usar

- **Lançamentos:** líquido recebido/gasto; bruto e descontos opcionais em receita. VA/VR entra numa conta de benefícios. Previsto não mexe no saldo. Exporte o filtro atual em CSV.
- **Minhas contas:** o saldo parte do valor inicial mais movimentos realizados. Benefícios ficam separados do dinheiro livre. Um saldo devedor em conta corrente aparece negativo.
- **Metas:** valor, data alvo, prioridade e teto mensal. Um aporte reserva saldo de uma conta para uma meta; não é uma nova despesa.
- **Investimentos:** crie uma conta do tipo investimento e configure taxa anual e inflação assumida. Aplique/resgate com transferências entre contas. Registre rendimento positivo ou perda com o tipo Rendimento, e taxas/impostos como despesas da conta investimento.
- **Recorrências:** mensal/semanal/anual, pausa e término. “Gerar previsões” cria lançamentos previstos em uma janela de até 12 meses. Confirme cada realizado nos lançamentos. Reexecutar não duplica; cancelar uma ocorrência não a recria.
- **Planejamento:** distribui a verba informada por data/prazo ou prioridade/orçamento, respeitando teto e necessidade mensal. Mostra déficit e sobra. Não movimenta dinheiro automaticamente.
- **Simulador:** juros compostos com taxa anual equivalente, aporte no fim do mês e inflação. Premissas e série mensal visíveis. Não promete rentabilidade.
- **Preferências:** claro/escuro/sistema, quatro cores e três fundos internos. Fundo por imagem/upload não integra o MVP.

## Regras de precisão e integridade

- Moeda BRL; entradas em português `1.234,56`. Não há ponto flutuante binário para ler/calcular valores monetários: centavos inteiros + Decimal para juros.
- Valores individuais/saldos de conta até 999.999.999.999 centavos. Agregados e projeções limitados a Number.MAX_SAFE_INTEGER. Falhas de limite são explícitas.
- Competência usa data sem horário. Hoje em America/Sao_Paulo. Realizados futuros e movimentos anteriores ao saldo inicial são rejeitados.
- Transferência é um único registro atômico e preserva patrimônio. Metas não duplicam ativos e reservas não podem exceder o saldo de origem nem o alvo da meta.
- Investimentos são contas de ativo; a configuração não cria um segundo saldo. Retorno realizado usa Modified Dietz desde a abertura; retorno real desconta **inflação assumida**, não IPCA observado automaticamente. Projeção é separada do ledger.
- Não há cálculo automático de imposto, INSS, IRRF, folha ou rentabilidade líquida tributária.

## Estrutura

```text
src/app/                       páginas App Router e API privada
src/components/                interface mobile, formulários, gráficos e simulador
src/lib/finance/                domínio puro: centavos, datas, juros e planejamento
src/lib/supabase/               cliente SSR e configuração
src/lib/validation.ts          contratos Zod de escrita
src/lib/import-contract.ts     contrato futuro; nenhum parser no MVP
src/proxy.ts                   renovação de sessão validada
supabase/migrations/           modelo, RLS, índices, constraints e RPCs
public/                        manifest assets, ícones, SW e tela offline
tests/                         gates automatizados por camada
scripts/smoke-supabase.mjs      teste opcional no projeto real
docs/                          especificação e evidências
```

A manutenção concentra o domínio em funções puras e a integridade no banco. O dashboard carrega tabelas por páginas de 500 registros, sem truncamento silencioso no limite padrão da Data API. O volume de um usuário pessoal é processado em memória; não é uma arquitetura para histórico bancário massivo. Antes de habilitar importação em alto volume, migrar relatórios para agregações SQL paginadas e perfilar índices/cotas.

## Segurança e limitações da entrega

RLS em todas as tabelas públicas; anon sem acesso; user_id obtido da sessão; vínculos compostos por usuário; validação no servidor e banco; Origin em escritas; respostas financeiras no-store; credenciais fora do repositório; CSV neutraliza fórmulas. Next.js usa script inline no App Router e a CSP permite `unsafe-inline`; nonce por resposta é uma melhoria futura para endurecer a CSP, não uma proteção já implementada.

O service worker usa lista explícita de assets públicos e uma tela offline genérica. Não armazena HTML financeiro, APIs, RSC, Supabase, tokens ou JSON de finanças. Cookies de sessão são gerenciados pelo Supabase SSR; não há localStorage/IndexedDB para finanças. No MVP, usar sem rede significa ver a tela offline, sem editar dados.

Gates externos pendentes: Auth e e-mail reais, CRUD sobre o projeto de destino, concorrência em conexões PostgreSQL reais, inspeção visual mobile/desktop em navegador e instalação iOS/Android. Não houve navegador disponível para QA visual nesta sessão. Os testes jsdom e o build não substituem esses gates.
