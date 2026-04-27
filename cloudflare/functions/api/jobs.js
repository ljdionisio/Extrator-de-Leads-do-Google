/**
 * /api/jobs — criar, listar e consultar diagnosis jobs via Supabase
 */
import { createClient } from '@supabase/supabase-js';

function getSupabase(env) {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '';
    if (!url || !key) return null;
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function checkAuth(request, env) {
    const code = env.PWA_OPERATOR_ACCESS_CODE;
    if (!code) return null;
    if ((request.headers.get('x-operator-access-code') || '') !== code) {
        return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return null;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-operator-access-code',
};

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
    const authErr = checkAuth(context.request, context.env);
    if (authErr) return authErr;

    const supabase = getSupabase(context.env);
    if (!supabase) return Response.json({ ok: false, error: 'Supabase não configurado' }, { status: 500 });

    const userId = context.env.SUPABASE_DEFAULT_USER_ID || null;
    if (!userId) return Response.json({ ok: false, error: 'User ID não configurado' }, { status: 500 });

    const body = await context.request.json().catch(() => ({}));
    if (!body.leadSnapshot) return Response.json({ error: 'leadSnapshot é obrigatório' }, { status: 400 });

    const { data, error } = await supabase
        .from('diagnosis_jobs')
        .insert({ user_id: userId, candidate_id: body.candidateId || null, lead_snapshot: body.leadSnapshot, status: 'queued' })
        .select('id')
        .single();

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, jobId: data.id }, { status: 201, headers: corsHeaders });
}

export async function onRequestGet(context) {
    const authErr = checkAuth(context.request, context.env);
    if (authErr) return authErr;

    const supabase = getSupabase(context.env);
    if (!supabase) return Response.json({ ok: false, error: 'Supabase não configurado' }, { status: 500 });

    const userId = context.env.SUPABASE_DEFAULT_USER_ID || null;
    if (!userId) return Response.json({ ok: false, error: 'User ID não configurado' }, { status: 500 });

    const url = new URL(context.request.url);
    const jobId = url.searchParams.get('id');

    // C4: GET by id
    if (jobId) {
        const { data, error } = await supabase
            .from('diagnosis_jobs')
            .select('id, status, lead_snapshot, diagnosis_score, result, created_at, started_at, completed_at, error_message, pdf_storage_path')
            .eq('id', jobId)
            .eq('user_id', userId)
            .single();

        if (error) return Response.json({ ok: false, error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 });
        return Response.json({ ok: true, job: data }, { headers: corsHeaders });
    }

    // Listagem padrão
    const status = url.searchParams.get('status') || undefined;
    const limit = parseInt(url.searchParams.get('limit')) || 20;

    let query = supabase
        .from('diagnosis_jobs')
        .select('id, status, lead_snapshot, diagnosis_score, result, created_at, started_at, completed_at, error_message, pdf_storage_path')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, jobs: data || [] }, { headers: corsHeaders });
}
