function generateMessage(leadData = {}, auditData = {}, city = "") {
    try {
        const nome = leadData.company_name || auditData.name || 'sua empresa';
        const cidade = city || auditData.city || leadData.city || 'sua região';

        const pains = [];

        // Dores REAIS baseadas APENAS em ausência confirmada ou nota baixa confirmada
        if (auditData.website === null || auditData.website === "") {
            pains.push("dificuldade de ser encontrado no Google fora do Maps por não possuir um site ativo");
        }

        if (auditData.rating === 0 || auditData.rating === null) {
            pains.push("nenhuma avaliação no Google, o que reduz a confiança de novos potenciais clientes");
        } else if (typeof auditData.rating === 'number' && auditData.rating > 0 && auditData.rating < 4.0) {
            pains.push(`uma nota baixa no Google (${auditData.rating}), o que afasta clientes com alta intenção de compra`);
        }

        if (auditData.last_post === null || auditData.last_post === "") {
            pains.push("falta de atualização no Perfil da Empresa, reduzindo seu engajamento local");
        }

        if (auditData.instagram === null || auditData.instagram === "") {
            pains.push("ausência de perfil no Instagram para atrair um público mais jovem e visual");
        }

        if (Array.isArray(auditData.negative_reviews) && auditData.negative_reviews.length > 0) {
            pains.push("reclamações expostas no Google que prejudicam diretamente a conversão de vendas");
        }

        let message = `Olá, tudo bem? Aqui é da *Digital Prime*.\n\n`;

        let targetText = `notamos o perfil de vocês: *${nome}*`;
        if (cidade !== 'sua região' && cidade !== '') {
            targetText += ` em ${cidade}`;
        }

        message += `Estávamos analisando a presença digital de algumas empresas corporativas e ${targetText}.\n\n`;

        // Se houver dores reais, usamos até 3.
        if (pains.length > 0) {
            message += `Percebemos alguns pontos de melhoria que podem estar custando clientes todos os dias:\n`;
            pains.slice(0, 3).forEach(p => {
                message += `- _${p}_\n`;
            });
            message += `\nNós ajudamos empresas a resolverem isso e dominarem as buscas.`;
        } else {
            // Se NÃO houver dores listadas, fallback genérico e seguro (1 oportunidade genérica).
            message += `Percebemos uma oportunidade de otimização na sua presença online que pode atrair mais clientes todos os dias, melhorando seu destaque perante a concorrência no Google.\n\nNós ajudamos projetos de sucesso a dominarem as buscas locais de forma prática.`;
        }

        message += ` Faz sentido agendarmos um bate-papo rápido de 10 min para eu mostrar na tela como podemos escalar isso?`;

        return message;
    } catch (err) {
        // Fallback absoluto em caso de exceção de código - atende ao requisito "1 oportunidade genérica e nunca falhar"
        const n = (leadData && leadData.company_name) || (auditData && auditData.name) || 'sua empresa';
        const c = city || (auditData && auditData.city) || (leadData && leadData.city) || 'sua região';

        const loc = c !== 'sua região' ? ` em ${c}` : '';
        return `Olá, tudo bem? Aqui é da *Digital Prime*.\n\nNotamos o perfil da *${n}*${loc}. Vimos uma grande oportunidade de otimização na sua presença online que pode atrair mais clientes todos os dias, maximizando seu destaque no Google.\n\nFaz sentido agendarmos um bate-papo rápido de 10 min para eu mostrar na tela como podemos construir isso?`;
    }
}

module.exports = { generateMessage };
