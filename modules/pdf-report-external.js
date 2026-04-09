const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { getDesktopExportDir } = require('./path-helper.js');

/**
 * Gera relatório externo consultivo para o CLIENTE.
 * NÃO contém: score, quente/morno/frio, mensagem WhatsApp, argumento SDR.
 * CONTÉM: diagnóstico visual, medidor de saúde, falhas, concorrentes, CTA Digital Prime.
 */
async function generateExternalPDF(lead, niche, city) {
    if (!lead || !lead.name) return null;

    const dateStr = new Date().toLocaleString('pt-BR');
    const empresaNome = lead.name || 'Empresa';
    const rating = lead.rating || 0;
    const reviews = lead.reviews || 0;

    // Calcular saúde digital (0-100) para o gauge visual
    let healthScore = 100;
    const falhas = [];

    if (!lead.website) {
        healthScore -= 30;
        falhas.push({ icon: '🌐', titulo: 'Sem Website Profissional', desc: 'A empresa não possui um site próprio, perdendo todos os clientes que buscam por serviços no Google fora do Maps.', custo: 'Até 40% dos clientes desistem quando não encontram um site.' });
    }
    if (!lead.instagram) {
        healthScore -= 15;
        falhas.push({ icon: '📸', titulo: 'Sem Presença no Instagram', desc: 'Não foi encontrado um perfil ativo no Instagram, reduzindo a confiança de clientes que pesquisam a marca nas redes sociais.', custo: '73% dos consumidores pesquisam marcas nas redes antes de comprar.' });
    }
    if (!lead.facebook) {
        healthScore -= 10;
        falhas.push({ icon: '📘', titulo: 'Sem Facebook', desc: 'A marca não possui página no Facebook, limitando o alcance em um público que ainda usa a plataforma para buscas locais.' });
    }
    if (rating === 0 || rating === null) {
        healthScore -= 25;
        falhas.push({ icon: '⭐', titulo: 'Nenhuma Avaliação no Google', desc: 'O perfil não possui nenhuma avaliação, o que gera desconfiança imediata em potenciais clientes.', custo: 'Empresas com 0 avaliações perdem até 60% das oportunidades locais.' });
    } else if (rating < 4.0) {
        healthScore -= 20;
        falhas.push({ icon: '⚠️', titulo: `Nota Crítica: ${rating} estrelas`, desc: `Com apenas ${rating} estrelas e ${reviews} avaliações, a reputação online está abaixo do aceitável para o setor.`, custo: 'Cada estrela abaixo de 4.0 reduz em ~10% o volume de contatos.' });
    }
    if (!lead.last_post) {
        healthScore -= 15;
        falhas.push({ icon: '📅', titulo: 'Perfil Google Abandonado', desc: 'Não foram encontradas atualizações recentes no Google Meu Negócio, o que sinaliza ao Google que o negócio pode estar inativo.', custo: 'Perfis atualizados recebem 2x mais cliques que perfis parados.' });
    }
    if (lead.negative_reviews && lead.negative_reviews.length > 0) {
        healthScore -= 15;
        falhas.push({ icon: '🔴', titulo: `${lead.negative_reviews.length} Reclamações Expostas`, desc: 'Existem reclamações públicas visíveis no Google que podem estar afastando novos clientes.', custo: '94% dos consumidores evitam empresas com avaliações negativas visíveis.' });
    }

    if (healthScore < 0) healthScore = 0;

    // Cor do gauge
    let gaugeColor = '#10b981'; // verde
    let gaugeLabel = 'Saudável';
    if (healthScore < 40) { gaugeColor = '#ef4444'; gaugeLabel = 'Crítico'; }
    else if (healthScore < 70) { gaugeColor = '#f59e0b'; gaugeLabel = 'Atenção'; }

    // Concorrentes
    const concorrentes = lead.concorrentes_referencia || 'Dados não disponíveis neste lote.';

    // Oportunidades
    const oportunidades = [];
    if (!lead.website) oportunidades.push('Criação de site profissional otimizado para Google');
    if (!lead.instagram) oportunidades.push('Estruturação de perfil no Instagram com identidade visual');
    if (rating < 4.5 || reviews < 20) oportunidades.push('Gestão de reputação e avaliações no Google');
    if (!lead.last_post) oportunidades.push('Ativação do Google Meu Negócio com postagens regulares');
    if (!lead.whatsapp_url) oportunidades.push('Implementação de WhatsApp Business com link direto');
    oportunidades.push('Estratégia de SEO local para posicionamento competitivo');

    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; line-height: 1.6; }
            
            /* === CAPA === */
            .cover {
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
                color: white;
                padding: 80px 60px;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                justify-content: center;
                page-break-after: always;
            }
            .cover-badge {
                display: inline-block;
                background: rgba(139, 92, 246, 0.2);
                border: 1px solid rgba(139, 92, 246, 0.4);
                color: #a78bfa;
                padding: 8px 20px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 30px;
            }
            .cover h1 {
                font-size: 42px;
                font-weight: 800;
                line-height: 1.2;
                margin-bottom: 15px;
            }
            .cover h1 span { color: #8b5cf6; }
            .cover .subtitle {
                font-size: 20px;
                color: #94a3b8;
                font-weight: 300;
                margin-bottom: 50px;
            }
            .cover-meta {
                font-size: 14px;
                color: #64748b;
                border-top: 1px solid #334155;
                padding-top: 30px;
                margin-top: auto;
            }
            .cover-meta strong { color: #cbd5e1; }
            
            /* === PÁGINAS INTERNAS === */
            .page { 
                padding: 50px 60px; 
                page-break-inside: avoid;
            }
            .section-title {
                font-size: 22px;
                font-weight: 700;
                color: #0f172a;
                margin-bottom: 25px;
                padding-bottom: 10px;
                border-bottom: 3px solid #8b5cf6;
                display: inline-block;
            }
            .section-number {
                display: inline-block;
                background: #8b5cf6;
                color: white;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                text-align: center;
                line-height: 32px;
                font-weight: 700;
                font-size: 14px;
                margin-right: 12px;
            }
            
            /* === GAUGE DE SAÚDE === */
            .gauge-container {
                text-align: center;
                margin: 40px 0;
            }
            .gauge-circle {
                width: 200px;
                height: 200px;
                border-radius: 50%;
                border: 12px solid #e2e8f0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                position: relative;
            }
            .gauge-circle::before {
                content: '';
                position: absolute;
                top: -12px; left: -12px; right: -12px; bottom: -12px;
                border-radius: 50%;
                border: 12px solid transparent;
                border-top-color: ${gaugeColor};
                border-right-color: ${healthScore > 25 ? gaugeColor : 'transparent'};
                border-bottom-color: ${healthScore > 50 ? gaugeColor : 'transparent'};
                border-left-color: ${healthScore > 75 ? gaugeColor : 'transparent'};
            }
            .gauge-number { font-size: 48px; font-weight: 800; color: ${gaugeColor}; }
            .gauge-label { font-size: 14px; color: #64748b; font-weight: 600; text-transform: uppercase; }
            .gauge-sublabel { font-size: 16px; color: ${gaugeColor}; font-weight: 700; margin-top: 10px; }
            
            /* === CARDS DE FALHA === */
            .fail-card {
                background: #fef2f2;
                border-left: 4px solid #ef4444;
                border-radius: 0 8px 8px 0;
                padding: 20px 25px;
                margin-bottom: 15px;
                page-break-inside: avoid;
            }
            .fail-card h3 { font-size: 16px; color: #991b1b; margin-bottom: 6px; }
            .fail-card p { font-size: 14px; color: #64748b; }
            .fail-card .custo { font-size: 13px; color: #ef4444; font-weight: 600; margin-top: 8px; font-style: italic; }
            
            /* === OPORTUNIDADES === */
            .opp-item {
                background: #f0fdf4;
                border-left: 4px solid #10b981;
                border-radius: 0 8px 8px 0;
                padding: 15px 20px;
                margin-bottom: 10px;
                font-size: 15px;
                color: #166534;
            }
            
            /* === CTA === */
            .cta-box {
                background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
                color: white;
                border-radius: 12px;
                padding: 40px;
                text-align: center;
                margin: 40px 0;
            }
            .cta-box h2 { font-size: 24px; margin-bottom: 15px; }
            .cta-box p { font-size: 16px; opacity: 0.9; margin-bottom: 20px; }
            .cta-button {
                display: inline-block;
                background: white;
                color: #6d28d9;
                padding: 14px 40px;
                border-radius: 8px;
                font-weight: 700;
                font-size: 16px;
                text-decoration: none;
            }
            
            /* === CONCORRENTES === */
            .competitors-box {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 25px;
                margin: 20px 0;
            }
            
            /* === TIMELINE === */
            .timeline-item {
                display: flex;
                margin-bottom: 20px;
                align-items: flex-start;
            }
            .timeline-dot {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: #8b5cf6;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 14px;
                flex-shrink: 0;
                margin-right: 15px;
            }
            .timeline-content h4 { font-size: 15px; color: #1e293b; margin-bottom: 4px; }
            .timeline-content p { font-size: 13px; color: #64748b; }
            
            /* === FOOTER === */
            .footer {
                background: #f8fafc;
                border-top: 1px solid #e2e8f0;
                padding: 30px 60px;
                font-size: 12px;
                color: #94a3b8;
            }
            .footer strong { color: #64748b; }
        </style>
    </head>
    <body>
        <!-- CAPA -->
        <div class="cover">
            <div class="cover-badge">Diagnóstico Digital Exclusivo</div>
            <h1>Análise de Presença<br>Digital para <span>${empresaNome}</span></h1>
            <p class="subtitle">Relatório consultivo sobre visibilidade, reputação e oportunidades de crescimento online.</p>
            <div class="cover-meta">
                <p><strong>Empresa:</strong> ${empresaNome}</p>
                <p><strong>Setor:</strong> ${niche}</p>
                <p><strong>Região:</strong> ${city}</p>
                <p><strong>Data:</strong> ${dateStr}</p>
                <p><strong>Elaborado por:</strong> Digital Prime — Ecossistema Digital Inteligente</p>
            </div>
        </div>
        
        <!-- RESUMO EXECUTIVO -->
        <div class="page">
            <div class="section-title"><span class="section-number">1</span> Resumo Executivo</div>
            <p style="font-size: 16px; color: #475569; margin-bottom: 30px;">
                Realizamos uma análise automatizada da presença digital da <strong>${empresaNome}</strong> 
                com base nos dados públicos disponíveis no Google Maps, redes sociais e website. 
                O objetivo é identificar pontos de melhoria que podem estar custando clientes todos os dias.
            </p>
            
            <!-- MEDIDOR DE SAÚDE -->
            <div class="section-title"><span class="section-number">2</span> Saúde Digital</div>
            <div class="gauge-container">
                <div class="gauge-circle">
                    <span class="gauge-number">${healthScore}</span>
                    <span class="gauge-label">de 100</span>
                </div>
                <p class="gauge-sublabel">Status: ${gaugeLabel}</p>
                <p style="font-size: 13px; color: #94a3b8; margin-top: 10px;">
                    ${healthScore < 40 ? 'A presença digital necessita de atenção urgente.' :
            healthScore < 70 ? 'Existem pontos de melhoria significativos.' :
                'A base digital é razoável, mas pode ser otimizada.'}
                </p>
            </div>
            
            <!-- INFO BÁSICA -->
            <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p><strong>📍 Endereço:</strong> ${lead.address || 'Não informado'}</p>
                <p><strong>📞 Telefone:</strong> ${lead.phone || 'Não encontrado'}</p>
                <p><strong>⭐ Avaliação Google:</strong> ${rating > 0 ? `${rating} estrelas (${reviews} avaliações)` : 'Nenhuma avaliação encontrada'}</p>
                <p><strong>🌐 Website:</strong> ${lead.website || '<em>Não possui</em>'}</p>
                <p><strong>📸 Instagram:</strong> ${lead.instagram || '<em>Não encontrado</em>'}</p>
            </div>
        </div>
        
        <!-- FALHAS -->
        ${falhas.length > 0 ? `
        <div class="page">
            <div class="section-title"><span class="section-number">3</span> Principais Falhas Identificadas</div>
            ${falhas.map(f => `
                <div class="fail-card">
                    <h3>${f.icon} ${f.titulo}</h3>
                    <p>${f.desc}</p>
                    ${f.custo ? `<p class="custo">💰 ${f.custo}</p>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <!-- CONCORRENTES -->
        <div class="page">
            <div class="section-title"><span class="section-number">4</span> Concorrentes Mais Fortes no Digital</div>
            <div class="competitors-box">
                <p style="font-size: 14px; color: #475569;">
                    Empresas do mesmo setor e região que possuem melhor posicionamento:
                </p>
                <p style="font-size: 15px; color: #1e293b; font-weight: 600; margin-top: 10px;">
                    ${concorrentes}
                </p>
                <p style="font-size: 13px; color: #94a3b8; margin-top: 10px;">
                    Estes concorrentes estão capturando clientes que poderiam ser seus.
                </p>
            </div>
            
            <!-- OPORTUNIDADES -->
            <div class="section-title"><span class="section-number">5</span> Oportunidades Práticas</div>
            ${oportunidades.map(o => `<div class="opp-item">✅ ${o}</div>`).join('')}
        </div>
        
        <!-- CTA DIGITAL PRIME -->
        <div class="page">
            <div class="section-title"><span class="section-number">6</span> Como a Digital Prime Pode Ajudar</div>
            <p style="font-size: 15px; color: #475569; margin-bottom: 20px;">
                A Digital Prime é especialista em transformar a presença digital de empresas locais. 
                Atuamos com soluções sob medida que cobrem cada ponto identificado neste relatório.
            </p>
            
            <div class="cta-box">
                <h2>Vamos transformar sua presença digital?</h2>
                <p>Agende uma conversa gratuita de 15 minutos para discutir um plano de ação personalizado.</p>
                <span class="cta-button">Falar com a Digital Prime</span>
            </div>
            
            <!-- TIMELINE 30/60/90 -->
            <div class="section-title"><span class="section-number">7</span> Plano Sugerido de Evolução</div>
            <div class="timeline-item">
                <div class="timeline-dot">30d</div>
                <div class="timeline-content">
                    <h4>Fundação Digital (Primeiros 30 dias)</h4>
                    <p>Ativação do Google Meu Negócio, ${!lead.website ? 'criação de site profissional,' : ''} configuração de perfis sociais e primeira onda de otimizações.</p>
                </div>
            </div>
            <div class="timeline-item">
                <div class="timeline-dot">60d</div>
                <div class="timeline-content">
                    <h4>Crescimento Visível (30-60 dias)</h4>
                    <p>SEO local ativo, gestão de reputação, conteúdo recorrente e primeiras melhorias em avaliações.</p>
                </div>
            </div>
            <div class="timeline-item">
                <div class="timeline-dot">90d</div>
                <div class="timeline-content">
                    <h4>Domínio de Mercado (60-90 dias)</h4>
                    <p>Posicionamento competitivo consolidado, fluxo de leads orgânicos e funil de conversão automatizado.</p>
                </div>
            </div>
        </div>
        
        <!-- FOOTER -->
        <div class="footer">
            <p><strong>Fonte dos dados:</strong> Google Maps, website público e redes sociais abertas.</p>
            <p><strong>Limitações:</strong> Este diagnóstico é baseado em dados públicos capturados automaticamente. 
            Alguns dados podem estar desatualizados ou incompletos. Recomendamos validação direta.</p>
            <p style="margin-top: 10px;"><strong>Digital Prime</strong> — Ecossistema Digital Inteligente | ${dateStr}</p>
        </div>
    </body>
    </html>
    `;

    const pdfBrowser = await chromium.launch({ headless: true });
    const page = await pdfBrowser.newPage();
    await page.setContent(html, { waitUntil: 'load' });

    const safeName = `Diagnostico_Digital_${empresaNome}_${Date.now()}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase() + '.pdf';
    const filePath = path.join(getDesktopExportDir(), safeName);

    await page.pdf({
        path: filePath,
        format: 'A4',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        printBackground: true
    });

    await pdfBrowser.close();
    return filePath;
}

module.exports = { generateExternalPDF };
