---
name: spline-3d-integration
description: "Integração com Spline 3D para experiências visuais web interativas. Não aplicável ao Lead King atual — reservado para futuras landing pages ou experiências premium da Digital Prime."
---

# Spline 3D Integration

## Quando usar
- Landing pages com experiência visual 3D interativa
- Demonstrações de produto com cenas animadas
- Elementos visuais premium para sites da Digital Prime

## Quando NÃO usar
- No Lead King (scraper/dashboard não tem UI pública)
- Em qualquer contexto que exija performance de scraping

## Referência rápida
- Runtime: `@splinetool/runtime` (npm) ou embed via iframe
- React: `@splinetool/react-spline`
- Editor: https://spline.design
- Exportação: `.splinecode` ou URL pública

## Padrão Digital Prime
- Usar somente em projetos front-end com HTTPS
- Não carregar cenas pesadas (>5 MB) sem lazy loading
- Testar em mobile antes de publicar (performance de GPU)
