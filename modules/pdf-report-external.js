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

    // --- CARREGAMENTO DE LOGOS EM BASE64 ---
    const rootDir = path.resolve(__dirname, '..');
    let logoBannerB64 = '';
    let logoCircularB64 = '';
    try {
        const bannerPath = path.join(rootDir, 'logo-digital-prime-studio-sp.png');
        const circularPath = path.join(rootDir, 'logo-digital-prime-studio.png');
        if (fs.existsSync(bannerPath)) {
            logoBannerB64 = 'data:image/png;base64,' + fs.readFileSync(bannerPath).toString('base64');
        }
        if (fs.existsSync(circularPath)) {
            logoCircularB64 = 'data:image/png;base64,' + fs.readFileSync(circularPath).toString('base64');
        }
    } catch (e) { /* logos opcionais */ }

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
            ${logoBannerB64 ? `<div style="text-align: center; margin-bottom: 40px;"><img src="${logoBannerB64}" style="width: 100%; max-width: 480px; border-radius: 10px; filter: drop-shadow(0 6px 20px rgba(139,92,246,0.5));" alt="Digital Prime Studio" /></div>` : ''}
            <div class="cover-badge">Diagnóstico Digital Consultivo</div>
            <h1>Análise de Presença<br>Digital para <span>${esc(empresaNome)}</span></h1>
            <p class="subtitle">Relatório baseado em dados públicos sobre visibilidade, reputação e oportunidades de crescimento online.</p>
            <div class="cover-meta">
                <p><strong>Empresa:</strong> ${esc(empresaNome)}</p>
                <p><strong>Setor:</strong> ${esc(niche)}</p>
                <p><strong>Região:</strong> ${esc(city)}</p>
                <p><strong>Data:</strong> ${dateStr}</p>
                <p><strong>Elaborado por:</strong> Digital Prime Studio — Ecossistema Digital Inteligente</p>
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
                ${logoCircularB64 ? `<img src="${logoCircularB64}" style="width: 70px; height: 70px; border-radius: 50%; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" alt="Digital Prime Studio" />` : ''}
                <h2>Quer transformar esses pontos em resultados?</h2>
                <p>A Digital Prime Studio é especialista em presença digital para empresas locais.</p>
                <p>Agende uma conversa gratuita e sem compromisso com o <strong>Lucas</strong>.</p>
                <p style="font-size: 14px; opacity: 0.9;">📞 WhatsApp: <a href="https://wa.me/5513996519515?text=Ol%C3%A1%20Lucas%2C%20recebi%20o%20diagn%C3%B3stico%20digital%20e%20gostaria%20de%20conversar" style="color: white; text-decoration: underline;">(13) 99651-9515</a></p>
                <p style="font-size: 14px; opacity: 0.9;">🌐 Site: <a href="https://www.digitalprimestudio.com.br" style="color: white; text-decoration: underline;">www.digitalprimestudio.com.br</a></p>
                <a href="https://wa.me/5513996519515?text=Ol%C3%A1%20Lucas%2C%20recebi%20o%20diagn%C3%B3stico%20digital%20e%20gostaria%20de%20conversar" class="cta-button">Falar com o Lucas</a>
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
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                ${logoCircularB64 ? `<img src="${logoCircularB64}" style="width: 32px; height: 32px; border-radius: 50%;" alt="" />` : ''}
                <strong>Digital Prime Studio</strong> — Ecossistema Digital Inteligente
            </div>
            <p>Este documento foi gerado em ${dateStr} e reflete os dados públicos disponíveis naquele momento.</p>
            <p>Para informações completas: <a href="https://www.digitalprimestudio.com.br" style="color: #64748b;">www.digitalprimestudio.com.br</a> | WhatsApp: <a href="https://wa.me/5513996519515" style="color: #64748b;">(13) 99651-9515</a></p>
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

