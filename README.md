# Meu Norte · v2.2.0

Gerenciador financeiro pessoal em **Next.js, TypeScript, Tailwind CSS, Supabase Auth e PostgreSQL**. PWA com finanças online, BRL em centavos e dados separados por usuário.

## Atualizar a versão já publicada

Se já instalou uma versão da fase 2, siga **[a atualização 2.2](docs/FASE-2.2.md)**. Esta revisão inclui uma migração pequena para o tema padrão de novas contas, além do código atualizado.

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
- Projeto existente da versão anterior: aplique apenas a migração `202610180002_phase2.sql`.
- Authentication → Sign In / Providers → Email: **Confirm Email desativado** nesta fase. Permita novos cadastros e use senha mínima de 8 caracteres.
- Configure `NEXT_PUBLIC_AUTH_EMAIL_ENABLED=false`. Cadastro pede nome, e-mail e senha, encerra a sessão criada automaticamente pelo Supabase e mostra a tela Entrar com o e-mail preenchido. Recuperação por e-mail está desabilitada; alteração de senha autenticada permanece disponível.
- Na Vercel, use a raiz com `package.json`, instalação `npm ci`, build `npm run build`, Node 24 LTS e saída padrão do Next.js.
- Configure as variáveis públicas e `APP_ORIGIN=https://meunorte-financeiro.vercel.app`, sem `/app`. Reinicie localmente ou faça novo deploy após mudar variáveis.
- Para habilitar a exclusão da conta, configure **`SUPABASE_SECRET_KEY` somente no servidor** com a chave privada do mesmo projeto. A rota verifica a senha atual antes de executar a exclusão atômica; nenhum identificador de usuário vindo do navegador escolhe a conta a apagar.
- Para executar as recorrências mesmo com o app fechado, habilite `pg_cron` em Database → Extensions e execute `supabase/phase2-cron.sql`. É um agendamento SQL diário; não envolve SMTP, Turnstile, serviço pago de cron ou backup automático. Sem esse job, a sincronização ocorre ao abrir/atualizar o app, ao voltar para a janela e a cada minuto enquanto ele estiver visível e sem formulário aberto.

Nunca envie `.env.local` ao Git. A chave pública é diferente da chave privada. Segredos não podem usar prefixo `NEXT_PUBLIC_`.

## O que mudou na fase 2

- Recorrências são preparadas automaticamente: em **Lançamentos → Para confirmar**, use **Recebi/Paguei**, ajuste valor/data ou pule uma ocorrência. O registro automático é opt-in, vale a partir de hoje e preserva o histórico pendente. Atualizar a página não duplica lançamentos.
- Empréstimos e financiamentos de parcelas fixas: histórico anterior, pagamento vinculado a uma única despesa, progresso e estimativa de amortização. Juros mensais e CET têm campos distintos. O modelo estimado é Price, sem indexadores, atrasos ou taxas adicionais.
- Nome no cadastro, saudação personalizada, perfil no avatar superior, logo levando à Visão geral e exclusão completa com senha atual.
- Modais centralizados, listas e calendários próprios, máscara monetária BR, categorias sugeridas, datas após situação nas despesas e receitas manuais tratadas como recebidas.
- Gráfico de receitas verde e despesas vermelho, CSV em português e download direto em Relatórios.
- Mais cores/fundos, gradiente corrigido, tipografia revisada, novo símbolo `n + caminho + bússola`, animações e acessibilidade por teclado. Movimento reduzido respeita a opção do usuário no sistema.
- Menu lateral com rolagem própria, rodapé com versão/copyright, indicador do Next oculto no desenvolvimento.
- CSP de scripts com nonce por resposta, validação e autorização no servidor, RLS/FKs por dono, limite distribuído de escritas e corpo de requisição limitado em bytes.

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

- [Atualização e homologação da fase 2](docs/FASE-2.md)
- [Controles e limites de segurança](docs/SEGURANCA.md)
- [Validação](docs/VALIDACAO.md)
- [Especificação original da fase 1](docs/ESPECIFICACAO.md)
- [Modelo inicial do banco](docs/MODELO.md)

SMTP/validação do e-mail e recuperação por e-mail ficam para fases futuras. Turnstile e backups automáticos estão adiados para fase 3/4. Sem integração bancária, importador de extratos ou movimentação de dinheiro real. Os dados da API de inflação são uma referência observada; projeções futuras continuam sendo hipóteses.
