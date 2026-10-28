# Atualização 2.3 · Meu Norte 2.3.0

> Há uma atualização posterior: [2.3.1](FASE-2.3.1.md), com correção do tutorial para contas existentes. Este documento descreve a entrega 2.3.0.

A fase 2.3 concentra o app no dia a dia, nas metas e nas decisões de compra. Inclui a correção de atualização silenciosa da v2.2.1.

## Atualizar o projeto já publicado

1. Se está na **v2.2.0 ou v2.2.1**, execute **somente `supabase/migrations/202610220004_phase23.sql`** no SQL Editor do seu projeto Supabase, antes de publicar o código novo. A migração é transacional e deve ser aplicada uma vez. Não execute novamente a inicial.
2. Se ainda está na fase 2.0/2.1, aplique antes `202610190003_phase22.sql`, que define o tema padrão para novos perfis. Se vem da fase 1, siga primeiro [FASE-2.md](FASE-2.md). Projetos novos aplicam todos os arquivos de `supabase/migrations/` em ordem.
3. Copie o conteúdo da pasta **`meu-norte-v2.3`** do ZIP para a raiz do seu projeto. Preserve `.env.local` e `.git`.
4. Execute `npm ci` e `npm run check`. Faça commit/push para a branch de produção conectada à Vercel e aguarde o deploy ficar Ready/Production.
5. Atualize o navegador e confira **v2.3.0** no rodapé. As variáveis de ambiente e o agendamento de recorrências continuam os mesmos. Novas contas seguem usando Confirm Email desativado e senha mínima de oito caracteres.

A migração adiciona condições/conclusão às metas e progresso do tutorial aos perfis. Preserva saldos, lançamentos, aportes e escolhas de aparência. Atualiza a exclusão completa da conta para também limpar as relações entre metas.

## Cabe no meu bolso?

Substitui o simulador de investimentos. Abrange celulares, eletrônicos, móveis, eletrodomésticos, veículos, imóveis, viagens e qualquer outra compra/projeto com nome livre.

- **Esta compra cabe no meu bolso?**: informe o preço desejado.
- **Até quanto posso gastar?**: calcula um teto a partir do dinheiro disponível e do orçamento mensal.
- **À vista / juntar antes de comprar**: mostra quanto falta e um prazo sem supor rentabilidade do dinheiro.
- **Parcelado ou financiado**: usa quantidade de parcelas e juros mensais informados. Oferece parcelas iguais (Price) e decrescentes (SAC). O teste de orçamento usa a maior parcela, arredondada para cima em centavos.

O formulário considera renda líquida, gastos mensais atuais incluindo parcelas, dinheiro disponível, parte que deseja preservar, custos iniciais extras, custos mensais de uso, gastos que deixarão de existir e uma folga mensal escolhida pela pessoa. Todos os campos de dinheiro usam `x.xxx,xx`.

O resultado mostra preço/teto, entrada, financiamento, parcelas, juros, total da compra, sobra mensal e quanto falta juntar. O total da compra soma entrada, parcelas e custos iniciais; despesas mensais de uso são descontadas da sobra e continuam existindo pelo tempo de uso. O prazo para juntar é limitado à sobra do orçamento atual, sem antecipar economias que só existirão depois da compra.

**Usar valores do meu app** traz sugestões editáveis do mês atual. Inclui movimentos previstos, recorrências ativas e parcelas conhecidas. Respeita ocorrências puladas e pagamentos adiantados, sem duplicar a ocorrência nem a parcela vinculada. VA/VR e dinheiro já reservado para metas ficam fora do dinheiro disponível. A pessoa deve conferir gastos e renda ainda não cadastrados.

**Transformar em meta** abre o cadastro para revisar nome, valor, data e condições. Uma simulação não cria aporte nem movimenta saldo. Para financiamento, a meta sugerida é o dinheiro inicial necessário para a entrada compatível com o orçamento e os custos iniciais; a reserva preservada permanece à parte. Se o prazo não puder ser calculado ou ultrapassar 50 anos, a data deve ser escolhida no cadastro.

## Referências gratuitas, pelo servidor

As consultas do navegador vão somente para `/api/indicators/credit?kind=vehicle|home`, com sessão autenticada. O servidor consulta o Banco Central com URL fixa e duas séries permitidas:

| Compra  | Série BCB                                              | Unidade original  |
| ------- | ------------------------------------------------------ | ----------------- |
| Veículo | 25471 · Aquisição de veículos, pessoas físicas         | Percentual ao mês |
| Imóvel  | 20772 · Financiamento imobiliário com taxas de mercado | Percentual ao ano |

A taxa anual imobiliária é convertida para a taxa mensal equivalente por `(1 + taxa_anual)^(1/12) - 1`. A interface mostra fonte, período de referência e taxa mensal, e permite substituir pela proposta recebida.

A consulta é acionada por botão. O provedor recebe somente uma consulta pública à série: nenhum salário, gasto, nome, e-mail, cookie de sessão ou token. A resposta pública do BCB pode ser reaproveitada no cache do servidor por seis horas; as respostas ao usuário usam `private, no-store`. A rota exige autenticação, bloqueia URLs/séries arbitrárias e redirecionamentos, valida o formato e limita o tempo de espera. Falha externa permite informar a taxa manualmente. Editar a taxa ou trocar a categoria cancela uma consulta em andamento.

