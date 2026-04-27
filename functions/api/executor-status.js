/**
 * Executor Status Function — Consulta heartbeat do executor local.
 * Retorna status: online, delayed, offline.
 */

export async function onRequestGet(context) {
    const { env } = context;
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    try {
        const supabaseUrl = env.SUPABASE_URL;
        const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return new Response(JSON.stringify({ ok: false, error: 'Config ausente' }), { status: 500, headers });
        }

        const res = await fetch(`${supabaseUrl}/rest/v1/executor_heartbeats?order=last_seen_at.desc&limit=1`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
            },
        });

        const rows = await res.json();

        if (!rows || rows.length === 0) {
            return new Response(JSON.stringify({
                ok: true,
                executor: { status: 'offline', label: 'Nunca conectou', lastSeen: null },
            }), { status: 200, headers });
        }

        const hb = rows[0];
        const lastSeen = new Date(hb.last_seen_at);
        const ageMs = Date.now() - lastSeen.getTime();
        const ageSec = Math.round(ageMs / 1000);

        let status, label;
        if (hb.status === 'stopping') {
            status = 'offline'; label = 'Desligando...';
        } else if (ageSec <= 30) {
            status = 'online'; label = 'Online';
        } else if (ageSec <= 90) {
            status = 'delayed'; label = `Atrasado (${ageSec}s)`;
        } else {
            status = 'offline'; label = `Offline (${Math.round(ageSec / 60)}min)`;
        }

        return new Response(JSON.stringify({
            ok: true,
            executor: { status, label, lastSeen: hb.last_seen_at, ageSec, executorId: hb.executor_id },
        }), { status: 200, headers });

    } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
