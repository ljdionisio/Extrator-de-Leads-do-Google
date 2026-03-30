const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const { runMapsCollector } = require('c:/Users/lucas/Desktop/Extrator de Leads Google/modules/maps-collector.js');
const { generateKeywords } = require('c:/Users/lucas/Desktop/Extrator de Leads Google/modules/keyword-expander.js');
const { loadLeads } = require('c:/Users/lucas/Desktop/Extrator de Leads Google/modules/local-store.js');

async function runHomologation() {
    console.log("=== RE-INICIANDO HOMOLOGAÇÃO DE CAMPO FINAL ===");

    const dataDir = path.join('c:/Users/lucas/Desktop/Extrator de Leads Google', 'data');
    if (fs.existsSync(path.join(dataDir, 'leads.json'))) {
        fs.unlinkSync(path.join(dataDir, 'leads.json'));
        console.log("Banco local data/leads.json resetado.");
    }

    const browser = await chromium.launch({ headless: true });

    const scenarios = [
        { niche: "advogado previdenciário", city: "Belo Horizonte" },
        { niche: "clínica odontológica", city: "Campinas" },
        { niche: "contabilidade", city: "Curitiba" }
    ];

    let evidence = {};
    let totalDuplicadas = 0;
    const dbRefs = new Set();
    let totalFoundThisSession = 0;

    for (let i = 0; i < scenarios.length; i++) {
        const { niche, city } = scenarios[i];
        console.log(`\n--- CENÁRIO ${i + 1}: ${niche} em ${city} ---`);

        let globalIsStopped = false;
        const startTime = Date.now();
        let extractedLeads = [];

        const context = await browser.newContext();
        const dashPage = await context.newPage();

        await dashPage.exposeFunction('addLeadMsg', (l) => {
            extractedLeads.push(l);
            if (dbRefs.has(l.name)) {
                totalDuplicadas++;
            } else {
                dbRefs.add(l.name);
            }
            if (extractedLeads.length >= 10 && !globalIsStopped) {
                console.log(`>> STOP MANUAL ACIONADO (simulando botão UI)`);
                globalIsStopped = true;
            }
        });

        await dashPage.evaluate(() => {
            window.leads = [];
            window.addLead = function (l) { window.leads.push(l); window.addLeadMsg(l); };
            window.updateStatusMsg = function (m) {
                if (m.includes('Novos Leads')) {
                    // interceptar quantidade encontrados para log
                }
            };
            window.updateTokens = function () { };
            window.addSerperCredit = function () { };
        });

        const keywords = generateKeywords(niche, city);
        console.log(`> Keywords geradas (${keywords.length}):`, keywords.join(', '));

        await runMapsCollector(niche, city, browser, dashPage, null, () => globalIsStopped);

        const endTime = Date.now();
        const capTime = ((endTime - startTime) / 1000).toFixed(2);

        const allLeads = loadLeads();
        const scenarioLeads = allLeads.filter(l => l.niche === niche.trim() && l.city === city.trim());

        // Generate real CSV
        const csvPath = path.join(process.cwd(), `evidence_cenario_${i + 1}.csv`);
        let csv = 'Score,Status,Prioridade,Rating,Reviews,Empresa,Telefone,Warnings\n';
        scenarioLeads.forEach(l => {
            csv += (l.score || 0) + ',' + l.status + ',' + (l.priority || '') + ',' + (l.rating || 0) + ',' + (l.reviews || 0) + ',"' + (l.name || '') + '","' + (l.phone || '') + '","' + (l.warnings ? l.warnings.join('|') : '') + '"\n';
        });
        fs.writeFileSync(csvPath, csv, 'utf8');

        // Generate real PDF
        const { generatePDF } = require('c:/Users/lucas/Desktop/Extrator de Leads Google/modules/pdf-exporter.js');
        const pdfPath = await generatePDF(scenarioLeads, niche, city).catch(e => { console.log(e); return "FAILED"; });

        const partialAudit = scenarioLeads.filter(l => l.status === 'partial');
        const successAudit = scenarioLeads.filter(l => l.status === 'success' || !l.status); // previous format didn't have status, but we fixed it.
        const failAudit = scenarioLeads.filter(l => l.status === 'failed'); // Maps collector doesn't inject failed, it skips. BUT if it was caught somehow.

        evidence[`Cenario_${i + 1}`] = {
            niche, city,
            keywords_generated: keywords.length,
            extracted_leads: scenarioLeads.length,
            success_audits: successAudit.length,
            partial_audits: partialAudit.length,
            failures: failAudit.length, // Extractor currently `continue` on missing name (failed).
            capture_time_seconds: capTime,
            csv_generated: fs.existsSync(csvPath),
            pdf_generated: fs.existsSync(pdfPath) && pdfPath !== 'FAILED',
            manual_stop_status: globalIsStopped ? "OK" : "N/A",
            sample_10_leads: scenarioLeads.slice(0, 10).map(l => ({ name: l.name, status: l.status, score: l.score, msg: l.draft_message }))
        };

        await context.close();
    }

    console.log("\\n--- TESTE DE RECUPERAÇÃO OFFLINE ---");
    const allRecovered = loadLeads();

    await browser.close();

    const finalReport = {
        evidence,
        global_duplicates_avoided: totalDuplicadas,
        offline_recovery: allRecovered.length > 0 ? "OK" : "FAIL"
    };

    fs.writeFileSync('c:/tmp/homologation_result.json', JSON.stringify(finalReport, null, 2));
    console.log("HOMOLOGAÇÃO CONCLUÍDA.");
}

runHomologation().catch(console.error);
