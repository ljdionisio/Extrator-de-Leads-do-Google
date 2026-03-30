async function auditCompany(mapsPage, url) {
    let warnings = [];
    try {
        await mapsPage.goto(url, { timeout: 60000 });
    } catch(e) {
        return null;
    }
    
    await mapsPage.waitForSelector('h1.DUwDvf', { timeout: 10000 }).catch(() => { warnings.push('name_timeout'); });

    let name = null;
    try {
        name = await mapsPage.locator('h1.DUwDvf').first().innerText();
    } catch(e) {
        warnings.push('name_failed');
    }
    if (!name) return null;

    let address = null;
    try {
        let addrRaw = await mapsPage.locator('button[data-item-id="address"]').first().innerText();
        if (addrRaw) address = addrRaw.replace('Copiou o endereço', '').trim();
    } catch(e) { warnings.push('address_failed'); }

    let phone = null;
    try {
        let phoneRaw = await mapsPage.locator('button[data-item-id^="phone:tel"]').first().innerText();
        if (phoneRaw) phone = phoneRaw.replace('Copiou o número de telefone', '').trim();
    } catch(e) { warnings.push('phone_failed'); }

    let website = null;
    try {
        website = await mapsPage.locator('a[data-item-id="authority"]').first().getAttribute('href');
    } catch(e) { warnings.push('website_failed'); }

    let instagram = null;
    let facebook = null;
    try {
        const links = await mapsPage.locator('a[href]').all();
        for (const link of links) {
            const hrefText = await link.getAttribute('href').catch(() => '');
            if (!hrefText) continue;
            if (hrefText.includes('instagram.com')) instagram = hrefText;
            if (hrefText.includes('facebook.com')) facebook = hrefText;
        }
    } catch(e) { warnings.push('socials_failed'); }

    let rating = null;
    let reviews = null;
    try {
        const ratingEl = await mapsPage.locator('div.F7nice').first().innerText();
        if (ratingEl) {
            const match = ratingEl.match(/([^\d.,]+)?([\d.,]+).*?\(([\d.,]+)\)/);
            if (match) {
                rating = parseFloat(match[2].replace(',', '.'));
                reviews = parseInt(match[3].replace(/[.,]/g, ''));
            } else {
               const simpleMatch = ratingEl.match(/([\d.,]+).*?\(([\d.,]+)\)/);
               if(simpleMatch) {
                   rating = parseFloat(simpleMatch[1].replace(',', '.'));
                   reviews = parseInt(simpleMatch[2].replace(/[.,]/g, ''));
               }
            }
        }
    } catch(e) { warnings.push('rating_failed'); }

    let negative_reviews = [];
    try {
        if (reviews > 0) {
            const tabReviews = mapsPage.getByRole('tab', { name: /Avaliações|Reviews/i });
            if (await tabReviews.isVisible().catch(() => false)) {
                await tabReviews.click();
                await mapsPage.waitForTimeout(1000);
                const sortBtn = mapsPage.getByRole('button', { name: /Ordenar|Sort/i }).first();
                if (await sortBtn.isVisible().catch(() => false)) {
                    await sortBtn.click();
                    await mapsPage.waitForTimeout(500);
                    const lowestOpt = mapsPage.locator('text=/Mais baixas|Lowest/i').first();
                    if (await lowestOpt.isVisible().catch(() => false)) {
                        await lowestOpt.click();
                        await mapsPage.waitForTimeout(1500);
                        const reviewSnips = await mapsPage.locator('.wiI7pd').allInnerTexts().catch(() => []);
                        negative_reviews = reviewSnips.slice(0, 3).filter(t => t.length > 5);
                    }
                }
            }
        }
    } catch(e) { warnings.push('neg_reviews_failed'); }

    let last_post = null;
    try {
        const tabUpdates = mapsPage.getByRole('tab', { name: /Atualizações|Updates/i });
        if (await tabUpdates.isVisible().catch(() => false)) {
            await tabUpdates.click();
            await mapsPage.waitForTimeout(1000);
            const timeEls = await mapsPage.locator('div.fontBodySmall').allTextContents().catch(() => []);
            for (let t of timeEls) {
                if (t.includes('Há') || t.includes(' de ') || t.includes('ago') || t.includes('days') || t.includes('weeks')) {
                    last_post = t;
                    break;
                }
            }
        }
    } catch(e) { warnings.push('last_post_failed'); }

    return {
        name, address, phone, website, instagram, facebook, rating, reviews, negative_reviews, last_post, warnings
    };
}

module.exports = { auditCompany };
