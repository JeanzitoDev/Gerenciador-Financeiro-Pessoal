# Meu Norte · v3.0.4

Planejador financeiro pessoal (Web App / PWA) com foco em **Fluxo de Caixa Mensal e Anual**, **Importação Inteligente de Extratos e Faturas (`.OFX`, `.CSV`, `.TXT`, `.PDF` e imagens/prints)**, **Gestão de Cartões e Carteiras Digitais**, **Empréstimos e Financiamentos (Tabela Price/SAC)**, **Simulador de Compras e Aluguel**, **Cofrinho de Metas** e **Armazenamento Híbrido Seguro (Nuvem Supabase + Offline First + Ofuscação Criptográfica)**.

> 📘 **Documentação Técnica e Funcional Completa:** consulte [`docs/DOCUMENTACAO-COMPLETA.md`](docs/DOCUMENTACAO-COMPLETA.md) para o manual definitivo do sistema (Arquitetura, Estrutura de Pastas, Requisitos Funcionais `RF01`–`RF14`, Requisitos Não Funcionais `RNF01`–`RNF12`, Regras de Negócio e Fórmulas Matemáticas `RN01`–`RN14`, Modelagem do Banco de Dados, Rotas de API, Segurança/LGPD e Guia de Testes).

> **Atualização v3.0.4:** leitura local de PDFs protegidos por senha, com campo de desbloqueio sem armazenamento de senha/CPF e extração de tabelas via PDF.js. Consulte [FASE-3.0.4.md](docs/FASE-3.0.4.md).
>
> **Anterior v3.0.3:** revisão da importação bancária (Itaú/99), proteção da data/saldo inicial, conciliação de duplicatas por descrição, transferências confirmadas e importação em lotes. Consulte [FASE-3.0.3.md](docs/FASE-3.0.3.md) para alterações, limites, testes e pendências.

---

## Sumário

