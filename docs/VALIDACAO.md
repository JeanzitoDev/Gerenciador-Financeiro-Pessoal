# Validação · Meu Norte 2.3.4

Base local: v2.3.3. Esta entrega evolui a base para a **v2.3.4**, preservando os dados, regras financeiras e migrações anteriores.

## Resultado local

- `npm test`: **180 testes em 15 arquivos aprovados**.
- `npm run typecheck`: geração de tipos e TypeScript aprovados.
- `npm run build`: produção compilada, incluindo a rota pública `/privacidade` atualizada.
- Node.js 24.19.0 e Next.js 16.4.2; nenhuma dependência nova ou serviço pago adicionado.
- PostgreSQL local com todas as migrations anteriores (incluindo `202610290006_phase234.sql`) e dados existentes aprovados.

## Evidência específica da 2.3.4

| Área                          | Verificação                                                                                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cadastro de cheque especial   | Opção `"Esta conta possui limite de cheque especial"` exibida em contas correntes (`kind = 'checking'`), com campo de limite em reais, prévia automática de limite consumido/disponível e seletor de sinal |
| Consumo e recomposição        | Quando uma despesa paga supera o saldo próprio da conta, o excedente consome o cheque especial (`accountOverdraft`), recompondo o limite quando novas receitas entram e barrando excessos além de `saldo + limite` |
| Painéis e Relatórios          | Cartão da conta corrente exibe barra e métricas de uso do limite (`Usado do limite`, `Limite disponível` e `Fôlego total`); `Visão geral` e `Relatórios` mostram o resumo do cheque especial   |
| Banco de dados (PGlite / SQL) | Coluna `overdraft_cents` adicionada em `public.accounts` com `check` restrito a `checking` e validação na trigger `public.check_finance_integrity()` impedindo saldo abaixo de `-overdraft_cents` |

## Evidência específica da 2.3.3

| Área                          | Verificação                                                                                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lista suspensa no calendário  | `SelectControl` aninhado em `.calendar-heading` abre com largura mínima confortável (`196px`) e espaçamento interno amplo, sem espremer o texto contra o check (`✓`) ou criar scroll duplo     |
| Máscara no nome do cofrinho   | Campo `Nome` da meta permanece livre com `placeholder` de exemplo (`"Ex.: Cofrinho da viagem, Reserva 1 a 500, Meu carro..."`) e aplica nome padrão automaticamente se salvo em branco         |
| Cofrinho personalizado        | Opção `"Outro tamanho (personalizado)"` permite definir qualquer cartela de `1 a N` (`2` a `2000`), recalculando a meta em centavos e exibindo o quadro interativo correspondente              |
| Relatórios completos          | Filtro por conta e período (`6` ou `12` meses), card de Economia e metas (`%` poupado + guardado no mês), **Raio-X do orçamento** (fixos vs. variáveis vs. sobra), **Maiores gastos** e contas |

## Evidência específica da 2.3.2

| Área                    | Verificação                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Menu lateral e foco     | Espaçamento horizontal em `.sidebar nav`, `.nav-item` e `.nav-active-dot` ajustado para exibir a borda ativa/foco e a bolinha indicadora inteiras sem corte                                                  |
| Carregamento            | Tela `"Preparando seu espaço"` atualizada para renderizar `<BrandMark size={48} />` oficial com animação da agulha                                                                                          |
| Tutorial na Visão Geral | Componente `GettingStarted` renderizado exclusivamente quando `screen === "overview"`, mantendo o restante das páginas livre                                                                                |
| Preferências            | Layout de duas colunas alinhado (`Seu espaço, seu jeito` à esquerda; `Sempre à mão`, `Primeiros passos`, `Quem pode ver meus dados?` e `Seu acesso` empilhados à direita)                                  |
| Privacidade (Beta)      | `/privacidade`, cadastro e Preferências informam versão Beta sem criptografia atual, isenção de garantia de inacessibilidade no Beta e plano para versão Produto (criptografia, recuperação e chave/B.O.)   |
| Aluguel de imóvel       | Categoria `rent` no simulador com cálculo de aluguel mensal, encargos, caução (com atalho `3x o aluguel`) e seguro fiança mensal, além de criação de meta                                                   |
| Cofrinho 1 a 500        | Meta de R$ 125.250,00 com retângulo interativo de 1 a 500 dividido por faixas e filtros, marcando números via aportes reais (`Cofrinho #...`), além de opção de cofrinho mensal progressivo no formulário |
| Zoom mobile             | `viewport` configurado com `maximumScale: 1` e `userScalable: false` para comportamento de aplicativo no celular                                                                                            |

## Evidência específica da 2.3.1

