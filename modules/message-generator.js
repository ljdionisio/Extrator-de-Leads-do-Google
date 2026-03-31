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

        const whatsapp_curta = pains.length > 0
            ? `Olá, tudo bem? Aqui é da Digital Prime. Percebi que o perfil da *${nome}* no Google tem muito potencial, mas precisa de otimização urgente (ex: ${pains[0]}). Faz sentido eu enviar um áudio de 1 minuto mostrando como os concorrentes estão atraindo os clientes que vocês perdem?`
            : `Olá! Aqui é da Digital Prime. Vimos uma chance real de alavancar o Google da *${nome}*. Podemos bater um papo rápido de 5 minutos sobre resultados comerciais?`;

        const email = `Assunto: Oportunidade comercial estruturada para ${nome}\n\nOlá equipe da ${nome},\n\nMeu nome é Lucas, especialista na Digital Prime. Fazendo um mapeamento de mercado na região de ${cidade}, notamos o potencial do perfil de vocês no buscador do Google.\n\nContudo, identificamos gargalos invisíveis que prejudicam a captação:\n${pains.length > 0 ? pains.map(p => "- " + p).join("\n") : "- Otimização de posicionamento defasada"}\n\nNós implementamos ecossistemas comerciais para empresas locais e podemos escalar suas buscas diárias. Teria disponibilidade para uma reunião curta essa semana onde mostramos a estratégia?\n\nAbs,\nEquipe Prime`;

        const argumento_comercial = `Lead: ${nome}. Dores Urgentes: ${pains.length > 0 ? pains.join(" | ") : 'Genéricas'}. O SDR deve focar em como essas falhas invisíveis entregam os clientes de bandeja para os concorrentes próximos de ${cidade}. Oferecer uma auditoria visual de graça via Meets.`;

        return {
            whatsapp_curta,
            whatsapp_consultiva: message,
            email,
            argumento_comercial
        };
    } catch (err) {
        // Fallback absoluto em caso de exceção de código
        const n = (leadData && leadData.company_name) || (auditData && auditData.name) || 'sua empresa';
        const c = city || (auditData && auditData.city) || (leadData && leadData.city) || 'sua região';
        const loc = c !== 'sua região' ? ` em ${c}` : '';
        const consultivaFallback = `Olá, tudo bem? Aqui é da *Digital Prime*.\n\nNotamos o perfil da *${n}*${loc}. Vimos uma grande oportunidade de otimização na sua presença online que pode atrair mais clientes todos os dias, maximizando seu destaque no Google.\n\nFaz sentido agendarmos um bate-papo rápido de 10 min para eu mostrar na tela como podemos construir isso?`;

        return {
            whatsapp_curta: `Olá! Aqui é da Digital Prime. Vimos uma chance real de alavancar comercialmente o seu perfil no Google. Podemos bater um papo rápido?`,
            whatsapp_consultiva: consultivaFallback,
            email: `Assunto: Oportunidade no Google para ${n}\n\nOlá,\nNotamos uma grande oportunidade de crescimento comercial estruturado nas buscas locais para a sua marca.\n\nVamos alinhar uma conversa de 10 minutos essa semana?\n\nEquipe Prime`,
            argumento_comercial: "Destaque a necessidade de profissionalizar a fachada digital para bater metas comerciais locais."
        };
    }
}

module.exports = { generateMessage };
