# Meu Norte 2.3.2: uso, privacidade e próximo passo de arquitetura

Análise do código e dos fluxos atualizada para a **v2.3.2**. As alterações da interface estão implementadas nesta entrega. A criptografia com chave exclusiva do usuário descrita abaixo é o plano de arquitetura para quando o aplicativo for disponibilizado como **Produto**; **não está implementada nas versões Beta atuais (2.3.x)**. Não houve auditoria independente nem teste com participantes.

## Facilidade de uso

O caminho principal faz sentido para quem quer organizar a vida financeira: cadastrar o dinheiro que já possui, informar o que se repete, registrar contratos e cuidar dos lançamentos. O tutorial agora atende também às contas existentes. Pode ser adiado, retomado pelo avatar e concluído com registro no perfil do usuário no banco.

A visão geral responde três perguntas sem trocar de tela: quanto tenho livre, o que entrou e saiu e como estão as metas. “Livre” é saldo atual menos o que já foi reservado, excluindo benefícios; **não desconta todas as contas futuras**. Isso precisa ser considerado ao decidir um aporte. Por isso o Planejamento mostra saldo atual, permite escolher um orçamento próprio e exige revisão antes de reservar.

Contagem dos comandos principais, partindo da visão geral já carregada, sem contar digitação, seleções de campos nem correções:

| Tarefa                                             | Caminho                                                         | Comandos                                  |
| -------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------- |
| Registrar receita ou despesa                       | Novo lançamento → Salvar                                        | 2                                         |
| Criar primeira conta pelo tutorial                 | Cadastrar uma conta → Salvar                                    | 2                                         |
| Confirmar uma recorrência com valor e data de hoje | Lançamentos → Confirmar no item                                 | 2                                         |
| Ver todas as categorias                            | Ver categorias                                                  | 1                                         |
| Ver a evolução do caixa                            | Ver fluxo                                                       | 1                                         |
| Ajustar tema e cor                                 | Avatar → Perfil e preferências → escolher → Salvar              | 4, com uma escolha                        |
| Reservar dinheiro pelo Planejamento                | Planejamento → informar orçamento → Revisar e reservar → Salvar | 3, excluindo o preenchimento do orçamento |
| Criar uma meta com a simulação pronta              | Transformar em meta → revisar e Salvar                          | 2                                         |

Para acessar com uma conta existente: Meu espaço → preencher credenciais → Entrar. O cadastro continua levando à tela de entrar, conforme a decisão anterior do projeto. Não alteramos esse comportamento para economizar um clique.

### O que mudou nesta entrega

- Um título principal por página, com a saudação apenas uma vez.
- Preferências somente no avatar, tanto no computador quanto no celular. Os créditos ficam no menu, sem rodapé duplicado na área de trabalho.
- Resultado do simulador recebe foco e rolagem suave após um cálculo válido; o botão de criar meta ganha espaço. A preferência por movimento reduzido é respeitada.
- Setas dos cards levam ao conteúdo correspondente e mostram sua ação em texto. As categorias abrem diretamente a composição completa nos Relatórios.
- O cartão de dinheiro livre usa todas as oito cores e o mesmo padrão de fundo escolhido para o espaço.
- O Planejamento passa a explicar a próxima ação de cada meta, mostrar condições pendentes e abrir uma reserva com meta, valor e conta sugeridos. Nada é salvo só por mudar o orçamento ou clicar em “Usar saldo livre”.
- A reserva é limitada inicialmente ao valor livre na conta sugerida; se o dinheiro estiver distribuído, é possível revisar a conta e fazer outros aportes. O banco continua validando o saldo. Ao salvar um aporte iniciado pelo plano, o valor é descontado do orçamento informado nessa tela; cancelar ou falhar não o desconta.
- O brilho decorativo da landing deixa de interceptar cliques nos links. “Meu espaço” já é um link com toda a área do botão, incluindo ícone e espaços internos.

### Limites e validação com pessoas

A interface pode ser navegada em poucos comandos, mas isso não prova que uma pessoa entende “saldo”, “previsto” e “reservado”. O maior risco de entendimento é tratar dinheiro livre como sobra garantida do mês. Outro é entender que reservar para uma meta transfere dinheiro no banco; o formulário já explica que se trata de organização dentro do app.

Recomendo uma rodada com cinco pessoas que ainda não usaram o app: cadastrar a primeira conta, confirmar salário, lançar uma despesa futura, separar dinheiro para uma meta e decidir se uma compra cabe no mês. Observe se concluem sem ajuda, onde hesitam, erros e necessidade de voltar. Registre tempo e dificuldade real, sem sugerir o caminho. Isso ainda não foi executado; não há nota ou porcentagem de usabilidade medida.

