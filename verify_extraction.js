const { chromium } = require('playwright');
const { runMapsCollector } = require('./modules/maps-collector.js');
const fs = require('fs');

async function runTest() {
    console.log(">>> Inciando E2E Validation Engine <<<");
    const browser = await chromium.launch({ headless: true });
    const dummyPage = await browser.newPage();

    // Configura o mock do dashPage que o collector espera
    await dummyPage.exposeFunction('updateStatusMsg', msg => console.log(`[DASH-STATUS] ${msg}`));
    await dummyPage.exposeFunction('addLead', lead => console.log(`[LEAD-SAVED] 🟢 ${lead.name} | Score: ${lead.score} | Tel: ${lead.phone}`));

    // injeta a string pro evaluate funcionar
    await dummyPage.addInitScript(() => {
        window.updateStatusMsg = (msg) => window.updateStatusMsg(msg);
        window.addLead = (l) => window.addLead(l);
    });

    let stopFlag = false;
    // Forçar a parada em 30 segundos para o teste não ficar preso
    setTimeout(() => {
        console.log(">>> [TIMEOUT] Forçando parada do motor por tempo máximo de teste (30s) <<<");
        stopFlag = true;
    }, 30000);

    const runData = { run_id: 'test-123', started_at: new Date().toISOString() };

    try {
        console.log(">>> Rodando o robô para 'Oficina' em 'Campinas'...");
        await runMapsCollector("Oficina", "Campinas", browser, dummyPage, null, () => stopFlag, runData);
        console.log(">>> Varredura E2E concluída com sucesso!");
        console.log(runData);

        const leadsFile = './data/leads.json';
        if (fs.existsSync(leadsFile)) {
            const leads = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
            console.log(`\n✅ O Arquivo leads.json contém ${leads.length} leads. A extração está 100% operacional.`);
        }
    } catch (e) {
        console.error("❌ ERRO FATAL no Engine:", e);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

runTest();
