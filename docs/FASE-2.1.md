# Atualização 2.1 · Meu Norte 2.1.1

Esta revisão corrige os problemas relatados nos calendários, menu lateral, leitura das metas e troca inesperada do tema após salvar um lançamento. A base é a versão 2.0.0 (`7e4a8ad`).

## Instalação

1. Copie o conteúdo da pasta `meu-norte-v2.1` do ZIP para o projeto, preservando `.env.local` e a pasta `.git` existente. O ZIP contém o código completo; não precisa aplicar um patch.
2. Execute `npm ci` e `npm run build`. Faça o commit/push pelo seu fluxo habitual para publicar na Vercel.
3. Atualize a aba do navegador após o deploy. O rodapé e o menu devem mostrar **v2.1.1**.

**Esta revisão não tem migração SQL nova.** Se a migração da fase 2 já foi aplicada com sucesso, não execute novamente os arquivos SQL. Se ainda estiver na v1, conclua primeiro o [roteiro da fase 2](FASE-2.md). As variáveis de ambiente continuam as mesmas.

## Correções

- O nome do mês tem largura própria, sem letras sobrepostas ou recortadas. As regras de tamanho dos botões de navegação não atingem os botões internos do calendário.
- O calendário dos formulários mantém até 320 px de largura, inclusive em campos de meia coluna, e se posiciona dentro das bordas do modal/tela. Considera o cabeçalho e rodapé fixos, abre acima quando há mais espaço e se adapta a rolagem, redimensionamento e conteúdo. Continua dentro do diálogo para preservar o foco do modal.
- Setas e escolhas de mês/ano têm tamanhos separados. Dias, meses e ações ficaram mais legíveis; controles continuam acessíveis pelo teclado e Esc devolve o foco ao botão de abertura.
- O logo fica mais alto no menu. Altura dos itens e espaçamento se adaptam à altura útil da janela, visando mostrar todas as seções no notebook a 100%. A rolagem permanece como alternativa para janelas muito baixas ou zoom elevado, preservando acesso a todas as seções.
- Progresso e valor restante das metas passam a 14 px. Nome, prazo, valor acumulado, valor de destino e botão também foram ampliados. Os textos quebram de linha quando necessário.
- Atualizar os dados financeiros preserva a aparência em edição, incluindo tema, cor e fundo. Isso cobre salvar, editar, excluir e a atualização ao voltar à janela. O rascunho é separado por usuário e não substitui dados do perfil de outra conta.
- **Salvar preferências** grava a aparência para os próximos acessos. A escolha sem salvar permanece como prévia nesta sessão; recarregar a página ainda usa o perfil salvo no Supabase. Uma falha ao salvar preserva o rascunho para tentar novamente.

## Logo

A v2.1.1 incorpora a escolha aprovada: bússola simples com quatro marcas de direção e agulha em losango de dois tons apontando para o norte. O símbolo representa se localizar e encontrar um rumo para o dinheiro. A paleta roxa e a palavra **meu norte** foram preservadas. O símbolo foi atualizado no app, na tela de entrada, na página inicial e nos ícones de instalação. O cache de arquivos públicos ganhou uma versão nova para buscar os ícones atualizados; o cache continua restrito aos mesmos ativos públicos.

## Verificação

Regressões React incluem tema durante CRUD em demonstração, tema durante criação e atualização por foco com API simulada, salvar preferências, escolha de mês/ano e retorno do foco. Um cenário com geometria controlada verifica o encaixe do calendário na coluna direita de um modal.

A revisão visual no navegador real permanece pendente. Após publicar, conferir especialmente:

1. Notebook a 100%, com o Chrome maximizado: todas as seções do menu visíveis, mês completo, textos de metas legíveis.
2. Calendário no campo à esquerda e à direita do modal, incluindo os últimos campos: mês/ano, seleção de dia, Hoje, Fechar, Esc e rolagem do diálogo.
3. Modo escuro: escolher, criar/editar/excluir um lançamento e voltar à aba; depois salvar as preferências e recarregar.
4. iPhone XR e Android: mês acessível, calendário dentro da tela, textos sem cortes e formulário utilizável com teclado virtual.

Os testes locais e o build não publicam na Vercel nem alteram o Supabase remoto.
