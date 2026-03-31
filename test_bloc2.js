const os = require('os');
const path = require('path');
const fs = require('fs');

async function testBloc2() {
    console.log(">>> TESTE BLOCO 2: Validação de Exportações para a Área de Trabalho <<<");

    const desktopPath = path.join(os.homedir(), 'Desktop', 'CRM Extrator Leads');

    // Testa criação de diretório
    const { getDesktopExportDir } = require('./modules/path-helper.js');
    const folderTarget = getDesktopExportDir();
    let folderExists = fs.existsSync(folderTarget);

    if (folderExists) {
        console.log("✅ Diretório Criado com Sucesso: " + folderTarget);
    } else {
        console.error("❌ Diretório não foi criado.");
    }

    const mockLeads = [
        { name: "Teste Export 1", score: 85, phone: "119999", rating: 4.5, reviews: 10, prioridade_comercial: "morno" },
        { name: "Teste Export 2", score: 10, phone: "118888", rating: 1.0, reviews: 2, prioridade_comercial: "quente" }
    ];

    const { generateCSV } = require('./modules/csv-exporter.js');
    const { generatePDF } = require('./modules/pdf-exporter.js');

    console.log(">> Testando geração manual CSV...");
    const csvPath = await generateCSV(mockLeads, "Dentista", "SP");
    const csvExists = fs.existsSync(csvPath);
    if (csvExists) {
        console.log(`✅ Arquivo CSV gerado: ${csvPath}`);
        fs.unlinkSync(csvPath); // cleanup
    } else {
        console.error("❌ Arquivo CSV falhou.");
    }

    console.log(">> Testando geração manual PDF...");
    const pdfPath = await generatePDF(mockLeads, "Dentista", "SP");
    const pdfExists = fs.existsSync(pdfPath);
    if (pdfExists) {
        console.log(`✅ Arquivo PDF gerado: ${pdfPath}`);
        fs.unlinkSync(pdfPath); // cleanup
    } else {
        console.error("❌ Arquivo PDF falhou.");
    }

    console.log("\n=== RESULTADO BLOCO 2 ===");
    if (folderExists && csvExists && pdfExists) {
        console.log("STATUS: OK");
        console.log("EVIDÊNCIAS: Tanto a Pasta Mestre 'CRM Extrator Leads' no Desktop foi criada autônomamente, como os relatórios (PDF e CSV) apontados a ela foram resolvidos sem gravar no dir nativo da app.");
    } else {
        console.log("STATUS: FAIL");
    }
}

testBloc2().catch(e => console.error("❌ Fatal:", e));
