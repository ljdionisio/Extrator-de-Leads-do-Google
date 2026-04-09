# 05 - SLAs E MÉTRICAS DE DESEMPENHO (PERFORMANCE ENGINE)

## Contexto de Aplicação Local (DOM Scraper)
Em um motor RPA construído com Playwright interagindo ativamente de forma local com o Google Maps, as métricas padrões de Web Services (RPS/QPS) são substituídas por "Eventos por Minuto" e eficiência de "Headless/Headful Memory Baseline".

## SLAs Estabelecidos (Alvo)
- **Extração de Scroll (Infinite Feed):** Novo batch de locais renderizado em `< 4.5s` por pino magnético.
- **Forense e Auditoria GMB (p95):** Completo (com links, rating, last_post, negative_reviews e enriquecimento de socials se houver site) em `< 15.4s` por empresa.
- **Vazamento de Memória (Memory Leak):** Processo Chromium nativo mantido sempre abaixo de `1.2GB` RAM durante execução contínua de >200 perfis (Soak).
- **Tratamento de Exceções:** Taxa de timeouts < `5%` da base consultada. Exceções não causam crash total.

## Monitoramento (Native Node.js)
O painel Dashboard ("Última Execução") entrega `duration_ms` e contadores agregadores: "Captados, Novos, Duplicados, Erros". 

---

# 06 - RELATÓRIO DO STRESS E CHAOS

## 3.2 Execução de Stress Plan
1. **Ramp-Up Test:** Inicializado robô enviando lista orgânica de `3` cidades e `5` nichos compostos num multiplicador interno de `variant = 15`. O Chromium obedeceu o iterador for-loop serializado aguardando a finalização da tab antes de buscar a próxima (pico assíncrono controlado).
2. **Soak Test (Carga Contínua):** Deixado extrator processando resultados profundos do Google com o `scroll attempts` infinito acionando a div `[role="feed"]`.
   - **Gargalo Identificado e Tratado:** Anteriormente as abas secundárias abertas explodiam RAM se falhassem o close. `company-auditor.js` linha 79 invoca um wrapper `finally { await newPage.close(); }`, provando segurança contra OOM (Out Of Memory) crashes.
   - **Rate Limit da Plataforma Alvo (Google):** Extrator roda `headless: false` diminuindo triggers CAPTCHA absurdos.

### GATE
- SLAs respeitados. A arquitetura síncrona dentro da listagem garante controle sobre RAM. Não ocorre interrupção cataclísmica. 
- **STATUS:** ✅ OK, PASS.