As fontes são [BCB veículos](https://dadosabertos.bcb.gov.br/dataset/25471-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---a) e [BCB imóveis](https://dadosabertos.bcb.gov.br/dataset/20772-taxa-media-de-juros-das-operacoes-de-credito-com-recursos-direcionados---pessoas-fisicas---fi). Nenhum serviço pago, chave de API, pacote adicional ou IA por consulta foi adicionado. O consumo de hospedagem segue o plano da sua conta.

Preços e custos pessoais são informados pela pessoa. Esta versão não consulta anúncios de imóveis ou modelos da FIPE. A referência do BCB é média de mercado, não uma proposta individual. CET não é substituído pela taxa nominal de juros. Seguros, tarifas e correções por índices precisam ser considerados ao comparar com uma proposta real; a simulação não aprova crédito.

## Dependências entre metas

Ao criar/editar uma meta, em **O que vem antes desta meta?**, adicione até 20 condições:

- **A meta ser concluída**: aguarda a pessoa marcar a meta anterior como concluída, no cadastro dela. Atingir o valor sozinho não declara que uma mudança ou compra aconteceu.
- **Ter um valor reservado**: exige um montante de aportes na meta escolhida, por exemplo R$ 10 mil na reserva. O valor não pode superar o alvo dessa meta.

Todas as condições precisam estar atendidas. Exemplo: o iPhone depende da conclusão da mudança **e** de R$ 10 mil reservados para emergências.

Os cartões e o Planejamento explicam o que falta. Enquanto aguarda, a sugestão de aporte é zero; o orçamento vai para metas disponíveis. As condições usam conclusões e reservas reais, sem liberar uma meta com base em aportes apenas sugeridos. Ao cumprir as condições, ela volta a participar do planejamento automaticamente. Se a reserva cair abaixo do mínimo, a condição volta a aguardar. Metas concluídas não recebem sugestões de novos aportes.

Aportes manuais continuam sendo uma escolha explícita: o botão **Reservar mesmo assim** e o formulário mostram a espera. Concluir uma meta preserva o dinheiro reservado; a pessoa administra os aportes e os movimentos reais separadamente.

O banco impede autorreferência, ciclos, condições inválidas e relações entre usuários, inclusive por chamadas diretas ao Supabase. Não é possível excluir uma meta usada como condição; primeiro edite as metas dependentes. Um cliente antigo que editar nome/data sem enviar os novos campos preserva as condições e a conclusão existentes.

## Tutorial e cadastro

No primeiro acesso de uma conta sem contas financeiras, o guia orienta:

1. Cadastrar contas com saldo e data.
2. Adicionar receitas/despesas recorrentes.
3. Incluir contratos e parcelas já pagas, se houver.
4. Conhecer Lançamentos e Para confirmar; depois Metas e o simulador de compra.

O progresso é salvo no perfil, por usuário. Pode adiar e retomar a etapa em **Preferências → Primeiros passos**. Depois de concluir, o mesmo botão reinicia o guia. Usuários existentes com contas financeiras recebem o guia como concluído e podem abri-lo quando quiserem.

Cadastro com e-mail já existente mostra **Já existe uma conta com esse e-mail. Entre para continuar.** e oferece **Ir para entrar**, mantendo o e-mail e limpando a senha. Usa o erro do Supabase Auth no cenário atual de confirmação de e-mail desativada; não adiciona uma consulta pública de lista de usuários.

## Saída do módulo de investimentos

A página de Investimentos e a antiga projeção de juros compostos saem do menu e da landing page. Contas do tipo anterior aparecem como **Dinheiro guardado**. Saldos, transferências, rendimentos já registrados e aportes permanecem íntegros. Ainda é possível registrar rendimentos recebidos nas contas guardadas.

As configurações antigas de projeção ficam no banco por compatibilidade. Ao excluir uma conta sem outros vínculos, sua configuração antiga é removida junto; a tela não exige visitar um módulo que foi retirado.

## Conferir depois do deploy

- Crie uma conta de teste nova e percorra/adie/retome o tutorial. Confira saldo inicial e a confirmação das recorrências.
- Tente cadastrar o mesmo e-mail novamente e use o botão para entrar.
- Simule uma compra simples à vista, uma sem juros, um veículo e um imóvel (Price/SAC). Edite custos, teste o cálculo inverso e transforme um resultado em meta.
- Consulte o BCB e confira fonte/período. Se indisponível, insira juros manualmente.
- Crie as três metas do exemplo, acrescente as duas condições ao iPhone e confira a sugestão zero. Conclua a mudança e reserve o mínimo para liberar. Remova um aporte da reserva para conferir que a condição volta a aguardar.
- Confira em notebook a 100%, iPhone XR e Android: listas, máscaras, formulários, contraste, rolagem e teclado. Mantenha o modo escuro e confira que a atualização automática continua silenciosa.

As alterações foram preparadas localmente; publicar na Vercel e executar o SQL no seu Supabase são etapas do seu fluxo de atualização.
