# Atualização 2.2 · Meu Norte 2.2.1

Esta versão inclui as correções da 2.1.1 e os ajustes de interface, tipografia, tema, máscaras de dinheiro e pagamentos adiantados da fase 2.2.

## Correção 2.2.1: atualização silenciosa

O aviso “Atualizando…” aparecia a cada minuto e ao voltar para a janela porque toda sincronização ativava o indicador. Agora esses dois gatilhos carregam os dados em segundo plano, mantendo a tela disponível. O carregamento inicial e as ações iniciadas pela pessoa continuam com seus retornos; falhas continuam visíveis com a opção de tentar novamente.

Se você já publicou a v2.2.0, copie o código atualizado e faça commit/push para a Vercel. Confira **v2.2.1** no rodapé após o deploy. **Não há migração SQL adicional** e as variáveis de ambiente são as mesmas.

## Atualizar

1. Se o banco já está na fase 2, execute no SQL Editor apenas **`supabase/migrations/202610190003_phase22.sql`**. O arquivo define `dark` como padrão para os novos perfis. Não apaga dados nem modifica a escolha de tema dos usuários existentes. Não execute novamente a migração inicial. Para um projeto ainda na v1, siga primeiro [FASE-2.md](FASE-2.md).
2. Copie o conteúdo de `meu-norte-v2.2` do ZIP para o projeto, preservando `.env.local` e a pasta `.git`. O ZIP contém o código completo.
3. Execute `npm ci` e `npm run build`. Faça commit/push e publique pelo seu fluxo habitual da Vercel.
4. Atualize a aba e confira **v2.2.1** no rodapé/menu. As variáveis de ambiente continuam as mesmas.

## Interface e tipografia

- Cor, fundo, filtros, prioridades, tipos de registro, contas, parcelas e escolhas de mês/ano usam o mesmo seletor arredondado. As cores aparecem com amostras dentro da lista. Navegação por teclado e Esc continuam disponíveis.
- O fundo claro fixo do ícone de benefício foi substituído por cores que acompanham o tema. O benefício mantém seu tom dourado para diferenciá-lo das outras contas.
- O caminho “Meu espaço > página” foi removido. No computador, a faixa superior fica transparente e mais compacta; os controles de privacidade e perfil continuam disponíveis.
- A família **Geist** substitui a fonte serifada dos títulos e padroniza a interface. A família foi conferida no CSS público da referência `https://lp.pierre.finance/`. O arquivo é servido pelo próprio app em `public/fonts/geist-variable.ttf`, com licença SIL OFL em `public/fonts/OFL.txt`. O navegador não precisa buscar a fonte no Google ou em outro serviço externo.
- Clicar novamente em uma seção ou no logo sobe a página suavemente. A configuração de redução de movimento do sistema continua sendo respeitada.

## Tema e bússola

Landing page, entrada, páginas iniciais sem preferências carregadas, demonstração e tela offline começam no modo escuro. Novos perfis no Supabase também passam a começar em escuro após a migração. Quem já salvou Claro ou Sistema continua com sua escolha; pode selecionar Escuro e salvar nas Preferências.

A bússola continua usando a cor escolhida nas Preferências. Ao passar o mouse, a agulha oscila e se alinha ao norte representado no topo da tela. É uma animação visual: não mede o norte físico do aparelho. Não usa API externa, geolocalização ou sensores e não solicita permissões. A mesma interação está nos logos do site e do app. Com redução de movimento ativada no sistema, a agulha fica estática.

## Dinheiro em x.xxx,xx

Um componente único cuida dos campos monetários: saldos iniciais, receitas/despesas, bruto e descontos, metas, aportes, planejamento, simulador, contratos, parcelas, amortização e ajustes de recorrências.

Durante a digitação, o componente coloca os pontos de milhar e permite editar os centavos. Ao sair do campo, completa duas casas: `12345,6` vira `12.345,60`. Os números antes da vírgula representam reais. Valores negativos continuam sujeitos às regras do registro; taxas em porcentagem e quantidades de parcelas/meses mantêm seus próprios formatos. Valores acima do limite não são reduzidos silenciosamente pela máscara; a validação pede correção.

## Pagar ou receber antes da data prevista

- Ao editar uma despesa recorrente, selecione **Já paguei**. A data sugerida passa a ser hoje; confira a data real do pagamento e salve.
- O vencimento da ocorrência é preservado em `occurrence_date`. O movimento usa `date` para a data em que o dinheiro entrou ou saiu. Se o pagamento aconteceu antes do vencimento, a lista mostra **Pago adiantado** e o vencimento original. Recebimentos antecipados mostram **Recebido adiantado**.
- O saldo, o fluxo e os relatórios usam a data real do movimento. O CSV também leva a situação em português, incluindo pagamentos antecipados.
- A lista passa para o mês do pagamento e sai do filtro de pendentes para que seja possível ver o lançamento confirmado. A regra mensal continua ativa para os próximos meses.
- A confirmação não cria outro lançamento. Sincronizar novamente mantém a mesma ocorrência confirmada. O estado interno continua sendo `posted`; “adiantado” é uma classificação pela comparação das duas datas.
- Em **Para confirmar**, clicar em Recebi/Paguei usa hoje. Use Ajustar se o dinheiro entrou ou saiu em outro dia. A data real não pode ser futura nessa confirmação. A API também aceita confirmar uma ocorrência futura quando o pagamento/recebimento aconteceu até hoje.
- Receitas recorrentes ainda pendentes podem ser editadas sem virarem recebidas automaticamente. O campo Situação só é mostrado nesse contexto recorrente; uma receita manual nova continua representando o que já foi recebido.
- Se a sincronização dos agendamentos falhar, o carregamento dos dados financeiros ainda é tentado. Uma edição aceita pelo servidor é mantida na tela enquanto os dados são atualizados.

## Conferência no seu navegador

1. Preferências: abrir cor e fundo, selecionar, salvar, criar/editar um lançamento e recarregar. Conferir a cor da bússola e o fundo escuro do benefício.
2. Calendários: escolher mês/ano e dia nos campos à esquerda e à direita do modal. Testar Tab, setas e Esc, inclusive com listas abertas dentro do calendário.
3. Simulador: informar `1234567,8` e um aporte, sair do campo, conferir `1.234.567,80` e executar o cálculo. Repetir nos saldos iniciais, planejamento e pagamentos de parcelas.
4. Criar uma recorrência com vencimento futuro, marcar como Já paguei e salvar. Conferir Pago adiantado, saldo, vencimento original, mês exibido e ausência de duplicação ao atualizar.
5. Clicar novamente em Minhas contas estando no fim da página e conferir a subida suave. Testar o hover da bússola e a preferência de redução de movimento.
6. Conferir landing page em janela anônima, notebook a 100%, iPhone XR e Android. Validar legibilidade, listas, teclado virtual e atualização do PWA.

Os testes locais não publicam na Vercel nem aplicam a migração no Supabase remoto. A inspeção visual em navegador real continua necessária. Nenhum serviço pago foi adicionado.