A validação automatizada cobre comportamento, formulários, foco, navegação e persistência. Este ambiente não dispõe de navegador para verificar layout, áreas de clique e animações em pixels. Homologar no Chrome a 100%, com navegação por teclado, zoom de 200%, iPhone XR e Android. O CSS usa quebra de linha, colunas adaptáveis e áreas de toque; a inspeção visual final nesses aparelhos continua necessária.

## O que é possível garantir hoje

Há autenticação no servidor e RLS (permissões por linha) no banco. Cada usuário comum acessa seus próprios registros. Testes usam duas identidades e tentam vínculos cruzados, dono forjado e chamadas diretas. Alterar a interface ou a rota pelo console não deve conceder acesso aos registros de outra pessoa; a autorização está no servidor e no banco.

**Você, como administrador com acesso privilegiado ao projeto Supabase, consegue consultar os dados financeiros no banco.** Uma chave administrativa ou papel com `bypassrls` não está sujeito às mesmas políticas do usuário comum. Esconder valores na tela é só uma preferência visual. HTTPS protege o transporte; não impede a leitura autorizada no servidor. Criptografia de disco oferecida por um provedor também não torna o operador da aplicação incapaz de consultar as tabelas.

O Supabase guarda hashes de senha. Isso não é criptografia dos lançamentos, e o login atual envia a senha para autenticação no servidor. Para não induzir os testadores a erro, esta versão inclui aviso no cadastro, página pública `/privacidade` e explicação nas preferências. As informações descrevem o comportamento implementado; não constituem certificação ISO, parecer jurídico ou garantia de ausência de falhas.

Antes de convidar pessoas, confira no projeto publicado as migrations, políticas e configurações de acesso; esta entrega não inspeciona o painel remoto. Não compartilhe conta administrativa, habilite MFA para quem administra e dê acesso mínimo à equipe. Como a confirmação de e-mail foi adiada, o cadastro ainda não comprova posse da caixa postal. Para um teste exploratório, ofereça demonstração ou dados fictícios.

## Como impedir a leitura dos valores pelo painel do banco

É viável cifrar o conteúdo financeiro **no aparelho, antes do envio**, e guardar no banco apenas o conteúdo cifrado. A chave que abre os dados não pode estar legível no Supabase, em variável da Vercel, em logs nem com o administrador. A proposta abaixo busca proteger o conteúdo contra leitura de uma cópia do banco e uso das credenciais administrativas, mantendo o cliente legítimo confiável.

Criptografar com `pgcrypto` no SQL ou com uma chave em variável de ambiente no servidor não atende a esse objetivo: quem controla o projeto pode acessar a chave ou a operação de decifragem. Hash também não substitui essa solução; o app precisa recuperar e calcular os valores originais.

A Web Crypto API dos navegadores fornece geração de chaves, cifragem autenticada e proteção de chaves. Ela não exige contratar uma API de criptografia. Isso cabe numa implementação sem serviço pago adicional, mas exige desenvolvimento, testes e revisão especializada. O consumo de infraestrutura e os limites dos planos continuam existindo.

### Desenho proposto, sujeito a revisão

1. Gerar uma chave de dados aleatória por usuário no navegador. Usar cifragem autenticada padronizada, por exemplo AES-GCM, com nonce exclusivo por cifragem e metadados autenticados que vinculem versão, usuário e registro. Não criar algoritmo próprio.
2. Cifrar valores, descrições, categorias, nomes de contas e metas, datas e detalhes de contratos. Cifrar apenas a descrição deixa salários, parcelas e patrimônio legíveis. A definição final do envelope e os limites de uso das chaves precisam de revisão.
3. Proteger a chave de dados com um segredo de desbloqueio que nunca seja enviado ao servidor, usando derivação de chave adequada e parâmetros avaliados nos dispositivos de destino. Guardar no servidor apenas o envelope cifrado da chave. Não tratar uma derivação rápida ou uma senha curta como proteção suficiente contra ataque a uma cópia do banco.
4. Separar autenticação da abertura dos dados. A senha atual de login passa pelo servidor: reaproveitá-la como único segredo não satisfaz o requisito de servidor sem acesso ao segredo. Uma primeira solução pode usar uma senha de cofre separada, com opção de lembrar o aparelho avaliada conforme o risco. O custo de mais um segredo para o usuário precisa ser testado.
5. Oferecer chave de recuperação guardada pelo próprio usuário e um fluxo seguro para liberar outro aparelho. A troca da senha de login não dá ao suporte acesso ao cofre. Sem segredo, aparelho autorizado ou chave de recuperação, os dados podem ficar irrecuperáveis. Uma “chave mestra” conhecida pela equipe desfaz a promessa de exclusividade.
6. Manter RLS e controle de escrita por usuário. A API só recebe envelopes cifrados com tamanho e versão validados. Usar versões e controle de concorrência para impedir que dois aparelhos sobrescrevam mudanças sem perceber. A cifragem autenticada detecta adulteração do conteúdo, mas não resolve sozinha exclusão ou restauração maliciosa de uma versão antiga.
7. Fazer saldo, relatórios, busca, priorização de metas e simulações no cliente desbloqueado. As validações financeiras atuais no Postgres não conseguem somar valores cifrados. Precisam ser redesenhadas; não basta trocar o tipo da coluna e manter os mesmos triggers.
8. Reavaliar recorrências: o servidor não poderá produzir lançamentos com valores secretos enquanto o usuário estiver ausente. O caminho simples é gerar e sincronizar as ocorrências ao abrir/desbloquear o app. Manter lembretes de data no servidor revela esse metadado e precisa ser uma escolha explícita.

