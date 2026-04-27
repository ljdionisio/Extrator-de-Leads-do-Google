/**
 * Shared Supabase client para Cloudflare Pages Functions.
 * Nunca retorna envs na resposta.
 */
import { createClient } from '@supabase/supabase-js';

export function getServiceKey(env) {
    return env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '';
}

export function getSupabaseClient(env) {
    const url = env.SUPABASE_URL;
    const key = getServiceKey(env);
    if (!url || !key) return null;
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export function getDefaultUserId(env) {
    return env.SUPABASE_DEFAULT_USER_ID || null;
}

export function safeJson(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
