# Meu Norte 3.0.3 — confiabilidade da importação

**Base:** ZIP v3.0.2 fornecido em 08/11/2026.  
**Escopo:** alterações incrementais no importador, sem banco novo, sem serviço pago e sem envio de PDFs a terceiros.

## O que mudou

1. **Extrato bancário x fatura de cartão.** O conteúdo do arquivo é analisado para reconhecer sinais característicos de extratos de conta e faturas. A interface bloqueia importação em tipo incompatível (extrato de conta escolhido para cartão e vice-versa). Se o tipo não puder ser identificado com segurança, mantenha revisão humana.
2. **Entradas e saídas.** Em extratos bancários com coluna de valor assinado, negativos são saídas e positivos são entradas, inclusive `CREDITO CONSIGNADO`. Valores com sufixos D/C também são respeitados. Em textos sem identificação de extrato, linhas com valor sem sinal são desmarcadas para conferência. O parser CSV reconhece colunas independentes crédito/débito e colunas de natureza `D/C` quando existentes.
3. **Tabelas do Itaú.** Linhas de saldo (`SALDO DO DIA` etc.) são ignoradas. Se a linha tiver valor **e** saldo, apenas o valor do movimento é lido. O leitor PDF passou a tentar reconstruir as linhas usando posições X/Y dos blocos de texto, em vez de concatenar células desconexas. Isso é *best effort* — não é um leitor PDF universal nem OCR, e o PDF real do banco ainda precisa de homologação.
4. **Categorias.** Reconhece `PAY DL 99 26/10`, `99POP` e `99app` como Transporte, sem classificar números que apenas contêm `99` em outro identificador. As demais regras continuam.
5. **Duplicatas.** A conciliação com lançamentos existentes agora exige também correspondência de descrição, além do valor, sentido, conta e data/competência. Identificadores externos continuam prioritários. FITIDs repetidos dentro do próprio arquivo são desmarcados. Ao importar o outro lado de uma transferência própria já lançada, a prévia sugere conciliação em vez de somar uma movimentação nova.
6. **Transferências próprias.** A prévia sugere a opção "É uma transferência entre minhas contas" quando detecta descrições de PIX/transferências. **Não transforma automaticamente** um PIX em transferência; a pessoa precisa marcar a opção e escolher a outra conta. Transferências confirmadas não entram nas somas de receitas/despesas.
7. **Limites e lotes.** Tamanho máximo de arquivo: PDF/imagem 10 MiB e OFX/QFX/CSV/TSV/TXT 5 MiB. O app envia até **75 lançamentos por requisição**, mantendo o limite autorizado de até 500 registros por lote no servidor. Somente o POST de registros de transações ganhou um teto de corpo de 200.000 bytes; as demais rotas continuam em 12.000 bytes. Falhas após lotes parciais são informadas para facilitar recuperação segura.
8. **Abertura da conta e importações retroativas.** A API **não modifica silenciosamente** `opening_date`. Movimentos anteriores à abertura são bloqueados e orientam a revisar **data e saldo inicial** manualmente. A mesma verificação considera contas usadas em transferências. Isso evita retroceder a data de abertura sem corrigir o saldo inicial e criar dupla contagem histórica.

## Preservação de dados e implantação

- Nenhuma migration nova é necessária para a v3.0.3.
- Nenhum dado existente é reclassificado ou alterado automaticamente.
- Os hashes/IDs externos dos lançamentos antigos foram mantidos para permitir reimportação idempotente.
- Para atualizar, substitua **somente o código** após conferir alterações próprias não contidas no ZIP.
- O importador não armazena/manda PDFs brutos ao Supabase; recebe texto extraído localmente e envia registros validados às APIs existentes.
- **Atenção:** entradas de crédito consignado continuam como entradas com categoria `Empréstimos e financiamentos`. A visão geral atual contabiliza entradas como fluxo de caixa, não como renda salarial; futura distinção patrimonial de empréstimos requer regra específica de produto.

## Limitações conhecidas

- O PDF **real** usado nos prints não foi anexado; foram testados textos equivalentes e um fluxo PDF sintético contendo colunas posicionadas. PDF com fontes personalizadas, codificação sem mapa Unicode, digitalização por imagem ou proteção pode falhar na extração; OFX/CSV continua sendo o formato preferencial para importações históricas extensas.
- Arquivos muito grandes podem consumir memória no iPhone XR/Android. Os limites de tamanho reduzem o risco, mas não equivalem a uma homologação nesses aparelhos.
- Se a data inicial/saldo inicial da conta já incluírem o histórico que será importado, a pessoa deve reconciliar manualmente antes de importar. O sistema não pode adivinhar o saldo anterior sem um saldo de referência confiável.
- Se o envio de vários lotes falhar após uma parte ser salva, reabra o arquivo: itens salvos serão reconhecidos pelo identificador ou pela conciliação por descrição/data/valor.
- O README herdado da v3.0.2 ainda contém trechos de arquitetura que não correspondem ao Supabase Auth atual. Revisar a documentação geral é trabalho separado deste ajuste.

## Verificação e homologação

- Novo arquivo de testes `tests/statement-import.test.ts`: sinais negativos e positivos, categoria 99, valor x saldo, IDs, conciliação, transferências, tratamento de texto ambíguo, detecção de origem e extração sintética por coordenadas.
- Para executar com dependências: `npm ci && npm run check` em Node 22.12+.
- **Homologação manual obrigatória:** importar em conta de testes um PDF real do Itaú, conferir linha a linha entradas/saídas/valores, repetir a importação para testar idempotência, testar 199+ linhas no iPhone XR e verificar o saldo inicial histórico antes/depois.
- O ZIP não inclui `.env.local`, chaves ou dados bancários reais.
