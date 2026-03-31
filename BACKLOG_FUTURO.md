# 🔮 Backlog de Evolução Futura
> Documento designado para trackeamento das features pausadas na versão atual (v2.2.0 - Baseline Operacional).
> *Não implementar. Estas pendências servem de bússola exclusiva para a próxima fase arquitetural.*

## 1. Integração Make.com
* Desvincular e robustecer o "push" direto da UI para os Webhooks.
* Implementar filas granulares de retentativas HTTP contra Payload limit rate vindo do Playwright.

## 2. Follow-up Comercial Automatizado
* Injeção de WhatsApp Web integrado.
* Disparo silencioso de abordagens primárias (a Sugestão de Abordagem Curta) diretamente pela secção do CRM embutido na aplicação, com delays humanos entre as mensagens.

## 3. Observabilidade mais Profunda
* Relatório diário sintético enviado ao Gestor de Vendas via API / Webhook (qtd de capturas, contatos válidos, prioridades frias X quentes).
* Integração com painel Sentry local ou Elasticsearch/Grafana.

## 4. Empacotamento/Distribuição Simplificada
* Criação de binários compilados cruzados (EXE, DMG) via Electron Builder focado.
* Eliminação da necessidade do BDR ter o **Node.js LTS** instalado nativamente rodando scripts `npm start` em CLI.
* Instalação One-Click para qualquer máquina da Digital Prime.

## 5. Camada Futura de Sincronização ou CRM Externo
* Banco de Dados na nuvem (Supabase Produtivo) ativado bidirecionalmente.
* Sincronismo do `duplicado_de` não apenas _Cross-Session_ local da máquina, mas _Cross-Company_, impedindo que o SDR A ligue para a empresa que o SDR B contatou em outra cidade e outra máquina.
* Atualização das pipelines refazendo pooling do PipeDrive SaaS (Status Two-way Sync).
