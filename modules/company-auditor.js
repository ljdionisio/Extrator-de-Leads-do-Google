/**
 * Company Auditor — Auditoria PROFUNDA do perfil Google Maps
 *
 * REGRA DE OURO: NÃO transformar falha de coleta em fato negativo.
 * Se não conseguir confirmar, dizer "não foi possível confirmar"
 * e NUNCA "não encontrado" / "não existe" / "nenhuma avaliação".
 *
 * Navega por abas, espera dados carregarem, faz scroll,
 * captura "Resultados da Web" e normaliza links sociais.
 */

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Domínios de redes sociais que NÃO devem ser tratados como website institucional
const SOCIAL_DOMAINS = [
    'instagram.com', 'facebook.com', 'fb.com', 'wa.me', 'whatsapp.com',
    'api.whatsapp.com', 'linktree.com', 'linktr.ee', 'twitter.com', 'x.com',
    'tiktok.com', 'youtube.com', 'youtu.be', 'linkedin.com', 'threads.net'
];

function isSocialUrl(url) {
    if (!url) return false;
    try {
        const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
        return SOCIAL_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
    } catch { return false; }
}

/**
 * Auditoria profunda do Google Maps.
 * Navega por abas, espera dados, faz scroll, captura Resultados da Web.
 *
 * @param {Object} mapsPage - Playwright page já aberta
 * @param {string} url - URL do Google Maps do estabelecimento
 * @param {Object} options - { deepScroll: true, tabWaitMs: 5000 }
 * @returns {Object|null} Dados completos ou null se falha total
 */
