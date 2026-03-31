# 02 - MAPA CRÍTICO E SUPERFÍCIES (DIGITAL PRIME MASTER)

## Dependências Críticas Externas
1. **Google Maps Search API/Web Interface:** O robô utiliza Selenium-styled Playwright para ler ativamente elementos do DOM (ex: `h1.DUwDvf`, `button[data-item-id="address"]`). *(Alto Risco Arquitetônico de Mudanças do Google).*
2. **Endpoints de Webhook SaaS (Make.com, HubSpot, Zapier):** O sistema se integra enviando payloads estruturados via fetch(). Apenas acessível se configurado via UI Local.

## Infraestrutura e Recursos Locais (Armazenamento)
1. **Data Store Local (Arquivo JSON):** `data/leads.json` (Banco de Oportunidades), `data/settings.json`, e `data/runs_log.json`. *(Riscos de concorrência ou colisão em ambiente Multi-thread).*
2. **Processo Chromium Ativo:** Consumo de CPU/Memória na máquina hospedeira.

## Pontos de Falha (Latência e Limites)
- **Time-Out no Google Maps:** Aguardo de carregamento de páginas Google Maps de 15s até 60s (Auditoria de Empresa).
- **Limite de Navegação Infinita:** Avaliação de Feed é configurada para até `5` tentativas máximas sem mudanças de Height.

## Fluxos CORE (P0 - Inegociáveis)
- **F1:** `runMapsCollector` (Busca de empresas no Google + Forense de dados em lote) - **Não pode falhar**.
- **F2:** `calculateLeadScore` e `generateMessage` (Qualificação do Lead e Motor de Inteligência Comercial) - **Não pode retornar undefined/nulo**.
- **F3:** `dispatchToWebhook` (Sincronização C2C) - Envio assíncrono para os SaaS de Destino - **Não pode quebrar a UI por erro de fetch**.
- **F4:** `saveLead` e Data Persistence - Deduplicação automática deve funcionar rigorosamente.
