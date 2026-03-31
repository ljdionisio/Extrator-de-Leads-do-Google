const { chromium } = require('playwright');
const { auditCompany } = require('./company-auditor.js');
const { calculateLeadScore } = require('./lead-scorer.js');
const { generateMessage } = require('./message-generator.js');
const { generateKeywords } = require('./keyword-expander.js');
const crypto = require('crypto');

// Utilitário para pausar a execução
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function runMapsCollector(niche, city, browser, dashPage, supabase, getRobotStopped) {
    const baseNiche = niche.trim();
    const baseCity = city.trim();

    // Multi-Keywords Generator via Expander
    const searchVariants = generateKeywords(baseNiche, baseCity);
    console.log(`\n🚀 INICIANDO CAPTAÇÃO MÚLTIPLA: Lote de ${searchVariants.length} Variações (Alvo: ${baseNiche})...\n`);

    const mapsContext = await browser.newContext({ viewport: { width: 900, height: 800 }, locale: 'pt-BR' });
    let mapsPage = await mapsContext.newPage();

    const globHrefs = new Set();
    let totalCount = 0;

    for (const variant of searchVariants) {
        if (getRobotStopped()) break;

        try {
            await mapsPage.goto(`https://www.google.com/maps/search/${encodeURIComponent(variant)}/`);
            await dashPage.evaluate((v) => { window.updateStatusMsg(`⏳ Inicializando varredura da Keyword: "${v}"...`); }, variant);

            // Aguarda os resultados carregarem
            await mapsPage.waitForSelector('div[role="feed"]', { timeout: 15000 }).catch(() => { });

            let previousHeight = 0;
            let scrollAttempts = 0;
            const maxUnchangedScrolls = 5;

            await dashPage.evaluate(() => { window.updateStatusMsg("⬇️ Extraindo todos os leads disponíveis na região..."); });

            while (true) {
                if (getRobotStopped()) break;
                const feed = mapsPage.locator('div[role="feed"]');
                if (await feed.count() === 0) break;

                await feed.hover();
                await mapsPage.mouse.wheel(0, 5000);
                await delay(1000);

                const isEnd = await mapsPage.getByText("Você chegou ao final da list").isVisible().catch(() => false) ||
                    await mapsPage.getByText("You've reached the end").isVisible().catch(() => false);

                if (isEnd) break;

                const currentHeight = await feed.evaluate(el => el.scrollHeight);
                if (currentHeight === previousHeight) {
                    scrollAttempts++;
                    if (scrollAttempts >= maxUnchangedScrolls) break;
                } else {
                    scrollAttempts = 0;
                }
                previousHeight = currentHeight;
            }

            if (getRobotStopped()) {
                await dashPage.evaluate(() => { window.updateStatusMsg("⏸️ Captação Suspendida pelo Usuário."); });
                return;
            }

            // Coleta todos os links de locais da listagem atual
            const placeLocators = await mapsPage.locator('a.hfpxzc').all();
            const sessionHrefs = [];
            for (const p of placeLocators) {
                const href = await p.getAttribute('href').catch(() => null);
                if (href && !globHrefs.has(href)) {
                    globHrefs.add(href);
                    sessionHrefs.push(href);
                    totalCount++;
                }
            }

            let topCompetitors = [];

            await dashPage.evaluate(({ c, v }) => { window.updateStatusMsg(`🕵️ +${c} Novos Leads vivos interceptados na keyword "${v}"! Explorando Forense GMB...`); }, { c: sessionHrefs.length, v: variant });

            for (let i = 0; i < sessionHrefs.length; i++) {
                try {
                    if (getRobotStopped()) {
                        await dashPage.evaluate(() => { window.updateStatusMsg("⏸️ Captação Suspendida durante extração!"); });
                        break;
                    }

                    const auditResult = await auditCompany(mapsPage, sessionHrefs[i]);
                    if (!auditResult || !auditResult.name) continue;

                    let scoreResult = { score: 0, priority: 'baixa', reasons: [] };
                    let messages = { whatsapp_curta: "", whatsapp_consultiva: "Erro", email: "", argumento_comercial: "" };
                    const wrn = auditResult.warnings || [];

                    try {
                        let calc = calculateLeadScore(auditResult);
                        if (calc && typeof calc === 'object') {
                            scoreResult.score = calc.score || 0;
                            scoreResult.priority = calc.priority || 'baixa';
                            scoreResult.reasons = calc.reasons || [];
                        }
                    } catch (e) {
                        wrn.push('score_failed');
                        console.error(`[${auditResult.name}] Erro no score:`, e.message);
                    }

                    try {
                        messages = generateMessage({ company_name: auditResult.name }, auditResult, city.trim());
                    } catch (e) {
                        wrn.push('message_failed');
                        console.error(`[${auditResult.name}] Erro na mensagem:`, e.message);
                    }

                    topCompetitors.push({ name: auditResult.name, rating: auditResult.rating || 0, reviews: auditResult.reviews || 0 });
                    topCompetitors.sort((a, b) => b.reviews - a.reviews);
                    if (topCompetitors.length > 3) topCompetitors.length = 3;
                    const concorrentes_referencia = topCompetitors.map(c => `${c.name} (${c.rating}⭐ com ${c.reviews} reviews)`).join(" | ");

                    const leadStatus = wrn.length > 0 ? 'partial' : 'success';

                    const fullLeadObj = {
                        name: auditResult.name,
                        address: auditResult.address ? auditResult.address.split('-')[0].trim() : '',
                        source_search_url: `https://www.google.com/maps/search/${encodeURIComponent(variant)}/`,
                        google_maps_url: sessionHrefs[i],
                        website: auditResult.website || '',
                        instagram: auditResult.instagram || '',
                        facebook: auditResult.facebook || '',
                        whatsapp_url: auditResult.whatsapp || '',
                        other_public_links: auditResult.other_public_links || [],
                        phone: auditResult.phone || '',
                        rating: auditResult.rating || 0,
                        reviews: auditResult.reviews || 0,
                        negative_reviews: auditResult.negative_reviews || [],
                        last_post: auditResult.last_post || null,
                        score: scoreResult.score,
                        priority: scoreResult.priority,
                        reasons: scoreResult.reasons,
                        draft_message: dfMsg,
                        status: leadStatus,
                        warnings: wrn,
                        niche: niche.trim(),
                        city: city.trim(),

                        // Expansão CRM e Inteligência Competitiva
                        lead_id_estavel: crypto.createHash('md5').update(`${auditResult.name}-${auditResult.phone || ''}`).digest("hex"),
                        data_captacao: new Date().toISOString(),
                        prioridade_comercial: scoreResult.priority,
                        prioridade_motivos: scoreResult.reasons,
                        resumo_executivo: "",
                        concorrentes_referencia: concorrentes_referencia,
                        oferta_recomendada: "",
                        mensagem_whatsapp_curta: messages.whatsapp_curta,
                        mensagem_whatsapp: messages.whatsapp_consultiva,
                        mensagem_email: messages.email,
                        argumento_comercial: messages.argumento_comercial,
                        status_pipeline: "Novo",
                        responsavel: "",
                        ultima_acao: null,
                        proxima_acao: null,
                        origem_snapshot: "Google Maps Scraper V2",
                        duplicado_de: null,
                        enrichment_quality: (auditResult.other_public_links && auditResult.other_public_links.length > 0) ? "Enriquecido" : "Básico",
                        evidence_summary: ""
                    };

                    if (getRobotStopped()) {
                        console.log(`[${auditResult.name}] Interlock atingido após auditoria. Lead descartado.`);
                        break;
                    }

                    const { saveLead } = require('./local-store.js');
                    const wasSaved = saveLead(fullLeadObj);

                    if (wasSaved) {
                        // Exibe UI Imediatamente só se for lead original ou deduplicado aceito
                        await dashPage.evaluate((l) => {
                            if (window.addLead) window.addLead(l);
                        }, fullLeadObj);
                    }

                } catch (err) {
                    console.log(`[${i + 1}] Falhou extração: ${err.message}`);
                }
            }

            if (!getRobotStopped()) {
                await dashPage.evaluate((v) => { window.updateStatusMsg(`✅ Mapeamento concluído na keyword: "${v}". Indo para a próxima...`); }, variant);
            }

        } catch (err) {
            console.error(err);
            await dashPage.evaluate(() => { window.updateStatusMsg("❌ Ocorreu um erro no processo de navegação desta keyword."); });
        }
    } // Fim do For(Variants)

    // Minimizar as abas auxiliares mas manter em funcionamento.
    if (mapsContext) {
        await mapsContext.close().catch(() => { });
    }

    if (!getRobotStopped()) {
        await dashPage.evaluate(() => { window.updateStatusMsg("✅ TODAS AS VARIAÇÕES CONCLUÍDAS!"); });
    }
}

module.exports = { runMapsCollector };