async function auditCompany(mapsPage, url, options = {}) {
    const tabWait = options.tabWaitMs || 5000;
    const warnings = [];
    const confidence = {
        rating: 'not_observed',
        reviews: 'not_observed',
        social_links: 'not_observed',
        website: 'not_observed'
    };
    const limitations = [];

    // === 1. NAVEGAR E ESPERAR CARREGAMENTO INICIAL ===
    try {
        await mapsPage.goto(url, { timeout: 60000 });
    } catch (e) {
        return null;
    }

    await mapsPage.waitForSelector('h1.DUwDvf', { timeout: 15000 }).catch(() => { warnings.push('name_timeout'); });
    await delay(3000); // Espera inicial para dados lazy

    // Se a URL é /maps/search/ (perfil simplificado sem abas),
    // precisamos navegar para /maps/place/ para ter acesso completo
    const currentUrl = mapsPage.url();
    if (currentUrl.includes('/maps/search/') || !currentUrl.includes('/maps/place/')) {
        try {
            // Clicar no nome do estabelecimento para ir ao perfil completo
            const nameLink = mapsPage.locator('a.hfpxzc').first();
            if (await nameLink.isVisible().catch(() => false)) {
                await nameLink.click();
                await mapsPage.waitForSelector('h1.DUwDvf', { timeout: 10000 }).catch(() => { });
                await delay(3000);
                warnings.push('redirected_to_place');
            }
        } catch { warnings.push('place_redirect_failed'); }
    }

    // === 2. DADOS BÁSICOS ===
    let name = null;
    try { name = await mapsPage.locator('h1.DUwDvf').first().innerText(); } catch { warnings.push('name_failed'); }
    if (!name) return null;

    let address = null;
    try {
        const addrRaw = await mapsPage.locator('button[data-item-id="address"]').first().innerText();
        if (addrRaw) address = addrRaw.replace('Copiou o endereço', '').trim();
    } catch { warnings.push('address_failed'); }

    let phone = null;
    try {
        const phoneRaw = await mapsPage.locator('button[data-item-id^="phone:tel"]').first().innerText();
        if (phoneRaw) phone = phoneRaw.replace('Copiou o número de telefone', '').trim();
    } catch { warnings.push('phone_failed'); }

    let website = null;
    try {
        const rawWebsite = await mapsPage.locator('a[data-item-id="authority"]').first().getAttribute('href');
        if (rawWebsite && !isSocialUrl(rawWebsite)) {
            website = rawWebsite;
            confidence.website = 'high';
        } else if (rawWebsite && isSocialUrl(rawWebsite)) {
            warnings.push('website_is_social_link');
            confidence.website = 'low';
        }
    } catch { warnings.push('website_failed'); }

    let categoria_maps = null;
    try {
        categoria_maps = await mapsPage.locator('button[jsaction*="category"] span, span.DkEaL').first().innerText().catch(() => null);
    } catch { warnings.push('category_failed'); }

    // === 3. RATING E REVIEWS (tentativa robusta com múltiplos seletores) ===
    let rating = null;
    let reviews = null;

    // Tentativa 1: div.F7nice (formato padrão)
    try {
        const ratingEl = await mapsPage.locator('div.F7nice').first().innerText();
        if (ratingEl) {
            const parsed = _parseRatingText(ratingEl);
            if (parsed) { rating = parsed.rating; reviews = parsed.reviews; }
        }
    } catch { }

    // Tentativa 2: span com aria-label contendo "estrelas" / "stars"
    if (rating === null) {
        try {
            const ariaLabels = await mapsPage.locator('span[aria-label*="estrela"], span[aria-label*="star"]').first().getAttribute('aria-label');
            if (ariaLabels) {
                const m = ariaLabels.match(/([\d.,]+)/);
                if (m) rating = parseFloat(m[1].replace(',', '.'));
            }
        } catch { }
    }

    // Tentativa 3: botão de avaliações com texto "(X avaliações)"
    if (reviews === null) {
        try {
            const revBtn = await mapsPage.locator('button[aria-label*="avaliação"], button[aria-label*="review"]').first().getAttribute('aria-label');
            if (revBtn) {
                const m = revBtn.match(/([\d.,]+)/);
                if (m) reviews = parseInt(m[1].replace(/[.,]/g, ''));
            }
        } catch { }
    }

    // Tentativa 4: span dentro de F7nice com parênteses "(2.380)" — exclui valores de rating (< 6)
    if (reviews === null) {
        try {
            const f7spans = await mapsPage.locator('div.F7nice span').allInnerTexts();
            for (const t of f7spans) {
                // Procurar explicitamente texto com parênteses como "(2.380)"
                const mParen = t.match(/\(([\d.,]+)\)/);
                if (mParen) {
                    const parsed = parseInt(mParen[1].replace(/[.,]/g, ''));
                    if (parsed >= 100) { reviews = parsed; break; }
                }
                // Procurar número grande standalone (>= 100) — provavelmente reviews
                const mNum = t.match(/^([\d.,]+)$/);
                if (mNum) {
                    const parsed = parseInt(mNum[1].replace(/[.,]/g, ''));
                    if (parsed >= 100) { reviews = parsed; break; }
                }
            }
        } catch { }
    }

    // Tentativa 5: scan do texto do header inteiro
    if (reviews === null) {
        try {
            const headerText = await mapsPage.locator('div.LBgpqf, div.fontBodyMedium').first().innerText().catch(() => '');
            const m = headerText.match(/([\d.,]+)\s*(?:avaliação|avaliações|review|reviews|comentário)/i);
            if (m) reviews = parseInt(m[1].replace(/[.,]/g, ''));
        } catch { }
    }

    // Tentativa 6: qualquer texto na página com padrão "X avaliações" ou "(X)"
    if (reviews === null) {
        try {
            const allText = await mapsPage.evaluate(() => {
                const el = document.querySelector('div[role="main"]');
                return el ? el.innerText.substring(0, 2000) : '';
            });
            // Procurar "(2.380)" ou "2.380 avaliações"
            const patterns = [
                /\(([\d.,]{4,})\)/,
                /([\d.,]+)\s*(?:avaliações|reviews|comentários)/i
            ];
            for (const p of patterns) {
                const m = allText.match(p);
                if (m) {
                    const parsed = parseInt(m[1].replace(/[.,]/g, ''));
                    if (parsed > 10) { reviews = parsed; break; }
                }
            }
        } catch { }
    }

    if (rating !== null) confidence.rating = 'high';
    if (reviews !== null) confidence.reviews = 'high';

    // === 4. SCROLL PROFUNDO NO PAINEL LATERAL (para revelar "Resultados da Web") ===
    let instagram = null;
    let instagram_source = '';
    let facebook = null;
    let whatsapp = null;
    let other_public_links = [];
    let email = null;

    // Scroll no painel lateral do Maps para carregar conteúdo lazy
    try {
        const panels = ['div[role="main"]', 'div.m6QErb.DxyBCb', 'div.m6QErb'];
        for (const sel of panels) {
            const panel = mapsPage.locator(sel).first();
            if (await panel.isVisible().catch(() => false)) {
                for (let i = 0; i < 5; i++) {
                    await panel.evaluate(el => el.scrollBy(0, 600));
                    await delay(800);
                }
                break;
            }
        }
    } catch { warnings.push('scroll_failed'); }

    await delay(2000);

    // === 5. CAPTURAR LINKS VISÍVEIS (incluindo "Resultados da Web") ===
    try {
        const allLinks = await mapsPage.$$eval('a[href]', anchors =>
            anchors.map(a => ({
                href: a.href || '',
                text: (a.textContent || '').trim().substring(0, 200),
                ariaLabel: a.getAttribute('aria-label') || ''
            }))
        );

        const processedUrls = new Set();
        for (const link of allLinks) {
            const href = link.href;
            if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
            const lower = href.toLowerCase();
            if (processedUrls.has(lower)) continue;
            processedUrls.add(lower);

            if (lower.includes('instagram.com') && !instagram) { instagram = href; instagram_source = 'maps_deep'; }
            else if ((lower.includes('facebook.com') || lower.includes('fb.com')) && !facebook) { facebook = href; }
            else if ((lower.includes('wa.me') || lower.includes('api.whatsapp.com') || lower.includes('whatsapp.com/send')) && !whatsapp) { whatsapp = href; }
            else if (lower.includes('linkedin.com') && other_public_links.length < 5) { other_public_links.push(href); }
        }

        if (instagram || facebook || whatsapp) {
            confidence.social_links = 'high';
        }
    } catch { warnings.push('link_scan_failed'); }

    // === 6. ABA AVALIAÇÕES ===
    let negative_reviews = [];
    let review_snippets = [];
    const tabs = {
        reviews: { status: 'not_available' },
        updates: { status: 'not_available' },
        about: { status: 'not_available' }
    };

    try {
        const tabReviews = mapsPage.getByRole('tab', { name: /Avaliações|Reviews/i });
        if (await tabReviews.isVisible().catch(() => false)) {
            await tabReviews.click();
            await delay(tabWait);

            tabs.reviews.status = 'visited';

            // Re-confirmar rating na aba de avaliações
            try {
                const ratingInTab = await mapsPage.locator('div.fontDisplayLarge').first().innerText().catch(() => null);
                if (ratingInTab) {
                    const parsedR = parseFloat(ratingInTab.replace(',', '.'));
                    if (!isNaN(parsedR) && parsedR > 0 && parsedR <= 5) {
                        if (rating === null || Math.abs(rating - parsedR) > 0.3) {
                            rating = parsedR;
                            confidence.rating = 'high';
                        }
                    }
                }
            } catch { }

            // Re-confirmar total reviews
            try {
                const totalReviewText = await mapsPage.locator('div.fontBodySmall').allTextContents();
                for (const t of totalReviewText) {
                    const m = t.match(/([\d.,]+)\s*(avaliações|reviews|comentários)/i);
                    if (m) {
                        const parsed = parseInt(m[1].replace(/[.,]/g, ''));
                        if (parsed > 0) {
                            reviews = parsed;
                            confidence.reviews = 'high';
                            break;
                        }
                    }
                }
            } catch { }

            // Coletar snippets de avaliações
            try {
                const snippets = await mapsPage.locator('.wiI7pd').allInnerTexts().catch(() => []);
                review_snippets = snippets.slice(0, 5).filter(t => t.length > 5);
            } catch { }

            // Ordenar por mais baixas para capturar negativas
            try {
                const sortBtn = mapsPage.getByRole('button', { name: /Ordenar|Sort/i }).first();
                if (await sortBtn.isVisible().catch(() => false)) {
                    await sortBtn.click();
                    await delay(1000);
                    const lowestOpt = mapsPage.locator('text=/Mais baixas|Lowest/i').first();
                    if (await lowestOpt.isVisible().catch(() => false)) {
                        await lowestOpt.click();
                        await delay(2000);
                        const negSnips = await mapsPage.locator('.wiI7pd').allInnerTexts().catch(() => []);
                        negative_reviews = negSnips.slice(0, 3).filter(t => t.length > 5);
                    }
                }
            } catch { warnings.push('neg_sort_failed'); }
        }
    } catch { warnings.push('reviews_tab_failed'); }

    // === 7. ABA ATUALIZAÇÕES (último post GMB) ===
    let last_post = null;
    try {
        // Voltar para visão geral antes de clicar em outra aba
        const tabOverview = mapsPage.getByRole('tab', { name: /Visão geral|Overview/i });
        if (await tabOverview.isVisible().catch(() => false)) {
            await tabOverview.click();
            await delay(1500);
        }

        const tabUpdates = mapsPage.getByRole('tab', { name: /Atualizações|Updates/i });
        if (await tabUpdates.isVisible().catch(() => false)) {
            await tabUpdates.click();
            await delay(tabWait);
            tabs.updates.status = 'visited';

            const timeEls = await mapsPage.locator('div.fontBodySmall').allTextContents().catch(() => []);
            for (const t of timeEls) {
                if (t.includes('Há') || t.includes(' de ') || t.includes('ago') || t.includes('days') || t.includes('weeks') || t.includes('meses') || t.includes('months')) {
                    last_post = t.trim();
                    tabs.updates.lastPost = last_post;
                    break;
                }
            }
        }
    } catch { warnings.push('updates_tab_failed'); }

    // === 8. ENRIQUECIMENTO VIA WEBSITE (se disponível) ===
    if (website) {
        const newPage = await mapsPage.context().newPage();
        try {
            await newPage.goto(website, { timeout: 10000, waitUntil: 'domcontentloaded' });
            const pageLinks = await newPage.$$eval('a[href]', anchors =>
                anchors.map(a => ({ href: a.href, text: (a.innerText || '').trim().toLowerCase() }))
            );

            const processed = new Set();
            for (const link of pageLinks) {
                const href = link.href;
                if (!href || href.startsWith('javascript:')) continue;
                const lower = href.toLowerCase();
                if (processed.has(lower)) continue;
                processed.add(lower);

                if (lower.includes('instagram.com') && !instagram) { instagram = href; instagram_source = 'website'; }
                else if (lower.includes('facebook.com') && !facebook) { facebook = href; }
                else if ((lower.includes('wa.me') || lower.includes('api.whatsapp.com') || lower.includes('whatsapp.com/send')) && !whatsapp) { whatsapp = href; }
                else if (lower.includes('linkedin.com/company') && other_public_links.length < 5) { other_public_links.push(href); }
            }

            if (!email) {
                try {
                    const bodyText = await newPage.evaluate(() => document.body.innerText);
                    const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    if (emailMatch) email = emailMatch[0];
                } catch { }
            }

            // Atualizar confiança se encontrou algo via website
            if (instagram || facebook || whatsapp) {
                confidence.social_links = confidence.social_links === 'not_observed' ? 'medium' : confidence.social_links;
            }
        } catch { warnings.push('website_enrichment_timeout'); }
        finally { await newPage.close(); }
    }

    // === 9. MONTAR LIMITAÇÕES ===
    if (confidence.rating === 'not_observed') {
        limitations.push('Rating não foi possível confirmar com segurança — seletores podem ter mudado');
    }
    if (confidence.social_links === 'not_observed') {
        limitations.push('Links de redes sociais não foram observados na página — podem existir em seções não carregadas');
    }
    if (!website) {
        limitations.push('Nenhum website institucional observado no perfil — pode existir mas não estar cadastrado');
    }

    other_public_links = [...new Set(other_public_links)];

    // === 10. RETORNO COMPLETO ===
    return {
        name, address, phone, website,
        instagram, instagram_source,
        facebook, whatsapp,
        other_public_links, email,
        categoria_maps,
        rating, reviews,
        negative_reviews,
        review_snippets,
        last_post,
        warnings,
        tabs,
        confidence,
        limitations,
        source: 'google_maps_deep'
    };
}

