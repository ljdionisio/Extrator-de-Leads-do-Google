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

    // Gestão de reputação GMB
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

    // Criterio de ouro: a gente OBRIGATORIAMENTE PERDE PONTOS SE NÃO TIVERMOS COMO LIGAR PARA ELE!
    // (Pois é um lead comercial inútil se não tiver telefone)
    if (auditData.phone) {
        score += 10;
        motives.push("Canal de Contato Direto ✅");
    } else {
        score -= 20;
        motives.push("LEAD SEM TELEFONE (Difícil fechamento)");
    }

    // Set priority
    let priority = 'baixa';
    if (score >= 70) {
        priority = 'alta';
    } else if (score >= 40) {
        priority = 'média';
    }

    return {
        score,
        priority,
        reasons: motives
    };
}

module.exports = { calculateLeadScore };
