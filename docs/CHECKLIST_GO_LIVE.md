# Checklist Go-Live — Lead King

## Pré-requisitos

- [ ] `.env` configurado com todas variáveis (ver `.env.example`)
- [ ] `npm install` executado
- [ ] Supabase: schema aplicado (`node scripts/apply-schema.js`)
- [ ] Supabase: user operator existe (`node scripts/find-operator-user.js`)
- [ ] Cloudflare: projeto Pages criado
- [ ] Cloudflare: secrets configurados (feito automaticamente no deploy)

## Deploy

```bash
npm run qa              # Validação de sintaxe
npm test                # 87 testes
npm run security:check  # Auditoria de segredos
npm run cf:deploy       # Deploy + secrets + validação
```

## Validação Pós-Deploy

| Check | Comando/URL | Esperado |
|---|---|---|
| Front-end | `https://extrator-leads-google.pages.dev/` | UI carrega |
| Health | `/api/health` | `{"ok":true}` |
| Supabase | `/api/supabase-status` | 4 tabelas `ok` |
| Auth | POST sem code | 401 |
| Search | POST com code | 201 |
| Jobs | POST com code | 201 |

## Executor Local

```bash
node index.js
```
O autopilot consome filas automaticamente a cada 15s (search) e 20s (diagnóstico).

## Rollback
Se o deploy falhar, o Cloudflare mantém a versão anterior ativa automaticamente.
