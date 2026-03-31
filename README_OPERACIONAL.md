# 🚀 Manual Operacional - Lead King
> Documentação exclusiva para o time comercial (SDR/BDR) da Digital Prime.
> **Versão Oficial:** v2.2.0 — Lead King / Baseline Operacional Digital Prime
> **Status de Homologação:** GO LOCAL ✅

---

## 1. O que é o Lead King?
O Lead King é o motor autônomo de Forense de Empresas e Captação B2B da Digital Prime. Ele utiliza do navegador do computador hospedeiro para varrer alvos no Google Maps, extraindo não apenas os dados de contato, mas as "dores" da presença digital (falta de sites, avaliações ruins, ausência de redes sociais).

**O motor pontua e prioriza** prospectos baseados na gravidade de suas deficiências (empresas com piores presenças ficam mais "Quentes").

---

## 2. Instruções de Operação Diária
1. **Inicialização:** Em um terminal na pasta raiz, execute `npm start`. A interface de controle (Master Control Panel) se abrirá.
2. **Definição do Alvo:** Preencha o **Nicho** (ex: *Advogados*) e a **Cidade** (ex: *São Paulo*).
3. **Extração Manual:** Pressione "INICIAR CAPTAÇÃO". O motor abrirá o mapa e os leads aparecerão gradativamante na tabela `Console Live`.
4. **Limpeza da Tela:** Pressione "Limpar Captações" para isolar um novo lote. Os resultados antigos já estarão salvos no arquivo seguro de Backup Automático do sistema.
5. **Gestão:** Use o seletor da tabela para classificar sua tratativa ("Novo", "Fechado", "Perdido"). A persistência no disco é imediata e irreversível na sessão.
6. **Exportação:** Utilize os botões "Exportar .CSV" ou "Exportar PDF" para despachar o lote atual. Os relatórios cairão pontualmente na pasta `Desktop/CRM Extrator Leads`.

---

## 3. O Sistema de Resgates (⚠️ Repescado)
Caso o robô extraia uma empresa que já estava no Histórico, ele irá injetá-la na sessão atual caso pertença ao seu novo filtro, mas acenderá um selo laranja **⚠️ REPESCADO**. Isso avisa o operador de que a empresa já fora mapeada no passado e merece cautela para não causar colisão de abordagem na Digital Prime.

---

## 4. Instruções de Homologação Comercial
1. **Definição de Responsáveis:** Selecionar um BDR designado para receber os relatórios do Desktop e carregar no CRM primário (RD Station/Pipedrive).
2. **Teste de Pitch:** Validar a utilidade da "Sugestão de Abordagem Curta" (Forensic Pain Points) gerada nas conversas de prospecção fria.
3. **Avaliação do Scoring:** Conferir se as pontuações mais altas (100+ pts) de fato correspondem a clientes mais propensos a comprarem serviços de visibilidade digital no mundo real.

---

## 5. Limitações e Riscos Residuais Oficiais

### Limitações Conhecidas do Cron Local
O módulo **Automação (Cron)** opera no lado do cliente.
* Se a janela/aba ativa sofrer *Sleep* severo pelo Windows ou por inatividade agressiva, a agenda atrasará indefinidamente, rompendo a sincronia do scraping de hora em hora. Recomenda-se um monitor/VPS ligado dedicado à janela.

### Limitação Estrutural do Scraper (DOM do Google Maps)
* **Sensores de Classes Fragilizadas:** O extrator depende de *seletores de CSS específicos* (como `a.hfpxzc` estruturado pelo React do Google). Uma alteração não-anunciada e massiva da UI pelo Google cegará as âncoras, resultando em 0 captações e exigindo intervenção rápida do time de engenharia técnica.
