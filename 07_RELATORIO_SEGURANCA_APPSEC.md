# 07 - RELATÓRIO DE SEGURANÇA E APPSEC (DESKTOP CRAWLER)

## Análise de Ameaças & Vetores (STRIDE modelado Desktop)
Como não existe uma API exposta externamente (a aplicação interage com Chromium no cliente local), ataques externos tradicionais via Rede (Auth bypass, CSRF base-level) têm superfície inexistente de fora para dentro. As superfícies críticas abordam **Cross-Site Scripting Baseado em Leads** e **File System Injections**.

## 4.1 Checklist AppSec Executado
- **Auth bypass / Sessões:** Não se aplica. `uiPath = 'file://'` executa rodando na porta IPC do próprio script em Runtime Local de único usuário do Sistema Operacional hospedeiro. (SEGURO/NÃO APLICÁVEL).
- **XSS via Dados Raspados:** A página renderizada `index.html` injeta HTML gerado dinamicamente:
  - Em `company-auditor.js`, os nomes de empresa, text-contents são formatados via `.innerText` / `textContent()`.
  - Injeções em tags na renderização local. Na listagem de UI principal em `script.js` linha 139: Ocorre `l.name` via concatenação de innerHTML. Isso gera uma vulnerabilidade XSS "Blind" de DOM local se o **nome do estabelecimento no Google Business estiver construído com `<script>` ou iframes**. O risco é mitigado pelo próprio isolamento da UI no Chromium do proprietário (rodando local file context sem privilégio nativo total), mas é classificado formalmente como Risco **S2** (DOM XSS via Crawler) e deve no futuro passar por sanitização antes do innerHTML.
- **Path Traversal e Secrets:** A exportação de PDF (`pdf-exporter.js` linha 85): `const safeName = "Relatorio_"...replace(/[^a-z0-9_]/gi, '_').toLowerCase() + '.pdf'` efetivamente bloqueia nomes do usuário injetarem caminhos de sub-diretórios na escrita de Path. (SEGURO).
- **Vazamentos de Credenciais / Segredos:** `Supabase` (tokens, chaves secretas) declarados null e ignorados na execução do Crawler; sem exposição para a web dos segredos.

### GATE
Nenhuma vulnerabilidade classificatória S0 / S1 (Acesso Remoto a Máquina Hospedeira, ou Leak de Credenciais na Nuvem) encontrada. Risco S2 Identificado (Inner-HTML Injection no Contexto UI). **CONTINUA PARA CHAOS**.

---

# 08 - RELATÓRIO DE RESILIÊNCIA + CHAOS

## Quedas de Rede e Timeouts de Extrator
O script foi projetado para tolerar instabilidade de carregamentos GMB e perda momentânea de conexão Web:
- `mapsPage.goto(url, { timeout: 60000 });` Envolvido em bloco `catch` em `company-auditor.js` isola e descarta (return null) um lead corrompido sem derrubar toda a aplicação.
- Componentes não encontrados (ex: não há rede local do `instagram` no DOM) têm fallbacks seguros `catch (() => false)`, permitindo fluidez.
- Acúmulos de Erros caem no contador de métricas limpo no Dashboard Front-End.

**STATUS:** ✅ ROBUSTO.
