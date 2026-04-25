require('dotenv').config();
const { chromium } = require('playwright');
const { createLocalServer, sendJson } = require('./modules/local-api-server.js');
// Supabase Removido em favor do Local Store


const supabase = null;

// Utilitário para pausar a execução
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function run() {
    console.log("\n=======================================================");
    console.log("   🤖 LEAD KING - MASTER CONTROL PANEL (Sinergia IA)   ");
    console.log("=======================================================\n");

    // Lança o navegador maximizado
    const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });

    // Janela Única: O Painel Visual do Robô (Dashboard Master Control)
    const dashContext = await browser.newContext({ viewport: { width: 1200, height: 800 }, acceptDownloads: true });
    const dashPage = await dashContext.newPage();

    let globalIsStopped = false;

    // Conexões com o painel visual
    await dashContext.exposeFunction('getSavedLeads', () => {
        const { loadLeads } = require('./modules/local-store.js');
        return loadLeads();
    });
    await dashContext.exposeFunction('getRobotStopped', () => globalIsStopped);
    await dashContext.exposeFunction('setRobotStopped', (status) => { globalIsStopped = status; });



    const { runMapsCollector } = require('./modules/maps-collector.js');
    await dashContext.exposeFunction('exportToPDF', async (leads, niche, city) => {
        const { generatePDF } = require('./modules/pdf-exporter.js');
        return await generatePDF(leads, niche, city);
    });

    await dashContext.exposeFunction('exportToCSV', async (leads, niche, city, mode) => {
        const { generateCSV } = require('./modules/csv-exporter.js');
        return await generateCSV(leads, niche, city, mode || 'interno');
    });

    await dashContext.exposeFunction('exportToCSVExternal', async (leads, niche, city) => {
        const { generateCSV } = require('./modules/csv-exporter.js');
        return await generateCSV(leads, niche, city, 'externo');
    });

    await dashContext.exposeFunction('exportExternalPDF', async (lead, niche, city) => {
        const { generateExternalPDF } = require('./modules/pdf-report-external.js');
        return await generateExternalPDF(lead, niche, city);
    });

    await dashContext.exposeFunction('generatePremiumReport', async (lead, niche, city) => {
        const { generatePremiumReport } = require('./modules/premium-report-engine.js');
        return await generatePremiumReport(lead, browser, niche, city);
    });

    // === PESQUISA INDIVIDUAL (M1) ===
    await dashContext.exposeFunction('searchSingle', async (companyName, city) => {
        const { searchSingleCompany } = require('./modules/single-search.js');
        return await searchSingleCompany(companyName, city, browser, 5);
    });

    await dashContext.exposeFunction('auditSingleCandidate', async (candidateUrl) => {
        const ctx = await browser.newContext({ viewport: { width: 900, height: 800 }, locale: 'pt-BR' });
        const pg = await ctx.newPage();
        try {
            const { auditCompany } = require('./modules/company-auditor.js');
            return await auditCompany(pg, candidateUrl);
        } finally {
            await ctx.close().catch(() => { });
        }
    });

    await dashContext.exposeFunction('clearLocalStore', () => {
        const { clearLeadsFile } = require('./modules/local-store.js');
        clearLeadsFile();
    });

    await dashContext.exposeFunction('logEvent', (type, msg) => {
        const { saveEventLog } = require('./modules/local-store.js');
        saveEventLog(type, msg);
    });

    await dashContext.exposeFunction('getRunLogs', () => {
        const { loadRuns } = require('./modules/local-store.js');
        return loadRuns();
    });

    await dashContext.exposeFunction('getEventsLog', () => {
        const { loadEventsLog } = require('./modules/local-store.js');
        return loadEventsLog();
    });

    await dashContext.exposeFunction('getSettings', () => {
        const { loadSettings } = require('./modules/local-store.js');
        return loadSettings();
    });

    await dashContext.exposeFunction('saveSettings', (settings) => {
        const { saveSettings } = require('./modules/local-store.js');
        saveSettings(settings);
    });

    await dashContext.exposeFunction('dispatchToWebhook', async (webhookUrl, leadsBatch) => {
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leads: leadsBatch, timestamp: new Date().toISOString() })
            });
            if (!response.ok) return { success: false, status: response.status, error: await response.text() };
            return { success: true, status: response.status };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    await dashContext.exposeFunction('savePipelineUpdate', (leadId, newStatus) => {
        const { updatePipelineStatus } = require('./modules/local-store.js');
        updatePipelineStatus(leadId, newStatus);
    });

    await dashContext.exposeFunction('startEngine', async (niche, city, triggerType = 'manual') => {
        globalIsStopped = false;

        const run_id = require('crypto').randomUUID();
        const started_at = new Date().toISOString();

        const runData = {
            run_id,
            trigger_type: triggerType,
            started_at,
            niche,
            city,
            status_final: 'RUNNING'
        };

        const { saveRunLog } = require('./modules/local-store.js');
        saveRunLog(runData);

        try {
            await runMapsCollector(niche, city, browser, dashPage, supabase, () => globalIsStopped, runData);

            // Bloco 3: Auto-Save ao fim da captação
            try {
                const { loadLeads } = require('./modules/local-store.js');
                const finalLeads = loadLeads() || [];
                if (finalLeads.length > 0) {
                    const { generatePDF } = require('./modules/pdf-exporter.js');
                    const { generateCSV } = require('./modules/csv-exporter.js');

                    const savedPdf = await generatePDF(finalLeads, niche, city);
                    const savedCsv = await generateCSV(finalLeads, niche, city);

                    await dashPage.evaluate((args) => {
                        if (window.logEvent) window.logEvent('SYS', `Auto-Save Concluído. Relatórios gerados na Área de Trabalho.`);
                        window.updateStatusMsg(`✅ Busca Finalizada! Relatórios salvos: ${args.savedPdf}`);
                    }, { savedPdf, savedCsv });
                }
            } catch (exportErr) {
                console.error("Erro no auto-save (não bloqueante):", exportErr);
                await dashPage.evaluate((args) => {
                    if (window.logEvent) window.logEvent('ERROR', `Auto-Save falhou: ${args.exportErr}`);
                }, { exportErr: exportErr.message });
            }

        } catch (e) {
            console.error('Fatal API crash:', e);
        }
    });

    // ========================================================
    // Inicia API HTTP Local (serve UI e API)
    // ========================================================
    const { loadLeads } = require('./modules/local-store.js');
    const apiHandlers = {
        'GET /api/leads': async (req, res) => {
            sendJson(res, 200, { leads: loadLeads(), total: loadLeads().length });
        },
        'POST /api/search-single': async (req, res, ctx) => {
            const { searchSingleCompany } = require('./modules/single-search.js');
            const { name, city } = ctx.body || {};
            if (!name || !city) return sendJson(res, 400, { error: 'name e city são obrigatórios' });
            const results = await searchSingleCompany(name, city, browser, 5);
            sendJson(res, 200, { candidates: results });

            // Persistir no Supabase (fire-and-forget, não bloqueia resposta)
            const { saveIndividualSearchWithCandidates } = require('./modules/supabase-server.js');
            saveIndividualSearchWithCandidates({
                queryName: name,
                city,
                candidates: results || [],
                rawQuery: { name, city, maxResults: 5 },
            }).catch(err => console.warn('[M7C] Persistência falhou:', err.message));
        },
        'GET /api/report-file': async (req, res, ctx) => {
            const filePath = ctx.query.path;
            if (!filePath) return sendJson(res, 400, { error: 'path é obrigatório' });

            const resolvedPath = path.resolve(filePath);

            // Somente .pdf
            if (!resolvedPath.toLowerCase().endsWith('.pdf')) {
                return sendJson(res, 403, { error: 'Somente arquivos PDF são permitidos' });
            }

            // Diretórios permitidos
            const { getDesktopExportDir } = require('./modules/path-helper.js');
            const allowedDirs = [
                getDesktopExportDir(),
                path.resolve(__dirname, 'data'),
                path.resolve(__dirname, 'reports'),
                path.resolve(__dirname, 'exports'),
            ];
            const isAllowed = allowedDirs.some(dir => resolvedPath.startsWith(dir));
            if (!isAllowed) {
                return sendJson(res, 403, { error: 'Acesso fora dos diretórios permitidos' });
            }

            // Verifica existência
            const fs = require('fs');
            if (!fs.existsSync(resolvedPath)) {
                return sendJson(res, 404, { error: 'Arquivo não encontrado' });
            }

            const filename = path.basename(resolvedPath);
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${filename}"`,
            });
            fs.createReadStream(resolvedPath).pipe(res);
        },
        'GET /api/supabase/status': async (req, res) => {
            const { isSupabaseConfigured, checkSupabaseHealth } = require('./modules/supabase-server.js');
            if (!isSupabaseConfigured()) {
                return sendJson(res, 200, { ok: false, configured: false, message: 'Supabase env not configured' });
            }
            try {
                const health = await checkSupabaseHealth();
                sendJson(res, 200, health);
            } catch (err) {
                sendJson(res, 500, { ok: false, configured: true, error: err.message });
            }
        },
        'POST /api/jobs': async (req, res, ctx) => {
            const { createDiagnosisJob } = require('./modules/supabase-server.js');
            const { candidateId, leadSnapshot, source } = ctx.body || {};
            if (!leadSnapshot) return sendJson(res, 400, { error: 'leadSnapshot é obrigatório' });
            const result = await createDiagnosisJob({ candidateId, leadSnapshot, source });
            sendJson(res, result.ok ? 201 : 500, result);
        },
        'GET /api/jobs': async (req, res, ctx) => {
            const { listDiagnosisJobs } = require('./modules/supabase-server.js');
            const status = ctx.query.status || undefined;
            const limit = parseInt(ctx.query.limit) || 20;
            const result = await listDiagnosisJobs({ status, limit });
            sendJson(res, 200, result);
        },
        'PATCH /api/jobs': async (req, res, ctx) => {
            const { updateDiagnosisJob } = require('./modules/supabase-server.js');
            const { jobId, ...updates } = ctx.body || {};
            if (!jobId) return sendJson(res, 400, { error: 'jobId é obrigatório' });
            const result = await updateDiagnosisJob(jobId, updates);
            sendJson(res, result.ok ? 200 : 500, result);
        },
    };

    const localApi = await createLocalServer({ port: 3939, apiHandlers, context: { browser } });

    // ========================================================
    // Carrega o layout HTML do Dashboard Master via HTTP
    // ========================================================
    const uiUrl = `http://localhost:${localApi.port}/`;
    await dashPage.goto(uiUrl);

    dashPage.on('close', async () => {
        console.log("👋 Painel Mestre fechado. Encerrando Robô.");
        await localApi.close().catch(() => { });
        process.exit(0);
    });

    // Inicialização da interface concluída
    console.log(`✅ Sistema Sinergia inicializado. UI: ${uiUrl}`);

    // Mantém o script vivo bloqueando o final
    await new Promise(() => { });
}

run();
