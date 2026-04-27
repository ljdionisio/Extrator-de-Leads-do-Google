const { chromium } = require('playwright');
const { searchSingleCompany } = require('../modules/single-search.js');
(async () => {
    const b = await chromium.launch({ headless: true });
    // Fase 1 — buscar para obter URL /maps/place/
    const candidates = await searchSingleCompany('Supermercado Ponto Bom', 'Peruibe', b, 1);
    if (!candidates.length) { console.log('Nenhum candidato'); process.exit(1); }
    const placeUrl = candidates[0].google_maps_url;
    console.log('Place URL:', placeUrl);
    console.log('Candidato reviews_source:', candidates[0].reviews_source);
    console.log('Candidato reviews:', candidates[0].reviews);

    // Fase 2 — abrir /maps/place/ e investigar DOM
    const c = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
    const p = await c.newPage();
    await p.goto(placeUrl, { timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));

    console.log('\n=== DOM INVESTIGATION ===');
    console.log('Current URL:', p.url());

    // Todos os buttons com aria-label que contêm números
    const btns = await p.$$eval('button[aria-label]', els =>
        els.map(e => ({ label: e.getAttribute('aria-label'), text: e.textContent.trim().substring(0, 80) }))
            .filter(e => e.label && /\d/.test(e.label))
    );
    console.log('\nButtons com aria-label numérico:');
    btns.forEach((b, i) => console.log(`  [${i}] label="${b.label}" text="${b.text}"`));

    // Todos os tabs
    const tabs = await p.$$eval('[role="tab"]', els =>
        els.map(e => ({ label: e.getAttribute('aria-label'), text: e.textContent.trim().substring(0, 80) }))
    );
    console.log('\nTabs:');
    tabs.forEach((t, i) => console.log(`  [${i}] label="${t.label}" text="${t.text}"`));

    // F7nice full HTML
    const f7html = await p.locator('div.F7nice').first().innerHTML().catch(() => 'NOT_FOUND');
    console.log('\nF7nice HTML:', f7html);

    // Todos os spans com texto numérico no painel
    const numSpans = await p.$$eval('div[role="main"] span', els =>
        els.map(e => e.textContent.trim()).filter(t => t && /\d/.test(t) && t.length < 30)
    );
    console.log('\nSpans numéricos no main:');
    numSpans.slice(0, 20).forEach((s, i) => console.log(`  [${i}] "${s}"`));

    // Tenta clicar na aba Reviews
    console.log('\n=== TENTANDO ABA REVIEWS ===');
    const tabReviews = p.getByRole('tab', { name: /Avaliações|Reviews/i });
    const tabVisible = await tabReviews.isVisible().catch(() => false);
    console.log('Tab Reviews visible:', tabVisible);
    if (tabVisible) {
        const tabLabel = await tabReviews.getAttribute('aria-label').catch(() => '');
        console.log('Tab label:', tabLabel);
        await tabReviews.click();
        await new Promise(r => setTimeout(r, 3000));

        // fontDisplayLarge e fontBodySmall
        const fdl = await p.locator('div.fontDisplayLarge').first().innerText().catch(() => 'NOT_FOUND');
        console.log('fontDisplayLarge:', fdl);
        const fbs = await p.locator('div.fontBodySmall').allTextContents().catch(() => []);
        console.log('fontBodySmall texts:');
        fbs.filter(t => /\d/.test(t)).forEach((t, i) => console.log(`  [${i}] "${t.trim().substring(0, 100)}"`));

        // Todos os textos no main
        const allText = await p.evaluate(() => {
            const el = document.querySelector('div[role="main"]');
            return el ? el.innerText.substring(0, 2000) : '';
        });
        const lines = allText.split('\n').filter(l => /avalia|review|comen/i.test(l)).slice(0, 10);
        console.log('Linhas com "avalia/review/comen":');
        lines.forEach((l, i) => console.log(`  [${i}] "${l}"`));
    }

    await c.close();
    await b.close();
})();
