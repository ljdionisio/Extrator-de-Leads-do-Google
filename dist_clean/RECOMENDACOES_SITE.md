# Recomendações Estratégicas — Site Digital Prime

> Documento gerado automaticamente com base na análise do ecossistema Lead King + GPT Analista.
> Data: 2026-04-08

---

## 1. CTA de Auditoria Acima da Dobra

**Problema:** O visitante não encontra uma ação imediata de alto valor ao chegar no site.

**Solução:**
- Adicionar hero banner com:
  - "Descubra o que sua empresa está perdendo no digital — Auditoria Visual Gratuita"
  - Botão WhatsApp direto (pré-preenchido)
  - Formulário com campos: Nome, Empresa, Telefone, Site (opcional)
- Integrar com tag de conversão do Google Analytics (`gtag('event', 'auditoria_cta_click')`)

---

## 2. Landing Pages por Nicho

Criar páginas específicas otimizadas para SEO e ads:

| Nicho | URL sugerida | Foco |
|---|---|---|
| Dentistas | `/para-dentistas` | Google Maps + site + agendamento |
| Advogados | `/para-advogados` | Site institucional + SEO + autoridade |
| Clínicas | `/para-clinicas` | Reputação + Google + redes sociais |
| Contabilidades | `/para-contabilidades` | Site + posicionamento + painel |
| Empresas Locais | `/para-empresas-locais` | Presença digital completa |
| Prestadores | `/para-prestadores` | Funil + WhatsApp + conversão |

Cada página deve ter:
- Dor específica do nicho no H1
- Before/After visual
- CTA direto para auditoria gratuita

---

## 3. Prova Social Objetiva

Além dos cases visuais atuais, incluir quando houve prova real:
- Antes vs depois com capturas reais
- Ganho de organização (ex: "de 0 a 47 leads qualificados por mês")
- Ganho de velocidade (ex: "site carregando 3x mais rápido")
- Ganho de conversão (ex: "formulário subiu de 2% para 8% de conversão")

**Regra:** Nunca inventar números. Usar apenas dados reais quando disponíveis.

---

## 4. FAQ com Intenção de Busca

Transformar FAQ em ativo de SEO:
- Implementar Schema FAQ quando fizer sentido
- Perguntas ligadas a buscas reais:
  - "Quanto custa um site para dentista?"
  - "Como aparecer no Google Maps?"
  - "O que é SEO local?"
  - "Como melhorar avaliações do Google?"
  - "Preciso de tráfego pago ou SEO orgânico?"
  - "O que um painel administrativo pode fazer pelo meu negócio?"

---

## 5. Entrada Consultiva Antes dos Planos

**Recomendação:** Priorizar a jornada:
1. Auditoria gratuita → 2. Diagnóstico personalizado → 3. Proposta sob medida

Em vez de:
1. Plano básico/médio/completo → 2. Compre agora

**Por quê:** Projetos sob medida geram ticket maior e aderência melhor.

---

## 6. Tracking Profissional de Eventos

Mapear todos os eventos de conversão no Google Analytics:

| Evento | Trigger | Tag |
|---|---|---|
| Clique WhatsApp | `onclick` no botão WA | `whatsapp_click` |
| Clique Telefone | `onclick` no link tel: | `phone_click` |
| Envio Formulário | `submit` do form | `form_submit` |
| Scroll 50% | Scroll depth | `scroll_50` |
| Clique em Case | `onclick` no card | `case_click` |
| Clique em Plano | `onclick` no card | `plan_click` |
| Clique CTA Principal | `onclick` no hero | `cta_hero_click` |

---

## 7. Como o GPT Deve Usar o Site

O GPT Analista NÃO deve copiar o site como panfleto.

### Regra de enquadramento por dor:

| Dor detectada | Enquadramento Digital Prime |
|---|---|
| Sem site | Criação de site profissional + SEO + captação |
| Site fraco | Reestruturação, conversão e autoridade |
| Google Maps fraco | Presença local, reputação e SEO local |
| Redes fracas | Social media e conteúdo |
| Jornada até contato ruim | Funil, WhatsApp e automação |

---

## 8. Menu Ideal Após Cada Análise (GPT)

```
Posso ir para a próxima?
1 = analisar próxima empresa
2 = aprofundar mais a empresa atual
3 = gerar agora o relatório externo final
4 = gerar resumo do lote até aqui
```
