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
 * Extrai dados de uma página de lugar do Google Maps.
 * Navega para /maps/place/ se necessário (perfil completo com abas).
 * Parser contextual de reviews com 6 tentativas.
 */
async function _extractPlaceData(page, index, mapsUrl = null) {
    // Se estamos em /maps/search/ (perfil simplificado), navegar para /maps/place/
    const currentUrl = page.url();
    if (currentUrl.includes('/maps/search/') && !currentUrl.includes('/maps/place/')) {
        try {
            const placeCard = page.locator('a.hfpxzc').first();
            if (await placeCard.isVisible({ timeout: 3000 }).catch(() => false)) {
                const placeHref = await placeCard.getAttribute('href');
                if (placeHref && placeHref.includes('/maps/place/')) {
                    await page.goto(placeHref, { timeout: 15000 });
                    await page.waitForSelector('h1.DUwDvf', { timeout: 8000 }).catch(() => { });
                    await delay(2000);
                }
            }
        } catch { /* continua no modo simplificado */ }
    }

    let name = null;
    try { name = await page.locator('h1.DUwDvf').first().innerText(); } catch { }
    if (!name) return null;

    // Espera extra para dados lazy no perfil /maps/place/
    await delay(2000);

    let address = '';
    try {
        const addrRaw = await page.locator('button[data-item-id="address"]').first().innerText();
        if (addrRaw) address = addrRaw.replace('Copiou o endereço', '').trim();
    } catch { }

    let rating = 0, reviews = 0;
    let reviews_text = '';
    let reviews_source = 'not_observed';

    // === RATING ===

    // R1: F7nice texto direto
    try {
        const ratingEl = await page.locator('div.F7nice').first().innerText();
        if (ratingEl) {
            const match = ratingEl.match(/([\d.,]+).*?\(([\d.,]+)\)/);
            if (match) {
                rating = parseFloat(match[1].replace(',', '.'));
                const rv = parseInt(match[2].replace(/[.,]/g, ''));
                if (rv >= 10) { reviews = rv; reviews_text = ratingEl; reviews_source = 'f7nice_combined'; }
            } else {
                const rMatch = ratingEl.match(/([\d.,]+)/);
                if (rMatch) rating = parseFloat(rMatch[1].replace(',', '.'));
            }
        }
    } catch { }

    // R2: aria-label com "estrelas"
    if (!rating) {
        try {
            const ariaLabel = await page.locator('span[role="img"][aria-label*="estrela"], span[role="img"][aria-label*="star"]').first().getAttribute('aria-label');
            if (ariaLabel) {
                const m = ariaLabel.match(/([\d.,]+)/);
                if (m) rating = parseFloat(m[1].replace(',', '.'));
            }
        } catch { }
    }

    // === REVIEWS (parser contextual) ===

    // V1: button com aria-label "X avaliações" ou "X reviews"
    if (reviews === 0) {
        try {
            const btns = await page.$$eval('button[aria-label]', els =>
                els.map(e => e.getAttribute('aria-label')).filter(l => l && /avaliação|avaliações|review|reviews/i.test(l))
            );
            for (const label of btns) {
                const m = label.match(/([\d.,]+)\s*(?:avaliação|avaliações|review|reviews)/i);
                if (m) {
                    const parsed = parseInt(m[1].replace(/[.,]/g, ''));
                    if (parsed >= 5) { reviews = parsed; reviews_text = label; reviews_source = 'button_aria_label'; break; }
                }
            }
        } catch { }
    }

    // V2: Tab "Avaliações" aria-label (frequentemente contém contagem)
    if (reviews === 0) {
        try {
            const tabEl = page.getByRole('tab', { name: /Avaliações|Reviews/i });
            if (await tabEl.isVisible({ timeout: 2000 }).catch(() => false)) {
                const tabLabel = await tabEl.getAttribute('aria-label').catch(() => '');
                if (tabLabel) {
                    const m = tabLabel.match(/([\d.,]+)/);
                    if (m) {
                        const parsed = parseInt(m[1].replace(/[.,]/g, ''));
                        if (parsed >= 5) { reviews = parsed; reviews_text = tabLabel; reviews_source = 'tab_aria_label'; }
                    }
                }
            }
        } catch { }
    }

    // V3: Texto avaliável no painel — "X avaliações" contextual
    if (reviews === 0) {
        try {
            const mainText = await page.evaluate(() => {
                const el = document.querySelector('div[role="main"]');
                return el ? el.innerText.substring(0, 4000) : '';
            });
            const patterns = [
                /([\d.,]+)\s*(?:avaliações|avaliação|reviews|review|comentários)/i,
                /\(([\d.,]{4,})\)/
            ];
            for (const p of patterns) {
                const m = mainText.match(p);
                if (m) {
                    const parsed = parseInt(m[1].replace(/[.,]/g, ''));
                    // Exclui telefones (DDD): 10-11 dígitos consecutivos
                    if (parsed >= 10 && m[1].replace(/[.,]/g, '').length <= 6) {
                        reviews = parsed;
                        reviews_text = m[0];
                        reviews_source = 'panel_text';
                        break;
                    }
                }
            }
        } catch { }
    }

    // V4: Click na aba Reviews para retirar contagem (só se não tem reviews e aba existe)
    if (reviews === 0) {
        try {
            const tabReviews = page.getByRole('tab', { name: /Avaliações|Reviews/i });
            if (await tabReviews.isVisible({ timeout: 1000 }).catch(() => false)) {
                await tabReviews.click();
                await delay(3000);
                const bodySmalls = await page.locator('div.fontBodySmall').allTextContents().catch(() => []);
                for (const t of bodySmalls) {
                    const m = t.match(/([\d.,]+)\s*(avaliações|reviews|comentários)/i);
                    if (m) {
                        const parsed = parseInt(m[1].replace(/[.,]/g, ''));
                        if (parsed >= 5) { reviews = parsed; reviews_text = t.trim(); reviews_source = 'reviews_tab'; break; }
                    }
                }
                const tabOverview = page.getByRole('tab', { name: /Visão geral|Overview/i });
                if (await tabOverview.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await tabOverview.click();
                    await delay(500);
                }
            }
        } catch { }
    }

    // === CAPTURA BÁSICA (ANTES de qualquer navegação fora do Maps) ===
    const originalUrl = mapsUrl || page.url();

    let category = '';
    try { category = await page.locator('button[jsaction*="category"] span, span.DkEaL').first().innerText().catch(() => ''); } catch { }

    let phone = '';
    try {
        const phoneRaw = await page.locator('button[data-item-id^="phone:tel"]').first().innerText();
        if (phoneRaw) phone = phoneRaw.replace('Copiou o número de telefone', '').trim();
    } catch { }

    let website = null;
    try {
        const rawWebsite = await page.locator('a[data-item-id="authority"]').first().getAttribute('href');
        if (rawWebsite) website = rawWebsite;
    } catch { }

    // V5: Google Search SERP fallback (ÚLTIMO RECURSO — pode navegar fora do Maps)
    if (reviews === 0 && name) {
        try {
            const searchQuery = encodeURIComponent(`${name} avaliações google maps`);
            await page.goto(`https://www.google.com/search?q=${searchQuery}&hl=pt-BR`, { timeout: 15000 });
            await delay(2000);
            // Verificar se não caiu em captcha
            const serpUrl = page.url();
            if (!serpUrl.includes('/sorry/') && !serpUrl.includes('captcha')) {
                const serpText = await page.evaluate(() => {
                    const main = document.querySelector('#main, #search, #rso, body');
                    return main ? main.innerText.substring(0, 5000) : '';
                });
                const serpPatterns = [
                    /([\d.,]+)\s*(?:avaliações|avaliação|reviews|review|comentários)/i,
                    /(?:rating|avaliação|nota).*?([\d.,]+).*?\(([\d.,]+)\)/i
                ];
                for (const p of serpPatterns) {
                    const m = serpText.match(p);
                    if (m) {
                        const targetGroup = m[2] || m[1];
                        const parsed = parseInt(targetGroup.replace(/[.,]/g, ''));
                        if (parsed >= 10 && targetGroup.replace(/[.,]/g, '').length <= 6) {
                            reviews = parsed;
                            reviews_text = m[0].substring(0, 100);
                            reviews_source = 'google_search_serp';
                            break;
                        }
                    }
                }
            }
        } catch { /* silencioso — SERP é fallback opcional */ }
    }

    return {
        index, name, address, rating, reviews,
        reviews_text, reviews_source,
        category, phone, website,
        google_maps_url: originalUrl
    };
}

module.exports = { searchSingleCompany };
