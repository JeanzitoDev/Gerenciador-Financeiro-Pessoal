# Atualização 2.3.1 · Meu Norte

Esta atualização simplifica a navegação, corrige a primeira exibição do tutorial para usuários existentes e torna o Planejamento uma ferramenta para decidir e revisar aportes. Também adiciona transparência sobre o acesso administrativo aos dados. A análise de criptografia com chave exclusiva do usuário está em [USABILIDADE-E-PRIVACIDADE.md](USABILIDADE-E-PRIVACIDADE.md); **essa criptografia ainda não está implementada**.

## Atualizar quem já está na 2.3.0

1. No SQL Editor do Supabase, aplique **somente `supabase/migrations/202610220005_phase231.sql`**. Ele adiciona o registro de conclusão real do tutorial e permite exibi-lo para usuários antigos. Não execute a migration inicial de novo.
2. Copie o conteúdo de `meu-norte-v2.3.1/` do ZIP para a raiz do seu projeto, mantendo o Git e suas variáveis de ambiente.
3. Execute `npm ci` e `npm run check`.
4. Faça commit e push para a branch conectada à Vercel. Aguarde o deploy de produção ficar pronto e atualize o navegador.
5. Confira **v2.3.1** nos créditos do menu lateral; no celular, abra **Mais**. O rodapé repetido dentro da página foi retirado.

Não é necessária uma variável de ambiente nova, serviço pago ou configuração de SMTP. As configurações de autenticação e os agendamentos atuais continuam em uso.

Se ainda está na **2.2.0/2.2.1**, execute antes `202610220004_phase23.sql` (veja [FASE-2.3.md](FASE-2.3.md)) e depois o arquivo `202610220005_phase231.sql`. Em projeto novo, execute todos os arquivos de `supabase/migrations/` em ordem. Versões anteriores precisam seguir também as atualizações intermediárias.

## Conferir a atualização

- Entre numa conta existente: o guia deve aparecer. Avance, adie, retome em **avatar → Perfil e preferências → Primeiros passos**, conclua e recarregue. Depois de concluir ele não deve reaparecer sozinho.
- Na visão geral, confira a saudação única, **Ver fluxo** e **Ver categorias**. Os botões devem abrir os Relatórios na seção certa.
- No avatar, abra Preferências. Esse item não deve aparecer de novo no menu lateral nem em Mais.
- Experimente as oito cores e os seis fundos. O cartão de dinheiro livre deve acompanhar as escolhas e manter os textos legíveis, no tema claro e no escuro.
- No Planejamento, informe quanto pretende separar, reveja as condições das metas e use **Revisar e reservar**. Confira a meta, a conta e o valor antes de salvar. Cancelar não muda o orçamento. Salvar reduz o valor ainda disponível neste plano e aumenta a reserva da meta. Usar saldo livre apenas preenche o orçamento: não reserva dinheiro sozinho.
- No simulador, calcule uma compra válida. A página deve levar ao resultado com foco para quem usa teclado; o botão **Transformar em meta** deve ficar afastado do texto. Ao solicitar movimento reduzido no sistema, a rolagem deve ser imediata.
- Na landing, clique no texto, no ícone e nos espaços internos de **Meu espaço**. Toda a área deve abrir a tela de entrar.
- Abra `/privacidade` sem login e confira o aviso antes de criar uma conta. O texto explica o acesso administrativo existente, sem prometer criptografia que ainda não existe.

## Por que o tutorial pode reaparecer uma vez

A 2.3.0 marcava como concluído quem já tinha conta financeira. Não registrava quando a pessoa realmente concluía. Não é possível distinguir esses casos antigos. A migration reabre uma vez o guia para perfis antes marcados como concluídos sem evidência de conclusão, preservando as etapas em andamento e a opção de adiar. A partir da 2.3.1, concluir grava `onboarding_completed_at` no próprio perfil, com horário gerado pelo servidor.

## Planejamento e saldo

A sugestão respeita prazo, prioridade, limite mensal e condições entre metas. Só metas liberadas recebem indicação de aporte. O detalhamento continua em **Ver as contas do plano**.

O orçamento informado é um valor para distribuir neste plano, não uma promessa de dinheiro futuro. “Dinheiro livre hoje” não desconta todas as contas que ainda vencerão; revise o mês antes de guardar. Reservar não transfere dinheiro entre bancos. O saldo e o valor reservado continuam sendo validados no banco.

Se uma sugestão exceder o saldo livre da conta com mais recursos, o formulário começa pelo valor disponível nessa conta. É possível rever a conta e completar com outros aportes. A redução do orçamento nesta tela vale para aportes iniciados pelo Planejamento; não é um histórico mensal persistente de orçamentos.

## Privacidade e facilidade de uso

Veja [a análise técnica](USABILIDADE-E-PRIVACIDADE.md) para os caminhos de uso, avaliação dos pontos de atrito, proposta de teste com pessoas e desenho de criptografia no navegador. RLS separa os usuários, mas o administrador ainda pode consultar as tabelas. A página pública explica esse limite e oferece a demonstração para quem prefere conhecer o app sem dados reais.

Esta entrega foi preparada localmente. Nenhum dado remoto foi alterado, nenhuma migration foi executada no seu Supabase e nenhum deploy foi realizado em sua conta.
