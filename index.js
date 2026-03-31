require('dotenv').config();
const { chromium } = require('playwright');
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

    await dashContext.exposeFunction('exportToCSV', async (leads, niche, city) => {
        const { generateCSV } = require('./modules/csv-exporter.js');
        return await generateCSV(leads, niche, city);
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
        const fs = require('fs');
        const path = require('path');
        const LEADS_FILE = path.join(process.cwd(), 'data', 'leads.json');
        const HIST_FILE = path.join(process.cwd(), 'data', 'history_snapshots.json');
        try {
            const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
            const idx = leads.findIndex(l => l.lead_id_estavel === leadId);
            if (idx !== -1) {
                leads[idx].status_pipeline = newStatus;
                leads[idx].ultima_acao = new Date().toISOString();
                fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
            }

            const history = JSON.parse(fs.readFileSync(HIST_FILE, 'utf8'));
            const histIdx = history.findIndex(l => l.lead_id_estavel === leadId);
            if (histIdx !== -1) {
                history[histIdx].status_pipeline = newStatus;
                history[histIdx].ultima_acao = new Date().toISOString();
                fs.writeFileSync(HIST_FILE, JSON.stringify(history, null, 2), 'utf8');
            }
        } catch (e) { }
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
    // Carrega o layout HTML do Dashboard Master
    // ========================================================
    const path = require('path');
    const uiPath = 'file://' + path.resolve(__dirname, 'ui-local', 'index.html');
    await dashPage.goto(uiPath);

    dashPage.on('close', () => {
        console.log("👋 Painel Mestre fechado. Encerrando Robô.");
        process.exit(0);
    });

    // Inicialização da interface concluída
    console.log("✅ Sistema Sinergia inicializado no Chromium.");

    // Mantém o script vivo bloqueando o final
    await new Promise(() => { });
}

run();
