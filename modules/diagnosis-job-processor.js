/**
 * Diagnosis Job Processor — Consome jobs queued do Supabase
 * 
 * Reusa o motor premium existente (premium-report-engine.js).
 * Requer instância de browser Playwright.
 */

const { updateDiagnosisJob, listDiagnosisJobs } = require('./supabase-server.js');
const { generatePremiumReport } = require('./premium-report-engine.js');

/**
 * Normaliza lead_snapshot para o formato esperado pelo motor premium.
 */
function normalizeJobLeadSnapshot(snapshot) {
    return {
        name: snapshot.name || snapshot.empresa || 'Desconhecido',
        city: snapshot.city || snapshot.cidade || '',
        phone: snapshot.phone || snapshot.telefone || null,
        website: snapshot.website || null,
        google_maps_url: snapshot.google_maps_url || snapshot.url || null,
        instagram: snapshot.instagram || snapshot.instagram_url || null,
        facebook: snapshot.facebook || snapshot.facebook_url || null,
        whatsapp_url: snapshot.whatsapp_url || null,
        rating: snapshot.rating || null,
        reviews: snapshot.reviews || null,
        score: snapshot.score || null,
        priority: snapshot.priority || null,
        reasons: snapshot.reasons || [],
        lead_id_estavel: snapshot.lead_id_estavel || snapshot.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'unknown',
        address: snapshot.address || snapshot.endereco || '',
    };
}

/**
 * Processa 1 job de diagnóstico.
 * @param {object} job - Job do Supabase (id, lead_snapshot, etc.)
 * @param {object} browser - Instância Playwright browser
 * @returns {{ ok: boolean, jobId: string, error?: string }}
 */
async function processDiagnosisJob(job, browser) {
    const jobId = job.id;

    // 1. Marcar como running
    const runResult = await updateDiagnosisJob(jobId, { status: 'running' });
    if (!runResult.ok) {
        console.error(`[JobProcessor] Falha ao marcar running: ${jobId.substring(0, 8)}...`);
        return { ok: false, jobId, error: runResult.error };
    }

    // 2. Normalizar lead
    const lead = normalizeJobLeadSnapshot(job.lead_snapshot || {});
    const niche = job.lead_snapshot?.niche || job.lead_snapshot?.nicho || 'Geral';
    const city = lead.city || 'Cidade';

    console.log(`[JobProcessor] Processando: ${lead.name} (${jobId.substring(0, 8)}...)`);

    try {
        // 3. Rodar diagnóstico premium
        const result = await generatePremiumReport(lead, browser, niche, city);

        // 4. Atualizar como succeeded
        await updateDiagnosisJob(jobId, {
            status: 'succeeded',
            diagnosis_score: result.evidence?.achados?.length || 0,
            result: {
                localPdfPath: result.pdfPath || null,
                pdfFileName: result.pdfPath ? require('path').basename(result.pdfPath) : null,
                evidencePath: result.evidencePath || null,
                achadosCount: result.evidence?.achados?.length || 0,
                fontesCount: result.evidence?.fontes?.length || 0,
                screenshotsCount: result.evidence?.screenshots?.length || 0,
            },
        });

        console.log(`[JobProcessor] ✅ Concluído: ${lead.name}`);
        return { ok: true, jobId, pdfPath: result.pdfPath };

    } catch (err) {
        console.error(`[JobProcessor] ❌ Falhou: ${lead.name} — ${err.message}`);

        await updateDiagnosisJob(jobId, {
            status: 'failed',
            error_message: err.message?.substring(0, 500) || 'Erro desconhecido',
            result: { error: err.message },
        });

        return { ok: false, jobId, error: err.message };
    }
}

/**
 * Busca e processa jobs queued.
 * @param {{ limit?: number, browser: object }} options
 * @returns {{ processed: number, succeeded: number, failed: number, results: Array }}
 */
async function processQueuedDiagnosisJobs(options = {}) {
    const limit = Math.min(options.limit || 1, 5);
    const browser = options.browser;

    if (!browser) {
        return { processed: 0, succeeded: 0, failed: 0, error: 'Browser não disponível', results: [] };
    }

    // Buscar jobs queued
    const { ok, jobs, error } = await listDiagnosisJobs({ status: 'queued', limit });

    if (!ok) {
        return { processed: 0, succeeded: 0, failed: 0, error, results: [] };
    }

    if (jobs.length === 0) {
        console.log('[JobProcessor] Nenhum job queued encontrado.');
        return { processed: 0, succeeded: 0, failed: 0, results: [] };
    }

    console.log(`[JobProcessor] ${jobs.length} job(s) queued para processar.`);

    const results = [];
    let succeeded = 0;
    let failed = 0;

    for (const job of jobs) {
        const r = await processDiagnosisJob(job, browser);
        results.push(r);
        if (r.ok) succeeded++;
        else failed++;
    }

    return { processed: jobs.length, succeeded, failed, results };
}

module.exports = { processQueuedDiagnosisJobs, processDiagnosisJob, normalizeJobLeadSnapshot };
