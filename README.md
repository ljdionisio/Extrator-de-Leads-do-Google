# 🤖 Lead King — Digital Prime

Extrator de leads corporativos no Google Maps. Arquitetura local-first com PWA cloud.

## 🌐 URL Pública
[https://extrator-leads-google.pages.dev/](https://extrator-leads-google.pages.dev/)

## 🚀 Início Rápido

```bash
# Instalar dependências
npm install

# Configurar .env (copiar de .env.example)
cp .env.example .env

# Aplicar schema ao Supabase
node scripts/apply-schema.js

# Iniciar motor local (backend + autopilot)
node index.js

# Deploy Cloudflare (inclui secrets + validação)
npm run cf:deploy
```

## 📋 Scripts Disponíveis

| Script | Descrição |
|---|---|
| `npm start` | Motor local completo |
| `npm test` | 87 testes automatizados |
| `npm run qa` | Validação de sintaxe (18 módulos) |
| `npm run security:check` | Auditoria de segredos |
| `npm run cf:prepare` | Preparar UI para Cloudflare |
| `npm run cf:deploy` | Deploy automatizado + secrets + validação |

## 📖 Documentação

| Doc | Conteúdo |
|---|---|
| [Operação Mobile](docs/OPERACAO_MOBILE.md) | Como usar o PWA no celular |
| [Checklist Go-Live](docs/CHECKLIST_GO_LIVE.md) | Pré-requisitos e deploy |
| [Riscos e Limites](docs/RISCOS_E_LIMITES.md) | Limitações operacionais |
| [Revogação de Credenciais](docs/REVOGACAO_DE_CREDENCIAIS.md) | Como revogar tokens/keys |

## 🏗️ Arquitetura

```
Mobile/Browser → Cloudflare Pages (PWA + Functions)
                    ↕ Supabase (filas + storage)
                    ↕ Executor Local (Node.js + Playwright)
```

## 🔒 Segurança
- Secrets via `.env` local + Cloudflare Secrets (nunca commitados)
- Auth via `x-operator-access-code` (auto-gerado)
- PDF via signed URL temporária (1h)
- Bucket Storage privado
- Validação anti-traversal no PDF endpoint
