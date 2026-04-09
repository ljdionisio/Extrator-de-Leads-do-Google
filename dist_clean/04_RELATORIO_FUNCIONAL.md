# 04 - RELATÓRIO DE QA FUNCIONAL (E2E & REGRESSÃO)

**Execução Automática via Playwright Headless Script (`test_ui.js` & `verify_extraction.js`) executada em 31/03/2026**

## Resultado da Bateria P0 (Crucial)

| CT | Objetivo | Esperado | Obtido | Severidade | Reprodutibilidade | Status |
|---|---|---|---|---|---|---|
| **CT-01** | Inicialização do Engine de Extração | Ao iniciar, travar input e mostrar botão Pausar MOTOR. O motor executa a rotina `runMapsCollector` no chromium oculto e salva. | O bot iterou as listagens corretamente. E evitou `ReferenceError` na formatação da draft message (Corrigido previamente: Bug **S0**). Capturou 10 leads no teste de extração controlada. | N/A (Corrigido) | Reproduzível Consistente | ✅ **PASS** |
| **CT-02** | Qualificação do Sistema | Gerar Score 0-100 para perfil sem postagens, sem site, sem avaliações e/ou ranking baixo. | `calculateLeadScore` operou perfeitamente nos atributos rasos e os `messages.whatsapp` foram gerados baseados em falhas tangíveis (não em predição alucinatória). | N/A | Exato | ✅ **PASS** |
| **CT-03** | Dispatch para Webhook | Disparar evento para URL customizada. | Sucesso no teste unitário que apontou para backend express mockado. A Promise de fetch retornou OK. | N/A | Exato | ✅ **PASS** |
| **CT-04** | Exportações | Disparo das rotinas de CSV Export e PDF Local. | Blob.js disparou click de download CSV em ambiente seguro. PDF invocando `page.pdf` gerou o layout formatado em `Relatorio_Oficina_Campinas_...pdf`. | N/A | Exato | ✅ **PASS** |
| **CT-05** | Estado Persistente (`Local Store`) | A persistência escreve `data/leads.json`. Ao dar reload/refresh a UI consome o IPC Event e reidrata a tabela. | UI repovoada em `<= 1.5s` pós load, invocando `initLocalLeads()`. | N/A | 100% Reprodutível | ✅ **PASS** |
| **CT-06** | UX/Layout | A interface não pode ocultar botões de controle na margem inferior em telas menores (1366x768). | `style.css` atualizado com scroll nativo, layout empilhado (`column`) para responsividade abaixo de 1024px. Visualizado no render. Nenhum botão cortado. | N/A | Consistente | ✅ **PASS** |

### GATE:
- **Existem S0 ou S1?** Não. O erro fatal em `maps-collector.js` linha 145 (onde a string `dfMsg` acionava exceção) foi mapeado, testado e recodificado **com sucesso** na versão atual.
- Nenhum travamento residual registrado nas rotinas principais.
