const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const { runMapsCollector } = require('c:/Users/lucas/Desktop/Extrator de Leads Google/modules/maps-collector.js');
const { generateKeywords } = require('c:/Users/lucas/Desktop/Extrator de Leads Google/modules/keyword-expander.js');
const { loadLeads } = require('c:/Users/lucas/Desktop/Extrator de Leads Google/modules/local-store.js');

async function runStressTest() {
    console.log("=== INICIANDO STRESS TEST 80 LEADS ===");

    const dataDir = path.join('c:/Users/lucas/Desktop/Extrator de Leads Google', 'data');
    if (fs.existsSync(path.join(dataDir, 'leads.json'))) {
        fs.unlinkSync(path.join(dataDir, 'leads.json'));
        console.log("Banco local data/leads.json resetado.");
    }

    let memoryLogs = [];
    const logMemory = (stage) => {
        const mem = process.memoryUsage();
        const mb = Math.round(mem.rss / 1024 / 1024);
        memoryLogs.push(`${stage}: ${mb} MB`);
        console.log(`[MEMÓRIA] ${stage}: ${mb} MB`);
    };

    logMemory("Início");

    const browser = await chromium.launch({ headless: true });

    const niche = "clínica odontológica";
    const city = "São Paulo";

    let globalIsStopped = false;
    const startTime = Date.now();
    let extractedLeads = [];
    let totalDuplicadas = 0;
    const dbRefs = new Set();

    const context = await browser.newContext();
    const dashPage = await context.newPage();

    await dashPage.exposeFunction('addLeadMsg', (l) => {
        extractedLeads.push(l);
        if (dbRefs.has(l.name)) {
            totalDuplicadas++;
        } else {
            dbRefs.add(l.name);
        }

        if (extractedLeads.length % 10 === 0) {
            logMemory(`Extraídos ${extractedLeads.length}`);
        }

        if (extractedLeads.length >= 80 && !globalIsStopped) {
            console.log(`>> META DE 80 LEADS ATINGIDA => STOP`);
            globalIsStopped = true;
        }

        const elapsedMin = (Date.now() - startTime) / 1000 / 60;
        if (elapsedMin >= 45 && !globalIsStopped) {
            console.log(`>> LIMITE DE 45 MIN ATINGIDO => STOP`);
            globalIsStopped = true;
        }
    });

    await dashPage.evaluate(() => {
        window.leads = [];
        window.addLead = function (l) { window.leads.push(l); window.addLeadMsg(l); };
        window.updateStatusMsg = function (m) {
            console.log("[Status UI]", m);
        };
        window.updateTokens = function () { };
        window.addSerperCredit = function () { };
    });

    const keywords = generateKeywords(niche, city);
    console.log(`> Keywords geradas (${keywords.length}):`, keywords.join(', '));

    await runMapsCollector(niche, city, browser, dashPage, null, () => globalIsStopped);

    const endTime = Date.now();
    const capTime = ((endTime - startTime) / 1000).toFixed(2);
    logMemory("Fim Captura");

    const allLeads = loadLeads();
    const scenarioLeads = allLeads.filter(l => l.niche === niche.trim() && l.city === city.trim());

    const csvPath = path.join(process.cwd(), `stress_test.csv`);
    let csv = 'Score,Status,Prioridade,Rating,Reviews,Empresa,Telefone,Warnings\n';
    scenarioLeads.forEach(l => {
        csv += (l.score || 0) + ',' + l.status + ',' + (l.priority || '') + ',' + (l.rating || 0) + ',' + (l.reviews || 0) + ',"' + (l.name || '') + '","' + (l.phone || '') + '","' + (l.warnings ? l.warnings.join('|') : '') + '"\n';
    });
    fs.writeFileSync(csvPath, csv, 'utf8');

    const { generatePDF } = require('c:/Users/lucas/Desktop/Extrator de Leads Google/modules/pdf-exporter.js');
    const pdfPath = await generatePDF(scenarioLeads, niche, city).catch(e => { console.log(e); return "FAILED"; });
    logMemory("Fim PDF");

    const partialAudit = scenarioLeads.filter(l => l.status === 'partial');
    const successAudit = scenarioLeads.filter(l => l.status === 'success' || !l.status);
    const failAudit = scenarioLeads.filter(l => l.status === 'failed');

    const allWarnings = {};
    scenarioLeads.forEach(l => {
        if (l.warnings) {
            l.warnings.forEach(w => {
                allWarnings[w] = (allWarnings[w] || 0) + 1;
            });
        }
    });

    const evidence = {
        niche, city,
        keywords_generated: keywords.length,
        extracted_leads_total: scenarioLeads.length,
        success_audits: successAudit.length,
        partial_audits: partialAudit.length,
        failures: failAudit.length,
        duplicates_avoided: totalDuplicadas,
        capture_time_seconds: capTime,
        csv_path: csvPath,
        pdf_path: pdfPath !== 'FAILED' ? pdfPath : 'FAILED',
        memory_logs: memoryLogs,
        warnings_distribution: allWarnings
    };

    await context.close();
    await browser.close();

    fs.writeFileSync('c:/tmp/stress_result.json', JSON.stringify(evidence, null, 2));
    console.log("STRESS TEST CONCLUÍDO.");
}

runStressTest().catch(console.error);
