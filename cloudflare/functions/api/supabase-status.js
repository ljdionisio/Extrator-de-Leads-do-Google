import { createClient } from '@supabase/supabase-js';

export async function onRequestGet(context) {
    const url = context.env.SUPABASE_URL;
    const key = context.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        return Response.json({
            ok: false,
            configured: false,
            error: 'Supabase env not configured in Cloudflare',
        });
    }

    try {
        const supabase = createClient(url, key, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const tables = ['lead_searches', 'lead_candidates', 'diagnosis_jobs', 'lead_search_jobs'];
        const results = {};
        const errors = [];

        for (const table of tables) {
            const { error } = await supabase.from(table).select('id').limit(1);
            results[table] = error ? 'fail' : 'ok';
            if (error) errors.push(`${table}: ${error.message}`);
        }

        const allOk = tables.every(t => results[t] === 'ok');

        return Response.json({
            ok: allOk,
            configured: true,
            tables: results,
            errors,
            runtime: 'pages-functions',
        });
    } catch (err) {
        return Response.json({
            ok: false,
            configured: true,
            error: err.message,
        }, { status: 500 });
    }
}
