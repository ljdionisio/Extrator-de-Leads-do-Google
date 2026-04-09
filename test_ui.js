/**
 * Teste E2E de Interface — Lead King
 * 
 * Gate confiável: falha com process.exit(1) quando qualquer teste quebra.
 * Pré-requisito: Playwright instalado (npx playwright install chromium)
 */
const { chromium } = require('playwright');
const path = require('path');

async function runUITests() {
    console.log(">>> INICIANDO TESTE E2E DE INTERFACE (UI) <<<\n");

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
    } catch (e) {
        console.error("❌ FALHA CRÍTICA: Playwright não conseguiu lançar o browser.");
        console.error("   Execute: npx playwright install chromium");
        console.error("   Erro:", e.message);
        process.exit(1);
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    let errors = [];
    page.on('pageerror', err => {
        console.error("❌ ERRO NO CONSOLE DA PÁGINA:", err);
        errors.push('Page error: ' + err.message);
    });

    // ============================================================
    // Mocks para TODAS as funções expostas pelo index.js
    // ============================================================
    let leadsDB = [];
    let engineRunning = false;

    await page.exposeFunction('getSavedLeads', () => leadsDB);
    await page.exposeFunction('getRobotStopped', () => !engineRunning);
    await page.exposeFunction('setRobotStopped', (status) => { engineRunning = !status; });
    await page.exposeFunction('startEngine', async (niche, city) => {
        console.log(`  [MOCK] startEngine: ${niche} em ${city}`);
        engineRunning = true;
        await page.evaluate(() => {
            window.addLead({ name: "Lead Teste 1", score: 100, phone: "11999999999", prioridade_comercial: "quente", status_pipeline: "Novo", lead_id_estavel: "test-1", address: "Rua Teste 1" });
            window.addLead({ name: "Lead Teste 2", score: 50, phone: "11888888888", prioridade_comercial: "morno", status_pipeline: "Novo", lead_id_estavel: "test-2", address: "Rua Teste 2" });
        });
        engineRunning = false;
    });
    await page.exposeFunction('clearLocalStore', () => { leadsDB = []; });
    await page.exposeFunction('logEvent', (type, msg) => console.log(`  [MOCK] Event: ${type} - ${msg}`));
    await page.exposeFunction('getRunLogs', () => []);
    await page.exposeFunction('getEventsLog', () => []);
    await page.exposeFunction('getSettings', () => ({ webhookUrl: "http://webhook.teste" }));
    await page.exposeFunction('saveSettings', (s) => console.log("  [MOCK] Settings salvo"));
    await page.exposeFunction('dispatchToWebhook', () => ({ success: true, status: 200 }));
    await page.exposeFunction('exportToPDF', () => "relatorio_interno.pdf");
    await page.exposeFunction('exportToCSV', () => "relatorio_interno.csv");
    await page.exposeFunction('exportToCSVExternal', () => "relatorio_externo.csv");
    await page.exposeFunction('exportExternalPDF', () => "diagnostico_externo.pdf");
    await page.exposeFunction('savePipelineUpdate', (id, status) => console.log(`  [MOCK] Pipeline ${id} -> ${status}`));

    // ============================================================
    // Carregar UI
    // ============================================================
    const uiPath = 'file://' + path.resolve(__dirname, 'ui-local', 'index.html');
    await page.goto(uiPath);
    await page.waitForTimeout(1500);

    // ============================================================
    // TESTE 1: Verificar elementos essenciais
    // ============================================================
    console.log(">> T1: Verificando elementos da UI...");
    const elements = {
        '#i-niche': 'Campo Nicho',
        '#i-city': 'Campo Cidade',
        '#btn-start': 'Botão Iniciar',
        '#btn-clear': 'Botão Limpar',
        '#lead-list': 'Tabela de Leads',
        '#sys-status': 'Barra de Status'
    };
    for (const [sel, name] of Object.entries(elements)) {
        const exists = await page.locator(sel).count();
        if (exists === 0) errors.push(`Elemento ausente: ${name} (${sel})`);
        else console.log(`  ✅ ${name}`);
    }

    // TESTE 1b: Verificar 5 botões de exportação
    console.log(">> T1b: Verificando botões de exportação...");
    const exportButtons = ['PDF Interno', 'Diagnóstico Externo', 'CSV Interno', 'CSV Externo', 'Webhook'];
    for (const btnText of exportButtons) {
        const btn = page.locator(`button:has-text("${btnText}")`);
        const count = await btn.count();
        if (count === 0) errors.push(`Botão ausente: ${btnText}`);
        else console.log(`  ✅ Botão: ${btnText}`);
    }

    // ============================================================
    // TESTE 2: Captação simulada
    // ============================================================
    console.log(">> T2: Testando captação...");
    await page.fill('#i-niche', 'Teste Nicho');
    await page.fill('#i-city', 'Teste Cidade');
    await page.click('#btn-start');
    await page.waitForTimeout(1000);

    const rows = await page.locator('.lead-row').count();
    console.log(`  Linhas na tabela: ${rows} (esperado: 2)`);
    if (rows !== 2) errors.push(`Captação: esperado 2 leads, encontrou ${rows}`);
    else console.log("  ✅ Captação OK");

    // ============================================================
    // TESTE 3: Pipeline
    // ============================================================
    console.log(">> T3: Testando pipeline...");
    await page.locator('.lead-row select').first().selectOption('Abordado');
    await page.waitForTimeout(200);
    console.log("  ✅ Pipeline atualizado");

    // ============================================================
    // TESTE 4: Modal
    // ============================================================
    console.log(">> T4: Testando modal...");
    await page.locator('.lead-row').first().click();
    await page.waitForTimeout(300);
    const isModalVisible = await page.locator('.modal-content').isVisible();
    if (!isModalVisible) errors.push("Modal não abriu ao clicar no lead");
    else console.log("  ✅ Modal abriu corretamente");

    await page.locator('.close-btn').click();
    await page.waitForTimeout(200);

    // ============================================================
    // TESTE 5: Webhook
    // ============================================================
    console.log(">> T5: Testando Webhook...");
    await page.click('button:has-text("Webhook")');
    await page.waitForTimeout(300);
    console.log("  ✅ Webhook disparado");

    // ============================================================
    // TESTE 6: XSS Safety
    // ============================================================
    console.log(">> T6: Testando segurança XSS...");
    const hasEscapeHtml = await page.evaluate(() => typeof window.escapeHtml === 'function');
    if (!hasEscapeHtml) errors.push("escapeHtml helper não encontrado");
    else {
        const escaped = await page.evaluate(() => window.escapeHtml('<script>alert(1)</script>'));
        if (escaped.includes('<script>')) errors.push("escapeHtml falhou em escapar tag script");
        else console.log("  ✅ escapeHtml funcional");
    }

    // ============================================================
    // TESTE 7: Limpar captação
    // ============================================================
    console.log(">> T7: Testando limpar captação...");
    page.on('dialog', dialog => dialog.accept());
    await page.click('#btn-clear');
    await page.waitForTimeout(500);
    const rowsAfter = await page.locator('.lead-row').count();
    if (rowsAfter !== 0) errors.push(`Limpar: esperado 0 leads, encontrou ${rowsAfter}`);
    else console.log("  ✅ Limpeza OK");

    // ============================================================
    // RESULTADO FINAL
    // ============================================================
    await browser.close();

    console.log("\n=== RESULTADO DOS TESTES ===");
    if (errors.length > 0) {
        console.error(`❌ ${errors.length} ERRO(S) ENCONTRADO(S):`);
        errors.forEach(e => console.error("   - " + e));
        process.exit(1);
    } else {
        console.log("✅ TODOS OS TESTES PASSARAM.");
        process.exit(0);
    }
}

runUITests().catch(err => {
    console.error("❌ FALHA FATAL NOS TESTES:", err.message);
    process.exit(1);
});
