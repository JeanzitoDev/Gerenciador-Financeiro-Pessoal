# Atualização incremental · Fase 2.3.4

Esta entrega evolui o **Meu Norte** da **v2.3.3** para a **v2.3.4**, adicionando a opção de **Cheque especial** na criação e edição de contas correntes e o cálculo automático de consumo do limite quando despesas pagas ultrapassam o saldo em conta.

## 1. Banco de dados (Supabase SQL Editor)

Existe **1 migração incremental** para adicionar a coluna `overdraft_cents` em `public.accounts` e atualizar a validação `public.check_finance_integrity()`:

- Arquivo: `supabase/migrations/202610290006_phase234.sql`

Copie e execute o conteúdo desse arquivo no **SQL Editor** do Supabase antes ou logo após o deploy. A migração é idempotente (`add column if not exists`) e preserva 100% das contas, saldos, metas e lançamentos existentes (definindo `overdraft_cents = 0` por padrão para contas já cadastradas).

## 2. O que mudou na v2.3.4

1. **Opção de cheque especial ao criar ou editar conta corrente (`src/components/record-form.tsx`)**
   - Ao cadastrar ou editar uma **Conta corrente** (`checking`), é possível marcar **"Esta conta possui limite de cheque especial"** e informar o **Limite do cheque especial (R$)**.
   - Inclui seletor rápido de situação do saldo inicial (**Saldo positivo (+)** ou **No cheque especial (−)**) para facilitar o preenchimento também em teclados numéricos de celular.
   - Exibe prévia imediata de quanto do cheque especial já está em uso (caso o saldo inicial seja negativo) ou qual será o fôlego total (`saldo inicial + limite do cheque especial`).

2. **Consumo automático do limite quando a despesa paga supera o saldo (`src/lib/finance/engine.ts`, `src/lib/demo.ts`, `supabase/migrations/202610290006_phase234.sql`)**
   - Quando o saldo inicial somado às entradas realizadas é menor do que as despesas pagas, o saldo da conta fica negativo e **consome automaticamente o limite do cheque especial**:
     - `usedCents`: quanto do limite contratado está sendo usado no momento.
     - `remainingCents`: quanto ainda resta disponível no cheque especial.
     - `totalAvailableCents`: fôlego total de pagamento (`saldo livre + limite de cheque especial`).
   - Quando novas receitas entram na conta, o limite do cheque especial é recomposto automaticamente.
   - Se um lançamento confirmado ultrapassar a soma do saldo com o limite do cheque especial contratado, a operação é bloqueada com mensagem clara tanto no aplicativo quanto no PostgreSQL.

3. **Acompanhamento nas telas de Contas, Visão Geral e Relatórios (`src/components/finance-app.tsx`, `src/lib/finance/reports.ts`)**
   - **Contas**: cada conta corrente com cheque especial exibe um painel próprio com barra de consumo, percentual usado, valor utilizado (`R$ X de R$ Y`), limite disponível e fôlego total.
   - **Visão geral**: a barra de indicadores exibe o cheque especial disponível ou o valor atualmente em uso.
   - **Relatórios**: a tabela **Movimento por conta no mês** detalha o uso e o limite livre do cheque especial de cada conta corrente.

## 3. Como publicar

1. No Supabase → **SQL Editor**, execute `supabase/migrations/202610290006_phase234.sql`.
2. Valide localmente:
   ```bash
   npm test
   npm run typecheck
   npm run build
   ```
3. Faça commit e push para a branch conectada à Vercel.

