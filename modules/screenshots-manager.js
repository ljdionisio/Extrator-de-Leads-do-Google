/**
 * Screenshots Manager — Captura de provas visuais para diagnóstico premium
 * 
 * Responsabilidades:
 * - Tirar screenshots de páginas públicas (Maps, Website, Instagram, Facebook)
 * - Salvar em data/screenshots/{lead_id}/ com nomes padronizados
 * - Converter para base64 para embedding no PDF
 * - Registrar timestamps e metadados
 */
const fs = require('fs');
const path = require('path');

const delay = (ms) => new Promise(res => setTimeout(res, ms));

/**
 * Garante que o diretório de screenshots do lead existe
 */
function ensureScreenshotDir(leadId) {
    const dir = path.resolve(__dirname, '..', 'data', 'screenshots', leadId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/**
 * Tira screenshot de uma página e salva no diretório do lead
 * @returns {{ path: string, filename: string, timestamp: string, size: number } | null}
 */
async function captureScreenshot(page, leadId, filename, options = {}) {
    const dir = ensureScreenshotDir(leadId);
    const filePath = path.join(dir, filename);
    const { fullPage = false, clip = null } = options;

    try {
        const screenshotOpts = { path: filePath, type: 'png' };
        if (fullPage) screenshotOpts.fullPage = true;
        if (clip) screenshotOpts.clip = clip;

        await page.screenshot(screenshotOpts);

        const stat = fs.statSync(filePath);
        return {
            path: filePath,
            filename: filename,
            timestamp: new Date().toISOString(),
            size: stat.size
        };
    } catch (e) {
        return null;
    }
}

/**
 * Captura screenshots do perfil Google Maps
 */
async function captureGMBScreenshots(page, leadId, mapsUrl) {
    const results = [];

    try {
        await page.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await delay(2000);

        // Screenshot do perfil completo
        const profile = await captureScreenshot(page, leadId, 'gmb_profile.png');
        if (profile) results.push({ ...profile, tipo: 'google_maps', descricao: 'Perfil completo do Google Maps' });

        // Tentar capturar área de avaliações
        const tabReviews = page.getByRole('tab', { name: /Avaliações|Reviews/i });
        if (await tabReviews.isVisible().catch(() => false)) {
            await tabReviews.click();
            await delay(1500);
            const reviews = await captureScreenshot(page, leadId, 'gmb_reviews.png');
            if (reviews) results.push({ ...reviews, tipo: 'google_maps_reviews', descricao: 'Área de avaliações do Google Maps' });
        }

        // Tentar capturar área de atualizações
        const tabUpdates = page.getByRole('tab', { name: /Atualizações|Updates|Publicações/i });
        if (await tabUpdates.isVisible().catch(() => false)) {
            await tabUpdates.click();
            await delay(1500);
            const updates = await captureScreenshot(page, leadId, 'gmb_updates.png');
            if (updates) results.push({ ...updates, tipo: 'google_maps_updates', descricao: 'Área de atualizações/publicações' });
        }

    } catch (e) {
        // Registrar falha silenciosamente
    }

    return results;
}

/**
 * Captura screenshot do website (ou prova de ausência)
 */
async function captureWebsiteScreenshots(page, leadId, websiteUrl) {
    const results = [];

    if (!websiteUrl) {
        // Prova de ausência: não há website
        return [{
            filename: 'website_absent.txt',
            tipo: 'website_ausente',
            descricao: 'Nenhum website encontrado no perfil público',
            timestamp: new Date().toISOString(),
            ausencia: true
        }];
    }

    try {
        const response = await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await delay(2000);

        if (response && response.ok()) {
            const home = await captureScreenshot(page, leadId, 'website_home.png');
            if (home) results.push({ ...home, tipo: 'website', descricao: 'Homepage do website', url: websiteUrl });

            // Verificar se tem WhatsApp/formulário de contato visível
            const hasWhatsApp = await page.locator('a[href*="wa.me"], a[href*="whatsapp"]').count().catch(() => 0);
            const hasForm = await page.locator('form, input[type="email"], input[type="tel"]').count().catch(() => 0);
            const hasCTA = await page.locator('a[href*="tel:"], button:has-text("contato"), button:has-text("orçamento"), a:has-text("contato")').count().catch(() => 0);

            if (hasWhatsApp === 0 && hasForm === 0 && hasCTA === 0) {
                results.push({
                    filename: 'website_no_cta.txt',
                    tipo: 'website_sem_cta',
                    descricao: 'Website sem botão WhatsApp, formulário ou CTA de contato visíveis',
                    timestamp: new Date().toISOString(),
                    ausencia: true
                });
            }
        } else {
            const errShot = await captureScreenshot(page, leadId, 'website_error.png');
            if (errShot) results.push({ ...errShot, tipo: 'website_erro', descricao: `Website retornou erro (HTTP ${response?.status() || 'desconhecido'})`, url: websiteUrl });
        }
    } catch (e) {
        results.push({
            filename: 'website_timeout.txt',
            tipo: 'website_timeout',
            descricao: 'Website não respondeu dentro do tempo limite (15s)',
            timestamp: new Date().toISOString(),
            ausencia: true,
            url: websiteUrl
        });
    }

    return results;
}

/**
 * Captura screenshot do Instagram (ou prova de ausência)
 */
async function captureInstagramScreenshot(page, leadId, instagramUrl) {
    if (!instagramUrl) {
        return [{
            filename: 'instagram_absent.txt',
            tipo: 'instagram_ausente',
            descricao: 'Nenhum perfil de Instagram encontrado nos canais observados',
            timestamp: new Date().toISOString(),
            ausencia: true
        }];
    }

    try {
        await page.goto(instagramUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await delay(2000);

        const shot = await captureScreenshot(page, leadId, 'instagram_profile.png');
        if (shot) return [{ ...shot, tipo: 'instagram', descricao: 'Perfil do Instagram encontrado', url: instagramUrl }];
    } catch (e) { /* silently fail */ }

    return [{
        filename: 'instagram_blocked.txt',
        tipo: 'instagram_bloqueado',
        descricao: 'Instagram encontrado mas não foi possível capturar (login requerido ou bloqueio)',
        timestamp: new Date().toISOString(),
        url: instagramUrl
    }];
}

/**
 * Captura screenshot do Facebook (ou prova de ausência)
 */
async function captureFacebookScreenshot(page, leadId, facebookUrl) {
    if (!facebookUrl) {
        return [{
            filename: 'facebook_absent.txt',
            tipo: 'facebook_ausente',
            descricao: 'Nenhuma página de Facebook encontrada nos canais observados',
            timestamp: new Date().toISOString(),
            ausencia: true
        }];
    }

    try {
        await page.goto(facebookUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await delay(2000);

        const shot = await captureScreenshot(page, leadId, 'facebook_page.png');
        if (shot) return [{ ...shot, tipo: 'facebook', descricao: 'Página do Facebook encontrada', url: facebookUrl }];
    } catch (e) { /* silently fail */ }

    return [{
        filename: 'facebook_blocked.txt',
        tipo: 'facebook_bloqueado',
        descricao: 'Facebook encontrado mas não foi possível capturar (login requerido ou bloqueio)',
        timestamp: new Date().toISOString(),
        url: facebookUrl
    }];
}

/**
 * Converte screenshot para base64 (para embedding no PDF)
 */
function screenshotToBase64(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const buf = fs.readFileSync(filePath);
        return 'data:image/png;base64,' + buf.toString('base64');
    } catch (e) {
        return null;
    }
}

/**
 * Lista todos os screenshots de um lead
 */
function listScreenshots(leadId) {
    const dir = path.resolve(__dirname, '..', 'data', 'screenshots', leadId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.png'))
        .map(f => ({
            filename: f,
            path: path.join(dir, f),
            size: fs.statSync(path.join(dir, f)).size
        }));
}

module.exports = {
    ensureScreenshotDir,
    captureScreenshot,
    captureGMBScreenshots,
    captureWebsiteScreenshots,
    captureInstagramScreenshot,
    captureFacebookScreenshot,
    screenshotToBase64,
    listScreenshots
};
