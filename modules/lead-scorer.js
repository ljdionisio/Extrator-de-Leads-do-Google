/**
 * Lead Scorer com pesos por nicho.
 * Cada nicho distribui 100 pontos-base entre 5 dimensões.
 * Dores adicionais (reviews negativas, GMB abandonado, sem telefone) somam bônus.
 */

const NICHE_WEIGHTS = {
    dentista: { website: 35, instagram: 20, facebook: 5, gmb: 25, reviews: 15 },
    advogado: { website: 40, instagram: 10, facebook: 5, gmb: 25, reviews: 20 },
    clinica: { website: 30, instagram: 25, facebook: 10, gmb: 20, reviews: 15 },
    contabilidade: { website: 40, instagram: 5, facebook: 5, gmb: 30, reviews: 20 },
    estetica: { website: 20, instagram: 35, facebook: 10, gmb: 20, reviews: 15 },
    industria: { website: 45, instagram: 5, facebook: 5, gmb: 25, reviews: 20 },
    comercio_local: { website: 25, instagram: 20, facebook: 15, gmb: 25, reviews: 15 },
    restaurante: { website: 20, instagram: 30, facebook: 10, gmb: 25, reviews: 15 },
    academia: { website: 25, instagram: 30, facebook: 10, gmb: 20, reviews: 15 },
    pet_shop: { website: 20, instagram: 25, facebook: 15, gmb: 25, reviews: 15 },
    default: { website: 30, instagram: 15, facebook: 10, gmb: 25, reviews: 20 }
};

/**
 * Normaliza o nome do nicho para encontrar os pesos corretos.
 */
function resolveNiche(nicheInput) {
    if (!nicheInput) return 'default';
    const n = nicheInput.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    // Mapeamento fuzzy
    if (n.includes('dentist') || n.includes('odonto')) return 'dentista';
    if (n.includes('advogad') || n.includes('juridi') || n.includes('escritorio_de_advocacia')) return 'advogado';
    if (n.includes('clinic') || n.includes('medic') || n.includes('saude')) return 'clinica';
    if (n.includes('contab') || n.includes('contad')) return 'contabilidade';
    if (n.includes('estetic') || n.includes('beleza') || n.includes('salao')) return 'estetica';
    if (n.includes('industri') || n.includes('fabrica') || n.includes('manufat')) return 'industria';
    if (n.includes('restaur') || n.includes('pizz') || n.includes('lanche') || n.includes('bar_')) return 'restaurante';
    if (n.includes('academi') || n.includes('crossfit') || n.includes('gym') || n.includes('fitness')) return 'academia';
    if (n.includes('pet') || n.includes('veterinar')) return 'pet_shop';
    if (n.includes('comerci') || n.includes('loja') || n.includes('mercea')) return 'comercio_local';

    return 'default';
}

/**
 * Calcula score do lead baseado no nicho.
 * @param {Object} auditData - Dados auditados do lead
 * @param {string} niche - Nicho da busca (ex: "dentistas em SP")
 * @returns {{ score: number, priority: string, reasons: Array<{dor: string, peso: number, evidencia: string}> }}
 */
