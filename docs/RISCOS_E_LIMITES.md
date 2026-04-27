# Riscos e Limites — Lead King

## Limites Operacionais

| Limite | Motivo | Impacto |
|---|---|---|
| Motor em lote só roda local | Playwright não roda em Workers | Captação em massa requer PC ligado |
| CSV/PDF bulk export só local | Filesystem Node.js | Exportações em massa requer PC |
| Executor offline → timeout 6min | PWA faz polling | Mensagem de timeout na UI |
| Signed URL PDF expira em 1h | Segurança do Storage | Usuário precisa re-solicitar após expiração |
| Diagnóstico premium depende de Playwright | Screenshots requerem browser | Executor local obrigatório |

## Riscos de Segurança Mitigados

| Risco | Mitigação |
|---|---|
| Secrets no front-end | Verificado: grep 0 resultados |
| Bucket público | `diagnosis-reports` privado, acesso via signed URL |
| PDF permanente | Signed URL com TTL 1h |
| Auth bypass | `x-operator-access-code` em todos endpoints POST/GET |
| Path traversal no PDF | Validação: rejeita `..`, `/` prefix, non-.pdf |
| `.env` commitado | `.gitignore` + `security:check` script |

## Riscos Aceitos (S3)

| Risco | Probabilidade | Impacto | Decisão |
|---|---|---|---|
| Access code fraco | Baixa (32 chars aleatório) | Médio | Aceito — auto-gerado |
| Rate limiting ausente | Média | Baixo | Aceito para MVP — Cloudflare tem proteção nativa |
| Sem MFA | Alta | Baixo | Aceito — single operator |
