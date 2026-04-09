# 01 - MATRIZ DE ROTAS E SUPERFÍCIES (DIGITAL PRIME MASTER)

**Contexto Arquitetural:**
A aplicação é um "Local-First Desktop App" rodando via Node.js + Playwright Chromium. Não atua como um servidor web clássico (sem Express/HTTP Server), portanto as "rotas" são na verdade **Eventos IPC (Inter-Process Communication)** via `exposeFunction` do Playwright ou views locais (`file://`).

## Matriz de Interfaces (Views)
| View / View | Tipo | Auth | Dados Acessados | Risco | Prioridade |
|---|---|---|---|---|---|
| `ui-local/index.html` | UI (Dashboard) | Pública (Local) | Leads, Logs, Configurações | Baixo | P0 |

## Matriz de Endpoints Internos (Eventos IPC Node.js -> UI)
| Ação / Endpoint IPC | Tipo | Auth | Dados | Risco | Prioridade |
|---|---|---|---|---|---|
| `startEngine(niche, city)` | Comando | Local | Gravação em DB (`leads.json`), Chromium Automation | Alto | P0 |
| `setRobotStopped(status)` | Comando | Local | N/A (State Change) | Baixo | P1 |
| `clearLocalStore()` | Comando | Local | Deleção da Sessão de Leads | Alto | P1 |
| `dispatchToWebhook(url, data)`| Network | Local | Envio PII (Leads) para SaaS Externo | Alto | P0 |
| `exportToPDF(leads, ...)` | Export | Local | Geração de Arquivo Local com Dados | Médio | P2 |
| `saveSettings(config)` | Storage | Local | Gravação URL de Webhook (`settings.json`) | Baixo | P2 |
| `savePipelineUpdate(id, st)` | Storage | Local | Modificação de Status de Pipeline de Lead | Médio | P1 |
| `getSavedLeads()` | Query | Local | Leitura de `leads.json` | Médio | P1 |
| `getRunLogs() / getEventsLog()`| Query | Local | Leitura de telemetria | Baixo | P2 |
