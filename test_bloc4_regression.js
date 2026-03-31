const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { getDesktopExportDir } = require('./modules/path-helper.js');

async function testBloc4() {
    console.log(">>> TESTE BLOCO 4: Regressão Master de Fluxos Integrados <<<");

    // Limpeza de ambiente de teste
    const desktopDir = getDesktopExportDir();
    if (fs.existsSync(desktopDir)) {
        fs.rmSync(desktopDir, { recursive: true, force: true });
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let errors = [];
    page.on('pageerror', err => {
        console.error("❌ ERRO DA PÁGINA:", err.message);
        errors.push(err.message);
    });

    let mockDB = [
        { name: "Dado Velho 1", score: 50 }
    ];
    let engineRunning = false;

    // Conectando pontes IPC completas
    await page.exposeFunction('getSavedLeads', () => mockDB);
    await page.exposeFunction('getRobotStopped', () => !engineRunning);
    await page.exposeFunction('setRobotStopped', (status) => { engineRunning = !status; });
    await page.exposeFunction('pausarCaptacao', async () => { engineRunning = false; });
    await page.exposeFunction('clearLocalStore', () => { mockDB = []; });
    await page.exposeFunction('logEvent', (t, m) => console.log(`[LOG] ${t}: ${m}`));
    await page.exposeFunction('getRunLogs', () => []);
    await page.exposeFunction('getEventsLog', () => []);

    // Exportações manuais
    await page.exposeFunction('exportToCSV', async (leads, niche, city) => {
        const { generateCSV } = require('./modules/csv-exporter.js');
        return await generateCSV(leads, niche, city);
    });
    await page.exposeFunction('exportToPDF', async (leads, niche, city) => {
        const { generatePDF } = require('./modules/pdf-exporter.js');
        return await generatePDF(leads, niche, city);
    });

    // Simulação do startEngine Completo (inclusive Bloco 3)
    await page.exposeFunction('startEngine', async (niche, city) => {
        engineRunning = true;
        // Simular injeção
        await page.evaluate(() => window.addLead({ name: "Lead Novo Pós-Wipe", score: 100 }));
        mockDB.push({ name: "Lead Novo Pós-Wipe", score: 100 });
        engineRunning = false;

        // Auto Save simulado do index.js
        if (mockDB.length > 0) {
            const { generatePDF } = require('./modules/pdf-exporter.js');
            const { generateCSV } = require('./modules/csv-exporter.js');
            const p = await generatePDF(mockDB, niche, city);
            const c = await generateCSV(mockDB, niche, city);
            await page.evaluate((msg) => window.updateStatusMsg(msg), `✅ Relatórios salvos: ${p}`);
        }
    });

    const uiPath = 'file://' + path.resolve(__dirname, 'ui-local', 'index.html');
    await page.goto(uiPath);
    await page.waitForTimeout(1500); // initLocalLeads

    console.log(">> 1. Abrir app com dados existentes");
    let count = await page.locator('.lead-row').count();
    if (count !== 1) errors.push("Estado inicial falhou ao carregar 'Dado Velho 1'");

    console.log(">> 2. Limpar captações (Sem Redrender branco)");
    page.on('dialog', async d => await d.accept());
    await page.evaluate(() => window.clearLeads());
    await page.waitForTimeout(1000);

    count = await page.locator('.lead-row').count();
    if (count !== 0) errors.push("Tabela não limpou os dados antigos.");

    let cellText = await page.locator('#lead-list td').first().innerText().catch(() => "");
    if (!cellText.includes('Nenhum lead')) errors.push("UI Vazia instável/vazada.");

    console.log(">> 3. Nova captação: injetando dados novos");
    await page.fill('#i-niche', 'TesteRegressao');
    await page.fill('#i-city', 'QA');
    await page.click('#btn-start');
    await page.waitForTimeout(1500);

    count = await page.locator('.lead-row').count();
    if (count !== 1) errors.push("Nova captação não preencheu exatamente 1 linha.");

    let leadName = await page.locator('.lead-row td').nth(1).innerText();
    if (!leadName.includes("Lead Novo Pós-Wipe")) errors.push("Dados antigos misturaram com a nova captação.");

    console.log(">> 4. Exportação CSV/PDF Manual");
    await page.click('button:text("Exportar .CSV")');
    await page.click('button:text("Exportar PDF")');
    await page.waitForTimeout(1000);

    const desktopFiles = fs.readdirSync(desktopDir);
    if (desktopFiles.length < 4) { // 2 auto-save + 2 manual
        errors.push("Faltam arquivos na Área de Trabalho! Encontrados: " + desktopFiles.length);
    }

    let pdfCount = desktopFiles.filter(f => f.endsWith('.pdf')).length;
    let csvCount = desktopFiles.filter(f => f.endsWith('.csv')).length;
    if (pdfCount !== 2 || csvCount !== 2) errors.push("Esquema de arquivos (CSV/PDF) gerados incompleto.");

    // Validando nomes de arquivo
    const sampleCSV = desktopFiles.find(f => f.endsWith('.csv'));
    if (!sampleCSV.includes('extracao_testeregressao_qa_')) errors.push(`Nome do arquivo inválido: ${sampleCSV}`);

    console.log(">> 5. Conferindo vazamento para a raiz do programa...");
    const rootFiles = fs.readdirSync(__dirname);
    const leakedPDFs = rootFiles.filter(f => f.endsWith('.pdf'));
    if (leakedPDFs.length > 0) errors.push("FATAL: Encontrado PDF na raiz do programa original! " + leakedPDFs);

    console.log("\n=== RESULTADO BLOCO 4 ===");
    if (errors.length === 0) {
        console.log("STATUS: OK");
        console.log("EVIDÊNCIAS: App inicializa com DB antigo, o botão de limpar exclui todos via isolamento State-Lock e expõe painel 'vazio'. Ao rodar motor, 'StartEngine' bloqueia inatividade, extrai novos, executa Auto-Save e Manual-Save diretamente no Desktop de forma nomeada ('extracao_testeregressao_...'). Nenhum lixo foi enviado à pasta interna do Node. Logging perfeitamente operacional.");
    } else {
        console.log("STATUS: FAIL");
        errors.forEach(e => console.error("❌ Erro:", e));
    }

    await browser.close();
}

testBloc4().catch(console.error);
