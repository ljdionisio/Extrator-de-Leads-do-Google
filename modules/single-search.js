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
    let candidates = [];

    try {
        candidates = await _searchMaps(page, query, maxResults);

        // Se 0 resultados, tentar query simplificada (nome mais curto + cidade)
        if (candidates.length === 0) {
            const simplified = _simplifyQuery(companyName.trim(), city.trim());
            if (simplified !== query) {
                console.log(`   🔄 Retry com query simplificada: "${simplified}"`);
                candidates = await _searchMaps(page, simplified, maxResults);
            }
        }

        // Se ainda 0, tentar apenas as palavras-chave mais relevantes
        if (candidates.length === 0) {
            const keywords = companyName.trim().split(/\s+/).filter(w => w.length > 3).slice(0, 2).join(' ');
            if (keywords && keywords !== companyName.trim()) {
                const lastTry = `${keywords} ${city.trim()}`;
                console.log(`   🔄 Retry com palavras-chave: "${lastTry}"`);
                candidates = await _searchMaps(page, lastTry, maxResults);
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

/**
 * Simplifica query removendo palavras genéricas como "Super", "mercado", "loja", etc.
 */
function _simplifyQuery(name, city) {
    const stopwords = ['super', 'mercado', 'supermercado', 'loja', 'casa', 'ponto', 'comercial',
        'empresa', 'restaurante', 'padaria', 'bar', 'posto', 'auto', 'centro',
        'grande', 'mini', 'mega', 'hiper', 'novo', 'nova', 'velho', 'velha',
        'do', 'da', 'de', 'dos', 'das', 'e', 'o', 'a', 'os', 'as', 'em', 'no', 'na'];
    const words = name.toLowerCase().split(/\s+/);
    const meaningful = words.filter(w => !stopwords.includes(w) && w.length > 2);
    if (meaningful.length > 0) {
        return `${meaningful.join(' ')} ${city}`;
    }
    return `${name} ${city}`;
}

/**
 * Executa busca no Google Maps e retorna candidatos
 */
async function _searchMaps(page, query, maxResults) {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}/`;
    await page.goto(searchUrl, { timeout: 20000 });

    // Verificar se redirecionou para resultado único (match direto)
    await delay(2500);
    const isDirectPlace = await page.locator('h1.DUwDvf').first().isVisible().catch(() => false);
    const hasFeed = await page.locator('div[role="feed"]').first().isVisible().catch(() => false);

    const candidates = [];

    if (isDirectPlace && !hasFeed) {
        // Google Maps redirecionou direto para um lugar
        console.log(`   📍 Resultado direto (match único)`);
        const c = await _extractPlaceData(page, 0);
        if (c) {
            candidates.push(c);
            console.log(`   ✅ [1] ${c.name} — ${c.rating}⭐ (${c.reviews} reviews)`);
        }
        return candidates;
    }

    // Modo lista — espera feed carregar
    if (!hasFeed) {
        await page.waitForSelector('div[role="feed"]', { timeout: 8000 }).catch(() => { });
        await delay(1500);
    }

    // Scroll para carregar mais resultados
    try {
        const feed = page.locator('div[role="feed"]').first();
        if (await feed.isVisible().catch(() => false)) {
            await feed.evaluate(el => el.scrollTop = el.scrollHeight);
            await delay(1000);
        }
    } catch { /* ignore */ }

    // Coleta links dos resultados
    const placeLocators = await page.locator('a.hfpxzc').all();
    const hrefs = [];
    for (const p of placeLocators) {
        const href = await p.getAttribute('href').catch(() => null);
        if (href) hrefs.push(href);
        if (hrefs.length >= maxResults) break;
    }

    console.log(`   📋 ${hrefs.length} candidato(s) encontrado(s)`);

    // Extrai dados de cada candidato
    for (let i = 0; i < hrefs.length; i++) {
        try {
            await page.goto(hrefs[i], { timeout: 15000 });
            await page.waitForSelector('h1.DUwDvf', { timeout: 8000 }).catch(() => { });
            const c = await _extractPlaceData(page, i, hrefs[i]);
            if (c) {
                candidates.push(c);
                console.log(`   ✅ [${i + 1}] ${c.name} — ${c.rating}⭐ (${c.reviews} reviews)`);
            }
        } catch (err) {
            console.log(`   ❌ [${i + 1}] Falhou: ${err.message}`);
        }
    }

    return candidates;
}

/**
 * Extrai dados de uma página de lugar do Google Maps
 */
async function _extractPlaceData(page, index, mapsUrl = null) {
    let name = null;
    try { name = await page.locator('h1.DUwDvf').first().innerText(); } catch { }
    if (!name) return null;

    let address = '';
    try {
        const addrRaw = await page.locator('button[data-item-id="address"]').first().innerText();
        if (addrRaw) address = addrRaw.replace('Copiou o endereço', '').trim();
    } catch { }

    let rating = 0, reviews = 0;
    try {
        const ratingEl = await page.locator('div.F7nice').first().innerText();
        if (ratingEl) {
            const match = ratingEl.match(/([\d.,]+).*?\(([\d.,]+)\)/);
            if (match) {
                rating = parseFloat(match[1].replace(',', '.'));
                reviews = parseInt(match[2].replace(/[.,]/g, ''));
            }
        }
    } catch { }

    let category = '';
    try { category = await page.locator('button[jsaction*="category"] span, span.DkEaL').first().innerText().catch(() => ''); } catch { }

    let phone = '';
    try {
        const phoneRaw = await page.locator('button[data-item-id^="phone:tel"]').first().innerText();
        if (phoneRaw) phone = phoneRaw.replace('Copiou o número de telefone', '').trim();
    } catch { }

    const url = mapsUrl || page.url();

    return { index, name, address, rating, reviews, category, phone, google_maps_url: url };
}

module.exports = { searchSingleCompany };
