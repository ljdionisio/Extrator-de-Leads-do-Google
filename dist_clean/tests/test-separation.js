/**
 * Teste de Separação Interno vs Externo
 * 
 * Verifica que exportações externas NÃO contêm campos internos proibidos:
 * score, SDR, prioridade comercial, mensagem de prospecção, argumento de fechamento
 */

const CAMPOS_PROIBIDOS_EXTERNO = [
    'Score', 'Prioridade', 'Pesquisa', 'StatusContato', 'DataUltimoEnvio',
    'ArgumentoComercial', 'MensagemWhatsApp', 'Repescado',
    'Operador', 'ObservacaoValidacao', 'StatusPipeline'
];

function testCSVExternalSeparation() {
    console.log(">> Teste: Separação CSV Externo...");
    const { generateCSV } = require('../modules/csv-exporter.js');

    const fakeLead = {
        lead_id_estavel: 'test-001',
        name: 'Empresa Teste',
        phone: '11999990000',
        address: 'Rua Teste 123',
        rating: 4.5,
        reviews: 30,
        score: 95,
        prioridade_comercial: 'quente',
        website: 'https://teste.com',
        instagram: 'https://instagram.com/teste',
        facebook: 'https://facebook.com/teste',
        google_maps_url: 'https://maps.google.com/teste',
        status_pipeline: 'Abordado',
        mensagem_whatsapp: 'Olá, vi seu perfil...',
        argumento_comercial: 'O cliente precisa de SEO',
        responsavel: 'João SDR',
        data_ultimo_envio: '2024-01-15',
        source_search_url: 'https://google.com/search?q=teste'
    };

    // Gerar CSV externo (modo síncrono via writeFileSync)
    const fs = require('fs');
    const path = require('path');

    // Criar dir temporário
    const tmpDir = path.join(__dirname, '..', 'tmp_test');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    // Monkey-patch para salvar em tmp
    const originalHelper = require('../modules/path-helper.js');
    const originalFn = originalHelper.getDesktopExportDir;
    originalHelper.getDesktopExportDir = () => tmpDir;

    let errors = [];

    try {
        // CSV Externo
        const csvPath = require('../modules/csv-exporter.js');
        // A função é async, mas usa writeFileSync internamente
        const result = generateCSV([fakeLead], 'teste', 'cidade', 'externo');

        // Esperar Promise resolver
        result.then(filePath => {
            if (!filePath) {
                errors.push("CSV externo retornou null");
                return report(errors, tmpDir);
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const headerLine = content.split('\n')[0];

            // Verificar campos proibidos no header
            CAMPOS_PROIBIDOS_EXTERNO.forEach(campo => {
                if (headerLine.includes(campo)) {
                    errors.push(`Campo proibido encontrado no CSV externo: ${campo}`);
                }
            });

            // Verificar que dados internos não estão no conteúdo
            const dataLine = content.split('\n')[1] || '';
            if (dataLine.includes('quente') || dataLine.includes('morno') || dataLine.includes('frio')) {
                errors.push("Temperatura comercial vazou para CSV externo");
            }
            if (dataLine.includes('João SDR') || dataLine.includes('Olá, vi seu perfil')) {
                errors.push("Dados de SDR/mensagem vazaram para CSV externo");
            }

            // Verificar campos OBRIGATÓRIOS no externo
            const camposObrigatorios = ['Empresa', 'Telefone', 'MapsURL', 'Rating'];
            camposObrigatorios.forEach(campo => {
                if (!headerLine.includes(campo)) {
                    errors.push(`Campo obrigatório ausente no CSV externo: ${campo}`);
                }
            });

            report(errors, tmpDir);
        }).catch(err => {
            errors.push("Erro ao gerar CSV externo: " + err.message);
            report(errors, tmpDir);
        });

    } catch (e) {
        errors.push("Exceção ao testar separação: " + e.message);
        report(errors, tmpDir);
    }

    // Restaurar helper
    originalHelper.getDesktopExportDir = originalFn;
}

function report(errors, tmpDir) {
    // Cleanup
    const fs = require('fs');
    try {
        const files = fs.readdirSync(tmpDir);
        files.forEach(f => fs.unlinkSync(require('path').join(tmpDir, f)));
        fs.rmdirSync(tmpDir);
    } catch (e) { }

    console.log("\n=== RESULTADO TESTE DE SEPARAÇÃO ===");
    if (errors.length > 0) {
        console.error(`❌ ${errors.length} VIOLAÇÃO(ÕES) DE SEPARAÇÃO:`);
        errors.forEach(e => console.error("   - " + e));
        process.exit(1);
    } else {
        console.log("✅ Separação interno/externo verificada — nenhum vazamento.");
        process.exit(0);
    }
}

testCSVExternalSeparation();
