/**
 * Supabase Server — Conexão server-side com service role key
 * 
 * SEGURANÇA:
 * - Este módulo NUNCA deve ser importado no front-end/PWA.
 * - Usa SUPABASE_SECRET_KEY (service role) para bypass de RLS.
 * - Nunca faz log de valores de env.
 * - Somente para backend local / executor.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

/**
 * Verifica se as variáveis de ambiente do Supabase estão configuradas
 * @returns {boolean}
 */
function isSupabaseConfigured() {
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let _adminClient = null;

/**
 * Retorna client Supabase com service role key.
 * Lança erro se env não estiver configurado.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabaseAdminClient() {
    if (_adminClient) return _adminClient;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Supabase env não configurado (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
    }

    _adminClient = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    return _adminClient;
}

/**
 * Health check completo: verifica tabelas e bucket.
 * Retorna objeto seguro sem expor credenciais.
 */
async function checkSupabaseHealth() {
    const result = {
        ok: false,
        configured: false,
        tables: {},
        storage: {},
        errors: [],
    };

    if (!isSupabaseConfigured()) {
        result.errors.push('Supabase env não configurado');
        return result;
    }

    result.configured = true;

    const supabase = getSupabaseAdminClient();

    // Verificar tabelas
    const tables = [
        'lead_searches',
        'lead_candidates',
        'diagnosis_jobs',
        'diagnosis_reports',
        'app_events',
    ];

    for (const table of tables) {
        try {
            const { error } = await supabase.from(table).select('id').limit(1);
            if (error) {
                result.tables[table] = 'fail';
                result.errors.push(`${table}: ${error.message}`);
            } else {
                result.tables[table] = 'ok';
            }
        } catch (err) {
            result.tables[table] = 'error';
            result.errors.push(`${table}: ${err.message}`);
        }
    }

    // Verificar bucket
    try {
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        if (bucketsError) {
            result.storage.diagnosis_reports = 'fail';
            result.errors.push(`Storage: ${bucketsError.message}`);
        } else {
            const bucket = buckets.find(b => b.name === 'diagnosis-reports');
            if (!bucket) {
                result.storage.diagnosis_reports = 'not_found';
                result.errors.push('Bucket diagnosis-reports não encontrado. Crie no Dashboard.');
            } else {
                result.storage.diagnosis_reports = 'ok';
                result.storage.public = !!bucket.public;
                if (bucket.public) {
                    result.errors.push('Bucket diagnosis-reports está público; deve ser privado antes de continuar.');
                }
            }
        }
    } catch (err) {
        result.storage.diagnosis_reports = 'error';
        result.errors.push(`Storage: ${err.message}`);
    }

    // Resultado final
    const allTablesOk = tables.every(t => result.tables[t] === 'ok');
    const storageOk = result.storage.diagnosis_reports === 'ok' && !result.storage.public;
    result.ok = allTablesOk && storageOk;

    return result;
}

module.exports = { isSupabaseConfigured, getSupabaseAdminClient, checkSupabaseHealth };
