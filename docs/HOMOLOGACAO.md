# Homologação antes de usar dados pessoais

Este roteiro é o gate final após publicar na Vercel e configurar o Supabase. Os itens abaixo não foram marcados como executados nesta entrega.

## Configuração e Auth

- [ ] Executar a migração em projeto Supabase novo, sem erro, e verificar Security Advisor.
- [ ] Configurar URL/publishable key na Vercel; publicar novo build.
- [ ] Configurar Site URL, redirects e envio de e-mails no Supabase.
- [ ] Cadastrar duas contas de teste A e B, confirmar e-mails e entrar no mesmo navegador do início do fluxo PKCE.
- [ ] Recuperar senha, abrir callback, definir senha com 12+ caracteres e entrar.
- [ ] Verificar logout e acesso bloqueado em /app após encerrar sessão; atualizar página e confirmar proteção.
- [ ] Renovar sessão expirada sem misturar dados entre usuários.

## Segurança e dados reais de teste

- [ ] Executar `scripts/smoke-supabase.mjs` com as duas contas confirmadas.
- [ ] Na API REST Supabase, confirmar anon sem SELECT/INSERT/UPDATE/DELETE em todas as tabelas financeiras.
- [ ] Sob A, tentar referência a conta/meta de B: bloqueado por FK composta, sem exposição dos dados de B.
- [ ] Em dois clientes simultâneos de A, tentar reservar R$80 + R$80 sobre conta de R$100, em metas diferentes de R$200. No máximo uma gravação confirma; conferir saldo e reservas depois.
- [ ] Repetir com saque simultâneo e aporte. Rejeição ou rollback mantém reserva coberta. Se houver deadlock, recarregar antes de repetir.
- [ ] Conferir que respostas de /app e /api/data são privadas/no-store e não são armazenadas no cache do navegador/SW.

## Jornada de valores de teste

1. Conta Banco: saldo inicial R$1.000,00, data 01/10/2026. Conta Investimento: zero, mesma data. Conta VA/VR: R$300,00.
2. Receita líquida Banco R$2.500,00, bruto R$3.000,00/descontos R$500,00. Despesa Banco R$400,00.
3. Transferir R$500,00 de Banco para Investimento. Resultado esperado: Banco R$2.600,00; Investimento R$500,00; patrimônio sem benefício R$3.100,00. Receitas R$2.500,00 e despesas R$400,00. Transferência não entra em receita/despesa.
4. Registrar rendimento observado +R$5,00 e taxa como despesa do investimento R$1,00. Investimento R$504,00. Patrimônio R$3.104,00.
5. Meta de R$1.000,00; reservar R$400,00 da aplicação. Meta 40%, patrimônio R$3.104,00, livre R$2.704,00. Rendimento não aloca automaticamente mais saldo à meta.
6. Tentar segunda reserva que deixe soma de reservas do investimento acima de R$504,00: rejeitar. Tentar resgatar R$200,00 enquanto R$400,00 estão reservados: rejeitar.
7. Gasto VA/VR R$50,00: benefícios R$250,00, sem impacto no patrimônio livre. Transferir VA/VR para Banco: rejeitar.
8. Lançamento previsto R$200,00: saldo não muda. Confirmar realizado: recalcular saldo. Editar valor e excluir: refletir exatamente a diferença.
9. Editar e excluir conta/meta/aporte/investimento. Verificar vínculos RESTRICT e que excluir configuração de investimento mantém conta e movimentos.

## Recorrência, planejamento e simulação

- [ ] Mensal com dia 31: fevereiro usa último dia e março volta a 31. Anual em 29/02 se comporta corretamente.
- [ ] Gerar mesma janela duas vezes; segunda execução cria zero. Excluir ocorrência e gerar novamente: não recria.
- [ ] Pausar regra, gerar: nenhuma nova ocorrência. Editar regra: histórico anterior mantido. Excluir regra: movimentos preservados.
- [ ] Verba de metas menor que necessidade: soma sugerida ≤ verba, tetos obedecidos e déficit explícito. Sem criar aporte real.
- [ ] Simulação R$1.000 inicial, zero aporte, 12% a.a., 12 meses: R$1.120 nominal. Inflação 6% a.a.: R$1.056,60 real, arredondado.
- [ ] Exportar CSV filtrado e abrir em planilha; descrição iniciada por `=` permanece texto.

## Mobile e PWA

- [ ] Revisar telas em 375×812, 390×844, 768px e 1440px; nenhum conteúdo financeiro cortado, tabela com scroll, navegação inferior acessível.
- [ ] Formulários: teclado decimal, labels legíveis, foco, fechamento e rolagem do dialog em iPhone real.
- [ ] Verificar contraste e foco em todos os temas/cores, modo sistema e movimento reduzido.
- [ ] Instalar por Safari no iOS e Chrome no Android. Nome, ícones any/maskable/apple e modo standalone corretos.
- [ ] Em produção online: Application → Service Workers → activated. Cache Storage contém apenas offline.html/ícones públicos.
- [ ] Desligar rede e navegar: tela offline genérica, sem dados financeiros. Reconectar: login/sessão e dados funcionam.
- [ ] Atualizar versão de SW e confirmar substituição do cache público antigo.

## Operação

- [ ] Conferir quotas atuais dos planos gratuitos no painel, limites de Auth/SMTP e política de pausa.
- [ ] Guardar migrações e código no Git; manter segredos e senhas fora dele.
- [ ] Testar recuperação/exportação antes de depender do app como único registro.
