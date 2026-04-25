# Supabase — Lead King Digital Prime

## Objetivo
Suportar PWA multi-dispositivo com histórico de pesquisas, fila de diagnósticos e armazenamento de PDFs.

## Tabelas

| Tabela | Descrição |
|---|---|
| `lead_searches` | Histórico de pesquisas (individual ou lote) |
| `lead_candidates` | Candidatos encontrados por pesquisa |
| `diagnosis_jobs` | Fila de diagnósticos premium (queued → running → succeeded/failed) |
| `diagnosis_reports` | Metadados de PDFs no Storage |
| `app_events` | Log de eventos para auditoria |

## RLS
- Ativada em **todas** as tabelas.
- Cada usuário vê/edita **somente** seus próprios registros (`auth.uid() = user_id`).

## Storage
- **Bucket:** `diagnosis-reports` (privado)
- **Acesso:** via signed URL no backend (service role key)
- **Front-end nunca acessa storage diretamente.**
- Criar manualmente no Dashboard → Storage → Create new bucket.

## Variáveis de ambiente

| Var | Uso | Onde |
|---|---|---|
| `SUPABASE_URL` | URL do projeto | Front + Backend |
| `SUPABASE_PUBLISHABLE_KEY` | Anon key (RLS) | **Front/PWA** |
| `SUPABASE_SECRET_KEY` | Service role key | **Backend/Executor APENAS** |

> ⚠️ `SUPABASE_SECRET_KEY` **nunca** deve aparecer no front-end, PWA, commit ou log.

## Como aplicar
1. Abrir Supabase Dashboard → SQL Editor
2. Colar conteúdo de `supabase/schema.sql`
3. Executar
4. Criar bucket `diagnosis-reports` no Storage
5. Verificar RLS nas tabelas

## Status
- **M7A:** Schema criado (somente arquivo SQL, não aplicado)
- **M7B:** Health check backend criado
- **Próximo:** M7C conectará a aplicação ao Supabase para persistência

## Validação via API (M7B)
Após configurar `.env` com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`:

```bash
npm start
# Abrir: http://localhost:3939/api/supabase/status
```

Resposta esperada:
```json
{
  "ok": true,
  "configured": true,
  "tables": { "lead_searches": "ok", ... },
  "storage": { "diagnosis_reports": "ok", "public": false }
}
```

> ⚠️ Se `storage.public` for `true`, o bucket deve ser corrigido para **privado** antes de prosseguir.

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` é somente para backend/executor local. Front/PWA usa apenas `SUPABASE_PUBLISHABLE_KEY`.

