# Lead King — Guia de Distribuição

## Pré-requisitos
- Node.js 18+ instalado
- Playwright browsers: `npx playwright install chromium`

## Instalação
```bash
cd dist_clean
npm install
cp .env.example .env
# Editar .env se necessário
```

## Execução
```bash
npm start
```

## Estrutura do Pacote
```
dist_clean/
├── index.js              # Orquestrador principal
├── package.json          # Dependências e scripts
├── .env.example          # Template de variáveis
├── modules/              # Módulos de extração
├── ui-local/             # Interface visual (Chromium)
├── data/                 # Dados locais (vazio no pacote)
├── tests/                # Testes automatizados
└── scripts/              # Utilitários
```

## Comandos Disponíveis
| Comando | Descrição |
|---|---|
| `npm start` | Iniciar o robô |
| `npm test` | Suíte básica (UI + separação) |
| `npm run evidence` | **Homologação completa** — roda 4 testes e gera `EVIDENCIA_HOMOLOGACAO.md` |
| `npm run smoke` | Smoke test comercial com 1 lead real |
| `npm run test:ui` | Teste E2E da interface |
| `npm run test:separation` | Verificar separação interno/externo |
| `npm run qa` | Verificação de sintaxe de todos os módulos |
| `npm run package:clean` | Gerar pacote limpo em `dist_clean/` |

> **Nota**: Para auditoria formal, use `npm run evidence`. O comando `npm test` cobre apenas UI e separação.

## Segurança
- O pacote NÃO contém `.env` com credenciais reais
- O pacote NÃO contém dados de leads operacionais
- O pacote NÃO contém histórico de captações anteriores
- O arquivo `.env.example` é apenas um template

## Suporte
Digital Prime — Ecossistema Digital Inteligente