Não é necessário enviar finanças para a API do BCB: o servidor pode continuar fornecendo apenas referências públicas. Exportações legíveis só devem ser produzidas no aparelho desbloqueado, avisando que o arquivo exportado contém dados pessoais. A exclusão da conta segue autorizada pela sessão e deve remover envelopes e chaves cifradas; registros técnicos e backups têm retenção própria.

### Limite importante: quem controla o código do site

Mesmo com esse desenho, o administrador ainda controla o JavaScript publicado. Uma versão maliciosa, uma dependência comprometida, XSS ou uma extensão do navegador pode capturar o segredo ou usar os dados enquanto estiverem abertos. Uma chave não exportável dificulta extração direta, mas código que roda com acesso à chave ainda pode utilizá-la para decifrar.

Portanto, a promessa tecnicamente honesta seria: **“o banco não guarda seu conteúdo financeiro legível e o serviço não recebe sua chave no funcionamento da versão auditada”**. Não seria honesto prometer “nem o dono pode acessar em qualquer circunstância” só por adicionar AES ao site. Código aberto, revisão independente, versões verificáveis e, num estágio posterior, cliente distribuído com integridade verificável ajudam a reduzir a confiança no operador; não eliminam todos os riscos do aparelho ou de uma atualização maliciosa.

O e-mail de autenticação, identificadores, tamanho e quantidade dos registros e dados operacionais de conexão ainda podem ser visíveis. Isso deve ser declarado separadamente. Não chamar todo o cadastro de anônimo nem prometer que todo metadado está oculto.

### Migração e critérios de aceite

Uma migração deve ocorrer com o usuário autenticado e o cofre aberto: ler os registros atuais, cifrar no cliente, verificar a leitura e integridade, controlar versões e só então retirar os campos legíveis do banco ativo. Nada de guardar chave de migração com o operador ou registrar payloads sensíveis. Backups e exportações antigos podem continuar contendo texto legível até sua eliminação conforme a retenção; cifrar os dados novos não corrige retroativamente essas cópias.

Validar antes da liberação: cópia do banco não permite leitura; chave trocada ou adulteração é rejeitada; nenhum segredo chega às APIs/logs; outro usuário não lê nem sobrescreve envelopes; dois aparelhos não perdem alterações; recuperação e perda total da chave têm mensagens compreensíveis; atualização de senha não destrói o acesso; importação, recorrências, metas e contratos mantêm os cálculos; fluxo de migração retoma falhas sem duplicar nem apagar dados ainda não verificados.

Recomendação: primeiro um protótipo isolado, com dados fictícios, exportação e recuperação de chave; depois revisão do modelo de ameaça e do protocolo, testes em aparelhos reais e migração opt-in. A 2.3.1 mantém o banco existente e explicita seus limites. Não inclui criptografia parcial apresentada como proteção completa.

## Referências técnicas

Fontes primárias consultadas em 22/10/2026. As consequências para as rotinas do Meu Norte acima são uma análise da arquitetura atual, não afirmações dos provedores sobre este projeto.

- Supabase, RLS e papéis administrativos: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase, armazenamento de senhas: https://supabase.com/docs/guides/auth/password-security
- MDN, Web Crypto e cuidados de projeto: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- MDN, cifragem pelo navegador: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt
- OWASP, desenho do armazenamento cifrado: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- OWASP, gestão, recuperação e perda de chaves: https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html
