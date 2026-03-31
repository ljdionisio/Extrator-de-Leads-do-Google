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

    await dashContext.exposeFunction('clearLocalStore', () => {
        const { clearLeadsFile } = require('./modules/local-store.js');
        clearLeadsFile();
    });

    await dashContext.exposeFunction('savePipelineUpdate', (leadId, newStatus) => {
        const fs = require('fs');
        const path = require('path');
        const LEADS_FILE = path.join(process.cwd(), 'data', 'leads.json');
        try {
            const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
            const idx = leads.findIndex(l => l.lead_id_estavel === leadId);
            if (idx !== -1) {
                leads[idx].status_pipeline = newStatus;
                leads[idx].ultima_acao = new Date().toISOString();
                fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
            }
        } catch (e) { }
    });

    await dashContext.exposeFunction('startEngine', async (niche, city) => {
        globalIsStopped = false;
        await runMapsCollector(niche, city, browser, dashPage, supabase, () => globalIsStopped);
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