function calculateLeadScore(auditData, niche = '') {
    let score = 0;
    const motives = [];
    const nicheKey = resolveNiche(niche);
    const weights = NICHE_WEIGHTS[nicheKey] || NICHE_WEIGHTS.default;

    // === DIMENSÃO 1: Website ===
    if (!auditData.website) {
        score += weights.website;
        motives.push({
            dor: "Sem website (Forte oportunidade de desenvolvimento web)",
            peso: weights.website,
            evidencia: "Campo website não encontrado no Google Maps nem no enriquecimento"
        });
    }

    // === DIMENSÃO 2: Instagram ===
    if (!auditData.instagram) {
        score += weights.instagram;
        motives.push({
            dor: "Sem Instagram (Oportunidade p/ Gestão de Redes)",
            peso: weights.instagram,
            evidencia: "Nenhum link instagram.com encontrado no Maps ou website"
        });
    }

    // === DIMENSÃO 3: Facebook ===
    if (!auditData.facebook) {
        score += weights.facebook;
        motives.push({
            dor: "Sem Facebook",
            peso: weights.facebook,
            evidencia: "Nenhum link facebook.com encontrado"
        });
    }

    // === DIMENSÃO 4: GMB (Google Meu Negócio) ===
    const perfilIncompleto = !auditData.website && (!auditData.phone || auditData.rating === 0);
    if (perfilIncompleto) {
        score += Math.round(weights.gmb * 0.8);
        motives.push({
            dor: "Perfil Google Incompleto (Oportunidade GMB)",
            peso: Math.round(weights.gmb * 0.8),
            evidencia: "Sem website + sem telefone ou sem avaliações"
        });
    }

    if (!auditData.last_post) {
        score += Math.round(weights.gmb * 0.6);
        motives.push({
            dor: "Google Meu Negócio abandonado (sem postagens recentes)",
            peso: Math.round(weights.gmb * 0.6),
            evidencia: "Aba 'Atualizações' sem conteúdo recente"
        });
    }

    // WhatsApp como canal de contato (bônus)
    if (auditData.whatsapp || (auditData.other_public_links && auditData.other_public_links.some(l => l.includes('wa.me') || l.includes('whatsapp.com')))) {
        score += 5;
        motives.push({
            dor: "Canal de Contato Rápido (WhatsApp) ✅",
            peso: 5,
            evidencia: "Link WhatsApp encontrado"
        });
    }

    // === DIMENSÃO 5: Reviews ===
    if (auditData.rating === null || auditData.rating === 0) {
        score += weights.reviews;
        motives.push({
            dor: "Invisibilidade Digital (Nenhuma avaliação Google)",
            peso: weights.reviews,
            evidencia: "Rating = 0 ou inexistente no painel GMB"
        });
    } else if (auditData.rating < 4.0) {
        score += Math.round(weights.reviews * 1.2);
        motives.push({
            dor: `Nota Crítica ${auditData.rating} (Necessita gestão de reputação)`,
            peso: Math.round(weights.reviews * 1.2),
            evidencia: `Rating ${auditData.rating} no Google Maps`
        });
    } else if (auditData.rating < 4.5) {
        score += Math.round(weights.reviews * 0.5);
        motives.push({
            dor: `Nota Regular ${auditData.rating} (Pode melhorar)`,
            peso: Math.round(weights.reviews * 0.5),
            evidencia: `Rating ${auditData.rating} no Google Maps`
        });
    }

    if (auditData.reviews > 0 && auditData.reviews < 10) {
        score += Math.round(weights.reviews * 0.7);
        motives.push({
            dor: "Presença Digital Fraca (Poucas avaliações)",
            peso: Math.round(weights.reviews * 0.7),
            evidencia: `Apenas ${auditData.reviews} reviews`
        });
    }

    // === BÔNUS: Avaliações Negativas Expostas ===
    if (auditData.negative_reviews && auditData.negative_reviews.length > 0) {
        score += 20;
        motives.push({
            dor: `Possui ${auditData.negative_reviews.length} reclamações expostas no Google`,
            peso: 20,
            evidencia: auditData.negative_reviews[0] ? auditData.negative_reviews[0].substring(0, 80) + '...' : 'Reclamações encontradas na aba de reviews'
        });
    }

    // === BÔNUS: Links Públicos ===
    if (!auditData.other_public_links || auditData.other_public_links.length === 0) {
        score += 5;
        motives.push({
            dor: "Sem links públicos suficientes",
            peso: 5,
            evidencia: "Nenhum link adicional útil encontrado no enriquecimento"
        });
    }

    // === PENALIDADE: Sem telefone ===
    if (auditData.phone) {
        score += 10;
        motives.push({
            dor: "Canal de Contato Direto ✅",
            peso: 10,
            evidencia: `Telefone: ${auditData.phone}`
        });
    } else {
        score -= 20;
        motives.push({
            dor: "LEAD SEM TELEFONE (Difícil fechamento)",
            peso: -20,
            evidencia: "Nenhum telefone encontrado no Google Maps"
        });
    }

    // === Prioridade ===
    let priority = 'frio';
    if (score >= 80) {
        priority = 'quente';
    } else if (score >= 50) {
        priority = 'morno';
    }

    // Retrocompatibilidade: também expor reasons como array de strings
    const reasons = motives.map(m => m.dor);

    return {
        score,
        priority,
        reasons,
        motives_detailed: motives,
        niche_profile: nicheKey,
        weights_used: weights
    };
}

module.exports = { calculateLeadScore, NICHE_WEIGHTS, resolveNiche };
