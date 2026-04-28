/**
 * Executor Autopilot — Polling automático de filas Supabase
 * 
 * Consome lead_search_jobs e diagnosis_jobs queued em background.
 * Ativado por padrão quando Supabase está configurado.
 * Não quebra o app se Supabase não estiver disponível.
 */

const { isPersistenceReady, sendExecutorHeartbeat } = require('./supabase-server.js');

let _searchTimer = null;
let _diagnosisTimer = null;
let _heartbeatTimer = null;
let _running = { search: false, diagnosis: false };
let _stats = { searchCycles: 0, diagnosisCycles: 0, searchProcessed: 0, diagnosisProcessed: 0, errors: 0 };

/**
 * Inicia o autopilot de execução de filas.
 * @param {{ browser: object, enabled?: boolean, searchIntervalMs?: number, diagnosisIntervalMs?: number, maxSearchJobs?: number, maxDiagnosisJobs?: number }} options
 */
function startExecutorAutopilot(options = {}) {
    const enabled = options.enabled !== undefined
        ? options.enabled
        : (process.env.EXECUTOR_AUTOPILOT_ENABLED !== 'false');

    if (!enabled) {
        console.log('[Autopilot] Desativado via config.');
        return { started: false, reason: 'disabled' };
    }

    if (!isPersistenceReady()) {
        console.log('[Autopilot] Supabase não configurado. Autopilot não ativado.');
        return { started: false, reason: 'supabase_not_configured' };
    }

    if (!options.browser) {
        console.log('[Autopilot] Browser não disponível. Autopilot não ativado.');
        return { started: false, reason: 'no_browser' };
    }

    const searchInterval = parseInt(process.env.EXECUTOR_SEARCH_POLL_INTERVAL_MS) || options.searchIntervalMs || 5000;
    const diagnosisInterval = parseInt(process.env.EXECUTOR_DIAGNOSIS_POLL_INTERVAL_MS) || options.diagnosisIntervalMs || 20000;
    const maxSearch = parseInt(process.env.EXECUTOR_MAX_SEARCH_JOBS) || options.maxSearchJobs || 1;
    const maxDiagnosis = parseInt(process.env.EXECUTOR_MAX_DIAGNOSIS_JOBS) || options.maxDiagnosisJobs || 1;

    // Polling de search jobs
    _searchTimer = setInterval(async () => {
        if (_running.search) return;
        _running.search = true;
        try {
            const { processQueuedSearchJobs } = require('./search-job-processor.js');
            const result = await processQueuedSearchJobs({ limit: maxSearch, browser: options.browser });
            _stats.searchCycles++;
            _stats.searchProcessed += result.processed || 0;
            if (result.processed > 0) {
                console.log(`[Autopilot] Search: ${result.succeeded} ok, ${result.failed} fail`);
            }
        } catch (err) {
            _stats.errors++;
            console.warn('[Autopilot] Erro search poll:', err.message);
        }
        _running.search = false;
    }, searchInterval);

    // Polling de diagnosis jobs
    _diagnosisTimer = setInterval(async () => {
        if (_running.diagnosis) return;
        _running.diagnosis = true;
        try {
            const { processQueuedDiagnosisJobs } = require('./diagnosis-job-processor.js');
            const result = await processQueuedDiagnosisJobs({ limit: maxDiagnosis, browser: options.browser });
            _stats.diagnosisCycles++;
            _stats.diagnosisProcessed += result.processed || 0;
            if (result.processed > 0) {
                console.log(`[Autopilot] Diagnosis: ${result.succeeded} ok, ${result.failed} fail`);
            }
        } catch (err) {
            _stats.errors++;
            console.warn('[Autopilot] Erro diagnosis poll:', err.message);
        }
        _running.diagnosis = false;
    }, diagnosisInterval);

    // Heartbeat
    const heartbeatInterval = parseInt(process.env.EXECUTOR_HEARTBEAT_INTERVAL_MS) || 15000;
    const heartbeatMeta = { version: '2.0', autopilot: true, searchIntervalMs: searchInterval, diagnosisIntervalMs: diagnosisInterval };
    sendExecutorHeartbeat({ status: 'online', meta: heartbeatMeta }).catch(() => { });
    _heartbeatTimer = setInterval(() => {
        sendExecutorHeartbeat({ status: 'online', meta: { ...heartbeatMeta, stats: { ..._stats } } }).catch(() => { });
    }, heartbeatInterval);

    console.log(`[Autopilot] ✅ Ativado — search: ${searchInterval / 1000}s, diagnosis: ${diagnosisInterval / 1000}s, heartbeat: ${heartbeatInterval / 1000}s`);
    return { started: true, searchInterval, diagnosisInterval, maxSearch, maxDiagnosis };
}

/**
 * Para o autopilot.
 */
function stopExecutorAutopilot() {
    if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
    sendExecutorHeartbeat({ status: 'stopping' }).catch(() => { });
    if (_searchTimer) { clearInterval(_searchTimer); _searchTimer = null; }
    if (_diagnosisTimer) { clearInterval(_diagnosisTimer); _diagnosisTimer = null; }
    _running = { search: false, diagnosis: false };
    console.log('[Autopilot] Parado.');
    return { stopped: true };
}

/**
 * Retorna stats do autopilot.
 */
function getAutopilotStatus() {
    return {
        active: !!(_searchTimer || _diagnosisTimer),
        running: { ..._running },
        stats: { ..._stats },
    };
}

module.exports = { startExecutorAutopilot, stopExecutorAutopilot, getAutopilotStatus };
