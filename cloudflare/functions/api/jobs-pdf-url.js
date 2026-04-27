/**
 * /api/jobs-pdf-url — gera signed URL para PDF no Storage privado
 * C6: Segurança reforçada — valida path, rejeita traversal, aceita só .pdf
 */
import { createClient } from '@supabase/supabase-js';

function checkAuth(request, env) {
    const code = env.PWA_OPERATOR_ACCESS_CODE;
    if (!code) return null;
    if ((request.headers.get('x-operator-access-code') || '') !== code) {
        return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return null;
}

export async function onRequestGet(context) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-operator-access-code',
    };

    const authErr = checkAuth(context.request, context.env);
    if (authErr) return authErr;

    const url = context.env.SUPABASE_URL;
    const key = context.env.SUPABASE_SERVICE_ROLE_KEY || context.env.SUPABASE_SECRET_KEY || '';
    if (!url || !key) return Response.json({ ok: false, error: 'Supabase não configurado' }, { status: 500 });

    const reqUrl = new URL(context.request.url);
    const storagePath = reqUrl.searchParams.get('path') || '';

    // C6: Validações de segurança do path
    if (!storagePath) return Response.json({ error: 'path é obrigatório' }, { status: 400 });
    if (storagePath.includes('..')) return Response.json({ error: 'path inválido (traversal)' }, { status: 400 });
    if (storagePath.startsWith('/')) return Response.json({ error: 'path não pode começar com /' }, { status: 400 });
    if (!storagePath.toLowerCase().endsWith('.pdf')) return Response.json({ error: 'apenas arquivos .pdf' }, { status: 400 });

    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data, error } = await supabase.storage
        .from('diagnosis-reports')
        .createSignedUrl(storagePath, 3600);

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, signedUrl: data.signedUrl }, { headers: corsHeaders });
}

export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-operator-access-code',
        },
    });
}
