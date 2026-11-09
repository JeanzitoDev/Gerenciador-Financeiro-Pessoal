# Meu Norte v3.0.4 — PDFs bancários protegidos por senha

**Base:** código v3.0.3. **Escopo:** correção incremental do importador, sem mudança de banco.

## Problema

O leitor de PDF v3.0.3 extraía operadores de texto dos streams internos do PDF. Ele não conseguia abrir streams cifrados (como os extratos do Itaú protegidos por uma senha fornecida pelo titular, frequentemente baseada no CPF). O aplicativo exibiria um erro de PDF ilegível, sem oferecer um campo de senha.

## Implementação

- Dependência local `pdfjs-dist@5.4.624` (Mozilla PDF.js), incluída no `package.json` e `package-lock.json`, sem CDN ou API de terceiros.
- Os PDFs passam a ser lidos no **navegador**, com o worker do PDF.js incluído no próprio build. PDFs com senha exibem o campo **Senha do PDF** e o botão **Desbloquear e ler PDF**.
- Em caso de senha incorreta, mantém-se o PDF em memória para nova tentativa, e o campo de senha é apagado; em caso de sucesso, o componente esquece o PDF protegido e limpa o campo.
- A senha **não** é enviada às APIs, ao Supabase ou à Vercel, nem salva em estado React, armazenamento do navegador ou logs. O PDF é lido localmente. Somente os lançamentos que a pessoa confirmar seguirão ao servidor, conforme o fluxo existente.
- A extração concatena segmentos por coordenadas das células (x/y) página por página, favorecendo tabelas de extrato de conta sem misturar valores e saldos de linhas distintas.
- Mantidos limites de arquivo (PDF 10 MiB), texto extraído (5 MiB), número de páginas (250) e validações da v3.0.3: revisão prévia, entradas e saídas, deduplicação, transferências e contas retroativas.
- PDFs exclusivamente digitalizados como imagem ainda precisam de OCR (não implementado), texto copiado ou exportação OFX/CSV.

## Limitações e homologação

- **Sem arquivo real fornecido:** ainda é necessário validar em um PDF real do Itaú, no iPhone XR e em um computador, com senha e layouts reais. Não inclua dados pessoais nem senha nos testes/prints enviados a terceiros.
- A biblioteca PDF.js e o worker são novos: executar `npm ci`, `npm run test`, `npm run typecheck`, `npm run build` e validar o carregamento do worker no PWA antes de publicar. A rede do ambiente de elaboração estava indisponível e impediu a instalação de dependências e o teste integrado.
- Os testes adicionados validam reconstrução de linhas e códigos de erro, mas não testam o desbloqueio de um PDF real cifrado nesta sessão.
- Nenhuma migration necessária. Não modifique saldos, lançamentos já gravados, RLS nem autenticação.
