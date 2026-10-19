# Atualizar para Meu Norte 2.0.0

Base: commit `ed8a9b52ad1537a8e1eab145ce0cd41260ab2f37` de `JeanzitoDev/Gerenciador-Financeiro-Pessoal`. Código e alterações incrementais; nenhuma publicação ou alteração do Supabase foi feita por este pacote.

## Ordem de atualização

1. Preserve seu `.env.local`. O pacote não contém suas credenciais. Faça uma exportação manual dos dados que deseja conservar antes de qualquer migração.
2. No SQL Editor do **mesmo projeto Supabase**, execute integralmente **`supabase/migrations/202610180002_phase2.sql`** uma única vez. A transação adiciona campos, contratos, funções, políticas e gatilhos, preservando os dados anteriores. Não execute `202610180001_initial.sql` novamente. Se ocorrer erro, a transação reverte; investigue a mensagem antes de repetir. Com Supabase CLI vinculado e histórico inicial já registrado, use `supabase db push` como alternativa ao SQL Editor.
3. Configure o Auth: novos cadastros habilitados, **Confirm Email desligado**, mínimo de **8 caracteres**. Cadastros já confirmados continuam funcionando; teste separadamente qualquer usuário antigo que estivesse pendente de confirmação.
4. Atualize os arquivos do projeto. O ZIP completo tem uma pasta `meu-norte-v2/`: use seu conteúdo na raiz atual, onde está seu `package.json`. Preserve `.env.local`; não copie `node_modules` ou `.next` antigos entre versões. O patch Git opcional usa caminhos relativos à raiz do repositório e parte do commit indicado acima.
5. Configure o ambiente:

| Variável                               | Local                                    | Vercel                                    |
| -------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL atual do projeto                     | Mesma URL                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública atual                      | Mesma chave pública                       |
| `NEXT_PUBLIC_AUTH_EMAIL_ENABLED`       | `false`                                  | `false`                                   |
| `APP_ORIGIN`                           | `http://localhost:3000`                  | `https://meunorte-financeiro.vercel.app`  |
| `SUPABASE_SECRET_KEY`                  | Privada do projeto, para excluir a conta | Privada do mesmo projeto, apenas servidor |

`APP_ORIGIN` contém somente protocolo e host/porta, sem `/app`. Um domínio de preview diferente precisa de ambiente com origem correspondente; a configuração de produção é estrita. Nenhuma origem arbitrária é aceita por cabeçalhos forwarded.

A chave privada não é necessária para entrar ou usar os CRUDs, mas é necessária para habilitar **Apagar minha conta**. Sem ela, o botão informa que falta configuração. Não substitua a chave pública pela privada. Nunca coloque a chave privada no Git nem em variável `NEXT_PUBLIC_`.

6. Rode `npm ci`, `npm test`, `npm run typecheck`, `npm run build`. Publique o código atualizado na Vercel. Variáveis públicas são incorporadas no build: faça novo deploy depois de configurá-las.
7. Para a automação funcionar também com o app fechado, habilite **pg_cron** em Database → Extensions e execute `supabase/phase2-cron.sql`. O job `meu-norte-recorrencias` roda diariamente às **03:10 UTC / 00:10 São Paulo**. Ele reaproveita a mesma sincronização testada e protege os saldos. Se uma automação não puder concluir, o item continua pendente. Sem o job, o app recupera as ocorrências ao abrir, voltar à janela ou após um minuto visível. Esse job é de recorrências, não de backup.

## O novo fluxo de recorrências

- Criar a regra prepara as datas desde o início informado até um mês à frente. A data de abertura da conta é o limite inferior do histórico; movimentos anteriores a ela não são incluídos.
- As ocorrências de hoje e passadas aparecem em **Lançamentos → Para confirmar**, independentemente do filtro mensal. As futuras ficam agendadas e não alteram o saldo.
- **Recebi/Paguei** confirma com um toque. **Ajustar** altera valor/data na própria lista. **Pular** conserva o marcador de cancelamento, impedindo que a ocorrência reapareça.
- A opção **Registrar automaticamente na data** vem desligada. Ao ativá-la, o marco inicial é hoje; ocorrências anteriores continuam pendentes. Ativar novamente após pausa também reinicia esse marco em hoje.
- Pausar interrompe novas datas e o lançamento automático. Ocorrências já criadas são preservadas. Alterações no valor/frequência da regra valem para datas ainda não criadas; edite individualmente itens já preparados quando necessário.
- A mesma regra/data nunca cria dois lançamentos, inclusive se o agendamento e duas sessões sincronizarem juntos.
- A configuração inicial da regra retroativa é acompanhada de uma explicação no formulário. Nenhum retroativo é automaticamente considerado recebido/pago.

