# Atualização · Meu Norte 2.3.3

Esta fase refina o calendário dos formulários, melhora a criação de metas no formato **Desafio do Cofrinho** e amplia a página **Relatórios** com análises detalhadas.

## Banco de dados (Supabase)

- **Nenhuma migration nova é necessária** para quem já aplicou até a `202610220005_phase231.sql` (v2.3.1/v2.3.2).
- Tanto o **cofrinho de tamanho personalizado** quanto os novos indicadores de **Relatórios** utilizam as tabelas e colunas já existentes (`goals`, `contributions`, `transactions`, `accounts`).

## O que mudou na v2.3.3

1. **Lista suspensa de mês e ano no calendário (`DateControl` + `SelectControl`)**:
   - Ajustada a largura mínima (`196px`) e o espaçamento interno das opções nos seletores de mês e ano dentro do popover do calendário, evitando que textos como `"outubro"` fiquem colados no ícone de seleção (`✓`) ou na barra de rolagem.
   - Corrigida a concordância do título do modal de cadastro (`Nova meta`, `Nova conta`, `Nova recorrência`).
2. **Máscara de exemplo (placeholder) no nome do cofrinho e das metas**:
   - O campo `Nome` permanece livre (com máscara de fundo explicativa como `"Ex.: Cofrinho da viagem, Reserva 1 a 500, Meu carro..."`) para o usuário digitar seu próprio nome sem precisar apagar texto preenchido. Se deixado em branco, o sistema gera automaticamente um nome padrão ao salvar.
3. **Opção "Outro tamanho (personalizado)" no Desafio do Cofrinho**:
   - Além das cartelas de 1 a 50, 100, 150, 200, 300 e 500, agora é possível escolher **"Outro tamanho (personalizado)"** e informar qualquer quantidade de números (de 2 a 2.000), calculando automaticamente o valor total da meta e gerando o quadro interativo correspondente.
4. **Página de Relatórios reformulada e mais completa**:
   - **Filtros no topo**: alternância entre **Últimos 6 meses** e **Últimos 12 meses** e filtro por conta bancária.
   - **4 indicadores principais**: Entradas realizadas, Saídas realizadas, Resultado do mês (com variação frente ao mês anterior e média mensal do período) e **Economia e metas** (`%` da renda preservada + total guardado em metas no mês).
   - **Atalho por categoria**: clique em `"Ver lançamentos"` em qualquer categoria de despesa para abrir a tela de Lançamentos já filtrada.
   - **Raio-X do orçamento**: separação clara entre **Compromissos fixos e parcelas** (recorrências e empréstimos), **Gastos variáveis do dia a dia** e **Sobra livre no mês**, além de aviso sobre lançamentos previstos ainda abertos no mês.
   - **Maiores gastos e origem das receitas**: ranking das 5 maiores despesas realizadas no mês e distribuição das fontes de receita.
   - **Balanço por conta** e **Fechamento por mês** enriquecido com colunas de `Guardado em metas` e `% Poupado`, além de exportação CSV do mês ou do período completo.