/**
 * Gera PDF PREMIUM com evidência visual para 1 lead selecionado.
 * 
 * Este PDF é a peça consultiva forte com prova observável.
 * Inclui screenshots embarcados, links clicáveis dos canais do cliente,
 * e linguagem estritamente observacional.
 * 
 * @param {Object} lead - Lead com dados extraídos
 * @param {string} niche - Nicho
 * @param {string} city - Cidade
 * @param {Object} evidence - Evidência estruturada do premium-report-engine
 */
async function generatePremiumPDF(lead, niche, city, evidence) {
    if (!lead || !lead.name) return null;

    const dateStr = new Date().toLocaleString('pt-BR');
    const empresaNome = lead.name || 'Empresa';
    const rating = lead.rating || 0;
    const reviews = lead.reviews || 0;

    // --- LOGOS ---
    const rootDir = path.resolve(__dirname, '..');
    let logoBannerB64 = '';
    let logoCircularB64 = '';
    try {
        const bannerPath = path.join(rootDir, 'logo-digital-prime-studio-sp.png');
        const circularPath = path.join(rootDir, 'logo-digital-prime-studio.png');
        if (fs.existsSync(bannerPath)) logoBannerB64 = 'data:image/png;base64,' + fs.readFileSync(bannerPath).toString('base64');
        if (fs.existsSync(circularPath)) logoCircularB64 = 'data:image/png;base64,' + fs.readFileSync(circularPath).toString('base64');
    } catch (e) { }

    // --- SCREENSHOTS BASE64 ---
    const { screenshotToBase64 } = require('./screenshots-manager.js');
    const leadId = evidence?.lead_id || lead.lead_id_estavel || '';
    const screenshotDir = path.resolve(rootDir, 'data', 'screenshots', leadId);
    const screenshotImages = {};
    if (evidence?.screenshots) {
        for (const shot of evidence.screenshots) {
            if (shot.path && shot.filename && shot.filename.endsWith('.png')) {
                const b64 = screenshotToBase64(shot.path);
                if (b64) screenshotImages[shot.tipo || shot.filename] = { b64, descricao: shot.descricao || '', tipo: shot.tipo };
            }
        }
    }

    // --- SAÚDE DIGITAL ---
    let healthScore = 100;
    const falhas = [];

    if (!lead.website) {
        healthScore -= 30;
        falhas.push({ icon: '🌐', titulo: 'Website não identificado', desc: 'Não foi possível identificar um site institucional nos dados públicos analisados.', evidencia: 'Dado observado no Google Maps e enriquecimento.', impacto: 'Reduz visibilidade fora do Google Maps e pode dificultar captação orgânica.', nota: 'Hipótese de melhoria: avaliar a criação de site profissional.' });
    }
    if (!lead.instagram) {
        healthScore -= 15;
        falhas.push({ icon: '📸', titulo: 'Instagram não encontrado', desc: 'Não foi localizado perfil no Instagram vinculado ao negócio.', evidencia: 'Verificado nos links do Google Maps e website (quando disponível).', impacto: 'Pode limitar confiança de consumidores que pesquisam nas redes sociais.', nota: 'Hipótese de melhoria: criar perfil profissional no Instagram.' });
    }
    if (!lead.facebook) {
        healthScore -= 10;
        falhas.push({ icon: '📘', titulo: 'Facebook não encontrado', desc: 'Não foi localizada página no Facebook.', evidencia: 'Verificado nos links do Google Maps e website.', impacto: 'Menor relevância, mas ainda usado para buscas locais.', nota: '' });
    }
    if (rating === 0 || rating === null) {
        healthScore -= 25;
        falhas.push({ icon: '⭐', titulo: 'Nenhuma avaliação no Google', desc: 'O perfil Google Meu Negócio não possui avaliações.', evidencia: 'Dado observado diretamente no perfil do Google Maps.', impacto: 'Perfis sem avaliações tendem a gerar menos confiança.', nota: 'Recomendação: iniciar estratégia de solicitação de avaliações.' });
    } else if (rating < 4.0) {
        healthScore -= 20;
        falhas.push({ icon: '⚠️', titulo: `Avaliação observada: ${rating} estrelas`, desc: `Nota ${rating} com ${reviews} avaliações observada no Google Maps.`, evidencia: 'Dado público do Google Maps.', impacto: 'Notas abaixo de 4.0 podem reduzir taxa de contato de potenciais clientes.', nota: 'Recomendação: gestão ativa de reputação.' });
    }
    if (!lead.last_post) {
        healthScore -= 15;
        falhas.push({ icon: '📅', titulo: 'Sem atualizações recentes no Google', desc: 'Não foram encontradas postagens recentes no Google Meu Negócio.', evidencia: 'Aba de atualizações do perfil verificada.', impacto: 'Perfis com atualizações frequentes tendem a ter maior destaque.', nota: 'Hipótese de melhoria: publicar atualizações periódicas.' });
    }
    if (lead.negative_reviews && lead.negative_reviews.length > 0) {
        healthScore -= 15;
        falhas.push({ icon: '🔴', titulo: `${lead.negative_reviews.length} reclamação(ões) pública(s)`, desc: 'Foram identificadas reclamações públicas no Google.', evidencia: 'Avaliações públicas do Google Maps.', impacto: 'Avaliações negativas visíveis podem influenciar decisão de potenciais clientes.', nota: 'Recomendação: responder publicamente e trabalhar pontos mencionados.' });
    }
    if (healthScore < 0) healthScore = 0;

    let gaugeColor = '#10b981';
    let gaugeLabel = 'Saudável';
    if (healthScore < 40) { gaugeColor = '#ef4444'; gaugeLabel = 'Requer Atenção'; }
    else if (healthScore < 70) { gaugeColor = '#f59e0b'; gaugeLabel = 'Pode Melhorar'; }

    const concorrentes = lead.concorrentes_referencia || 'Nenhum dado de concorrência disponível neste lote de análise.';

    // --- OPORTUNIDADES ---
    const oportunidades = [];
    if (!lead.website) oportunidades.push({ opp: 'Criação de site profissional otimizado para buscas no Google', canal: 'Website', prioridade: 'Alta' });
    if (!lead.instagram) oportunidades.push({ opp: 'Estruturação de perfil no Instagram com identidade visual', canal: 'Instagram', prioridade: 'Média' });
    if (rating < 4.5 || reviews < 20) oportunidades.push({ opp: 'Gestão de reputação e incentivo a avaliações no Google', canal: 'Google Maps', prioridade: 'Alta' });
    if (!lead.last_post) oportunidades.push({ opp: 'Ativação do Google Meu Negócio com postagens regulares', canal: 'Google Maps', prioridade: 'Média' });
    if (!lead.whatsapp_url) oportunidades.push({ opp: 'Implementação de WhatsApp Business com link direto no perfil', canal: 'WhatsApp', prioridade: 'Média' });
    oportunidades.push({ opp: 'Avaliação de estratégia de SEO local para posicionamento competitivo', canal: 'Multcanal', prioridade: 'Média' });

    // --- CANAIS COM LINKS CLICÁVEIS ---
    const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    function canalLink(url, label) {
        if (!url) return '<em>Não foi possível confirmar com segurança na web aberta</em>';
        return `<a href="${esc(url)}" style="color: #6d28d9; text-decoration: underline;">${esc(label || url)}</a>`;
    }

    const canais = [
        { nome: 'Google Maps', valor: lead.google_maps_url, status: lead.google_maps_url ? '✅' : '❌', fonte: 'Busca Google Maps', obs: lead.google_maps_url ? 'Perfil encontrado' : 'Não encontrado' },
        { nome: 'Website', valor: lead.website, status: lead.website ? '✅' : '❌', fonte: 'Google Maps + Enriquecimento', obs: lead.website ? 'Site institucional confirmado' : 'Não foi possível confirmar website institucional' },
        { nome: 'Instagram', valor: lead.instagram, status: lead.instagram ? '✅' : '❌', fonte: lead.instagram_source === 'website' ? 'Website' : 'Google Maps', obs: lead.instagram ? 'Perfil encontrado' : 'Não encontrado' },
        { nome: 'Facebook', valor: lead.facebook, status: lead.facebook ? '✅' : '❌', fonte: 'Google Maps + Website', obs: lead.facebook ? 'Página encontrada' : 'Não encontrado' },
        { nome: 'WhatsApp', valor: lead.whatsapp_url, status: lead.whatsapp_url ? '✅' : '❌', fonte: 'Website', obs: lead.whatsapp_url ? 'Link encontrado' : 'Não encontrado' },
    ];
    if (lead.email) canais.push({ nome: 'Email', valor: `mailto:${lead.email}`, status: '✅', fonte: 'Website', obs: lead.email });

    // --- EVIDÊNCIAS VISUAIS HTML ---
    let evidenciasHtml = '';
    if (evidence?.achados) {
        const achadosRelevantes = evidence.achados.filter(a => a.tipo !== 'presenca_google_maps');
        evidenciasHtml = achadosRelevantes.map(a => {
            const shotB64 = a.screenshot && screenshotImages[a.tipo]?.b64 ? screenshotImages[a.tipo].b64 : null;
            const confColors = { alta: '#10b981', media: '#f59e0b', baixa: '#ef4444' };
            return `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 15px; page-break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="font-size: 15px; color: #1e293b;">${esc(a.descricao)}</strong>
                    <span style="font-size: 11px; padding: 3px 10px; border-radius: 12px; background: ${confColors[a.confianca] || '#94a3b8'}22; color: ${confColors[a.confianca] || '#94a3b8'}; font-weight: 600;">Confiança: ${esc(a.confianca)}</span>
                </div>
                <p style="font-size: 13px; color: #64748b; margin-bottom: 5px;">📌 Classificação: ${a.classificacao === 'fato_observado' ? 'Fato observado' : a.classificacao === 'hipotese_melhoria' ? 'Hipótese de melhoria' : 'Projeção consultiva'}</p>
                ${a.fonte ? `<p style="font-size: 12px; color: #94a3b8;">Fonte: ${esc(a.fonte)}${a.url ? ` — <a href="${esc(a.url)}" style="color: #6d28d9;">${esc(a.url.substring(0, 60))}</a>` : ''}</p>` : ''}
                ${shotB64 ? `<img src="${shotB64}" style="width: 100%; max-height: 300px; object-fit: contain; margin-top: 10px; border-radius: 6px; border: 1px solid #e2e8f0;" alt="Evidência visual" />` : ''}
            </div>`;
        }).join('');
    }

    // --- FONTES VISITADAS ---
    let fontesHtml = '';
    if (evidence?.fontes) {
        fontesHtml = evidence.fontes.map(f => `<li><strong>${esc(f.tipo)}:</strong> <a href="${esc(f.url)}" style="color: #6d28d9;">${esc(f.url?.substring(0, 80))}</a> — visitado em ${f.visitado_em ? new Date(f.visitado_em).toLocaleString('pt-BR') : 'N/D'}</li>`).join('');
    }

    // --- LIMITAÇÕES ---
    let limitacoesHtml = '';
    if (evidence?.limitacoes) {
        limitacoesHtml = evidence.limitacoes.map(l => `<li>${esc(l)}</li>`).join('');
    }

    const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; line-height: 1.6; }
            .cover { background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); color: white; padding: 80px 60px; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
            .cover-badge { display: inline-block; background: rgba(139,92,246,0.2); border: 1px solid rgba(139,92,246,0.4); color: #a78bfa; padding: 8px 20px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 30px; }
            .cover h1 { font-size: 40px; font-weight: 800; line-height: 1.2; margin-bottom: 15px; }
            .cover h1 span { color: #8b5cf6; }
            .cover .subtitle { font-size: 18px; color: #94a3b8; font-weight: 300; margin-bottom: 50px; }
            .cover-meta { font-size: 14px; color: #64748b; border-top: 1px solid #334155; padding-top: 30px; margin-top: auto; }
            .cover-meta strong { color: #cbd5e1; }
            .page { padding: 50px 60px; page-break-inside: avoid; }
            .section-title { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 3px solid #8b5cf6; display: inline-block; }
            .section-number { display: inline-block; background: #8b5cf6; color: white; width: 30px; height: 30px; border-radius: 50%; text-align: center; line-height: 30px; font-weight: 700; font-size: 13px; margin-right: 10px; }
            .gauge-container { text-align: center; margin: 30px 0; }
            .gauge-circle { width: 180px; height: 180px; border-radius: 50%; border: 10px solid #e2e8f0; display: inline-flex; align-items: center; justify-content: center; flex-direction: column; position: relative; }
            .gauge-circle::before { content: ''; position: absolute; top: -10px; left: -10px; right: -10px; bottom: -10px; border-radius: 50%; border: 10px solid transparent; border-top-color: ${gaugeColor}; border-right-color: ${healthScore > 25 ? gaugeColor : 'transparent'}; border-bottom-color: ${healthScore > 50 ? gaugeColor : 'transparent'}; border-left-color: ${healthScore > 75 ? gaugeColor : 'transparent'}; }
            .gauge-number { font-size: 44px; font-weight: 800; color: ${gaugeColor}; }
            .gauge-label { font-size: 13px; color: #64748b; font-weight: 600; }
            .gauge-sublabel { font-size: 15px; color: ${gaugeColor}; font-weight: 700; margin-top: 8px; }
            .fail-card { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; padding: 18px 22px; margin-bottom: 12px; page-break-inside: avoid; }
            .fail-card h3 { font-size: 15px; color: #991b1b; margin-bottom: 5px; }
            .fail-card p { font-size: 13px; color: #64748b; }
            .fail-card .nota { font-size: 12px; color: #7c3aed; font-weight: 500; margin-top: 6px; font-style: italic; }
            .fail-card .evidencia { font-size: 12px; color: #94a3b8; margin-top: 4px; }
            .fail-card .impacto { font-size: 12px; color: #dc2626; margin-top: 4px; }
            .opp-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .opp-table th { background: #f0fdf4; color: #166534; text-align: left; padding: 10px; font-size: 13px; border-bottom: 2px solid #10b981; }
            .opp-table td { padding: 10px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
            .canal-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .canal-table th { background: #f8fafc; color: #475569; text-align: left; padding: 10px; font-size: 13px; border-bottom: 2px solid #8b5cf6; }
            .canal-table td { padding: 10px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
            .cta-box { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; border-radius: 12px; padding: 40px; text-align: center; margin: 40px 0; }
            .cta-box h2 { font-size: 22px; margin-bottom: 12px; }
            .cta-box p { font-size: 15px; opacity: 0.9; margin-bottom: 8px; }
            .cta-button { display: inline-block; background: white; color: #6d28d9; padding: 14px 40px; border-radius: 8px; font-weight: 700; font-size: 16px; text-decoration: none; margin-top: 15px; }
            .competitors-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 15px 0; }
            .timeline-item { display: flex; margin-bottom: 18px; align-items: flex-start; }
            .timeline-dot { width: 38px; height: 38px; border-radius: 50%; background: #8b5cf6; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; margin-right: 12px; }
            .timeline-content h4 { font-size: 14px; color: #1e293b; margin-bottom: 3px; }
            .timeline-content p { font-size: 12px; color: #64748b; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 25px 60px; font-size: 11px; color: #94a3b8; }
            .disclaimer { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; margin: 20px 0; font-size: 11px; color: #64748b; line-height: 1.7; }
            a { color: #6d28d9; }
        </style>
    </head>
    <body>
        <!-- 1. CAPA -->
        <div class="cover">
            ${logoBannerB64 ? `<div style="text-align: center; margin-bottom: 40px;"><img src="${logoBannerB64}" style="width: 100%; max-width: 480px; border-radius: 10px; filter: drop-shadow(0 6px 20px rgba(139,92,246,0.5));" alt="Digital Prime Studio" /></div>` : ''}
            <div class="cover-badge">Diagnóstico Premium — Relatório com Evidência</div>
            <h1>Análise de Presença<br>Digital para <span>${esc(empresaNome)}</span></h1>
            <p class="subtitle">Relatório consultivo aprofundado com evidência observável, baseado em dados públicos e visitas diretas aos canais digitais.</p>
            <div class="cover-meta">
                <p><strong>Empresa:</strong> ${esc(empresaNome)}</p>
                <p><strong>Setor:</strong> ${esc(niche)}</p>
                <p><strong>Região:</strong> ${esc(city)}</p>
                <p><strong>Data da análise:</strong> ${dateStr}</p>
                <p><strong>Elaborado por:</strong> Digital Prime Studio — Ecossistema Digital Inteligente</p>
            </div>
        </div>
        
        <!-- 2. RESUMO EXECUTIVO -->
        <div class="page">
            <div class="section-title"><span class="section-number">1</span> Resumo Executivo</div>
            <p style="font-size: 15px; color: #475569; margin-bottom: 15px;">
                Foi realizada uma análise aprofundada da presença digital da <strong>${esc(empresaNome)}</strong> 
                com base em visitas diretas aos canais públicos disponíveis: Google Maps, website institucional, Instagram e Facebook.
            </p>
            <div style="background: #f8fafc; border-radius: 8px; padding: 18px; margin: 15px 0;">
                <p style="margin-bottom: 8px;"><strong>🎯 Principal oportunidade observada:</strong> ${!lead.website ? 'Criação de website institucional' : rating < 4.0 ? 'Gestão de reputação online' : !lead.instagram ? 'Presença em redes sociais' : 'Otimização da presença digital atual'}</p>
                <p style="margin-bottom: 8px;"><strong>⚠️ Principal risco observado:</strong> ${rating === 0 ? 'Ausência total de avaliações no Google' : rating < 4.0 ? `Nota ${rating} estrelas abaixo do ideal` : lead.negative_reviews?.length > 0 ? `${lead.negative_reviews.length} reclamação(ões) pública(s)` : 'Nenhum risco crítico identificado'}</p>
                <p><strong>📊 O que foi efetivamente observado:</strong> ${evidence?.achados?.length || 0} pontos de análise documentados com evidência</p>
            </div>

            <!-- 3. SAÚDE DIGITAL -->
            <div class="section-title"><span class="section-number">2</span> Nota Consultiva de Saúde Digital</div>
            <div class="gauge-container">
                <div class="gauge-circle">
                    <span class="gauge-number">${healthScore}</span>
                    <span class="gauge-label">de 100</span>
                </div>
                <p class="gauge-sublabel">Status: ${gaugeLabel}</p>
                <p style="font-size: 11px; color: #94a3b8; margin-top: 8px; max-width: 480px; display: inline-block;">
                    Racional: a nota inicia em 100 e deduz pontos por ausência de canais digitais observáveis. Não é métrica científica; é instrumento consultivo visual para facilitar a conversa comercial.
                </p>
            </div>
        </div>
        
        <!-- 4. CANAIS ENCONTRADOS -->
        <div class="page">
            <div class="section-title"><span class="section-number">3</span> Canais Digitais Identificados</div>
            <table class="canal-table">
                <tr><th>Canal</th><th>Status</th><th>Link</th><th>Fonte</th><th>Observação</th></tr>
                ${canais.map(c => `<tr><td><strong>${esc(c.nome)}</strong></td><td>${c.status}</td><td>${canalLink(c.valor, c.valor ? (c.valor.length > 45 ? c.valor.substring(0, 45) + '...' : c.valor) : '')}</td><td style="font-size: 11px; color: #94a3b8;">${esc(c.fonte)}</td><td style="font-size: 12px;">${esc(c.obs)}</td></tr>`).join('')}
            </table>

            <!-- 5. EVIDÊNCIAS REAIS -->
            ${evidenciasHtml ? `
            <div class="section-title" style="margin-top: 30px;"><span class="section-number">4</span> Evidências Observadas</div>
            <p style="font-size: 12px; color: #94a3b8; margin-bottom: 15px;">Cada evidência abaixo foi documentada com classificação de confiança e tipo (fato observado, hipótese de melhoria ou projeção consultiva).</p>
            ${evidenciasHtml}
            ` : ''}
        </div>

        <!-- 6. FALHAS PRIORITÁRIAS -->
        ${falhas.length > 0 ? `
        <div class="page">
            <div class="section-title"><span class="section-number">5</span> Falhas Prioritárias</div>
            ${falhas.map(f => `
                <div class="fail-card">
                    <h3>${f.icon} ${esc(f.titulo)}</h3>
                    <p>${f.desc}</p>
                    <p class="evidencia">📋 Evidência: ${esc(f.evidencia)}</p>
                    <p class="impacto">📉 Impacto provável: ${esc(f.impacto)}</p>
                    ${f.nota ? `<p class="nota">💡 ${esc(f.nota)}</p>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- 7. OPORTUNIDADES PRÁTICAS -->
        <div class="page">
            <div class="section-title"><span class="section-number">6</span> Oportunidades Práticas</div>
            <table class="opp-table">
                <tr><th>Oportunidade</th><th>Canal</th><th>Prioridade</th></tr>
                ${oportunidades.map(o => `<tr><td>${esc(o.opp)}</td><td>${esc(o.canal)}</td><td>${esc(o.prioridade)}</td></tr>`).join('')}
            </table>
            <p style="font-size: 11px; color: #94a3b8; margin-top: 10px; font-style: italic;">As oportunidades acima são hipóteses de melhoria baseadas nas observações. Não são garantias de resultado.</p>
        </div>

        <!-- 8. CONCORRÊNCIA OBSERVÁVEL -->
        <div class="page">
            <div class="section-title"><span class="section-number">7</span> Possíveis Concorrentes Digitais Observáveis</div>
            <div class="competitors-box">
                <p style="font-size: 12px; color: #92400e; margin-bottom: 8px;">⚠️ Os dados abaixo foram extraídos do mesmo lote de busca no Google Maps. Não representam uma análise competitiva completa nem um estudo de mercado.</p>
                <p style="font-size: 14px; color: #1e293b; font-weight: 600; margin-top: 8px;">${esc(concorrentes)}</p>
                <p style="font-size: 11px; color: #94a3b8; margin-top: 8px;">Para análise competitiva aprofundada, recomenda-se pesquisa dedicada por setor e região.</p>
            </div>

            <!-- 9. PLANO CONSULTIVO -->
            <div class="section-title" style="margin-top: 30px;"><span class="section-number">8</span> Plano Consultivo Sugerido</div>
            <div class="timeline-item">
                <div class="timeline-dot">F1</div>
                <div class="timeline-content">
                    <h4>Fundação Digital (Primeiros 30 dias)</h4>
                    <p>Ativação do Google Meu Negócio, ${!lead.website ? 'avaliação de criação de site profissional,' : ''} configuração de perfis sociais e primeiras otimizações.</p>
                </div>
            </div>
            <div class="timeline-item">
                <div class="timeline-dot">F2</div>
                <div class="timeline-content">
                    <h4>Crescimento (30-60 dias)</h4>
                    <p>SEO local, gestão de reputação, conteúdo recorrente e acompanhamento de avaliações.</p>
                </div>
            </div>
            <div class="timeline-item">
                <div class="timeline-dot">F3</div>
                <div class="timeline-content">
                    <h4>Consolidação (60-90 dias)</h4>
                    <p>Revisão de posicionamento, análise de resultados e ajuste contínuo da estratégia digital.</p>
                </div>
            </div>
            <p style="font-size: 11px; color: #94a3b8; margin-top: 10px; font-style: italic;">Este é um plano sugerido. Os prazos e resultados dependem de fatores específicos de cada negócio. Isto é uma projeção consultiva, não uma garantia.</p>
        </div>

        <!-- 10. FONTES E LIMITAÇÕES -->
        <div class="page">
            <div class="section-title"><span class="section-number">9</span> Fontes Consultadas</div>
            <div class="disclaimer">
                <p><strong>Links visitados durante esta análise:</strong></p>
                <ul style="margin-top: 5px; padding-left: 18px;">${fontesHtml || '<li>Nenhuma fonte rastreada nesta sessão.</li>'}</ul>
                <p style="margin-top: 12px;"><strong>Data da leitura:</strong> ${dateStr}</p>
            </div>

            <div class="section-title" style="margin-top: 20px;"><span class="section-number">10</span> Limitações da Apuração</div>
            <div class="disclaimer">
                <ul style="padding-left: 18px;">${limitacoesHtml || '<li>Nenhuma limitação registrada.</li>'}
                    <li>A nota de saúde digital é um instrumento consultivo visual, não uma métrica científica.</li>
                    <li>A seção de concorrentes é baseada no mesmo lote de busca, não em análise de mercado dedicada.</li>
                    <li>Recomendações são hipóteses de melhoria, não garantias de resultado.</li>
                </ul>
                <p style="margin-top: 10px;"><strong>Classificação do conteúdo:</strong></p>
                <ul style="margin-top: 5px; padding-left: 18px;">
                    <li><strong>Fatos observados:</strong> presença ou ausência de canais, nota e número de avaliações</li>
                    <li><strong>Hipóteses de melhoria:</strong> recomendações de ação baseadas nas observações</li>
                    <li><strong>Projeções consultivas:</strong> plano de fases e estimativas de impacto</li>
                </ul>
            </div>
        </div>

        <!-- 11. CTA FINAL -->
        <div class="page">
            <div class="cta-box">
                ${logoCircularB64 ? `<img src="${logoCircularB64}" style="width: 70px; height: 70px; border-radius: 50%; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" alt="Digital Prime Studio" />` : ''}
                <h2>Quer transformar esses pontos em resultados?</h2>
                <p>A Digital Prime Studio é especialista em presença digital para empresas locais.</p>
                <p>Agende uma conversa gratuita e sem compromisso com o <strong>Lucas</strong>.</p>
                <p style="font-size: 14px; opacity: 0.9;">📞 WhatsApp: <a href="https://wa.me/5513996519515?text=Ol%C3%A1%20Lucas%2C%20recebi%20o%20diagn%C3%B3stico%20premium%20e%20gostaria%20de%20conversar" style="color: white; text-decoration: underline;">(13) 99651-9515</a></p>
                <p style="font-size: 14px; opacity: 0.9;">🌐 Site: <a href="https://www.digitalprimestudio.com.br" style="color: white; text-decoration: underline;">www.digitalprimestudio.com.br</a></p>
                <a href="https://wa.me/5513996519515?text=Ol%C3%A1%20Lucas%2C%20recebi%20o%20diagn%C3%B3stico%20premium%20e%20gostaria%20de%20conversar" class="cta-button">Falar com o Lucas</a>
            </div>
        </div>

        <!-- FOOTER -->
        <div class="footer">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                ${logoCircularB64 ? `<img src="${logoCircularB64}" style="width: 28px; height: 28px; border-radius: 50%;" alt="" />` : ''}
                <strong>Digital Prime Studio</strong> — Ecossistema Digital Inteligente
            </div>
            <p>Este documento foi gerado em ${dateStr} e reflete dados públicos disponíveis naquele momento.</p>
            <p><a href="https://www.digitalprimestudio.com.br" style="color: #64748b;">www.digitalprimestudio.com.br</a> | WhatsApp: <a href="https://wa.me/5513996519515" style="color: #64748b;">(13) 99651-9515</a></p>
        </div>
    </body>
    </html>
    `;

    const pdfBrowser = await chromium.launch({ headless: true });
    const page = await pdfBrowser.newPage();
    await page.setContent(html, { waitUntil: 'load' });

    const safeName = `Premium_${empresaNome}_${Date.now()}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase() + '.pdf';
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

module.exports = { generateExternalPDF, generatePremiumPDF };
