# Operação Mobile — Lead King PWA

## Visão Geral

O Lead King opera em dois modos:

| Modo | Onde roda | O que faz |
|---|---|---|
| **Local** | `node index.js` no PC | Motor Playwright + auditoria completa + PDF + executor autopilot |
| **Cloud** | `extrator-leads-google.pages.dev` | PWA mobile → filas Supabase → executor local processa |

## Fluxo de Uso no Celular

### 1. Abrir o PWA
- Acessar `https://extrator-leads-google.pages.dev/` no celular
- Na primeira vez, o sistema pede o **Código de Acesso** do operador
- O código é salvo no localStorage e reutilizado automaticamente

### 2. Pesquisa Individual (Cloud)
1. Preencher **empresa** e **cidade**
2. Tocar em **BUSCAR EMPRESA**
3. A busca é enviada para a fila no Supabase
4. O PWA faz polling a cada 3s aguardando o executor local
5. Quando o executor processa, os candidatos aparecem na tela
6. Selecionar o candidato correto → lead adicionado ao pipeline

### 3. Diagnóstico Premium (Cloud)
1. Abrir detalhes do lead
2. Tocar em **DIAGNÓSTICO PREMIUM**
3. O job é enviado para a fila de diagnóstico
4. O executor local processa com Playwright (screenshots + evidência)
5. PDF é gerado e enviado ao Supabase Storage
6. Botão **Abrir PDF** aparece com signed URL temporária (1h)

### 4. Pré-requisito: Executor Local Rodando
O executor local deve estar ativo no PC:
```bash
node index.js
```
Ele consome automaticamente as filas `lead_search_jobs` e `diagnosis_jobs`.

## Dicas
- O PWA funciona offline para a shell (HTML/CSS/JS), mas as APIs precisam de internet
- O polling tem timeout de 6 minutos — se o executor estiver offline, aparece mensagem de timeout
- Cada signed URL do PDF expira em 1 hora