**Exemplo de 06/10:** conta iniciada em 01/10, regra mensal desde 06/10 → o item de 06/10 aparece para confirmar. Conta iniciada em 18/10 → não é correto acrescentar uma receita em 06/10 sem revisar o saldo/data inicial, pois ela pode já estar incluída no saldo informado em 18/10.

## Contratos e amortização

Informe total de parcelas, valor fixo, data da primeira parcela **do contrato inteiro**, quantidade já paga antes do app, instituição e, se disponível, juros mensais, CET anual e valor financiado.

O histórico anterior só avança o contador; não cria despesas antigas. Ao pagar uma nova parcela pelo contrato, é criada uma despesa única em Lançamentos. Não registre o mesmo pagamento manualmente. Repetir o pagamento da mesma parcela retorna o lançamento já existente. Para apagar um contrato com pagamentos, o app aponta para os vínculos em Lançamentos.

A amortização compara redução de prazo e redução da prestação em um modelo de parcelas fixas mensais (Price), imediatamente após o último pagamento, sem atrasos, indexadores, tarifas extras ou seguro variável. O CET é exibido como custo informado; **não substitui a taxa de juros mensal**. Sem taxa, não é exibida uma estimativa falsa. Se as parcelas foram pagas fora de ordem, a estimativa é suspensa até revisar o histórico. Simular não registra amortização real nem altera parcelas/saldos.

## IPCA

O botão do investimento consulta as últimas 12 variações mensais da série SGS 433 do Banco Central e calcula o acumulado por composição, não pela soma. A consulta é feita no servidor, com cache compartilhado, timeout e destino fixo. Período e fonte são mostrados. Isso fornece uma hipótese para projetar; não prevê inflação futura nem substitui a taxa/rendimento informado pelo banco. Se a API não responder, o preenchimento manual permanece disponível. Taxas de CDB em “% do CDI” precisam ser convertidas a uma hipótese anual; o campo não interpreta esse percentual como taxa anual efetiva.

## Homologação após publicar

1. Cadastrar nome/e-mail/senha de oito caracteres sem confirmação; ver tela Entrar e conseguir entrar. Sair e entrar novamente. Testar edição de nome e alteração de senha autenticada. O link de recuperação não promete e-mail nesta fase.
2. Com dois usuários, testar leitura/criação/alteração/exclusão de contas, movimentos e contratos. Tentativas diretas com IDs do outro usuário devem falhar. Não confundir dois perfis do navegador com uma única sessão compartilhada por abas.
3. Cadastrar uma recorrência retroativa numa conta cuja data inicial permita esse histórico; confirmar, pular, atualizar e conferir ausência de duplicação. Pausar/reabrir e validar preservação do histórico. Criar uma automática para hoje, com saldo suficiente e insuficiente.
4. Se o cron foi habilitado, conferir Database → Cron/Jobs e uma execução diária. Validar o resultado após o job rodar com o app fechado; o teste local não executou o job gerenciado remoto.
5. Registrar um contrato com duas parcelas históricas, pagar a terceira e confirmar uma única despesa. Testar saldo restante, taxa ausente, taxa zero, amortização parcial/integral e vínculo na exclusão.
6. Baixar CSV diretamente de Relatórios. Conferir mês, tipos/situações em português, valores BR, data DD/MM/AAAA e abertura no Excel com acentos.
7. Testar modais, calendário e listas por mouse e teclado, fechamento com Esc, foco visível, nomes acessíveis e redução de movimento do sistema. Conferir perfil superior e logo sem sair da sessão.
8. Desktop em **1366×768 a 100%**, 1280×720, 1920×1080 e zoom do navegador em 200%; iPhone XR em **414×896 CSS px**; Android em 360×800 e 412×915; orientação paisagem. O menu lateral tem sua própria rolagem e o mobile usa o menu Mais. Verificar teclado virtual, barra inferior e área segura. Números/fontes devem permanecer legíveis e nenhum controle essencial pode ficar cortado.
9. Preferências: testar oito cores, seis fundos, claro/escuro/sistema, persistência após login, gradiente visível e contraste. Instalar/atualizar PWA e conferir o novo símbolo.
10. Em conta exclusivamente de teste, tentar apagar com senha errada (dados devem permanecer), depois senha correta + APAGAR. Confirmar exclusão de Auth e das tabelas, preservando o segundo usuário.
11. Verificar console do navegador por bloqueios inesperados de CSP, login/cookies por HTTPS e ausência de cache privado. A chave privada nunca deve aparecer em arquivos JS do navegador.

## Decisões adiadas

Turnstile e backups automáticos: fase 3/4. SMTP, confirmação de e-mail e recuperação por e-mail: fase 4/5. Integração bancária e importação de extratos permanecem fora do escopo. Não foi alterado plano pago, domínio ou serviço externo.
