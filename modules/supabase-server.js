/**
 * Supabase Server — Conexão server-side com service role key
 * 
 * SEGURANÇA:
 * - Este módulo NUNCA deve ser importado no front-end/PWA.
 * - Usa SUPABASE_SERVICE_ROLE_KEY (service role) para bypass de RLS.
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
    const tables = ['lead_searches', 'lead_candidates', 'diagnosis_jobs', 'diagnosis_reports', 'app_events'];

    for (const table of tables) {
        try {
            const { error } = await supabase.from(table).select('id').limit(1);
            result.tables[table] = error ? 'fail' : 'ok';
            if (error) result.errors.push(`${table}: ${error.message}`);
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

    const allTablesOk = tables.every(t => result.tables[t] === 'ok');
    const storageOk = result.storage.diagnosis_reports === 'ok' && !result.storage.public;
    result.ok = allTablesOk && storageOk;

    return result;
}

// =============================================================
// AUTO-PROVISIONING DE USUÁRIO
// =============================================================

let _resolvedUserId = null;
const FALLBACK_EMAIL = 'extrator-leads-system@digitalprime.local';

/**
 * Garante que existe um usuário Auth padrão para persistência.
 * 1. Se SUPABASE_DEFAULT_USER_ID existe, valida e usa.
 * 2. Senão, busca por email (env ou fallback).
 * 3. Se não encontrar, cria via Admin Auth.
 * Nunca imprime ID completo ou senha.
 */
async function ensureDefaultSupabaseUser() {
    if (_resolvedUserId) {
        return { ok: true, userId: _resolvedUserId, created: false, source: 'cache' };
    }

    if (!isSupabaseConfigured()) {
        return { ok: false, error: 'Supabase não configurado' };
    }

    const supabase = getSupabaseAdminClient();

    // 1. Env explícito?
    const envUserId = process.env.SUPABASE_DEFAULT_USER_ID;
    if (envUserId) {
        try {
            const { data } = await supabase.auth.admin.getUserById(envUserId);
            if (data && data.user) {
                _resolvedUserId = envUserId;
                console.log('[Supabase] Usuário padrão validado via env.');
                return { ok: true, userId: envUserId, created: false, source: 'env' };
            }
        } catch (e) {
            console.warn('[Supabase] Erro ao validar user_id do env:', e.message);
        }
    }

    // 2. Buscar por email
    const email = process.env.SUPABASE_DEFAULT_USER_EMAIL || FALLBACK_EMAIL;

    try {
        const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const existingUser = (listData?.users || []).find(u => u.email === email);

        if (existingUser) {
            _resolvedUserId = existingUser.id;
            console.log('[Supabase] Usuário encontrado por email.');
            _persistUserIdToEnv(existingUser.id);
            return { ok: true, userId: existingUser.id, created: false, source: 'email_lookup' };
        }
    } catch (e) {
        console.warn('[Supabase] Erro ao listar usuários:', e.message);
    }

    // 3. Criar usuário técnico
    try {
        const crypto = require('crypto');
        const randomPassword = crypto.randomBytes(32).toString('hex');

        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
            email,
            password: randomPassword,
            email_confirm: true,
            user_metadata: { role: 'system', source: 'auto_provisioned' },
        });

        if (createErr || !newUser?.user) {
            return { ok: false, error: createErr?.message || 'Criação falhou' };
        }

        _resolvedUserId = newUser.user.id;
        console.log('[Supabase] Usuário técnico auto-provisionado.');
        _persistUserIdToEnv(newUser.user.id);
        return { ok: true, userId: newUser.user.id, created: true, source: 'auto_created' };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

/**
 * Persiste user_id no .env local para futuras execuções.
 * Nunca imprime o valor.
 */
