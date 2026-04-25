# Lead King — Contexto do Projeto

## Stack Real
- **Runtime:** Node.js (CommonJS, `"type": "commonjs"`)
- **Dependências:** `playwright@^1.58.2`, `dotenv@^17.3.1`
- **UI:** HTML/CSS/JS local carregado via `file://` no Chromium do Playwright
- **Armazenamento:** JSON em `data/` (leads, histórico, runs, events, settings, evidence, screenshots)
- **PDF:** Gerado via Playwright headless (HTML → PDF via `page.pdf()`)
- **Versão:** 2.0.0

## Comandos Existentes
| Comando | Ação |
|---|---|
| `npm run qa` | Syntax check (`node --check`) de todos os módulos |
| `npm test` | Roda 5 suítes de teste: channels, premium-evidence, screenshots, pdf-links, separation |
| `npm start` | Executa `node index.js` — inicia o robô com dashboard visual |
| `npm run test:premium-smoke` | Smoke test real do diagnóstico premium |
| `npm run package:clean` | Gera distribuição limpa em `dist_clean/` |

## Arquivos Críticos
- `index.js` — Orquestrador: expõe funções via `dashContext.exposeFunction()` e carrega UI
- `modules/maps-collector.js` — Motor de coleta: multi-keyword no Google Maps
- `modules/company-auditor.js` — Auditoria forense: extrai dados de cada lead do Maps + enriquecimento via website
- `modules/lead-scorer.js` — Scoring por nicho com 10 perfis de peso
- `modules/premium-report-engine.js` — Diagnóstico premium: visita canais, captura screenshots, monta evidência
- `modules/pdf-report-external.js` — 2 PDFs: consultivo externo + premium com evidência visual
- `modules/local-store.js` — Persistência local: CRUD, deduplicação MD5, bloqueio de reabordagem 30 dias
- `modules/screenshots-manager.js` — Captura e base64 de screenshots por lead
- `modules/keyword-expander.js` — Gerador de variações de busca por nicho
- `modules/message-generator.js` — Templates de mensagem WhatsApp/email/argumento comercial
- `ui-local/index.html` + `script.js` + `style.css` — Dashboard Master Control Panel

## Segurança
- **`.env` NUNCA vai para Git** — protegido por `.gitignore` (`/.env`, `.env.*`, `!.env.example`)
- `.env.example` contém apenas placeholders de Supabase (atualmente desativado, `supabase = null`)
- XSS mitigado na UI com `escapeHtml()` e no PDF com `esc()`
- Relatórios exportados (*.pdf, *.csv, *.xlsx) ignorados pelo Git

## Decisão de Infraestrutura (quando necessário)
| Necessidade | Solução padrão |
|---|---|
| Banco, auth, fila, storage de PDFs, histórico multi-dispositivo | **Supabase** (RLS obrigatória, nunca expor service role no front) |
| Deploy/hospedagem do PWA | **Cloudflare Pages** |
| API leve, proxy, fila, integração segura | **Cloudflare Workers/Functions** (avaliar caso a caso) |

**Status atual:** Supabase **recomendado para próxima fase** (PWA multi-dispositivo). Não é obrigatório agora — o MVP local funciona sem backend remoto.
- Front-end usa apenas `anon`/`publishable key` quando houver integração
- Não criar integração Supabase sem justificar a necessidade
- Não solicitar credenciais reais em bloco de bootstrap

## Próxima Fase — PWA + Pesquisa Individual + Diagnóstico PDF Mobile
1. Busca individual: `nome da empresa + cidade` → lista de candidatos → seleção manual
2. Diagnóstico premium para lead único selecionado
3. PDF compartilhável via celular (WhatsApp share)
4. PWA: requer HTTPS + Service Worker + manifest (UI atual roda via `file://`, incompatível)
5. Separar backend Node (API local ou remota) da UI (PWA em HTTPS)

## Regra Operacional
Toda alteração deve ser feita por **microblocos** com:
- 1 objetivo por vez
- Escopo delimitado
- Validação objetiva (`npm run qa` + `npm test`)
- Saída explícita: `OK` ou `FAIL`
