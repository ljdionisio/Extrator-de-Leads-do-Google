/**
 * Teste de Campo Real — Extração headless direta
 * Usa Playwright para buscar leads no Google Maps sem depender da UI
 * 
 * Uso: node tests/field-test.js "dentista" "Peruibe"
 */
const { chromium } = require('playwright');
const path = require('path');
const crypto = require('crypto');

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function fieldTest(niche, city) {
    console.log(`\n=== TESTE DE CAMPO REAL ===`);
    console.log(`Nicho: ${niche}`);
    console.log(`Cidade: ${city}`);
    console.log(`Data: ${new Date().toLocaleString('pt-BR')}\n`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 900, height: 800 }, locale: 'pt-BR' });
    const page = await context.newPage();

    const query = `${niche} em ${city}`;
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}/`;

    console.log(`>> Buscando: "${query}"`);
    console.log(`>> URL: ${url}\n`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Aguarda feed de resultados
    console.log(`>> Aguardando resultados...`);
    await page.waitForSelector('div[role="feed"]', { timeout: 15000 }).catch(() => {
        console.log('   ⚠️ Feed não encontrado, tentando continuar...');
    });
    await delay(3000);

    // Scroll para carregar mais
    const feed = await page.$('div[role="feed"]');
    if (feed) {
        for (let i = 0; i < 3; i++) {
            await feed.evaluate(el => el.scrollBy(0, 800));
            await delay(1500);
        }
    }

    // Extrair links dos estabelecimentos
    const hrefs = await page.$$eval('a[href*="/maps/place/"]', links =>
        [...new Set(links.map(a => a.href).filter(h => h.includes('/maps/place/')))]
    );

    console.log(`>> ${hrefs.length} estabelecimentos encontrados\n`);

    const leads = [];
    const maxLeads = Math.min(hrefs.length, 8); // limitar a 8 para speed

    for (let i = 0; i < maxLeads; i++) {
        try {
            console.log(`>> [${i + 1}/${maxLeads}] Extraindo dados...`);
            await page.goto(hrefs[i], { waitUntil: 'domcontentloaded', timeout: 20000 });
            await delay(2000);

            const data = await page.evaluate(() => {
                const name = document.querySelector('h1')?.textContent?.trim() || '';
                const ratingEl = document.querySelector('span[role="img"]');
                const ratingText = ratingEl?.getAttribute('aria-label') || '';
                const ratingMatch = ratingText.match(/([\d,\.]+)/);
                const rating = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : 0;

                const reviewsEl = document.querySelector('span[role="img"] + span > span');
                const reviewsText = reviewsEl?.textContent || '0';
                const reviews = parseInt(reviewsText.replace(/[^\d]/g, '')) || 0;

                const addressEl = document.querySelector('button[data-item-id="address"]');
                const address = addressEl?.textContent?.trim() || '';

                const phoneEl = document.querySelector('button[data-item-id*="phone"]');
                const phone = phoneEl?.textContent?.trim() || '';

                const websiteEl = document.querySelector('a[data-item-id="authority"]');
                const website = websiteEl?.href || '';

                const categoryEl = document.querySelector('button[jsaction*="category"]');
                const category = categoryEl?.textContent?.trim() || '';

                return { name, rating, reviews, address, phone, website, category };
            });

            if (data.name) {
                data.id = crypto.randomBytes(4).toString('hex');
                leads.push(data);
                console.log(`   ✅ ${data.name} | ${data.rating}★ (${data.reviews}) | ${data.phone || 'sem tel'} | ${data.website ? 'TEM SITE' : 'SEM SITE'}`);
            }
        } catch (e) {
            console.log(`   ⚠️ Erro ao extrair: ${e.message.substring(0, 50)}`);
        }
    }

    await browser.close();

    console.log(`\n=== RESULTADO ===`);
    console.log(`Total de leads: ${leads.length}`);

    if (leads.length === 0) {
        console.log('\n❌ Nenhum lead capturado. Verifique conexão ou tente outro nicho/cidade.');
        process.exit(1);
    }

    // Gerar PDF externo do primeiro lead
    console.log(`\n>> Gerando PDF externo para: ${leads[0].name}...`);
    const { generateExternalPDF } = require('../modules/pdf-report-external.js');
    const pdfPath = await generateExternalPDF(leads[0], niche, city);

    if (pdfPath) {
        const fs = require('fs');
        const size = (fs.statSync(pdfPath).size / 1024).toFixed(1);
        console.log(`   ✅ PDF gerado: ${pdfPath} (${size} KB)`);
    } else {
        console.log(`   ❌ Falha ao gerar PDF`);
    }

    // Resumo
    console.log(`\n=== RESUMO DO TESTE DE CAMPO ===`);
    console.log(`Nicho: ${niche} | Cidade: ${city}`);
    console.log(`Leads capturados: ${leads.length}`);
    leads.forEach((l, i) => {
        console.log(`  ${i + 1}. ${l.name} — ${l.rating}★ (${l.reviews} reviews) — ${l.phone || 'sem telefone'} — ${l.website ? 'COM site' : 'SEM site'}`);
    });
    console.log(`PDF: ${pdfPath || 'não gerado'}`);
    console.log(`\n✅ TESTE DE CAMPO CONCLUÍDO`);

    process.exit(0);
}

const niche = process.argv[2] || 'dentista';
const city = process.argv[3] || 'Peruibe';
fieldTest(niche, city);
