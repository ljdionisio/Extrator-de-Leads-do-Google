const { chromium } = require('playwright');
const path = require('path');

async function testBloc1() {
    console.log(">>> TESTE BLOCO 1: Validação do Limpar Captações <<<");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('pageerror', err => {
        console.error("❌ ERRO NO CONSOLE DA PÁGINA:", err.message);
    });

    let leadsDB = [];
    let engineRunning = true;

    await page.exposeFunction('getSavedLeads', () => leadsDB);
    await page.exposeFunction('getRobotStopped', () => !engineRunning);
    await page.exposeFunction('setRobotStopped', (status) => { engineRunning = !status; });
    await page.exposeFunction('pausarCaptacao', async () => {
        console.log("[MOCK] Motor pausado via botão Limpar");
        engineRunning = false;
    });
    await page.exposeFunction('clearLocalStore', async () => {
        console.log("[MOCK] clearLocalStore chamado. Simulando delay de DB...");
        await new Promise(r => setTimeout(r, 500));
        leadsDB = [];
    });
    await page.exposeFunction('logEvent', (type, msg) => console.log(`[MOCK] Event: ${msg}`));
    await page.exposeFunction('getRunLogs', () => []);
    await page.exposeFunction('getEventsLog', () => []);

    // Setup initial button display to trigger pausarCaptacao correctly
    await page.addInitScript(() => {
        window.addEventListener('DOMContentLoaded', () => {
            document.getElementById('btn-stop').style.display = 'block';
        });
    });

    const uiPath = 'file://' + path.resolve(__dirname, 'ui-local', 'index.html');
    await page.goto(uiPath);
    await page.waitForTimeout(1000);

    console.log(">> Injetando leads na tela...");
    await page.evaluate(() => {
        window.addLead({ name: "Empresa 1", score: 100 });
        window.addLead({ name: "Empresa 2", score: 80 });
    });

    let rowCount = await page.locator('.lead-row').count();
    console.log(`>> Linhas injetadas: ${rowCount} (Esperado: 2)`);

    console.log(">> Simulando clique no Limpar Captações e uma injeção paralela...");

    page.on('dialog', async dialog => await dialog.accept());

    // Aciona a limpeza mas não trava
    await page.evaluate(() => { window.clearLeads(); });

    await page.waitForTimeout(50);
    // Tenta bypassar o lock
    await page.evaluate(() => {
        window.addLead({ name: "Lead Fantasma Injetado", score: 10 });
    });

    await page.waitForTimeout(1000);

    console.log(">> Verificando estabilidade do Empty State...");
    rowCount = await page.locator('.lead-row').count();
    let emptyStateText = '';
    try {
        emptyStateText = await page.locator('#lead-list td').first().innerText();
    } catch (e) { }

    let ok = true;
    if (rowCount > 0) {
        console.error(`❌ FAIL: Vazaram ${rowCount} leads para a UI após limpeza. O Lock falhou.`);
        ok = false;
    }
    if (!emptyStateText.includes("Nenhum lead")) {
        console.error("❌ FAIL: Empty state não foi renderizado apropriadamente: " + emptyStateText);
        ok = false;
    }

    console.log(`>> Texto Empty State lido: "${emptyStateText}"`);

    console.log(">> Testando injeção após a limpeza concluída...");
    await page.evaluate(() => {
        window.addLead({ name: "Empresa 3", score: 90 });
    });
    await page.waitForTimeout(200);
    rowCount = await page.locator('.lead-row').count();
    if (rowCount !== 1) {
        console.error(`❌ FAIL: Esperava 1 lead novo pós-limpeza, encontrou ${rowCount}`);
        ok = false;
    } else {
        console.log(">> Novo lead injetado com sucesso no estado limpo.");
    }

    console.log("\n=== RESULTADO BLOCO 1 ===");
    if (ok) {
        console.log("STATUS: OK");
        console.log("EVIDÊNCIAS: O Lock `isClearing` bloqueou o 'Lead Fantasma', reset de estado evitou tela branca, componente de feedback visível, e tabela recuperada para novas injeções.");
    } else {
        console.log("STATUS: FAIL");
    }

    await browser.close();
}

testBloc1().catch(console.error);
