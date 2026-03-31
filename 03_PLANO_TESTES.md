# 03 - PLANO DE TESTES (QA FUNCIONAL E2E)

## Casos de Testes Principales (Core Flows)

| Caso | Caminho Feliz (P0) | Erros e Edge Cases (P1/P2) | Status Esperado |
|---|---|---|---|
| **CT-01: Engine de Busca** | Usuário insere "Nicho" e "Cidade". Clica em Iniciar. Motor engata e traz resultados. | Inserir campos vazios e clicar em Iniciar (Bloqueado via Alert). | Bloqueio de UI limpo. |
| **CT-02: Qualificador (Score)** | Cada scraper aciona a inteligência e pontua (0-100). | Faltam dados no Google Maps e Score cai adequadamente para frio. | Cálculo persistente e resiliente. |
| **CT-03: Webhook Sincronização** | Inserir Webhook (Make.com), selecionar Leads e sincronizar via Dispatch. | Webhook offline/errado (exibe console.error sem quebrar app). | Catch seguro de Promise. |
| **CT-04: Exportação PDF / CSV**| Clicar em Exportar e baixar dados em tela. | Tentar exportar com a tela vazia (Alert Nativo). | Bloqueio correto. |
| **CT-05: Sessão de Armazenamento** | Fechar e abrir a Engine. `initLocalLeads()` recupera do disco. | Arquivo JSON danificado (reseta em array vazio). | Fallback para `[]`. |
| **CT-06: Pausa do Motor** | Clicar em Pausar Motor. Interromper o loop de Playwright e fechar contexto de extração. | Suspender subitamente no meio do fetch do Google Maps. | Finaliza rotina e salva o que completou. |
| **CT-07: Dashboard Responsivo**| Usar telas < 1024px. UI deve comprimir sem omitir botões. | Verificar corte do painel lateral. | Wrap fluido. |