function _persistUserIdToEnv(userId) {
    try {
        const fs = require('fs');
        const path = require('path');
        const envPath = path.resolve(__dirname, '..', '.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            if (!content.includes('SUPABASE_DEFAULT_USER_ID=')) {
                fs.appendFileSync(envPath, `\nSUPABASE_DEFAULT_USER_ID=${userId}\n`);
                console.log('[Supabase] user_id salvo no .env local.');
            }
        }
    } catch (e) {
        console.warn('[Supabase] Não persistiu user_id no .env:', e.message);
    }
}

// =============================================================
// PERSISTÊNCIA
// =============================================================

function isPersistenceReady() {
    return isSupabaseConfigured();
}

/**
 * Salva pesquisa individual + candidatos no Supabase.
 * Auto-provisiona usuário se necessário.
 */
async function saveIndividualSearchWithCandidates(payload) {
    if (!isPersistenceReady()) {
        return { ok: false, error: 'Supabase não configurado' };
    }

    const userResult = await ensureDefaultSupabaseUser();
    if (!userResult.ok) {
        return { ok: false, error: `Usuário: ${userResult.error}` };
    }

    const userId = userResult.userId;
    const supabase = getSupabaseAdminClient();

    try {
        // 1. Inserir pesquisa
        const { data: search, error: searchErr } = await supabase
            .from('lead_searches')
            .insert({
                user_id: userId,
                query_name: payload.queryName || '',
                city: payload.city || '',
                source: 'individual',
                status: 'completed',
                candidate_count: (payload.candidates || []).length,
                raw_query: payload.rawQuery || {},
            })
            .select('id')
            .single();

        if (searchErr) {
            console.error('[Supabase] Erro ao salvar pesquisa:', searchErr.message);
            return { ok: false, error: searchErr.message };
        }

        const searchId = search.id;

        // 2. Inserir candidatos
        let candidatesSaved = 0;
        if (payload.candidates && payload.candidates.length > 0) {
            const rows = payload.candidates.map(c => ({
                user_id: userId,
                search_id: searchId,
                name: c.name || c.titulo || '',
                city: payload.city || '',
                phone: c.phone || c.telefone || null,
                website: c.website || null,
                google_maps_url: c.url || c.google_maps_url || null,
                rating: c.rating ? parseFloat(c.rating) : null,
                reviews: c.reviews ? parseInt(c.reviews) : null,
                raw_data: c,
            }));

            const { error: candErr } = await supabase
                .from('lead_candidates')
                .insert(rows);

            if (candErr) {
                console.error('[Supabase] Erro ao salvar candidatos:', candErr.message);
                return { ok: true, searchId, candidatesSaved: 0, warning: candErr.message };
            }

            candidatesSaved = rows.length;
        }

        // 3. Evento
        await logAppEvent('search_completed', 'lead_search', searchId, {
            query_name: payload.queryName,
            city: payload.city,
            candidates_found: candidatesSaved,
        });

        console.log(`[Supabase] Pesquisa salva (${candidatesSaved} candidatos)`);
        return { ok: true, searchId, candidatesSaved };

    } catch (err) {
        console.error('[Supabase] Erro inesperado:', err.message);
        return { ok: false, error: err.message };
    }
}

/**
 * Registra evento operacional no Supabase.
 */
async function logAppEvent(eventType, entityType, entityId, payload) {
    if (!isPersistenceReady()) return;

    try {
        const userResult = await ensureDefaultSupabaseUser();
        if (!userResult.ok) return;

        const supabase = getSupabaseAdminClient();
        await supabase.from('app_events').insert({
            user_id: userResult.userId,
            event_type: eventType,
            entity_type: entityType || null,
            entity_id: entityId || null,
            payload: payload || {},
        });
    } catch (err) {
        console.warn('[Supabase] Evento não salvo:', err.message);
    }
}

module.exports = {
    isSupabaseConfigured,
    getSupabaseAdminClient,
    checkSupabaseHealth,
    isPersistenceReady,
    ensureDefaultSupabaseUser,
    saveIndividualSearchWithCandidates,
    logAppEvent,
};
