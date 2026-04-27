/**
 * Apply heartbeat schema — M11C
 * Cria tabela executor_heartbeats se não existir
 */
require('dotenv').config();

const sql = `
CREATE TABLE IF NOT EXISTS executor_heartbeats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    executor_id text NOT NULL UNIQUE,
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

ALTER TABLE executor_heartbeats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'heartbeats_service_all') THEN
        CREATE POLICY heartbeats_service_all ON executor_heartbeats
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
`;

async function run() {
    const url = process.env.SUPABASE_URL;
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    const ref = url.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
    if (!ref || !token) { console.error('Missing env'); process.exit(1); }

    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    if (res.ok) {
        console.log('✅ Tabela executor_heartbeats criada/verificada.');
    } else {
        console.error('❌ Erro:', text);
        process.exit(1);
    }
}

run();
