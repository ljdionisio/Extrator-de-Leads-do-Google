/**
 * Teste real do auditor profundo — "Supermercado Ponto Bom" em "Peruíbe"
 * 
 * 1. Busca via searchSingleCompany para obter URL real
 * 2. Audita via auditCompany com URL real
 * 3. Valida rating, reviews, links sociais
 */
const { chromium } = require('playwright');
const { searchSingleCompany } = require('../modules/single-search.js');
const { auditCompany } = require('../modules/company-auditor.js');

async function runTest() {
    console.log('🧪 Teste: Auditor Profundo — Supermercado Ponto Bom, Peruíbe\n');

    const browser = await chromium.launch({ headless: true });

    try {
        // Fase 1: Buscar candidato para obter URL real
        console.log('📍 Fase 1: Buscando candidato no Google Maps...');
        const candidates = await searchSingleCompany('Supermercado Ponto Bom', 'Peruibe', browser, 3);

        if (!candidates || candidates.length === 0) {
            console.error('❌ FALHA: nenhum candidato encontrado na busca');
            process.exit(1);
        }

        const target = candidates[0];
        console.log(`   ✅ Candidato: ${target.name} — ${target.google_maps_url?.substring(0, 60)}...\n`);

        // Fase 2: Auditoria profunda
        console.log('🔍 Fase 2: Auditor profundo...');
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
        const page = await context.newPage();

        const result = await auditCompany(page, target.google_maps_url, { tabWaitMs: 5000 });
        await context.close();

        if (!result) {
            console.error('❌ FALHA: auditCompany retornou null');
            process.exit(1);
        }

        // Fase 3: Relatório
        console.log('\n📊 Resultado da auditoria profunda:');
        console.log(`   Nome:      ${result.name}`);
        console.log(`   Endereço:  ${result.address}`);
        console.log(`   Telefone:  ${result.phone}`);
        console.log(`   Website:   ${result.website || '(nenhum)'}`);
        console.log(`   Categoria: ${result.categoria_maps}`);
        console.log(`   Rating:    ${result.rating}`);
        console.log(`   Reviews:   ${result.reviews}`);
        console.log(`   Instagram: ${result.instagram || '(não observado)'} [${result.instagram_source || ''}]`);
        console.log(`   Facebook:  ${result.facebook || '(não observado)'}`);
        console.log(`   WhatsApp:  ${result.whatsapp || '(não observado)'}`);
        console.log(`   Last Post: ${result.last_post || '(não observado)'}`);
        console.log(`   Snippets:  ${(result.review_snippets || []).length} avaliações capturadas`);
        console.log(`   Negativas: ${(result.negative_reviews || []).length}`);
        console.log(`   Warnings:  ${result.warnings.length > 0 ? result.warnings.join(', ') : 'nenhum'}`);
        console.log(`   Confiança: ${JSON.stringify(result.confidence)}`);
        console.log(`   Limitações: ${result.limitations.length > 0 ? result.limitations.join('; ') : 'nenhuma'}`);
        console.log(`   Source:    ${result.source}`);

        // Fase 4: Validações
        console.log('\n--- VALIDAÇÕES ---');
        let ok = true;

        if (result.rating && result.rating > 0) {
            console.log(`✅ Rating: ${result.rating}`);
        } else {
            console.error('❌ Rating não capturado');
            ok = false;
        }

        if (result.reviews && result.reviews > 100) {
            console.log(`✅ Reviews: ${result.reviews}`);
        } else {
            console.error(`❌ Reviews insuficientes: ${result.reviews}`);
            ok = false;
        }

        if (result.name && result.name.toLowerCase().includes('ponto')) {
            console.log(`✅ Nome: ${result.name}`);
        } else {
            console.error(`❌ Nome inesperado: ${result.name}`);
            ok = false;
        }

        if (result.source === 'google_maps_deep') {
            console.log('✅ Source: google_maps_deep');
        }

        const hasSocial = result.instagram || result.facebook || result.whatsapp;
        console.log(`${hasSocial ? '✅' : '⚠️'} Links sociais: ${hasSocial ? 'encontrados' : 'não observados (pode ser limitação do Maps)'}`);

        console.log(`\n${ok ? '🎉 TESTE PASSOU' : '💥 TESTE FALHOU'}`);
        process.exit(ok ? 0 : 1);

    } catch (err) {
        console.error('💥 ERRO:', err.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

runTest();
