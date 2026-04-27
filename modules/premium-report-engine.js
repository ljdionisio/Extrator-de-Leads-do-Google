/**
 * Premium Report Engine — Diagnóstico aprofundado com evidência por lead
 * 
 * Responsabilidades:
 * - Recebe 1 lead selecionado (já extraído) + browser
 * - Visita canais públicos (Maps, Website, Instagram, Facebook)
 * - Captura screenshots via screenshots-manager
 * - Monta evidência estruturada (achados, fontes, limitações)
 * - Salva data/evidence/{lead_id}.json
 * - Gera PDF premium com evidência visual embarcada
 * 
 * REGRA: NÃO rodar para todos os leads do lote. Apenas para 1 lead selecionado.
 */
const fs = require('fs');
const path = require('path');
const {
    captureGMBScreenshots,
    captureWebsiteScreenshots,
    captureInstagramScreenshot,
    captureFacebookScreenshot,
    screenshotToBase64,
    listScreenshots
} = require('./screenshots-manager.js');

const delay = (ms) => new Promise(res => setTimeout(res, ms));

// Domínios de redes sociais (mesma lista do company-auditor)
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
    } catch (e) { return false; }
}

/**
 * Garante que o diretório de evidência existe
 */
function ensureEvidenceDir() {
    const dir = path.resolve(__dirname, '..', 'data', 'evidence');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/**
 * Sanitiza o website do lead (corrige se for rede social)
 */
function sanitizeLeadWebsite(lead) {
    if (lead.website && isSocialUrl(lead.website)) {
        return { ...lead, website: '', _website_was_social: true };
    }
    return lead;
}

/**
 * Gera diagnóstico premium completo para 1 lead
 * @param {Object} lead - Lead completo já extraído
 * @param {Object} browser - Instância do Playwright browser
 * @param {string} niche - Nicho da busca
 * @param {string} city - Cidade da busca
 * @returns {{ pdfPath: string, evidencePath: string, evidence: Object }}
 */
async function generatePremiumReport(lead, browser, niche, city) {
    if (!lead || !lead.name) throw new Error('Lead inválido para relatório premium');

    const leadId = lead.lead_id_estavel || lead.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cleanLead = sanitizeLeadWebsite(lead);

    console.log(`\n🔍 DIAGNÓSTICO PREMIUM: ${lead.name}`);
    console.log(`   Lead ID: ${leadId}`);

    // Estrutura de evidência
    const evidence = {
        lead_id: leadId,
        empresa: lead.name,
        cidade: city,
        nicho: niche,
        capturado_em: new Date().toISOString(),
        fontes: [],
        achados: [],
        screenshots: [],
        limitacoes: []
    };

    // Abrir contexto do browser para screenshots
    let context = null;
    let page = null;

    try {
        context = await browser.newContext({
            viewport: { width: 1280, height: 900 },
            locale: 'pt-BR',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        page = await context.newPage();

        // ============================================
        // 1. GOOGLE MAPS
        // ============================================
        if (lead.google_maps_url) {
            console.log('   📍 Visitando Google Maps...');
            evidence.fontes.push({
                tipo: 'google_maps',
                url: lead.google_maps_url,
                visitado_em: new Date().toISOString()
            });

            try {
                const gmbShots = await captureGMBScreenshots(page, leadId, lead.google_maps_url);
                evidence.screenshots.push(...gmbShots);

                // Achados do Google Maps
                evidence.achados.push({
                    tipo: 'presenca_google_maps',
                    descricao: `Perfil encontrado no Google Maps: ${lead.name}`,
                    fonte: 'Google Maps',
                    url: lead.google_maps_url,
                    screenshot: gmbShots[0]?.filename || null,
                    confianca: 'alta',
                    classificacao: 'fato_observado'
                });

                if (lead.rating && lead.rating > 0) {
                    evidence.achados.push({
                        tipo: 'avaliacao_google',
                        descricao: `Avaliação observada: ${lead.rating} estrelas com ${lead.reviews || 0} avaliações`,
                        fonte: 'Google Maps',
                        url: lead.google_maps_url,
                        screenshot: gmbShots.find(s => s.tipo === 'google_maps_reviews')?.filename || null,
                        confianca: 'alta',
                        classificacao: 'fato_observado'
                    });
                } else {
                    evidence.achados.push({
                        tipo: 'sem_avaliacao',
                        descricao: 'Nenhuma avaliação encontrada no Google Maps',
                        fonte: 'Google Maps',
                        url: lead.google_maps_url,
                        screenshot: gmbShots[0]?.filename || null,
                        confianca: 'media',
                        classificacao: 'fato_observado'
                    });
                }

                if (lead.negative_reviews && lead.negative_reviews.length > 0) {
                    evidence.achados.push({
                        tipo: 'reclamacoes_publicas',
                        descricao: `${lead.negative_reviews.length} reclamação(ões) pública(s) observada(s)`,
                        fonte: 'Google Maps - Avaliações',
                        url: lead.google_maps_url,
                        screenshot: gmbShots.find(s => s.tipo === 'google_maps_reviews')?.filename || null,
                        confianca: 'alta',
                        classificacao: 'fato_observado'
                    });
                }

                if (!lead.last_post) {
                    evidence.achados.push({
                        tipo: 'sem_atualizacoes',
                        descricao: 'Não foram encontradas publicações recentes no Google Meu Negócio',
                        fonte: 'Google Maps - Atualizações',
                        url: lead.google_maps_url,
                        screenshot: gmbShots.find(s => s.tipo === 'google_maps_updates')?.filename || null,
                        confianca: 'media',
                        classificacao: 'fato_observado'
                    });
                    evidence.limitacoes.push('A ausência de publicações pode indicar que a aba não está ativa ou que posts antigos foram removidos.');
                }

            } catch (e) {
                evidence.limitacoes.push(`Não foi possível capturar screenshots do Google Maps: ${e.message}`);
            }
        }

        // ============================================
        // 2. WEBSITE
        // ============================================
        const websiteUrl = cleanLead.website;
        console.log(`   🌐 Website: ${websiteUrl || 'não identificado'}...`);

        if (websiteUrl) {
            evidence.fontes.push({
                tipo: 'website',
                url: websiteUrl,
                visitado_em: new Date().toISOString()
            });
        }

        try {
            const webShots = await captureWebsiteScreenshots(page, leadId, websiteUrl);
            evidence.screenshots.push(...webShots);

            if (!websiteUrl) {
                evidence.achados.push({
                    tipo: 'sem_website',
                    descricao: 'Não foi possível confirmar website institucional nos dados públicos analisados',
                    fonte: 'Google Maps + enriquecimento',
                    url: null,
                    screenshot: null,
                    confianca: 'media',
                    classificacao: 'fato_observado'
                });
                if (cleanLead._website_was_social) {
                    evidence.limitacoes.push('O campo website no Google Maps continha um link de rede social, que não foi considerado como website institucional.');
                }
            } else {
                const hasError = webShots.some(s => s.tipo === 'website_erro' || s.tipo === 'website_timeout');
                const noCTA = webShots.some(s => s.tipo === 'website_sem_cta');

                if (hasError) {
                    evidence.achados.push({
                        tipo: 'website_indisponivel',
                        descricao: 'Website encontrado mas apresentou erro ou indisponibilidade durante a visita',
                        fonte: 'Visita direta ao website',
                        url: websiteUrl,
                        screenshot: webShots.find(s => s.tipo?.includes('erro'))?.filename || null,
                        confianca: 'alta',
                        classificacao: 'fato_observado'
                    });
                } else {
                    evidence.achados.push({
                        tipo: 'website_ativo',
                        descricao: 'Website institucional carregou com sucesso',
                        fonte: 'Visita direta ao website',
                        url: websiteUrl,
                        screenshot: webShots.find(s => s.tipo === 'website')?.filename || null,
                        confianca: 'alta',
                        classificacao: 'fato_observado'
                    });
                }

                if (noCTA) {
                    evidence.achados.push({
                        tipo: 'website_sem_cta',
                        descricao: 'Website observado sem botão WhatsApp, formulário de contato ou CTA visível na homepage',
                        fonte: 'Visita direta ao website',
                        url: websiteUrl,
                        screenshot: webShots.find(s => s.tipo === 'website')?.filename || null,
                        confianca: 'media',
                        classificacao: 'hipotese_melhoria'
                    });
                }
            }
        } catch (e) {
            evidence.limitacoes.push(`Erro ao analisar website: ${e.message}`);
        }

        // ============================================
        // 3. INSTAGRAM
        // ============================================
        const instagramUrl = lead.instagram || null;
        console.log(`   📸 Instagram: ${instagramUrl || 'não encontrado'}...`);

        if (instagramUrl) {
            evidence.fontes.push({
                tipo: 'instagram',
                url: instagramUrl,
                visitado_em: new Date().toISOString()
            });
        }

        try {
            const igShots = await captureInstagramScreenshot(page, leadId, instagramUrl);
            evidence.screenshots.push(...igShots);

            if (!instagramUrl) {
                evidence.achados.push({
                    tipo: 'sem_instagram',
                    descricao: 'Não foi possível confirmar perfil de Instagram vinculado ao negócio',
                    fonte: 'Google Maps + website',
                    url: null,
                    screenshot: null,
                    confianca: 'media',
                    classificacao: 'fato_observado'
                });
            } else {
                const blocked = igShots.some(s => s.tipo === 'instagram_bloqueado');
                if (blocked) {
                    evidence.achados.push({
                        tipo: 'instagram_bloqueado',
                        descricao: 'Perfil do Instagram encontrado, mas não foi possível visualizar (possível login requerido ou restrição)',
                        fonte: 'Instagram',
                        url: instagramUrl,
                        screenshot: null,
                        confianca: 'baixa',
                        classificacao: 'fato_observado'
                    });
                    evidence.limitacoes.push('O Instagram pode exigir login para visualização de alguns perfis. A captura pode não refletir o perfil completo.');
                } else {
                    evidence.achados.push({
                        tipo: 'instagram_encontrado',
                        descricao: 'Perfil de Instagram encontrado e acessível publicamente',
                        fonte: 'Instagram',
                        url: instagramUrl,
                        screenshot: igShots[0]?.filename || null,
                        confianca: 'alta',
                        classificacao: 'fato_observado'
                    });
                }
            }
        } catch (e) {
            evidence.limitacoes.push(`Erro ao analisar Instagram: ${e.message}`);
        }

        // ============================================
        // 4. FACEBOOK
        // ============================================
        const facebookUrl = lead.facebook || null;
        console.log(`   📘 Facebook: ${facebookUrl || 'não encontrado'}...`);

        if (facebookUrl) {
            evidence.fontes.push({
                tipo: 'facebook',
                url: facebookUrl,
                visitado_em: new Date().toISOString()
            });
        }

        try {
            const fbShots = await captureFacebookScreenshot(page, leadId, facebookUrl);
            evidence.screenshots.push(...fbShots);

            if (!facebookUrl) {
                evidence.achados.push({
                    tipo: 'sem_facebook',
                    descricao: 'Não foi possível confirmar página de Facebook vinculada ao negócio',
                    fonte: 'Google Maps + website',
                    url: null,
                    screenshot: null,
                    confianca: 'media',
                    classificacao: 'fato_observado'
                });
            } else {
                const blocked = fbShots.some(s => s.tipo === 'facebook_bloqueado');
                if (blocked) {
                    evidence.achados.push({
                        tipo: 'facebook_bloqueado',
                        descricao: 'Página de Facebook encontrada, mas não foi possível visualizar (possível login requerido)',
                        fonte: 'Facebook',
                        url: facebookUrl,
                        screenshot: null,
                        confianca: 'baixa',
                        classificacao: 'fato_observado'
                    });
                    evidence.limitacoes.push('O Facebook pode exigir login para visualização de páginas. A captura pode estar incompleta.');
                } else {
                    evidence.achados.push({
                        tipo: 'facebook_encontrado',
                        descricao: 'Página de Facebook encontrada e acessível publicamente',
                        fonte: 'Facebook',
                        url: facebookUrl,
                        screenshot: fbShots[0]?.filename || null,
                        confianca: 'alta',
                        classificacao: 'fato_observado'
                    });
                }
            }
        } catch (e) {
            evidence.limitacoes.push(`Erro ao analisar Facebook: ${e.message}`);
        }

    } catch (e) {
        evidence.limitacoes.push(`Erro geral na captura de evidências: ${e.message}`);
    } finally {
        if (context) await context.close().catch(() => { });
    }

    // ============================================
    // 5. LIMITAÇÕES PADRÃO
    // ============================================
    evidence.limitacoes.push('Dados coletados da web aberta em ' + new Date().toLocaleDateString('pt-BR') + '. Podem estar desatualizados.');
    evidence.limitacoes.push('A ausência de um canal pode significar que ele existe mas não foi vinculado ao perfil público.');

    // ============================================
    // 6. SALVAR EVIDÊNCIA
    // ============================================
    const evidenceDir = ensureEvidenceDir();
    const evidencePath = path.join(evidenceDir, `${leadId}.json`);
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');
    console.log(`   💾 Evidência salva: ${evidencePath}`);

    // ============================================
    // 7. GERAR PDF PREMIUM
    // ============================================
    console.log('   📄 Gerando PDF Premium...');
    const { generatePremiumPDF } = require('./pdf-report-external.js');
    const pdfPath = await generatePremiumPDF(cleanLead, niche, city, evidence);
    console.log(`   ✅ PDF Premium gerado: ${pdfPath}`);

    return { pdfPath, evidencePath, evidence };
}

module.exports = { generatePremiumReport, sanitizeLeadWebsite, isSocialUrl, ensureEvidenceDir };
