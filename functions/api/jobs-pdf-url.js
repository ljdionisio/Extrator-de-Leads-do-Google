/**
 * /api/jobs-pdf-url — gera signed URL para PDF no Storage privado
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
    const authErr = checkAuth(context.request, context.env);
    if (authErr) return authErr;

    const url = context.env.SUPABASE_URL;
    const key = context.env.SUPABASE_SERVICE_ROLE_KEY || context.env.SUPABASE_SECRET_KEY || '';
    if (!url || !key) return Response.json({ ok: false, error: 'Supabase não configurado' }, { status: 500 });

    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    const reqUrl = new URL(context.request.url);
    const storagePath = reqUrl.searchParams.get('path');
    if (!storagePath) return Response.json({ error: 'path é obrigatório' }, { status: 400 });

    const { data, error } = await supabase.storage
        .from('diagnosis-reports')
        .createSignedUrl(storagePath, 3600);

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, signedUrl: data.signedUrl });
}