/**
 * Parse texto de rating em diferentes formatos brasileiros e ingleses.
 * Exemplos: "4,5(2.380)", "4.5 (2,380)", "4,5 estrelas 2.380 avaliações"
 */
function _parseRatingText(text) {
    if (!text) return null;

    // Formato: "4,5(2.380)" ou "4.5(2380)" ou "4,5 (2.380)"
    let m = text.match(/([\d]+[.,][\d]+)\s*\(?([\d.,]+)\)?/);
    if (m) {
        return {
            rating: parseFloat(m[1].replace(',', '.')),
            reviews: parseInt(m[2].replace(/[.,]/g, ''))
        };
    }

    // Formato: apenas rating sem reviews
    m = text.match(/([\d]+[.,][\d]+)/);
    if (m) {
        return { rating: parseFloat(m[1].replace(',', '.')), reviews: null };
    }

    return null;
}

/**
 * Merge dados do auditor profundo com dados do lead/candidato original.
 * Regra: NUNCA sobrescrever valor bom por null/0.
 * Registra fonte de cada campo para transparência.
 *
 * @param {Object} originalLead - Lead/candidato com dados iniciais
 * @param {Object} deepAudit - Resultado do auditCompany()
 * @returns {Object} Lead merged com evidence metadata
 */
function mergeAuditWithLeadEvidence(originalLead, deepAudit) {
    if (!deepAudit) return { ...originalLead, _auditSource: 'failed' };

    const merged = { ...deepAudit };
    const evidence = {};

    // Rating: prefer auditor profundo (mais recente), fallback para original
    if (deepAudit.rating && deepAudit.rating > 0) {
        merged.rating = deepAudit.rating;
        evidence.rating = { value: deepAudit.rating, source: 'maps_deep', confidence: deepAudit.confidence?.rating || 'high' };
    } else if (originalLead.rating && originalLead.rating > 0) {
        merged.rating = originalLead.rating;
        evidence.rating = {
            value: originalLead.rating, source: 'initial_search', confidence: 'medium',
            note: 'Preservado do candidato inicial porque auditor profundo não observou rating.'
        };
    } else {
        evidence.rating = { value: null, source: 'not_observed', confidence: 'not_observed' };
    }

    // Reviews: NUNCA trocar valor > 0 por null/0
    if (deepAudit.reviews && deepAudit.reviews > 0) {
        merged.reviews = deepAudit.reviews;
        evidence.reviews = { value: deepAudit.reviews, source: 'maps_deep', confidence: deepAudit.confidence?.reviews || 'high' };
    } else if (originalLead.reviews && originalLead.reviews > 0) {
        merged.reviews = originalLead.reviews;
        evidence.reviews = {
            value: originalLead.reviews, source: 'initial_search', confidence: 'medium',
            note: 'Preservado do candidato inicial porque auditor profundo não observou contagem em headless.'
        };
    } else {
        merged.reviews = null;
        evidence.reviews = {
            value: null, source: 'not_observed', confidence: 'not_observed',
            note: 'Não foi possível confirmar contagem de avaliações com segurança.'
        };
    }

    // Website: prefer auditor (pode ter visitado)
    if (!merged.website && originalLead.website) {
        merged.website = originalLead.website;
        evidence.website = { source: 'initial_search' };
    }

    // Instagram/Facebook/WhatsApp: preservar originais se auditor não encontrou
    if (!merged.instagram && originalLead.instagram) {
        merged.instagram = originalLead.instagram;
        merged.instagram_source = originalLead.instagram_source || 'initial_search';
    }
    if (!merged.facebook && originalLead.facebook) {
        merged.facebook = originalLead.facebook;
    }
    if (!merged.whatsapp && (originalLead.whatsapp || originalLead.whatsapp_url)) {
        merged.whatsapp = originalLead.whatsapp || originalLead.whatsapp_url;
    }

    // Phone: preservar se auditor perdeu
    if (!merged.phone && originalLead.phone) {
        merged.phone = originalLead.phone;
    }

    // Address: preservar se auditor perdeu
    if (!merged.address && originalLead.address) {
        merged.address = originalLead.address;
    }

    merged._evidence = evidence;
    merged._auditSource = 'merged';

    return merged;
}

module.exports = { auditCompany, isSocialUrl, mergeAuditWithLeadEvidence };
