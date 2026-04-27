-- =============================================================
-- Lead King Digital Prime — Supabase Schema
-- =============================================================
-- Versão: 1.0 (M7A)
-- Objetivo: histórico multi-dispositivo, fila de diagnósticos,
--           armazenamento de PDFs, eventos de auditoria.
--
-- IMPORTANTE: Não contém credenciais reais.
-- Rodar manualmente no SQL Editor do Supabase Dashboard.
-- =============================================================

-- 0. EXTENSÕES
-- =============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- 1. FUNÇÃO updated_at (trigger genérico)
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- 2. TABELA: lead_searches
-- Histórico de pesquisas (individual ou lote)
-- =============================================================
CREATE TABLE IF NOT EXISTS lead_searches (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    query_name    text        NOT NULL,
    city          text,
    source        text        DEFAULT 'individual',
    status        text        DEFAULT 'completed',
    candidate_count integer   DEFAULT 0,
    raw_query     jsonb       DEFAULT '{}'::jsonb,
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_searches_user      ON lead_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_searches_created    ON lead_searches(created_at DESC);

DROP TRIGGER IF EXISTS trg_lead_searches_updated ON lead_searches;
CREATE TRIGGER trg_lead_searches_updated
    BEFORE UPDATE ON lead_searches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lead_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_searches_select_own" ON lead_searches
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lead_searches_insert_own" ON lead_searches
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lead_searches_update_own" ON lead_searches
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "lead_searches_delete_own" ON lead_searches
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================
-- 3. TABELA: lead_candidates
-- Candidatos encontrados em cada pesquisa
-- =============================================================
CREATE TABLE IF NOT EXISTS lead_candidates (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    search_id       uuid        REFERENCES lead_searches(id) ON DELETE SET NULL,
    name            text        NOT NULL,
    city            text,
    phone           text,
    website         text,
    google_maps_url text,
    instagram_url   text,
    facebook_url    text,
    whatsapp_url    text,
    rating          numeric,
    reviews         integer,
    score           integer,
    priority        text,
    reasons         jsonb       DEFAULT '[]'::jsonb,
    raw_data        jsonb       DEFAULT '{}'::jsonb,
    selected        boolean     DEFAULT false,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_candidates_user      ON lead_candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_candidates_search    ON lead_candidates(search_id);
CREATE INDEX IF NOT EXISTS idx_lead_candidates_created   ON lead_candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_candidates_maps_url  ON lead_candidates(google_maps_url);

DROP TRIGGER IF EXISTS trg_lead_candidates_updated ON lead_candidates;
CREATE TRIGGER trg_lead_candidates_updated
    BEFORE UPDATE ON lead_candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lead_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_candidates_select_own" ON lead_candidates
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lead_candidates_insert_own" ON lead_candidates
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lead_candidates_update_own" ON lead_candidates
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "lead_candidates_delete_own" ON lead_candidates
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================
-- 4. TABELA: diagnosis_jobs
-- Fila de diagnósticos premium
-- =============================================================
CREATE TABLE IF NOT EXISTS diagnosis_jobs (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    candidate_id     uuid        REFERENCES lead_candidates(id) ON DELETE SET NULL,
    lead_snapshot    jsonb       NOT NULL DEFAULT '{}'::jsonb,
    status           text        NOT NULL DEFAULT 'queued',
    error_message    text,
    pdf_storage_path text,
    pdf_public_url   text,
    diagnosis_score  integer,
    result           jsonb       DEFAULT '{}'::jsonb,
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now(),
    started_at       timestamptz,
    completed_at     timestamptz,

    CONSTRAINT chk_diagnosis_status CHECK (
        status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')
    )
);

CREATE INDEX IF NOT EXISTS idx_diagnosis_jobs_user      ON diagnosis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_jobs_status    ON diagnosis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_diagnosis_jobs_candidate ON diagnosis_jobs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_jobs_created   ON diagnosis_jobs(created_at DESC);

DROP TRIGGER IF EXISTS trg_diagnosis_jobs_updated ON diagnosis_jobs;
CREATE TRIGGER trg_diagnosis_jobs_updated
    BEFORE UPDATE ON diagnosis_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE diagnosis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diagnosis_jobs_select_own" ON diagnosis_jobs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "diagnosis_jobs_insert_own" ON diagnosis_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "diagnosis_jobs_update_own" ON diagnosis_jobs
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "diagnosis_jobs_delete_own" ON diagnosis_jobs
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================
-- 5. TABELA: diagnosis_reports
-- Metadados dos PDFs armazenados no Storage
-- =============================================================
CREATE TABLE IF NOT EXISTS diagnosis_reports (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id        uuid        REFERENCES diagnosis_jobs(id) ON DELETE CASCADE,
    candidate_id  uuid        REFERENCES lead_candidates(id) ON DELETE SET NULL,
    bucket        text        DEFAULT 'diagnosis-reports',
    storage_path  text        NOT NULL,
    file_name     text,
    file_size     bigint,
    mime_type     text        DEFAULT 'application/pdf',
    lead_name     text,
    city          text,
    created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnosis_reports_user      ON diagnosis_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_reports_job       ON diagnosis_reports(job_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_reports_candidate ON diagnosis_reports(candidate_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_reports_created   ON diagnosis_reports(created_at DESC);

ALTER TABLE diagnosis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diagnosis_reports_select_own" ON diagnosis_reports
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "diagnosis_reports_insert_own" ON diagnosis_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "diagnosis_reports_delete_own" ON diagnosis_reports
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================
-- 6. TABELA: app_events
-- Log de eventos para auditoria e observabilidade
-- =============================================================
CREATE TABLE IF NOT EXISTS app_events (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type  text        NOT NULL,
    entity_type text,
    entity_id   uuid,
    payload     jsonb       DEFAULT '{}'::jsonb,
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_events_user    ON app_events(user_id);
CREATE INDEX IF NOT EXISTS idx_app_events_type    ON app_events(event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_created ON app_events(created_at DESC);

ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_events_select_own" ON app_events
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "app_events_insert_own" ON app_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================
-- 7. TABELA: lead_search_jobs
-- Fila de pesquisas individuais para processamento offline/PWA
-- =============================================================
CREATE TABLE IF NOT EXISTS lead_search_jobs (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    query_name      text        NOT NULL,
    city            text,
    status          text        NOT NULL DEFAULT 'queued',
    error_message   text,
    candidate_count integer     DEFAULT 0,
    search_id       uuid        REFERENCES lead_searches(id) ON DELETE SET NULL,
    result          jsonb       DEFAULT '{}'::jsonb,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    started_at      timestamptz,
    completed_at    timestamptz,

    CONSTRAINT chk_search_job_status CHECK (
        status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')
    )
);

CREATE INDEX IF NOT EXISTS idx_lead_search_jobs_user    ON lead_search_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_search_jobs_status  ON lead_search_jobs(status);
CREATE INDEX IF NOT EXISTS idx_lead_search_jobs_created ON lead_search_jobs(created_at DESC);

DROP TRIGGER IF EXISTS trg_lead_search_jobs_updated ON lead_search_jobs;
CREATE TRIGGER trg_lead_search_jobs_updated
    BEFORE UPDATE ON lead_search_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lead_search_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_search_jobs_select_own" ON lead_search_jobs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lead_search_jobs_insert_own" ON lead_search_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lead_search_jobs_update_own" ON lead_search_jobs
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "lead_search_jobs_delete_own" ON lead_search_jobs
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================
-- 8. STORAGE BUCKET (instrução manual)
-- =============================================================
-- O bucket 'diagnosis-reports' deve ser criado manualmente no
-- Supabase Dashboard → Storage → Create new bucket.
--
-- Configuração:
--   - Nome: diagnosis-reports
--   - Público: NÃO (privado)
--   - Tamanho máximo: 50MB
--   - MIME permitido: application/pdf
--
-- Acesso via signed URL no backend (service role key).
-- Front-end NUNCA acessa storage diretamente.

-- FIM DO SCHEMA v1.1 (M7G)

-- =============================================================
-- 9. TABELA: executor_heartbeats (M11C)
-- Heartbeat do executor local para monitoramento de status
-- =============================================================
CREATE TABLE IF NOT EXISTS executor_heartbeats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    executor_id text NOT NULL,
    status text NOT NULL DEFAULT 'online'
        CHECK (status IN ('online','stopping','offline','error')),
    last_seen_at timestamptz DEFAULT now(),
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_executor_id ON executor_heartbeats(executor_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_last_seen ON executor_heartbeats(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_heartbeats_user_id ON executor_heartbeats(user_id);

CREATE TRIGGER trg_heartbeats_updated_at
    BEFORE UPDATE ON executor_heartbeats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE executor_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY heartbeats_service_all ON executor_heartbeats
    FOR ALL USING (true) WITH CHECK (true);

-- FIM DO SCHEMA v1.2 (M11C)
