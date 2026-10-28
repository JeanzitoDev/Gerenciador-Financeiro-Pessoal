# Atualização 2.3.2 · Meu Norte

Esta atualização traz melhorias de interface, privacidade para a fase de testes (Beta), simulação de aluguel de imóvel no **Cabe no meu bolso?** e o **Desafio do Cofrinho (cartela de 1 a 500 + cofrinho mensal progressivo)** integrado às Metas.

## Atualizar quem já está na 2.3.1

1. **Nenhuma nova migration SQL é necessária** para quem já aplicou `202610220005_phase231.sql` na versão 2.3.1. O Cofrinho 1 a 500 utiliza a estrutura existente de metas (`goals`) e aportes (`contributions`), registrando na observação os números marcados (`Cofrinho #1, #2...`).
2. Se você ainda está na **2.3.0**, aplique `supabase/migrations/202610220005_phase231.sql` no SQL Editor do Supabase (veja [FASE-2.3.1.md](FASE-2.3.1.md)).
3. Copie o conteúdo do projeto atualizado para a raiz do seu repositório, preservando o `.git` e suas variáveis de ambiente (`.env.local`).
4. Execute `npm ci` e `npm run check`.
5. Faça commit e push para a branch conectada à Vercel. Aguarde o deploy de produção ficar pronto e atualize o navegador.
6. Confira **v2.3.2** nos créditos do menu lateral (ou em **Mais** no celular).

Não é necessária nenhuma variável de ambiente nova, serviço pago ou configuração de SMTP.

## O que mudou na 2.3.2

- **Menu lateral com foco e indicador completos**: ajuste de espaçamento interno e flexibilidade dos itens (`.sidebar nav`, `.nav-item` e `.nav-active-dot`) para que a borda do item ativo/focado e a bolinha indicadora fiquem sempre inteiras, sem corte lateral mesmo em nomes longos.
- **Logo atualizado no carregamento**: a tela `"Preparando seu espaço"` agora exibe o símbolo oficial `<BrandMark />` do Meu Norte em vez do ícone genérico antigo.
- **Tutorial exclusivo na Visão Geral**: o guia **Primeiros passos** (`GettingStarted`) aparece somente na tela **Visão geral**, deixando o topo das demais páginas livre. Ao clicar em **Ver guia novamente** nas Preferências, o app leva você direto para a Visão geral.
- **Preferências reorganizadas**: na tela **Perfil e preferências**, o painel **Seu espaço, seu jeito** permanece na coluna principal à esquerda, enquanto **Sempre à mão (como usar no celular)**, **Primeiros passos**, **Quem pode ver meus dados?** e **Seu acesso** ficam agrupados de forma limpa na coluna à direita.
- **Aviso de versão Beta e privacidade futura (`/privacidade` e cadastro)**:
  - Informa com transparência que o Meu Norte está em **versão Beta (teste)** e ainda não possui criptografia de ponta a ponta.
  - Explicita que, nesta fase de testes, o responsável pelo projeto possui acesso técnico administrativo ao banco e se exime de qualquer garantia de inacessibilidade total enquanto a criptografia não estiver ativa.
  - Explica o plano para a versão **Produto**: implementação de criptografia para que dados sensíveis fiquem acessíveis apenas ao usuário, recuperação de senha e acesso mediante solicitação de relatório/suporte ou ordem/registro judicial (B.O. judicial) exclusivamente por meio de chave ou autorização fornecida pelo usuário.
- **Cabe no meu bolso? — Aluguel de imóvel**:
  - Nova categoria **Aluguel de imóvel** com cálculo de aluguel mensal, condomínio, IPTU, contas da casa e mudança/pintura.
  - Opção de **Garantia da locação**: **Caução (depósito antecipado)** com atalho para **3× o aluguel**, **Seguro fiança (valor mensal)** somado ao compromisso todo mês ou **Sem custo extra (fiador ou sem garantia)**.
  - Permite transformar a reserva para caução + mudança diretamente em uma Meta.
- **Cofrinho nas Metas (Cartela de 1 a 500 e Cofrinho mensal progressivo)**:
  - Botão rápido **Cofrinho 1 a 500** na tela de Metas e seletor de **Formato da meta** ao criar uma nova meta.
  - **Desafio do Cofrinho (1 a 500)**: cria a meta de **R$ 125.250,00** (ou de 1 até o número desejado) e exibe dentro do cartão da meta um **retângulo interativo com os números de 1 a 500** divididos por faixas (`1–100`, `101–200`, `201–300`, `301–400`, `401–500`) e filtros (`Todos`, `Livres`, `Marcados`).
  - Ao selecionar um ou mais números no retângulo e escolher a conta, o botão **Marcar no cofrinho** registra o aporte correspondente e marca os números na cartela.
  - **Cofrinho mensal progressivo**: permite planejar depósitos mensais que crescem mês a mês (valor inicial + incremento mensal × prazo) e já preenche o alvo e o primeiro aporte mensal sugerido.
- **Trava de zoom no celular**: configuração de `viewport` (`maximumScale: 1`, `userScalable: false`) para evitar zoom acidental ao tocar em campos ou navegar no celular, mantendo o comportamento de aplicativo nativo.