| Área                | Verificação                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tutorial            | Conta existente com marcação antiga recebe o guia; percorre etapas, conclui e não o vê novamente depois de recarregar; o fluxo anterior de adiar/retomar continua aprovado                                                            |
| Persistência        | API salva conclusão com horário do servidor, descarta data/dono fornecidos pelo cliente; origem inválida e etapa inválida continuam recusadas                                                                                         |
| Migração            | Perfis antigos são reiniciados sem mexer em saldos; etapas em andamento preservadas; conclusão real não é apagada ao reaplicar; RLS isola perfis                                                                                      |
| Planejamento        | Orçamento abre aporte com valor e conta; cancelar mantém o orçamento; salvar reserva o valor e desconta do plano; condições das metas continuam impedindo sugestões                                                                   |
| Navegação           | Categorias e fluxo abrem a seção certa dos Relatórios com foco; preferências acessíveis só pelo avatar; título único e créditos fora do conteúdo da página                                                                            |
| Simulador           | Cálculo válido move foco ao resultado e pede rolagem suave; movimento reduzido usa rolagem imediata; criação da meta preservada sem aporte automático                                                                                 |
| Aparência           | CSS compartilha padrão e cor entre espaço e cartão, sem lista de gradientes limitada a quatro cores; brilho decorativo da landing não captura eventos de ponteiro                                                                     |
| Contraste do cartão | Cálculo sRGB conservador para 8 cores × 2 temas × 6 fundos: menor contraste estimado do texto do cartão 4,81:1, incluindo sobreposição máxima das camadas e fundo do selo. Não equivale a auditoria visual completa de acessibilidade |
| Transparência       | Avisos no cadastro, avatar, preferências e página pública explicam que o administrador tem acesso técnico; nenhuma promessa de criptografia de ponta a ponta                                                                          |

## Regressões da 2.3.0 mantidas

| Área                 | Verificação                                                                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compra e orçamento   | Compra à vista, reserva preservada, taxas iniciais, custo mensal, gastos substituídos, margem, prazo para juntar limitado à sobra atual, valores inválidos e renda insuficiente                                                                      |
| Financiamento        | Casos de Price e SAC com resultados conhecidos; juros zero; 24 combinações de sistema/taxa/prazo para garantir que a maior parcela respeita o teto calculado até o centavo                                                                           |
| Sugestões do app     | Receitas/despesas do mês, recorrências e parcelas; VA/VR excluído; dinheiro de metas não fica disponível para a compra; prevenção de duplicação por ocorrência vinculada                                                                             |
| Fluxo da compra      | Formulário monetário BR; escolha de bem genérico; simular e criar meta com nome/valor/prazo, sem aporte automático; consulta atrasada não substitui juros digitados                                                                                  |
| Referências BCB      | Conversão efetiva anual/mensal, unidade/fonte/período; requisição fixa sem dados pessoais; cache de dados públicos no servidor e resposta privada ao usuário; autenticação, allowlist, erro e preenchimento manual                                   |
| Metas                | Várias condições com lógica E, conclusão explícita e valor mínimo reservado; sugestão zero enquanto aguarda; liberação após condições reais e nova espera se a reserva cair; metas concluídas fora de novos aportes                                  |
| Integridade de grafo | Ciclos diretos/indiretos, autorreferência, relações entre usuários, JSON/valores inválidos e redução de alvo incompatível recusados; UUID normalizado para a proteção de exclusão                                                                    |
| Migração e exclusão  | Saldos preservados; tutorial e progresso por usuário (a primeira exibição foi revisada na 2.3.1); progresso isolado por dono; exclusão completa com grafo mantém outra conta intacta; configuração antiga acompanha exclusão de conta sem movimentos |
| Compatibilidade      | Edição de meta por cliente antigo preserva as novas condições/conclusão; configurações antigas de investimento não bloqueiam uma conta sem outros vínculos                                                                                           |
| Tutorial             | Conta nova percorre contas → recorrências → contratos → lançamentos; adiar e retomar a mesma etapa; conclusão e reinício nas Preferências                                                                                                            |
| Cadastro             | Dois códigos de erro de e-mail existente retornam mensagem clara/409; interface oferece Entrar com e-mail mantido e senha limpa                                                                                                                      |
| Regressões           | Autenticação/origem, saldo e centavos, RLS, recorrências, pagamentos adiantados, empréstimos, preferências, calendário/teclado, CSV, cache PWA e sincronização silenciosa                                                                            |

Na validação anterior da 2.3.0, a conectividade externa foi conferida sem credenciais: a série imobiliária 20772 respondeu HTTP 200 com uma observação; a tentativa à série de veículos 25471 falhou na conexão neste ambiente. Os testes das duas séries usam respostas controladas, incluindo falhas. A interface permite taxa manual; disponibilidade externa não é garantida.

## Limites e publicação

Não houve publicação na Vercel, execução de SQL no Supabase remoto ou alteração de usuários/configurações reais de Auth. O roteiro está em [FASE-2.3.1.md](FASE-2.3.1.md).

Os testes de interface usam React/jsdom e inspeção de componentes/CSS. **A conferência visual em navegador real, notebook a 100%, iPhone XR e Android ainda precisa ser feita após publicar.** Sem navegador disponível neste ambiente, não foram simulados testes visuais nem clique em coordenadas reais da landing. A contagem de comandos de uso é uma inspeção dos fluxos, não uma pesquisa com participantes.

O PostgreSQL local é PGlite. Valida regras, triggers, RLS e transações com papéis distintos; não representa conexões concorrentes independentes no Supabase remoto. Não houve teste de carga ou invasão contra a aplicação publicada.

A análise de criptografia está em [USABILIDADE-E-PRIVACIDADE.md](USABILIDADE-E-PRIVACIDADE.md), como proposta para uma etapa própria. A versão atual não torna o banco ilegível ao administrador. Não foi realizada auditoria independente nem declarada conformidade ISO.

SMTP, confirmação/recuperação por e-mail, Turnstile e backups automáticos continuam nas fases futuras já combinadas. Nenhuma fonte de anúncios ou API de FIPE foi integrada. As APIs financeiras não foram consultadas de novo: a atualização não muda essas integrações.
