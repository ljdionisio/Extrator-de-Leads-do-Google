/**
 * Search Job Processor — Consome search jobs queued do Supabase
 * 
 * Reusa o motor de pesquisa existente (single-search.js).
 * Persiste resultados via saveIndividualSearchWithCandidates.
 * Requer instância de browser Playwright.
 */

const {
    listLeadSearchJobs,
    updateLeadSearchJob,
    saveIndividualSearchWithCandidates,
    logAppEvent,
} = require('./supabase-server.js');
const { searchSingleCompany } = require('./single-search.js');

/**
 * Processa 1 search job.
 */
async function processSearchJob(job, browser) {
    const jobId = job.id;
    const queryName = job.query_name || '';
    const city = job.city || '';

    // 1. Marcar como running
    const runResult = await updateLeadSearchJob(jobId, { status: 'running' });
    if (!runResult.ok) {
        return { ok: false, jobId, error: runResult.error };
    }

    console.log(`[SearchProcessor] Processando: "${queryName}" em "${city}" (${jobId.substring(0, 8)}...)`);

    try {
        // 2. Rodar pesquisa usando motor existente
        const candidates = await searchSingleCompany(queryName, city, browser, 5);

        // 3. Persistir pesquisa + candidatos no Supabase
        const saveResult = await saveIndividualSearchWithCandidates({
            queryName,
            city,
            candidates: candidates || [],
            rawQuery: { name: queryName, city, maxResults: 5, source: 'search_job' },
        });

        // 4. Atualizar job como succeeded
        await updateLeadSearchJob(jobId, {
            status: 'succeeded',
            candidate_count: (candidates || []).length,
            search_id: saveResult.searchId || null,
            result: {
                candidateCount: (candidates || []).length,
                searchId: saveResult.searchId || null,
                candidates: (candidates || []).map(c => ({
                    name: c.name || c.titulo || '',
                    address: c.address || c.endereco || '',
                    phone: c.phone || c.telefone || null,
                    rating: c.rating || null,
                    reviews: c.reviews || c.total_reviews || 0,
                    website: c.website || null,
                    google_maps_url: c.google_maps_url || c.maps_url || null,
                    instagram_url: c.instagram || c.instagram_url || null,
                    facebook_url: c.facebook || c.facebook_url || null,
                    whatsapp_url: c.whatsapp_url || c.whatsapp || null,
                    category: c.category || c.categoria_maps || '',
                })),
            },
        });

        await logAppEvent('search_job_succeeded', 'lead_search_job', jobId, {
            query_name: queryName,
            city,
            candidates_found: (candidates || []).length,
        });

        console.log(`[SearchProcessor] ✅ Concluído: "${queryName}" (${(candidates || []).length} candidatos)`);
        return { ok: true, jobId, candidateCount: (candidates || []).length };

    } catch (err) {
        console.error(`[SearchProcessor] ❌ Falhou: "${queryName}" — ${err.message}`);

        await updateLeadSearchJob(jobId, {
            status: 'failed',
            error_message: err.message?.substring(0, 500) || 'Erro desconhecido',
            result: { error: err.message },
        });

        return { ok: false, jobId, error: err.message };
    }
}

/**
 * Busca e processa search jobs queued.
 * @param {{ limit?: number, browser: object }} options
 */
async function processQueuedSearchJobs(options = {}) {
    const limit = Math.min(options.limit || 1, 5);
    const browser = options.browser;

    if (!browser) {
        return { processed: 0, succeeded: 0, failed: 0, error: 'Browser não disponível', results: [] };
    }

    const { ok, jobs, error } = await listLeadSearchJobs({ status: 'queued', limit });

    if (!ok) {
        return { processed: 0, succeeded: 0, failed: 0, error, results: [] };
    }

    if (jobs.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0, results: [] };
    }

    console.log(`[SearchProcessor] ${jobs.length} search job(s) queued.`);

    const results = [];
    let succeeded = 0;
    let failed = 0;

    for (const job of jobs) {
        const r = await processSearchJob(job, browser);
        results.push(r);
        if (r.ok) succeeded++;
        else failed++;
    }

    return { processed: jobs.length, succeeded, failed, results };
}

module.exports = { processQueuedSearchJobs, processSearchJob };
