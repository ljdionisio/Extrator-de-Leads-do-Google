/**
 * /api/search-jobs — criar e listar search jobs via Supabase
 */
import { getSupabaseClient, getDefaultUserId, safeJson } from '../_shared/supabase.js';
import { requireOperatorAccess } from '../_shared/auth.js';

export async function onRequest(context) {
    // CORS preflight
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, x-operator-access-code',
            },
        });
    }

    const authErr = requireOperatorAccess(context.request, context.env);
    if (authErr) return authErr;

    const supabase = getSupabaseClient(context.env);
    if (!supabase) return safeJson({ ok: false, error: 'Supabase não configurado' }, 500);

    const userId = getDefaultUserId(context.env);
    if (!userId) return safeJson({ ok: false, error: 'User ID não configurado' }, 500);

    if (context.request.method === 'POST') {
        const body = await context.request.json().catch(() => ({}));
        if (!body.queryName) return safeJson({ error: 'queryName é obrigatório' }, 400);

        const { data, error } = await supabase
            .from('lead_search_jobs')
            .insert({
                user_id: userId,
                query_name: body.queryName,
                city: body.city || '',
                status: 'queued',
            })
            .select('id')
            .single();

        if (error) return safeJson({ ok: false, error: error.message }, 500);
        return safeJson({ ok: true, jobId: data.id }, 201);
    }

    // GET — listar
    const url = new URL(context.request.url);
    const status = url.searchParams.get('status') || undefined;
    const limit = parseInt(url.searchParams.get('limit')) || 20;

    let query = supabase
        .from('lead_search_jobs')
        .select('id, query_name, city, status, candidate_count, result, created_at, started_at, completed_at, error_message')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return safeJson({ ok: false, error: error.message }, 500);
    return safeJson({ ok: true, jobs: data || [] });
}
