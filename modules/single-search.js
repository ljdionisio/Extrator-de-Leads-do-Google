/**
 * Single Search — Pesquisa individual de empresa por nome + cidade
 * 
 * Busca no Google Maps por "nome da empresa + cidade",
 * retorna até N candidatos com dados básicos para seleção do operador.
 * 
 * REGRA: NÃO faz auditoria completa. Apenas coleta dados visíveis na lista.
 * A auditoria completa + diagnóstico premium é feita DEPOIS da seleção.
 */

const delay = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * Busca candidatos no Google Maps para seleção manual
 * @param {string} companyName - Nome da empresa
 * @param {string} city - Cidade
 * @param {Object} browser - Instância Playwright browser
 * @param {number} maxResults - Máximo de candidatos (default 5)
 * @returns {Array<{name, address, rating, reviews, category, google_maps_url}>}
 */
async function searchSingleCompany(companyName, city, browser, maxResults = 5) {
    if (!companyName || !companyName.trim()) throw new Error('Nome da empresa é obrigatório');
    if (!city || !city.trim()) throw new Error('Cidade é obrigatória');

    const query = `${companyName.trim()} ${city.trim()}`;
    console.log(`\n🔍 PESQUISA INDIVIDUAL: "${query}" (máx ${maxResults} candidatos)`);

    const context = await browser.newContext({
        viewport: { width: 900, height: 800 },
        locale: 'pt-BR'
    });
    const page = await context.newPage();
    const candidates = [];

    try {
        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}/`;
        await page.goto(searchUrl, { timeout: 20000 });

        // Aguarda feed de resultados
        await page.waitForSelector('div[role="feed"]', { timeout: 10000 }).catch(() => { });
        await delay(2000);

        // Coleta links dos resultados
        const placeLocators = await page.locator('a.hfpxzc').all();
        const hrefs = [];
        for (const p of placeLocators) {
            const href = await p.getAttribute('href').catch(() => null);
            if (href) hrefs.push(href);
            if (hrefs.length >= maxResults) break;
        }

        console.log(`   📋 ${hrefs.length} candidato(s) encontrado(s)`);

        // Extrai dados básicos de cada candidato (sem auditoria completa)
        for (let i = 0; i < hrefs.length; i++) {
            try {
                await page.goto(hrefs[i], { timeout: 15000 });
                await page.waitForSelector('h1.DUwDvf', { timeout: 8000 }).catch(() => { });

                // Nome
                let name = null;
                try {
                    name = await page.locator('h1.DUwDvf').first().innerText();
                } catch (e) { /* skip */ }
                if (!name) continue;

                // Endereço
                let address = '';
                try {
                    const addrRaw = await page.locator('button[data-item-id="address"]').first().innerText();
                    if (addrRaw) address = addrRaw.replace('Copiou o endereço', '').trim();
                } catch (e) { /* skip */ }

                // Rating e reviews
                let rating = 0;
                let reviews = 0;
                try {
                    const ratingEl = await page.locator('div.F7nice').first().innerText();
                    if (ratingEl) {
                        const match = ratingEl.match(/([\d.,]+).*?\(([\d.,]+)\)/);
                        if (match) {
                            rating = parseFloat(match[1].replace(',', '.'));
                            reviews = parseInt(match[2].replace(/[.,]/g, ''));
                        }
                    }
                } catch (e) { /* skip */ }

                // Categoria
                let category = '';
                try {
                    category = await page.locator('button[jsaction*="category"] span, span.DkEaL').first().innerText().catch(() => '');
                } catch (e) { /* skip */ }

                // Telefone (para preview)
                let phone = '';
                try {
                    const phoneRaw = await page.locator('button[data-item-id^="phone:tel"]').first().innerText();
                    if (phoneRaw) phone = phoneRaw.replace('Copiou o número de telefone', '').trim();
                } catch (e) { /* skip */ }

                candidates.push({
                    index: i,
                    name,
                    address,
                    rating,
                    reviews,
                    category,
                    phone,
                    google_maps_url: hrefs[i]
                });

                console.log(`   ✅ [${i + 1}] ${name} — ${rating}⭐ (${reviews} reviews)`);

            } catch (err) {
                console.log(`   ❌ [${i + 1}] Falhou: ${err.message}`);
            }
        }

    } catch (err) {
        console.error('Erro na pesquisa individual:', err.message);
    } finally {
        await context.close().catch(() => { });
    }

    console.log(`   📊 Total: ${candidates.length} candidato(s) válido(s)\n`);
    return candidates;
}

module.exports = { searchSingleCompany };
