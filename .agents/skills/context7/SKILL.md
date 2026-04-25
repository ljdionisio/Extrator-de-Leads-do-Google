---
name: context7
description: "Validação de documentação atualizada de libs, frameworks e toolchain antes de instalar, atualizar, refatorar ou mudar abordagem. Evita usar padrões deprecados."
---

# Context7 — Validação de Documentação Mutável

## Quando usar (OBRIGATÓRIO)
- Antes de instalar nova dependência
- Antes de atualizar versão de lib existente
- Antes de refatorar código que depende de API de lib externa
- Antes de mudar abordagem técnica (ex: migrar de CommonJS para ESM)
- Quando sugerido ou determinado pela regra global Digital Prime

## Como usar
1. Identificar a lib/framework/tool em questão
2. Consultar a documentação oficial mais recente (context7-auto-research ou web search)
3. Verificar: breaking changes, deprecations, nova API recommended
4. Registrar decisão no commit ou no plano de execução

## Contexto Lead King
- **Playwright:** verificar changelog antes de atualizar (`^1.58.2`)
- **dotenv:** verificar se sintaxe de config mudou
- **Node.js:** verificar compatibilidade de versão com Playwright atual
- **CommonJS vs ESM:** qualquer migração exige context7 antes

## Regra
> Não instalar, atualizar nem refatorar sem validar padrão atual.
> Se a documentação mudou, ajustar o código ao novo padrão antes de mergear.
