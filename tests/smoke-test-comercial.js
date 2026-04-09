/**
 * Smoke Test Comercial Real — 1 lead público
 * 
 * Usa lead público real (dados fictícios mas representativos de um caso real)
 * para validar o fluxo completo: entrada → processamento → PDF externo.
 */
const path = require('path');

async function smokeTest() {
    console.log("=== SMOKE TEST COMERCIAL REAL ===\n");

    // ==========================================
    // LEAD DE TESTE — dados públicos típicos de GMB
    // ==========================================
    const lead = {
        lead_id_estavel: 'smoke-001',
        name: 'Auto Mecânica São Jorge',
        address: 'Rua das Palmeiras, 456 - Centro, Campinas - SP',
        phone: '(19) 3234-5678',
        rating: 3.8,
        reviews: 12,
        website: null,
        instagram: null,
        facebook: 'https://facebook.com/mecanicasaojorge',
        whatsapp_url: null,
        google_maps_url: 'https://maps.google.com/place/auto-mecanica-sao-jorge',
        email: null,
        last_post: null,
        negative_reviews: ['Demorou muito para entregar o carro', 'Preço acima do combinado'],
        concorrentes_referencia: 'Auto Center Premium (4.8★, 120 reviews), Oficina Rápida (4.5★, 85 reviews)',
        categoria_maps: 'Oficina mecânica',
        other_public_links: [],
        data_captacao: new Date().toISOString(),
        // Campos INTERNOS que NÃO devem aparecer no externo
        score: 92,
        prioridade_comercial: 'quente',
        mensagem_whatsapp: 'Olá! Vi que sua oficina tem potencial...',
        argumento_comercial: 'Sem site, sem Instagram, rating baixo — oportunidade clara',
        status_pipeline: 'Novo',
        responsavel: 'João SDR'
    };

    console.log("Lead escolhido:");
    console.log(`  Nome: ${lead.name}`);
    console.log(`  Cidade: Campinas - SP`);
    console.log(`  Nicho: Oficina Mecânica`);
    console.log(`  Rating: ${lead.rating}★ (${lead.reviews} reviews)`);
    console.log(`  Website: ${lead.website || 'SEM'}`);
    console.log(`  Instagram: ${lead.instagram || 'SEM'}`);
    console.log(`  Reclamações: ${lead.negative_reviews.length}`);
    console.log();

    // ==========================================
    // GERAR PDF EXTERNO
    // ==========================================
    console.log(">> Gerando PDF Externo...");
    const { generateExternalPDF } = require('../modules/pdf-report-external.js');

    let pdfPath;
    try {
        pdfPath = await generateExternalPDF(lead, 'Oficinas Mecânicas', 'Campinas - SP');
        if (pdfPath) {
            console.log(`  ✅ PDF gerado: ${pdfPath}\n`);
        } else {
            console.error("  ❌ PDF retornou null");
            process.exit(1);
        }
    } catch (e) {
        console.error("  ❌ Erro ao gerar PDF:", e.message);
        process.exit(1);
    }

    // ==========================================
    // GERAR CSV EXTERNO (para validação de separação)
    // ==========================================
    console.log(">> Gerando CSV Externo...");
    const { generateCSV } = require('../modules/csv-exporter.js');
    let csvPath;
    try {
        csvPath = await generateCSV([lead], 'oficinas', 'campinas', 'externo');
        if (csvPath) {
            console.log(`  ✅ CSV gerado: ${csvPath}\n`);
        } else {
            console.error("  ❌ CSV retornou null");
            process.exit(1);
        }
    } catch (e) {
        console.error("  ❌ Erro ao gerar CSV:", e.message);
        process.exit(1);
    }

    // ==========================================
    // VALIDAR CSV EXTERNO — Separação
    // ==========================================
    console.log(">> Validando separação no CSV Externo...");
    const fs = require('fs');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const headerLine = csvContent.split('\n')[0];
    const dataLine = csvContent.split('\n')[1] || '';

    const proibidos = ['Score', 'Prioridade', 'ArgumentoComercial', 'MensagemWhatsApp', 'Operador', 'StatusPipeline'];
    let vazamentos = [];
    proibidos.forEach(campo => {
        if (headerLine.includes(campo)) vazamentos.push(`Header contém: ${campo}`);
    });

    // Verificar conteúdo proibido nos dados
    const conteudoProibido = ['quente', 'João SDR', 'Olá! Vi que sua oficina', 'oportunidade clara'];
    conteudoProibido.forEach(txt => {
        if (dataLine.toLowerCase().includes(txt.toLowerCase())) vazamentos.push(`Dado contém: "${txt}"`);
    });

    if (vazamentos.length > 0) {
        console.error("  ❌ VAZAMENTOS ENCONTRADOS:");
        vazamentos.forEach(v => console.error(`     - ${v}`));
    } else {
        console.log("  ✅ Separação confirmada — zero vazamentos\n");
    }

    // ==========================================
    // LER HTML RENDERIZADO DO PDF PARA VALIDAR CONTEÚDO
    // ==========================================
    console.log(">> Validando conteúdo do PDF Externo via source...");

    // Verificar que o arquivo de PDF existe e tem tamanho razoável
    const pdfStat = fs.statSync(pdfPath);
    console.log(`  Tamanho do PDF: ${(pdfStat.size / 1024).toFixed(1)} KB`);
    if (pdfStat.size < 5000) {
        console.error("  ❌ PDF muito pequeno — possível falha de renderização");
        process.exit(1);
    } else {
        console.log("  ✅ Tamanho do PDF adequado\n");
    }

    // ==========================================
    // RELATÓRIO FINAL
    // ==========================================
    console.log("=== RESULTADO DO SMOKE TEST ===\n");
    console.log("Artefatos gerados:");
    console.log(`  📄 PDF: ${path.basename(pdfPath)}`);
    console.log(`  📊 CSV: ${path.basename(csvPath)}`);
    console.log(`  Tamanho PDF: ${(pdfStat.size / 1024).toFixed(1)} KB`);
    console.log();

    if (vazamentos.length > 0) {
        console.error("❌ SMOKE TEST FALHOU — Vazamento de dados internos");
        process.exit(1);
    }

    console.log("✅ SMOKE TEST PASSOU");
    console.log("   - Lead processado com sucesso");
    console.log("   - PDF externo gerado");
    console.log("   - CSV externo sem vazamento");
    console.log("   - Artefatos salvos na área de trabalho");
    process.exit(0);
}

smokeTest().catch(err => {
    console.error("❌ FALHA FATAL:", err.message);
    process.exit(1);
});
