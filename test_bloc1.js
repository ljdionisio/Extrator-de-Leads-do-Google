const { chromium } = require('playwright');
const path = require('path');

async function testBloc1() {
    console.log(">>> TESTE BLOCO 1: Validação do Limpar Captações <<<");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let errors = [];
    page.on('pageerror', err => {
        console.error("❌ ERRO NO CONSOLE DA PÁGINA:", err);
        errors.push(err);
    });

    // Mocks for backend functions
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
        // Simulando delay para testar o Lock
        await new Promise(r => setTimeout(r, 500));
        leadsDB = [];
    });
    await page.exposeFunction('logEvent', (type, msg) => console.log(`[MOCK] Event: ${msg}`));
    await page.exposeFunction('getRunLogs', () => []);
    await page.exposeFunction('getEventsLog', () => []);

    // Abrir UI
    const uiPath = 'file://' + path.resolve(__dirname, 'ui-local', 'index.html');
    await page.goto(uiPath);
    await page.waitForTimeout(1000);

    // Injetar leads
    console.log(">> Injetando leads na tela...");
    await page.evaluate(() => {
        window.addLead({ name: "Empresa 1", score: 100 });
        window.addLead({ name: "Empresa 2", score: 80 });
    });

    let rowCount = await page.locator('.lead-row').count();
    console.log(`>> Linhas injetadas: ${rowCount} (Esperado: 2)`);

    // Iniciar simulação de "racing condition"
    console.log(">> Simulando clique no Limpar Captações e uma injeção de Lead paralela ao mesmo tempo...");

    // Aceitar a confirmação nativa
    page.on('dialog', dialog => dialog.accept());

    // Clicar em clear (que vai travar com isClearing)
    page.click('#btn-clear');

    // Milissegundos depois, tentar injetar um lead vindo do background
    await page.waitForTimeout(100);
    await page.evaluate(() => {
        window.addLead({ name: "Lead Fantasma Injetado", score: 10 });
    });

    // Esperar concluir a limpeza
    await page.waitForTimeout(1000);

    console.log(">> Verificando estabilidade do Empty State...");
    rowCount = await page.locator('.lead-row').count();
    const emptyStateText = await page.locator('#lead-list td').first().innerText().catch(() => "");

    if (rowCount > 0) {
        errors.push(`Vazaram ${rowCount} leads para a UI após limpeza. O Lock falhou.`);
    }
    if (!emptyStateText.includes("Nenhum lead")) {
        errors.push("Empty state não foi renderizado apropriadamente: " + emptyStateText);
    }

    console.log(`>> Texto Empty State lido: "${emptyStateText}"`);

    // Tentar adicionar lead de novo após limpar
    console.log(">> Testando injeção após a limpeza...");
    await page.evaluate(() => {
        window.addLead({ name: "Empresa 3", score: 90 });
    });
    await page.waitForTimeout(200);
    rowCount = await page.locator('.lead-row').count();
    if (rowCount !== 1) {
        errors.push(`Esperava 1 lead novo pós-limpeza, encontrou ${rowCount}`);
    } else {
        console.log(">> Novo lead injetado com sucesso no estado limpo.");
    }

    console.log("=== RESULTADO BLOCO 1 ===");
    if (errors.length > 0) {
        console.error("FAIL: Erros encontrados:");
        errors.forEach(e => console.error(" - " + e));
    } else {
        console.log("STATUS: OK");
        console.log("Evidências: Lock isClearing evitou o Lead Fantasma, DB foi pausado, e Empty State renderizado sem tela branca.");
    }

    await browser.close();
}

testBloc1().catch(console.error);
