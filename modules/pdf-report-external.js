const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { getDesktopExportDir } = require('./path-helper.js');

/**
 * Gera relatório externo consultivo para o CLIENTE.
 * 
 * PROTOCOLO DE VERDADE:
 * - NÃO contém: score, quente/morno/frio, mensagem WhatsApp, argumento SDR, prioridade comercial
 * - NÃO usa percentuais sem fonte comprovada
 * - NÃO trata concorrentes como certeza (usa "possíveis concorrentes digitais observáveis")
 * - USA linguagem observacional: "foi observado que...", "não foi possível confirmar..."
 * - CONTÉM: diagnóstico visual, nota consultiva, falhas observáveis, oportunidades, CTA Digital Prime
 * 
 * NOTA DE SAÚDE DIGITAL:
 * A nota é calculada por um algoritmo interno baseado em presença/ausência de canais digitais.
 * Não é uma métrica científica; é um instrumento consultivo visual para facilitar a conversa comercial.
 * Racional: inicia em 100 e deduz pontos por ausência de canal ou indicador digital observável.
 */
async function generateExternalPDF(lead, niche, city) {
    if (!lead || !lead.name) return null;

    const dateStr = new Date().toLocaleString('pt-BR');
    const empresaNome = lead.name || 'Empresa';
    const rating = lead.rating || 0;
    const reviews = lead.reviews || 0;

    // --- CÁLCULO DA NOTA DE SAÚDE DIGITAL ---
    // Racional: nota consultiva visual, não métrica científica.
    // Inicia em 100 e deduz por ausência de canais observáveis.
    let healthScore = 100;
    const falhas = [];

    if (!lead.website) {
        healthScore -= 30;
        falhas.push({
            icon: '🌐',
            titulo: 'Website não identificado',
            desc: 'Não foi possível identificar um site próprio nos dados públicos analisados. Empresas sem site tendem a perder visibilidade em buscas fora do Google Maps.',
            nota: 'Recomendação: avaliar a criação de um site profissional para ampliar a captação orgânica.'
        });
    }
    if (!lead.instagram) {
        healthScore -= 15;
        falhas.push({
            icon: '📸',
            titulo: 'Instagram não encontrado',
            desc: 'Não foi localizado um perfil no Instagram vinculado ao negócio. A ausência pode limitar a confiança de consumidores que pesquisam marcas nas redes sociais antes de comprar.',
            nota: 'Hipótese de melhoria: criar ou vincular perfil profissional no Instagram.'
        });
    }
    if (!lead.facebook) {
        healthScore -= 10;
        falhas.push({
            icon: '📘',
            titulo: 'Facebook não encontrado',
            desc: 'Não foi localizada uma página no Facebook. Embora com menor relevância que outros canais, o Facebook ainda é utilizado para buscas locais por parte do público.'
        });
    }
    if (rating === 0 || rating === null) {
        healthScore -= 25;
        falhas.push({
            icon: '⭐',
            titulo: 'Nenhuma avaliação no Google',
            desc: 'O perfil Google Meu Negócio não possui avaliações. Perfis sem avaliações tendem a gerar menos confiança em potenciais clientes que comparam opções.',
            nota: 'Recomendação: iniciar uma estratégia de solicitação de avaliações junto a clientes satisfeitos.'
        });
    } else if (rating < 4.0) {
        healthScore -= 20;
        falhas.push({
            icon: '⚠️',
            titulo: `Avaliação observada: ${rating} estrelas`,
            desc: `Foi observada uma nota de ${rating} estrelas com ${reviews} avaliações. Notas abaixo de 4.0 podem reduzir a taxa de contato por parte de potenciais clientes.`,
            nota: 'Recomendação: avaliar gestão ativa de reputação e respostas a avaliações.'
        });
    }
    if (!lead.last_post) {
        healthScore -= 15;
        falhas.push({
            icon: '📅',
            titulo: 'Sem atualizações recentes no Google',
            desc: 'Não foram encontradas postagens recentes no Google Meu Negócio. Perfis com atualizações frequentes tendem a receber maior destaque nas buscas locais.',
            nota: 'Hipótese de melhoria: publicar atualizações periódicas no perfil Google.'
        });
    }
    if (lead.negative_reviews && lead.negative_reviews.length > 0) {
        healthScore -= 15;
        falhas.push({
            icon: '🔴',
            titulo: `${lead.negative_reviews.length} reclamação(ões) observada(s)`,
            desc: 'Foram identificadas reclamações públicas no Google. Avaliações negativas visíveis podem influenciar a decisão de potenciais clientes.',
            nota: 'Recomendação: responder publicamente às avaliações e trabalhar os pontos mencionados.'
        });
    }

    if (healthScore < 0) healthScore = 0;

    // Cor e label do gauge
    let gaugeColor = '#10b981';
    let gaugeLabel = 'Saudável';
    if (healthScore < 40) { gaugeColor = '#ef4444'; gaugeLabel = 'Requer Atenção'; }
    else if (healthScore < 70) { gaugeColor = '#f59e0b'; gaugeLabel = 'Pode Melhorar'; }

    // Concorrentes — linguagem observacional
    const concorrentes = lead.concorrentes_referencia || 'Nenhum dado de concorrência disponível neste lote de análise.';

    // Oportunidades — baseadas estritamente no observado
    const oportunidades = [];
    if (!lead.website) oportunidades.push('Criação de site profissional otimizado para buscas no Google');
    if (!lead.instagram) oportunidades.push('Estruturação de perfil no Instagram com identidade visual');
    if (rating < 4.5 || reviews < 20) oportunidades.push('Gestão de reputação e incentivo a avaliações no Google');
    if (!lead.last_post) oportunidades.push('Ativação do Google Meu Negócio com postagens regulares');
    if (!lead.whatsapp_url) oportunidades.push('Implementação de WhatsApp Business com link direto no perfil');
    oportunidades.push('Avaliação de estratégia de SEO local para posicionamento competitivo');

    // Canais encontrados
    const canais = [];
    if (lead.website) canais.push({ nome: 'Website', valor: lead.website, status: '✅' });
    else canais.push({ nome: 'Website', valor: 'Não identificado', status: '❌' });
    if (lead.instagram) canais.push({ nome: 'Instagram', valor: lead.instagram, status: '✅' });
    else canais.push({ nome: 'Instagram', valor: 'Não encontrado', status: '❌' });
    if (lead.facebook) canais.push({ nome: 'Facebook', valor: lead.facebook, status: '✅' });
    else canais.push({ nome: 'Facebook', valor: 'Não encontrado', status: '❌' });
    if (lead.whatsapp_url) canais.push({ nome: 'WhatsApp', valor: lead.whatsapp_url, status: '✅' });
    else canais.push({ nome: 'WhatsApp', valor: 'Não encontrado', status: '❌' });
    if (lead.email) canais.push({ nome: 'Email', valor: lead.email, status: '✅' });

    // Escape HTML para segurança
    const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; line-height: 1.6; }
            .cover {
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
                color: white; padding: 80px 60px; min-height: 100vh;
                display: flex; flex-direction: column; justify-content: center;
                page-break-after: always;
            }
            .cover-badge { display: inline-block; background: rgba(139,92,246,0.2); border: 1px solid rgba(139,92,246,0.4); color: #a78bfa; padding: 8px 20px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 30px; }
            .cover h1 { font-size: 42px; font-weight: 800; line-height: 1.2; margin-bottom: 15px; }
            .cover h1 span { color: #8b5cf6; }
            .cover .subtitle { font-size: 20px; color: #94a3b8; font-weight: 300; margin-bottom: 50px; }
            .cover-meta { font-size: 14px; color: #64748b; border-top: 1px solid #334155; padding-top: 30px; margin-top: auto; }
            .cover-meta strong { color: #cbd5e1; }
            .page { padding: 50px 60px; page-break-inside: avoid; }
            .section-title { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 25px; padding-bottom: 10px; border-bottom: 3px solid #8b5cf6; display: inline-block; }
            .section-number { display: inline-block; background: #8b5cf6; color: white; width: 32px; height: 32px; border-radius: 50%; text-align: center; line-height: 32px; font-weight: 700; font-size: 14px; margin-right: 12px; }
            .gauge-container { text-align: center; margin: 40px 0; }
            .gauge-circle { width: 200px; height: 200px; border-radius: 50%; border: 12px solid #e2e8f0; display: inline-flex; align-items: center; justify-content: center; flex-direction: column; position: relative; }
            .gauge-circle::before { content: ''; position: absolute; top: -12px; left: -12px; right: -12px; bottom: -12px; border-radius: 50%; border: 12px solid transparent; border-top-color: ${gaugeColor}; border-right-color: ${healthScore > 25 ? gaugeColor : 'transparent'}; border-bottom-color: ${healthScore > 50 ? gaugeColor : 'transparent'}; border-left-color: ${healthScore > 75 ? gaugeColor : 'transparent'}; }
            .gauge-number { font-size: 48px; font-weight: 800; color: ${gaugeColor}; }
            .gauge-label { font-size: 14px; color: #64748b; font-weight: 600; text-transform: uppercase; }
            .gauge-sublabel { font-size: 16px; color: ${gaugeColor}; font-weight: 700; margin-top: 10px; }
            .fail-card { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; padding: 20px 25px; margin-bottom: 15px; page-break-inside: avoid; }
            .fail-card h3 { font-size: 16px; color: #991b1b; margin-bottom: 6px; }
            .fail-card p { font-size: 14px; color: #64748b; }
            .fail-card .nota { font-size: 13px; color: #7c3aed; font-weight: 500; margin-top: 8px; font-style: italic; }
            .opp-item { background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 0 8px 8px 0; padding: 15px 20px; margin-bottom: 10px; font-size: 15px; color: #166534; }
            .canal-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
            .canal-row:last-child { border-bottom: none; }
            .cta-box { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; border-radius: 12px; padding: 40px; text-align: center; margin: 40px 0; }
            .cta-box h2 { font-size: 24px; margin-bottom: 15px; }
            .cta-box p { font-size: 16px; opacity: 0.9; margin-bottom: 10px; }
            .cta-button { display: inline-block; background: white; color: #6d28d9; padding: 14px 40px; border-radius: 8px; font-weight: 700; font-size: 16px; text-decoration: none; margin-top: 15px; }
            .competitors-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 25px; margin: 20px 0; }
            .timeline-item { display: flex; margin-bottom: 20px; align-items: flex-start; }
            .timeline-dot { width: 40px; height: 40px; border-radius: 50%; background: #8b5cf6; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; margin-right: 15px; }
            .timeline-content h4 { font-size: 15px; color: #1e293b; margin-bottom: 4px; }
            .timeline-content p { font-size: 13px; color: #64748b; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 30px 60px; font-size: 12px; color: #94a3b8; }
            .footer strong { color: #64748b; }
            .disclaimer { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 30px 0; font-size: 12px; color: #64748b; line-height: 1.7; }
        </style>
    </head>
    <body>
        <!-- CAPA -->
        <div class="cover">
            <div class="cover-badge">Diagnóstico Digital Consultivo</div>
            <h1>Análise de Presença<br>Digital para <span>${esc(empresaNome)}</span></h1>
            <p class="subtitle">Relatório baseado em dados públicos sobre visibilidade, reputação e oportunidades de crescimento online.</p>
            <div class="cover-meta">
                <p><strong>Empresa:</strong> ${esc(empresaNome)}</p>
                <p><strong>Setor:</strong> ${esc(niche)}</p>
                <p><strong>Região:</strong> ${esc(city)}</p>
                <p><strong>Data:</strong> ${dateStr}</p>
                <p><strong>Elaborado por:</strong> Digital Prime — Ecossistema Digital Inteligente</p>
            </div>
        </div>
        
        <!-- RESUMO EXECUTIVO -->
        <div class="page">
            <div class="section-title"><span class="section-number">1</span> Resumo Executivo</div>
            <p style="font-size: 16px; color: #475569; margin-bottom: 30px;">
                Realizamos uma análise automatizada da presença digital da <strong>${esc(empresaNome)}</strong> 
                com base nos dados públicos disponíveis no Google Maps, redes sociais e website. 
                O objetivo é identificar pontos observáveis que podem representar oportunidades de melhoria.
            </p>
            
            <!-- NOTA DE SAÚDE DIGITAL -->
            <div class="section-title"><span class="section-number">2</span> Nota Consultiva de Saúde Digital</div>
            <div class="gauge-container">
                <div class="gauge-circle">
                    <span class="gauge-number">${healthScore}</span>
                    <span class="gauge-label">de 100</span>
                </div>
                <p class="gauge-sublabel">Status: ${gaugeLabel}</p>
                <p style="font-size: 12px; color: #94a3b8; margin-top: 10px; max-width: 500px; display: inline-block;">
                    Esta nota é um instrumento consultivo visual, calculado com base na presença ou ausência de canais digitais observáveis. Não representa uma métrica científica exata.
                </p>
            </div>
            
            <!-- INFO BÁSICA -->
            <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p><strong>📍 Endereço:</strong> ${esc(lead.address) || 'Não informado'}</p>
                <p><strong>📞 Telefone:</strong> ${esc(lead.phone) || 'Não encontrado'}</p>
                <p><strong>⭐ Avaliação Google:</strong> ${rating > 0 ? `${rating} estrelas (${reviews} avaliações)` : 'Nenhuma avaliação encontrada'}</p>
                <p><strong>🌐 Website:</strong> ${esc(lead.website) || '<em>Não identificado</em>'}</p>
                <p><strong>📸 Instagram:</strong> ${esc(lead.instagram) || '<em>Não encontrado</em>'}</p>
            </div>
        </div>
        
        <!-- CANAIS ENCONTRADOS -->
        <div class="page">
            <div class="section-title"><span class="section-number">3</span> Canais Digitais Identificados</div>
            <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                ${canais.map(c => `<div class="canal-row"><span><strong>${c.nome}</strong></span><span>${c.status} ${esc(c.valor)}</span></div>`).join('')}
            </div>

            <!-- FALHAS -->
            ${falhas.length > 0 ? `
            <div class="section-title"><span class="section-number">4</span> Pontos de Atenção Observados</div>
            ${falhas.map(f => `
                <div class="fail-card">
                    <h3>${f.icon} ${esc(f.titulo)}</h3>
                    <p>${f.desc}</p>
                    ${f.nota ? `<p class="nota">💡 ${f.nota}</p>` : ''}
                </div>
            `).join('')}
            ` : ''}
        </div>
        
        <!-- CONCORRENTES OBSERVÁVEIS -->
        <div class="page">
            <div class="section-title"><span class="section-number">5</span> Possíveis Concorrentes Digitais Observáveis</div>
            <div class="competitors-box">
                <p style="font-size: 13px; color: #92400e; margin-bottom: 10px;">
                    ⚠️ Os dados abaixo foram extraídos do mesmo lote de busca. Não representam uma análise competitiva completa.
                </p>
                <p style="font-size: 15px; color: #1e293b; font-weight: 600; margin-top: 10px;">
                    ${esc(concorrentes)}
                </p>
                <p style="font-size: 12px; color: #94a3b8; margin-top: 10px;">
                    Para uma análise competitiva aprofundada, recomenda-se pesquisa dedicada por setor e região.
                </p>
            </div>
            
            <!-- OPORTUNIDADES -->
            <div class="section-title"><span class="section-number">6</span> Oportunidades Práticas Identificadas</div>
            ${oportunidades.map(o => `<div class="opp-item">✅ ${o}</div>`).join('')}
        </div>
        
        <!-- PLANO CONSULTIVO + CTA -->
        <div class="page">
            <div class="section-title"><span class="section-number">7</span> Plano Consultivo Sugerido</div>
            <div class="timeline-item">
                <div class="timeline-dot">30d</div>
                <div class="timeline-content">
                    <h4>Fundação Digital (Primeiros 30 dias)</h4>
                    <p>Ativação do Google Meu Negócio, ${!lead.website ? 'avaliação de criação de site profissional,' : ''} configuração de perfis sociais e primeiras otimizações.</p>
                </div>
            </div>
            <div class="timeline-item">
                <div class="timeline-dot">60d</div>
                <div class="timeline-content">
                    <h4>Crescimento (30-60 dias)</h4>
                    <p>SEO local, gestão de reputação, conteúdo recorrente e acompanhamento de avaliações.</p>
                </div>
            </div>
            <div class="timeline-item">
                <div class="timeline-dot">90d</div>
                <div class="timeline-content">
                    <h4>Consolidação (60-90 dias)</h4>
                    <p>Revisão de posicionamento, análise de resultados e ajuste contínuo da estratégia digital.</p>
                </div>
            </div>

            <p style="font-size: 12px; color: #94a3b8; margin-top: 15px; font-style: italic;">
                Este é um plano sugerido baseado nos pontos observados. Os prazos e resultados reais dependem de diversos fatores específicos de cada negócio. Isto é uma projeção consultiva, não uma garantia de resultado.
            </p>
            
            <!-- CTA DIGITAL PRIME -->
            <div class="cta-box">
                <h2>Quer transformar esses pontos em resultados?</h2>
                <p>A Digital Prime é especialista em presença digital para empresas locais.</p>
                <p>Agende uma conversa gratuita e sem compromisso.</p>
                <p style="font-size: 14px; opacity: 0.8;">📞 WhatsApp: (XX) XXXXX-XXXX</p>
                <p style="font-size: 14px; opacity: 0.8;">🌐 digitalprime.com.br</p>
                <span class="cta-button">Falar com a Digital Prime</span>
            </div>
        </div>
        
        <!-- FONTES, LIMITAÇÕES E DISCLAIMER -->
        <div class="page">
            <div class="section-title"><span class="section-number">8</span> Fontes e Limitações</div>
            <div class="disclaimer">
                <p><strong>Fontes dos dados:</strong> Google Maps (perfil público), website institucional (quando disponível) e perfis de redes sociais vinculados ao perfil Google ou website.</p>
                <p style="margin-top: 8px;"><strong>Método de coleta:</strong> Captura automatizada de dados públicos disponíveis na web aberta. Nenhuma informação privada foi acessada.</p>
                <p style="margin-top: 8px;"><strong>Limitações importantes:</strong></p>
                <ul style="margin-top: 5px; padding-left: 20px;">
                    <li>Dados podem estar desatualizados no momento da leitura</li>
                    <li>A ausência de um canal pode significar que ele existe mas não foi vinculado ao perfil público</li>
                    <li>A nota de saúde digital é um instrumento consultivo visual, não uma métrica científica</li>
                    <li>A seção de concorrentes é baseada no mesmo lote de busca, não em análise de mercado dedicada</li>
                    <li>Recomendações são hipóteses de melhoria, não garantias de resultado</li>
                </ul>
                <p style="margin-top: 12px;"><strong>Classificação do conteúdo:</strong></p>
                <ul style="margin-top: 5px; padding-left: 20px;">
                    <li><strong>Fatos observados:</strong> presença ou ausência de canais, nota e número de avaliações</li>
                    <li><strong>Hipóteses de melhoria:</strong> recomendações de ação baseadas nas observações</li>
                    <li><strong>Projeções consultivas:</strong> plano de 30/60/90 dias e estimativas de impacto</li>
                </ul>
            </div>
        </div>

        <!-- FOOTER -->
        <div class="footer">
            <p><strong>Digital Prime</strong> — Ecossistema Digital Inteligente</p>
            <p>Este documento foi gerado em ${dateStr} e reflete os dados públicos disponíveis naquele momento.</p>
            <p>Para informações completas, entre em contato: digitalprime.com.br</p>
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
