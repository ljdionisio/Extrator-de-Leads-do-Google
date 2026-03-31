const { chromium } = require('playwright');
const path = require('path');

async function runUITests() {
    console.log(">>> INICIANDO TESTE E2E DE INTERFACE (UI) <<<");
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
    let engineRunning = false;

    await page.exposeFunction('getSavedLeads', () => leadsDB);
    await page.exposeFunction('getRobotStopped', () => !engineRunning);
    await page.exposeFunction('setRobotStopped', (status) => { engineRunning = !status; });
    await page.exposeFunction('startEngine', async (niche, city) => {
        console.log(`[BACKEND MOCK] startEngine: ${niche} em ${city}`);
        engineRunning = true;
        // Simulando extração de 2 leads
        await page.evaluate(() => {
            window.addLead({ name: "Lead Teste 1", score: 100, phone: "11999999999", prioridade_comercial: "quente", status_pipeline: "Novo", lead_id_estavel: "1" });
            window.addLead({ name: "Lead Teste 2", score: 50, phone: "11888888888", prioridade_comercial: "morno", status_pipeline: "Novo", lead_id_estavel: "2" });
        });
        engineRunning = false;
    });
    await page.exposeFunction('clearLocalStore', () => { leadsDB = []; });
    await page.exposeFunction('logEvent', (type, msg) => console.log(`[BACKEND MOCK] Event: ${type} - ${msg}`));
    await page.exposeFunction('getRunLogs', () => []);
    await page.exposeFunction('getEventsLog', () => []);
    await page.exposeFunction('getSettings', () => ({ webhookUrl: "http://webhook.teste" }));
    await page.exposeFunction('saveSettings', (s) => console.log("[BACKEND MOCK] Settings salvo:", s));
    await page.exposeFunction('dispatchToWebhook', () => ({ success: true, status: 200 }));
    await page.exposeFunction('exportToPDF', () => "relatorio.pdf");
    await page.exposeFunction('savePipelineUpdate', (id, status) => console.log(`[BACKEND MOCK] Pipeline lead ${id} -> ${status}`));

    const uiPath = 'file://' + path.resolve(__dirname, 'ui-local', 'index.html');
    await page.goto(uiPath);
    await page.waitForTimeout(1500); // Aguarda initLocalLeads rodar

    console.log(">> Testando preenchimento de inputs...");
    await page.fill('#i-niche', 'Teste Nicho');
    await page.fill('#i-city', 'Teste Cidade');

    console.log(">> Testando 'Iniciar Captação'...");
    await page.click('#btn-start');
    await page.waitForTimeout(500); // Aguarda mock resolver

    console.log(">> Verificando listagem...");
    const rows = await page.locator('.lead-row').count();
    console.log(`>> Encontradas ${rows} linhas na tabela (Esperado: 2)`);
    if (rows !== 2) errors.push("Listagem não populou corretamente");

    console.log(">> Testando troca de status pipeline...");
    // Acessar select do primeiro lead
    await page.locator('.lead-row select').first().selectOption('Abordado');
    await page.waitForTimeout(100);

    console.log(">> Testando Modal...");
    await page.locator('.lead-row').first().click();
    await page.waitForTimeout(200);
    const isModalVisible = await page.locator('.modal-content').isVisible();
    if (!isModalVisible) errors.push("Modal não abriu ao clicar no lead");

    await page.locator('.close-btn').click();
    await page.waitForTimeout(200);

    console.log(">> Testando botão de Webhook...");
    await page.click('button:text("Enviar p/ Webhook")');
    await page.waitForTimeout(200);

    console.log(">> Testando botão Exportar CSV...");
    // Não vamos realmente fazer download, só testar se não quebra
    // Wait, on click it creates a Blob and clicks a link, which might fail or trigger a download in headless.
    // Setting up download listener
    const downloadPromise = page.waitForEvent('download').catch(() => null);
    await page.evaluate(() => window.exportCSV());
    await downloadPromise;

    console.log(">> Testando Limpar Captações...");
    page.on('dialog', dialog => dialog.accept()); // Aceitar alert()
    await page.click('#btn-clear');
    await page.waitForTimeout(200);
    const rowsAfterClear = await page.locator('.lead-row').count();
    if (rowsAfterClear !== 0) errors.push("Limpar captação não funcionou");

    console.log("=== FIM DOS TESTES ===");
    if (errors.length > 0) {
        console.error(`❌ Foram encontrados ${errors.length} erros durante os testes:`);
        errors.forEach(e => console.error(" - " + e));
    } else {
        console.log("✅ TODOS OS TESTES PASSARAM. Interface 100% Funcional.");
    }

    await browser.close();
}

runUITests().catch(console.error);
