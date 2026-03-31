function calculateLeadScore(auditData) {
    let score = 0;
    const motives = [];

    // Sem site vira oportunidade de venda
    if (!auditData.website) {
        score += 30;
        motives.push("Sem website (Forte oportunidade de desenvolvimento web)");
    }

    // Faltam redes sociais
    if (!auditData.instagram) {
        score += 15;
        motives.push("Sem Instagram (Oportunidade p/ Gestão de Redes)");
    }
    if (!auditData.facebook) {
        score += 10;
        motives.push("Sem Facebook");
    }

    // WhatsApp
    if (auditData.whatsapp || (auditData.other_public_links && auditData.other_public_links.some(l => l.includes('wa.me') || l.includes('whatsapp.com')))) {
        score += 10;
        motives.push("Canal de Contato Rápido (WhatsApp)");
    }

    // Gestão de reputação GMB e Perfil Completo
    const perfilIncompleto = !auditData.website && (!auditData.phone || auditData.rating === 0);
    if (perfilIncompleto) {
        score += 20;
        motives.push("Perfil Google Incompleto (Oportunidade GMB)");
    }

    if (auditData.rating === null || auditData.rating === 0) {
        score += 20;
        motives.push("Invisibilidade Digital (Nenhuma avaliação Google)");
    } else if (auditData.rating < 4.0) {
        score += 25;
        motives.push(`Nota Crítica ${auditData.rating} (Necessita gestão de reputação)`);
    } else if (auditData.rating < 4.5) {
        score += 10;
        motives.push(`Nota Regular ${auditData.rating} (Pode melhorar)`);
    }

    if (auditData.reviews > 0 && auditData.reviews < 10) {
        score += 15;
        motives.push("Presença Digital Fraca (Poucas avaliações)");
    }

    // Avaliações Negativas Expostas (dor urgente pro cliente)
    if (auditData.negative_reviews && auditData.negative_reviews.length > 0) {
        score += 20;
        motives.push(`Possui ${auditData.negative_reviews.length} reclamações difamando a marca expostas no Google`);
    }

    // SEO Local
    if (!auditData.last_post) {
        score += 15;
        motives.push("Google Meu Negócio abandonado (sem postagens recentes)");
    }

    // Links públicos
    if (!auditData.other_public_links || auditData.other_public_links.length === 0) {
        score += 10;
        motives.push("Sem links públicos suficientes");
    }

    // Criterio de ouro: a gente OBRIGATORIAMENTE PERDE PONTOS SE NÃO TIVERMOS COMO LIGAR PARA ELE!
    if (auditData.phone) {
        score += 10;
        motives.push("Canal de Contato Direto ✅");
    } else {
        score -= 20;
        motives.push("LEAD SEM TELEFONE (Difícil fechamento)");
    }

    // Set priority
    let priority = 'frio';
    if (score >= 80) {
        priority = 'quente';
    } else if (score >= 50) {
        priority = 'morno';
    }

    return {
        score,
        priority,
        reasons: motives
    };
}

module.exports = { calculateLeadScore };
