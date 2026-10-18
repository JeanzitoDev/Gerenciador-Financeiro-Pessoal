# Evidências de validação — 18/10/2026

## Resultado automatizado final

`npm run check` concluiu: **57 testes em 7 arquivos**, geração de tipos, TypeScript estrito e build Next.js de produção aprovados. `npm audit --omit=dev --audit-level=high`: **0 vulnerabilidades conhecidas nas dependências de produção** no momento da execução. Não é uma auditoria de segurança independente.

| Camada               | Testes | Evidência                                                                                                                                                                                                                                                                                                          |
| -------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domínio financeiro   |     20 | Parser BR, valores inválidos, somas, limite seguro, formatação exata de centavos grandes, datas/bissexto, recorrências ancoradas, caixa/benefícios, metas/tetos, juros equivalentes, inflação, Modified Dietz e CSV seguro                                                                                         |
| PostgreSQL           |     13 | Migração executada em PGlite; papéis authenticated/anon; duas identidades; leitura/alteração isoladas; dono falsificado bloqueado; FKs cruzadas; dupla reserva; limites por meta/conta; transferência; benefícios; datas; líquido; perda/saldo inicial; recorrências idempotentes e exclusão preservando histórico |
| Estado demonstrativo |      4 | Seeds fictícios consistentes; CRUD de receita recalcula saldo; vínculos/saldo reservado protegidos; ocorrência cancelada não é recriada                                                                                                                                                                            |
| Contratos Zod        |      4 | Campo user_id descartado; centavos fracionários e transferência para mesma conta rejeitados; salário e taxas validados; entidades futuras não expostas                                                                                                                                                             |
| APIs HTTP            |      8 | Origem externa rejeitada; sessão ausente bloqueada; user_id atribuído pela identidade; erro sanitizado; paginação acima de 500; payload/ID inválido; JSON nulo/array; RPC autenticada                                                                                                                              |
| React / jsdom        |      5 | Criar/editar/excluir receita; aporte sem saldo mantém erro no formulário; tema/cor e simulador; navegação de todos os módulos; Auth indisponível sem projeto configurado                                                                                                                                           |
| PWA                  |      3 | Manifest e dimensões de ícones; SW não intercepta APIs/Auth/Supabase/RSC/escritas; navegação offline usa só tela pública sem armazenar resposta financeira                                                                                                                                                         |

Testes completos: `tests/`. Verificações específicas foram executadas primeiro no domínio e depois no banco antes de construir os fluxos da interface. As suítes ampliadas foram repetidas após correções observadas de contrato, comparação de texto e precisão de formatação.

## Build

- Node.js 24.19.0; npm 11.9.0.
- Next.js 16.4.2, TypeScript 5.9.3; demais versões resolvidas no package-lock.json.
- `next typegen` aprovado; `tsc --noEmit` aprovado.
- `next build` aprovado: páginas públicas/manifest estáticos e páginas privadas/APIs dinâmicas.
- Sem dependência de credenciais remotas para compilar.
- Scripts auxiliares validados sintaticamente; o smoke remoto não foi executado sem as duas contas de teste.

## Status por gate

| Gate                                                    | Situação                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| Especificação antes do código                           | Concluído; referência parcial e protótipo ausente documentados        |
| Domínio e precisão monetária                            | Aprovado localmente                                                   |
| Schema, RLS e integridade                               | Aprovado em PostgreSQL embutido                                       |
| CRUDs, relatórios, planejamento e simulação             | Implementados; contratos e fluxos React aprovados                     |
| Build Next.js e estrutura PWA                           | Aprovados localmente                                                  |
| Autenticação remota, confirmação/recuperação de e-mail  | Pendente no projeto Supabase de destino                               |
| Migração/CRUD/RLS na instância remota                   | Pendente; smoke fornecido                                             |
| Concorrência com duas conexões PostgreSQL independentes | Pendente; lock transacional implementado e roteiro fornecido          |
| QA visual responsivo e acessibilidade em navegador real | Pendente: sem ferramenta de navegador compatível disponível na sessão |
| HTTPS, instalação iOS/Android e offline instalado       | Pendente de publicação/homologação no dispositivo                     |
| Implantação Vercel                                      | Não executada; conta/projeto externo não configurado nesta sessão     |

**Os testes locais não equivalem a uma validação de produção.** A implementação pode ser executada e revisada; a liberação para dados pessoais depende dos gates externos acima. Não foi inventado resultado de autenticação, implantação ou instalação.

## Limites conhecidos

- Online para finanças; offline oferece somente aviso genérico.
- BRL e lançamentos manuais; sem conexão bancária, parser de extratos, categorização automática, cotação ou imposto automático.
- IPCA histórico não integrado: retorno real usa inflação anual assumida pelo usuário, explicitamente identificada.
- Projeções com aporte no fim do mês; não alteram saldo ou reservas reais.
- Métodos de priorização por data/prazo equivalem na mesma data-base, comportamento explicado na UI.
- Relatórios carregam o histórico pessoal com paginação de 500, processando-o em memória. Para alto volume de importações futuras será preciso agregar no banco.
- CSP permite inline para compatibilidade com Next.js; nonce por resposta fica como melhoria futura.
- Contexto anterior recuperado parcialmente; sem reprodução afirmada do protótipo não localizado.