1. [Visão Geral e Stack Tecnológica](#1-visão-geral-e-stack-tecnológica)
2. [Principais Funcionalidades (v3.0.4)](#2-principais-funcionalidades-v304)
3. [Arquitetura e Estrutura de Pastas](#3-arquitetura-e-estrutura-de-pastas)
4. [Requisitos Funcionais (RF01 a RF14)](#4-requisitos-funcionais-rf01-a-rf14)
5. [Requisitos Não Funcionais (RNF01 a RNF12)](#5-requisitos-não-funcionais-rnf01-a-rnf12)
6. [Regras de Negócio Principais (RN01 a RN14)](#6-regras-de-negócio-principais-rn01-a-rn14)
7. [Banco de Dados e Migrações SQL](#7-banco-de-dados-e-migrações-sql)
8. [Rotas de API Backend](#8-rotas-de-api-backend)
9. [Como Rodar Localmente](#9-como-rodar-localmente)
10. [Configuração do Supabase e Deploy na Vercel](#10-configuração-do-supabase-e-deploy-na-vercel)
11. [Comandos de Verificação e Testes](#11-comandos-de-verificação-e-testes)
12. [Índice de Documentação (`docs/`)](#12-índice-de-documentação-docs)

---

## 1. Visão Geral e Stack Tecnológica

O **Meu Norte** é uma aplicação web progressiva (PWA) construída para organizar a vida financeira pessoal de ponta a ponta sem exigir conexão direta de Open Finance paga, combinando lançamento manual guiado com um motor local de importação e conciliação de extratos/faturas.

| Camada | Tecnologia | Papel no Projeto |
| :--- | :--- | :--- |
| **Framework** | **Next.js 16 (App Router)** + **React 19** | Renderização híbrida, rotas de API serverless e SPA responsiva |
| **Linguagem** | **TypeScript 5.8** (`strict: true`) | Tipagem estática ponta a ponta |
| **Banco de Dados** | **Supabase (PostgreSQL + RLS)** | Persistência relacional em nuvem com isolamento por usuário |
| **Persistência Local** | **LocalStorage (`LocalStoragePlannerRepository`)** | Funcionamento 100% offline/visitante e cache instantâneo |
| **Autenticação** | **JWT HMAC-SHA256 (`Web Crypto API`) + PBKDF2** | Sessão em cookie `HttpOnly` e senhas com 120.000 iterações |
| **Criptografia de Dados** | **AES-256-CTR + HMAC-SHA256 (`privacy-crypto.ts`)** | Ofuscação criptográfica de descrições e nomes no banco em nuvem |
| **Validação** | **Zod** | Validação estrita de payloads de entrada e saída nas APIs |
| **Testes** | **Vitest + Testing Library + JSDOM** | 15 suítes automatizadas e 187 testes de unidade e integração |

---

## 2. Principais Funcionalidades (v3.0.4)

- **Visão Mensal (`Mensal`)**:
  - Indicadores em tempo real: Saldo Real Disponível, Limite do Cheque Especial, Despesas do Mês, Resultado Previsto, Liquidez e Comprometimento da Renda.
  - Tabelas interativas de **Entradas** e **Saídas** com status (`Pago/Recebido`, `Pendente`, `Atrasado`), recorrência (`Fixo`/`Variável`), filtro por categoria e edição inline.
- **Importação Inteligente de Extratos e Faturas (`v3.0.4`)**:
  - Leitura direta no navegador (sem enviar arquivos brutos para servidores externos) de **`.OFX`, `.QFX`, `.CSV`, `.TXT`, `.PDF`** e **Imagens/Prints (`.PNG`, `.JPG`, `.WEBP`)** ou texto colado do app do banco.
  - **Conciliação Anti-Duplicação em 3 Camadas**:
    1. Hash determinístico `FITID` / identificador da transação (`imported_hash`);
    2. Reconciliação inteligente com lançamentos manuais existentes (mesmo valor, mesmo tipo e janela de ±4 dias, ou mesma competência para salários/rendas fixas);
    3. Detecção de parcelas de compras já cadastradas.
  - Categorização automática por palavras-chave e projeção automática de parcelas futuras (`02/10` → gera `02/10` a `10/10` nos meses seguintes).
- **Cartões de Crédito e Carteiras Digitais**:
  - Suporte a Cartão de Crédito tradicional, **SPayLater (Shopee)**, **Mercado Crédito**, **Crediário Digital** e outros limites parcelados.
  - Cálculo automático de competência pela data de fechamento, fatura consolidada expansível na tabela de Saídas e indicador de utilização do limite total.
- **Empréstimos e Financiamentos**:
  - Cálculo preciso de **Tabela Price** e **SAC**, simulação de **amortização extraordinária** (`reduzir prazo` vs. `reduzir parcela`) e geração automática das parcelas mensais.
- **Simulador de Compra e Aluguel**:
  - **Viabilidade de Compra**: avalia impacto à vista vs. parcelado sobre a folga mensal e a reserva mínima em todos os meses afetados (`Folga`, `Atenção` ou `Risco`).
  - **Simulador de Aluguel**: calcula o custo total de moradia (Aluguel + Condomínio + IPTU + Contas Fixas + Seguro) frente à renda líquida (limites de 30% saudável e 40% crítico).
- **Cofrinho e Metas Financeiras**:
  - Caixinhas por objetivo (`Reserva de Emergência`, `Viagem`, `Carro`, etc.), simulador de aportes com rendimento em `% do CDI` e **Desafio das 52 Semanas** interativo.
- **Planejamento Anual e Relatórios**:
  - Grade de 12 meses com projeção automática de fixos, parcelas de cartões e financiamentos, gráficos de evolução patrimonial e distribuição por categoria (`50-30-20`).
- **UX, Acessibilidade e Privacidade**:
  - Modais com largura adaptativa por dispositivo e listas suspensas customizadas (`SelectControl`) com abertura inteligente para baixo.
  - Modo Privacidade (`👁️`) para ocultar valores na tela, Tour Guiado passo a passo para novos usuários e Central de Privacidade LGPD (exportação JSON e exclusão definitiva de conta).

---

## 3. Arquitetura e Estrutura de Pastas

```text
Gerenciador-Financeiro-Pessoal/
├── docs/                                  # Documentação técnica, funcional e histórico de fases
│   └── DOCUMENTACAO-COMPLETA.md           # Manual completo do sistema (RF, RNF, RN, Banco, API)
├── public/                                # Assets estáticos, ícones PWA e Service Worker (sw.js)
├── supabase/
│   ├── schema.sql                         # Schema base completo do PostgreSQL + Políticas RLS
│   └── migrations/                        # Migrações incrementais (002 a 005)
└── src/
    ├── app/                               # Next.js App Router (Páginas, Layouts e API Routes)
    │   ├── api/                           # Endpoints REST (auth, planner, import, credit-cards, loans, piggy-banks)
    │   ├── globals.css                    # Design System base e tokens CSS
    │   └── phase2.css                     # Estilos de modais responsivos, importador, cartões e cofrinho
    ├── components/                        # Componentes visuais React (Workspace, Modais, SelectControl, DatePicker)
    └── lib/
        ├── auth/                          # JWT (HMAC-SHA256), hash PBKDF2 e gerenciamento de sessão
        ├── finance/                       # Motores puros de cálculo (engine, statement-import, credit-cards, loans, purchase, piggy-bank, reports)
        ├── repositories/                  # Abstração de dados (LocalStorage vs Supabase Cloud)
        ├── supabase/                      # Clientes Supabase (browser e service-role server)
        ├── privacy-crypto.ts              # Ofuscação criptográfica AES-256-CTR + HMAC-SHA256
        ├── types.ts                       # Contratos e interfaces TypeScript de todo o domínio
        └── validation.ts                  # Schemas Zod para validação de entrada da API
```

---

## 4. Requisitos Funcionais (RF01 a RF14)

A especificação detalhada de entradas, processamento e saídas de cada requisito encontra-se em [`docs/DOCUMENTACAO-COMPLETA.md`](docs/DOCUMENTACAO-COMPLETA.md#4-requisitos-funcionais-rf).

| Código | Requisito Funcional | Resumo |
| :--- | :--- | :--- |
| **RF01** | **Autenticação e Modos de Uso** | Cadastro, login com identificador/senha, recuperação por código de 8 dígitos e modo Visitante/Offline. |
| **RF02** | **Saldos de Contas e Cheque Especial** | Registro de saldo em conta corrente, reserva de segurança e limite de cheque especial com alerta de uso. |
| **RF03** | **Gestão de Entradas e Saídas Mensais** | CRUD completo de receitas e despesas (`Fixo`/`Variável`, status de pagamento, categorias customizadas). |
| **RF04** | **Importação Inteligente de Extratos/Faturas** | Importação de `.OFX`, `.CSV`, `.TXT`, `.PDF`, imagens/prints ou texto colado com categorização e anti-duplicação. |
| **RF05** | **Cartões de Crédito e Carteiras Digitais** | Gestão de limites, compras parceladas, cálculo de fatura por dia de fechamento e consolidação nas saídas. |
| **RF06** | **Empréstimos e Financiamentos** | Cadastro de contratos Price/SAC, simulação de amortização antecipada e geração de parcelas no fluxo mensal. |
| **RF07** | **Cofrinho, Metas e Desafio 52 Semanas** | Criação de caixinhas de objetivo, aportes/resgates, projeção em `% do CDI` e acompanhamento de 52 semanas. |
| **RF08** | **Simulador de Viabilidade de Compra** | Simulação de impacto de compra à vista ou parcelada sobre a liquidez e reserva mínima futura. |
| **RF09** | **Simulador de Viabilidade de Aluguel** | Avaliação do custo total de moradia frente à renda líquida mensal com faixas de segurança (30% / 40%). |
| **RF10** | **Planejamento Anual (12 Meses)** | Consolidação anual de entradas, saídas, faturas, financiamentos e evolução do saldo previsto. |
| **RF11** | **Relatórios e Análises Gráficas** | Gráficos por categoria, evolução mensal, despesas fixas vs. variáveis e regra 50-30-20. |
| **RF12** | **Modo Privacidade Visual** | Ocultação instantânea (`R$ •••••`) de todos os valores monetários na interface. |
| **RF13** | **Tutorial Interativo (Onboarding)** | Guia passo a passo ensinando configuração inicial, importação de extrato, cartões, simuladores e metas. |
| **RF14** | **Portabilidade e Exclusão (LGPD)** | Exportação integral dos dados em `.JSON` e exclusão irreversível da conta em nuvem. |

---

## 5. Requisitos Não Funcionais (RNF01 a RNF12)

| Código | Categoria | Especificação |
| :--- | :--- | :--- |
| **RNF01** | **Offline-First & Resiliência** | Funcionamento integral sem internet via `localStorage`, com sincronização transparente para a nuvem quando autenticado. |
| **RNF02** | **Criptografia de Senhas** | Hash `PBKDF2` (`SHA-256`, 120.000 iterações, salt aleatório de 16 bytes) com comparação em tempo constante. |
| **RNF03** | **Sessão Segura** | Cookie `HttpOnly`, `SameSite=Lax`, assinado via `HMAC-SHA256` (`mn_session`), validade de 30 dias. |
| **RNF04** | **Ofuscação em Repouso** | Descrições, categorias e nomes de cartões/empréstimos cifrados no banco via `AES-256-CTR` + `HMAC-SHA256` (`enc:v1:`). |
| **RNF05** | **Isolamento Multi-Tenant** | Row Level Security (RLS) ativo em todas as 11 tabelas do PostgreSQL por `user_id`. |
| **RNF06** | **Proteção Anti-Brute-Force** | Rate limiting por IP e identificador nas rotas de login, cadastro e recuperação de acesso. |
| **RNF07** | **Headers de Segurança HTTP** | `CSP`, `HSTS`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` e `Permissions-Policy`. |
| **RNF08** | **Responsividade e Modais** | Layout adaptativo de 360px (mobile) a 4K (desktop), com modais largos sem corte de listas suspensas. |
| **RNF09** | **Posicionamento de Dropdowns** | Componente `SelectControl` via React Portal com abertura prioritária para baixo (`bottom`) e rolagem interna. |
| **RNF10** | **Processamento Local de Arquivos** | Parsing de `.OFX`, `.CSV`, `.TXT`, `.PDF` e imagens executado em memória sem persistir arquivos brutos em terceiros. |
| **RNF11** | **Instalabilidade PWA** | Manifesto Web App + Service Worker (`public/sw.js`) para instalação no Android, iOS e Desktop. |
| **RNF12** | **Testabilidade Determinística** | Regras de negócio desacopladas em funções puras (`src/lib/finance/*`) cobertas por 187 testes automatizados. |

---

## 6. Regras de Negócio Principais (RN01 a RN14)

Todas as fórmulas matemáticas e algoritmos detalhados encontram-se na [Seção 6 da Documentação Completa](docs/DOCUMENTACAO-COMPLETA.md#6-regras-de-negócio-e-fórmulas-matemáticas-rn).

- **RN01 — Projeção Automática de Recorrentes**: Receitas e despesas marcadas como `Fixo` (com `recurringEndMonth` vazio ou futuro) projetam-se automaticamente nos meses subsequentes sem duplicar registros já lançados no mês.
- **RN02 — Saldo Real vs. Resultado Previsto**:
  - $\text{Saldo Previsto Final} = \text{Saldo em Conta} + \text{Entradas Pendentes} - \text{Saídas Pendentes}$.
  - $\text{Poder de Compra Total} = \max(0, \text{Saldo em Conta}) + \text{Limite de Cheque Especial}$.
- **RN03 — Competência de Fatura de Cartão**: Compras realizadas no dia $d \le \text{closingDay}$ entram na fatura do próprio mês $(Y, M)$; compras com $d > \text{closingDay}$ entram na fatura do mês seguinte $(Y, M+1)$, distribuindo as $N$ parcelas consecutivamente.
- **RN04 — Consolidação de Fatura**: As compras do cartão são somadas em uma linha sintética `card-invoice-{cardId}-{YYYY-MM}` na tabela de Saídas do mês para evitar dupla contagem no saldo líquido.
- **RN05 — Anti-Duplicação na Importação (3 Camadas)**:
  1. **Camada 1 (`Exact Match`)**: Verifica `importedHash` (`FITID` do OFX ou hash normalizado) contra lançamentos existentes.
  2. **Camada 2 (`Fuzzy Manual Reconciliation`)**: Sinaliza como `Já lançado manualmente?` (desmarcado por padrão) quando encontra lançamento com mesmo tipo, diferença $\le \text{R\$ } 0,05$ e data dentro de $\pm 4$ dias (ou no mesmo mês para salários/rendas fixas).
  3. **Camada 3 (`Installment Match`)**: Reconcilia parcelas de cartão pelo valor da parcela e número `XX/YY`.
- **RN06 — Projeção de Parcelas na Importação**: Ao importar uma compra parcelada na parcela $c$ de $t$ ($c < t$), o sistema gera automaticamente as $(t - c)$ parcelas restantes nos meses futuros.
- **RN07 — Financiamentos Price e SAC**: Suporte integral à Tabela Price (parcela constante) e SAC (amortização constante), com simulação de amortização extra reduzindo prazo ou valor da parcela.
- **RN08 — Viabilidade de Compra**: Classifica a compra em `Folga` (não invade reserva mínima em nenhum mês), `Atenção` (consome parte da reserva, mas mantém saldo $\ge 0$) ou `Risco` (deixa algum mês negativo).
- **RN09 — Viabilidade de Aluguel**: Alerta quando o custo total de moradia ultrapassa **30%** (Atenção) ou **40%** (Risco) da renda líquida mensal.
- **RN10 — Rendimento do Cofrinho**: Calcula juros compostos mensais baseados em `% do CDI` sobre o saldo acumulado e aportes mensais.

---

## 7. Banco de Dados e Migrações SQL

O banco de dados PostgreSQL no Supabase possui **11 tabelas com RLS ativo**:

1. `profiles` — Perfis, hash de senha (`PBKDF2`) e hash do código de recuperação.
2. `planner_Preferences` — Preferências do usuário (`starting_month`, `Note`).
3. `month_snapshots` — Saldos mensais (`current_balance`, `safe_balance`, `overdraft_limit`, `starting_balance`).
4. `income_entries` — Entradas financeiras (com `imported_hash`, `recurring_end_month`, etc.).
5. `expense_entries` — Saídas financeiras (com `imported_hash`, `credit_card_id`, `installment_number`, etc.).
6. `custom_categories` — Categorias personalizadas de entrada e saída.
7. `credit_cards` — Cartões de crédito e carteiras digitais (`card_type`, `credit_limit`, `closing_day`, `due_day`).
8. `credit_card_expenses` — Compras à vista ou parceladas vinculadas aos cartões.
9. `loans` — Contratos de empréstimos e financiamentos (`amortization_type`, `interest_rate_annual`, etc.).
10. `piggy_banks` — Cofrinhos, metas financeiras e estado do Desafio de 52 Semanas (`challenge_52_weeks`).
11. `piggy_bank_transactions` — Histórico de depósitos e resgates dos cofrinhos.

### Ordem de Execução no Supabase SQL Editor
Para criar o banco do zero ou atualizar um ambiente existente, execute na ordem:
1. [`supabase/schema.sql`](supabase/schema.sql)
2. [`supabase/migrations/002_phase2_tables.sql`](supabase/migrations/002_phase2_tables.sql)
3. [`supabase/migrations/003_phase23_features.sql`](supabase/migrations/003_phase23_features.sql)
4. [`supabase/migrations/004_overdraft_and_credit_types.sql`](supabase/migrations/004_overdraft_and_credit_types.sql)
5. [`supabase/migrations/005_statement_import_hash.sql`](supabase/migrations/005_statement_import_hash.sql)

---

## 8. Rotas de API Backend

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Cria conta com identificador + senha e retorna código de recuperação de 8 dígitos |
| `POST` | `/api/auth/login` | Autentica usuário e grava cookie `HttpOnly` (`mn_session`) |
| `POST` | `/api/auth/logout` | Encerra a sessão limpando o cookie |
| `POST` | `/api/auth/recover` | Redefine a senha usando o código de recuperação de 8 dígitos |
| `GET` | `/api/auth/session` | Retorna o estado da sessão atual (`anonymous`, `local` ou `cloud`) |
| `DELETE` | `/api/auth/account` | Exclui permanentemente a conta e todos os dados em cascata (LGPD) |
| `GET` / `PUT` | `/api/planner` | Carrega ou salva o `PlannerState` completo (com ofuscação criptográfica) |
| `POST` | `/api/import/parse-document` | Extrai texto de arquivos `.PDF` ou analisa imagens de comprovantes/faturas |
| `GET/POST/PUT/DELETE` | `/api/credit-cards` | CRUD de cartões de crédito e compras no cartão |
| `GET/POST/PUT/DELETE` | `/api/loans` | CRUD de empréstimos e financiamentos |
| `GET/POST/PUT/DELETE` | `/api/piggy-banks` | CRUD de cofrinhos e transações de aporte/resgate |

---

## 9. Como Rodar Localmente

### Pré-requisitos
- **Node.js** `20.x` ou superior
- **npm** `10.x` ou superior

### Passo a passo
```bash
# 1. Instale as dependências
npm install

# 2. Copie o arquivo de variáveis de ambiente de exemplo
cp .env.example .env.local

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:3000`.
> 💡 **Nota:** Mesmo sem configurar o Supabase no `.env.local`, o app funciona imediatamente em **Modo Local / Offline** usando o `localStorage` do navegador.

---

## 10. Configuração do Supabase e Deploy na Vercel

### Variáveis de Ambiente (`.env.local` e Painel da Vercel)

| Variável | Obrigatória | Descrição |
| :--- | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim (Nuvem) | URL do projeto no Supabase (`https://<project-ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim (Nuvem) | Chave pública `anon` do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim (Nuvem) | Chave privada `service_role` (usada exclusivamente no servidor Next.js) |
| `AUTH_SECRET` | Sim (Produção) | Segredo forte (mínimo 32 caracteres) para assinar o JWT e derivar a chave de ofuscação `AES-256-CTR` |
| `GEMINI_API_KEY` | Opcional | Chave da API Google Gemini (`gemini-2.5-flash`) para leitura OCR de fotos/prints de faturas |

Gere um `AUTH_SECRET` seguro com:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## 11. Comandos de Verificação e Testes

```bash
# Executar todas as 15 suítes de testes automatizados (187 testes)
npm test

# Verificar tipagem estática do TypeScript
npx tsc --noEmit

# Executar linter (ESLint)
npm run lint

# Gerar build de produção
npm run build
```

---

## 12. Índice de Documentação (`docs/`)

- 📘 **[`docs/DOCUMENTACAO-COMPLETA.md`](docs/DOCUMENTACAO-COMPLETA.md)** — **Documentação Completa do Projeto (v3.0.3)**: Arquitetura, Requisitos Funcionais (`RF01`–`RF14`), Requisitos Não Funcionais (`RNF01`–`RNF12`), Regras de Negócio e Fórmulas (`RN01`–`RN14`), Dicionário de Dados, API e Guia de Manutenção.
- [`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md) — Especificação funcional original e fluxos principais.
- [`docs/MODELO.md`](docs/MODELO.md) — Modelo de domínio inicial e regras de cálculo base.
- [`docs/SEGURANCA.md`](docs/SEGURANCA.md) — Arquitetura de segurança, autenticação, rate-limiting e headers HTTP.
- [`docs/USABILIDADE-E-PRIVACIDADE.md`](docs/USABILIDADE-E-PRIVACIDADE.md) — Diretrizes de LGPD, ofuscação criptográfica de dados e usabilidade.
- [`docs/FASE-2.md`](docs/FASE-2.md) / [`docs/FASE-2.3.md`](docs/FASE-2.3.md) / [`docs/FASE-2.3.4.md`](docs/FASE-2.3.4.md) — Registros históricos da evolução das fases 2.x até a 3.0.3.
