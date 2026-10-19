# Validação · Meu Norte 2.2.0

Base desta revisão: Meu Norte 2.1.1, commit `e347196`.

## Resultado local

- `npm run check`: **136 testes em 12 arquivos aprovados**, geração de tipos, TypeScript e build de produção aprovados.
- Node.js **24.19.0** e Next.js **16.4.2**. Dependências NPM preservadas; nenhuma dependência de serviço pago adicionada.
- Geist variável servida pelo próprio app. Arquivo de fonte validado, eixo de peso 100–900 e caracteres acentuados de pt-BR presentes. Licença SIL OFL incluída.
- `git diff --check` sem erros. Build realizado sem credenciais remotas.

## Cobertura

| Camada                   | Verificação                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dinheiro e domínio       | Centavos/Decimal, formatos BR, reservas, projeções, juros, parcelas e amortização; máscara com milhares, centavos incompletos e preservação de valores acima do limite para validação                              |
| Interface monetária      | Digitação e edição no meio do valor, centavos ao sair do campo, valores iniciais formatados, simulador com milhar e resultado conferido                                                                            |
| Preferências e navegação | Escuro padrão no demo, cor/fundo pelo seletor comum, manutenção da aparência durante CRUD e atualizações, ausência do breadcrumb e rolagem suave com alternativa para redução de movimento                         |
| Calendários e listas     | Escolha de mês/ano/dia com componente comum, teclado e Esc, retorno do foco, geometria controlada do calendário em coluna direita do modal                                                                         |
| Pagamento adiantado      | Criar regra futura, mudar para Já paguei, usar a data real, exibir Pago adiantado, acompanhar mês/filtro e manter uma ocorrência ao navegar novamente                                                              |
| Receita recorrente       | Editar um item pendente conserva sua situação; Já recebi confirma e passa a data para hoje                                                                                                                         |
| HTTP de confirmação      | Recusa data de pagamento futura, permite antecipação com data real até hoje, usa hoje na ausência de data e mantém confirmação idempotente e vinculada ao dono                                                     |
| Atualização dos dados    | Edição aceita permanece confirmada e os dados ainda são lidos quando a sincronização de recorrências retorna erro                                                                                                  |
| PostgreSQL local         | Migrações inicial, fase 2 e fase 2.2; novos perfis escuros sem alterar os existentes; pagamento antecipado debita uma vez e não volta a previsto; RLS, vínculos, saldos, limites, contratos e exclusão preservados |
| CSV                      | Tipo/situação em português, data BR, valores com vírgula e neutralização de fórmulas; classificação de pagamento antecipado                                                                                        |
| Segurança/PWA            | Origem, autenticação, permissões, limite de corpo e orçamento de escrita; CSP com nonce; cache restrito a ativos públicos, agora incluindo a fonte local                                                           |

Os testes anteriores de login, cadastro, isolamento entre usuários, salário bruto/líquido, metas, investimentos, empréstimos/financiamentos, automação e relatórios continuam na suíte completa.

## Limites

Não houve publicação na Vercel, migração no Supabase remoto, criação/exclusão de contas reais ou alteração das configurações de Auth do usuário. A atualização deve seguir [FASE-2.2.md](FASE-2.2.md).

A interface foi validada por tarefas React, leitura de CSS/componentes e build. **Não houve revisão visual em navegador real**, nem medição nos aparelhos citados. O teste de geometria usa medidas controladas e não substitui renderização real de fontes, popovers, foco, toque ou contraste. O roteiro inclui notebook a 100%, iPhone XR e Android.

O banco local dos testes é PGlite. Os testes validam políticas, constraints, transações e RPCs com papéis distintos; não representam duas conexões concorrentes independentes no Supabase remoto. A execução do agendamento gerenciado deve ser conferida após publicar. A fonte local e o PWA devem ser conferidos no navegador instalado.

O IPCA usa respostas controladas nos testes. A disponibilidade do serviço oficial e a configuração real de Auth precisam ser verificadas no deploy. SMTP, confirmação de e-mail, recuperação por e-mail, Turnstile e backups automáticos permanecem nas fases futuras acordadas.
