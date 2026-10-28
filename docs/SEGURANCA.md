# Segurança do Meu Norte 2.3.1

Referências: ISO/IEC 27001:2022 (gestão de riscos), ISO/IEC 27002:2022 (controles), documentação do Next.js, Supabase e Vercel. Este documento registra controles implementados e limites. **Não é declaração de conformidade, certificação ISO ou auditoria independente.**

## Controles e evidências

| Risco / referência de controle                | Medida nesta versão                                                                                                                                                                | Evidência / verificação                                                                                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Acesso indevido                               | Auth validado no servidor; RLS por auth.uid(); dono vem da sessão; FKs compostas impedem relações entre usuários                                                                   | Testes PostgreSQL e HTTP com duas identidades, inclusive contratos e exclusão                                                                                                  |
| Escritas pelo console ou chamada direta à API | Cada operação autoriza o usuário; schemas descartam user_id/id extras; banco continua protegendo acesso direto via PostgREST                                                       | Testes de dono forjado, vínculo cruzado e rotas privadas sem sessão                                                                                                            |
| SQL injection                                 | Parâmetros pelo SDK/RPC, nomes de entidades em lista fechada; sem interpolação de texto do usuário em SQL                                                                          | Schemas, rotas e funções SQL inspecionados                                                                                                                                     |
| XSS e injeção                                 | Texto renderizado pelo React com escape; sem HTML fornecido pelo usuário; scripts CSP com nonce aleatório por resposta, strict-dynamic e sem unsafe-inline/unsafe-eval em produção | Teste da política; homologar console no deploy. style-src mantém unsafe-inline para estilos do React; não permite scripts inline arbitrários                                   |
| CSRF/clickjacking                             | Origin canônico nas escritas, APP_ORIGIN explícita em produção, comparação estrita; frame-ancestors none e X-Frame-Options DENY                                                    | Testes de origem externa, aliases locais somente em desenvolvimento e forwarded não confiável                                                                                  |
| Sobrecarga de APIs                            | Corpo máximo 12.000 bytes medido por stream; orçamento central no banco de 120 operações de escrita/minuto/usuário para rotas da fase 2; limites de Auth do Supabase               | Testes de limite por identidade, payload Unicode e acesso a tabela privada. Chamadas diretas ao PostgREST não passam pelo orçamento da rota; RLS/integridade continuam valendo |
| DDoS                                          | Mitigação da plataforma Vercel e uso das cotas gratuitas; sem prometer imunidade                                                                                                   | Configuração operacional no painel; nenhum teste de carga foi dirigido ao site publicado                                                                                       |
| Fraude/duplicação financeira                  | Centavos inteiros, Decimal para cálculos, transações/locks por usuário, unicidade de ocorrência/parcela; previsto não altera realizado                                             | Testes de reserva, VA/VR, dupla confirmação, pagamento repetido, automação sem saldo e amortização                                                                             |
| Segredos                                      | Chave privilegiada só no servidor, sem NEXT_PUBLIC_; exclusão deriva identidade de getUser e confirma senha                                                                        | Testes da rota de exclusão e checklist de bundle no deploy                                                                                                                     |
| Privacidade e descarte                        | Nome é metadado visual, não privilégio. Exclusão transacional de Auth e vínculos; sem respostas financeiras no cache offline                                                       | Teste de exclusão e PWA. Não apaga cópias exportadas, logs externos ou backups preexistentes dos provedores                                                                    |
| Logs                                          | Diagnóstico de Auth registra somente nome/código/status, sem mensagem do provedor com e-mail; não registra senha/token                                                             | Revisão da rota Auth. Logs do provedor têm retenção própria                                                                                                                    |
| Mudanças e verificação                        | Migração incremental transacional, testes, TypeScript e build; pacote sem credenciais                                                                                              | docs/VALIDACAO.md e guia de atualização                                                                                                                                        |
| Continuidade                                  | Exportação manual e roteiro de restauração/homologação                                                                                                                             | Backups automáticos adiados; não existe promessa de recuperação gerenciada no Free                                                                                             |

## Opções desta fase

Cadastro sem confirmação de e-mail por decisão do projeto. A senha autentica a conta, mas não comprova posse da caixa postal. O login não deve ser usado para afirmar identidade civil, e-mail verificado ou titularidade externa. Recuperação por e-mail desabilitada até configurar um provedor. O mínimo de oito caracteres deve ser configurado também no Supabase; permitir colagem de senhas e gerenciadores de senha.

Turnstile e backups automáticos foram adiados. A aplicação não depende de planos Pro/Team, serviços de rate limit pagos, WAF gerenciado pago ou certificado ISO contratado. Proteções de segurança consomem recursos normais dentro das cotas gratuitas. O uso acima das cotas pode limitar disponibilidade; não habilite planos/adicionais pagos automaticamente.

## Operação

- Cada pessoa do projeto deve usar sua própria conta no painel com MFA e o mínimo de acessos necessário. Rotacione segredos se forem expostos; trocar a chave no Git não elimina versões anteriores.
- Mantenha dependências e lockfile revisados; execute auditoria de dependências antes de atualizar/publicar. Ausência de vulnerabilidades conhecidas não significa ausência de falhas.
- Em incidente, preserve evidências sem copiar senhas/tokens, revogue sessões/credenciais afetadas, contenha acesso, avalie dados atingidos e documente correção e restauração.
- Use somente os controles gratuitos escolhidos e acompanhe utilização/limites no painel. Backups automáticos, CAPTCHA e melhorias de validação de identidade exigem reavaliação nas fases acordadas.

## Fontes oficiais

- https://www.iso.org/standard/27001
- https://www.iso.org/standard/75652.html
- https://nextjs.org/docs/app/guides/content-security-policy
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/general-configuration
- https://vercel.com/docs/vercel-firewall/ddos-mitigation

## Acesso administrativo e criptografia

RLS separa os registros entre usuários comuns; credenciais administrativas e o painel do projeto permitem consultar os dados financeiros. A 2.3.1 explicita isso no cadastro, na página `/privacidade` e nas preferências. Não há criptografia com chave exclusiva do usuário nesta versão. HTTPS e hashes de senha não cifram os lançamentos contra o administrador. A proposta de arquitetura, seus limites e critérios de migração estão em [USABILIDADE-E-PRIVACIDADE.md](USABILIDADE-E-PRIVACIDADE.md).
