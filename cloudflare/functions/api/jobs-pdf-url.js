/**
 * /api/jobs-pdf-url — gera signed URL para PDF no Storage privado
 */
import { getSupabaseClient, safeJson } from '../_shared/supabase.js';
import { requireOperatorAccess } from '../_shared/auth.js';

export async function onRequestGet(context) {
    const authErr = requireOperatorAccess(context.request, context.env);
    if (authErr) return authErr;

    const supabase = getSupabaseClient(context.env);
    if (!supabase) return safeJson({ ok: false, error: 'Supabase não configurado' }, 500);

    const url = new URL(context.request.url);
    const storagePath = url.searchParams.get('path');
    if (!storagePath) return safeJson({ error: 'path é obrigatório' }, 400);

    const { data, error } = await supabase.storage
        .from('diagnosis-reports')
        .createSignedUrl(storagePath, 3600);

    if (error) return safeJson({ ok: false, error: error.message }, 500);
    return safeJson({ ok: true, signedUrl: data.signedUrl });
}
