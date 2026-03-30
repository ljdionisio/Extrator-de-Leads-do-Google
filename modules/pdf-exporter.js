const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function generatePDF(leads, niche, city) {
    const dateStr = new Date().toLocaleString('pt-BR');

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; color: #333; margin: 40px; }
            h1 { color: #8b5cf6; }
            .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
            .stats { font-size: 18px; margin-bottom: 30px; }
            .lead-card { page-break-inside: avoid; border: 1px solid #ddd; background: #fafafa; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
            .lead-card h2 { margin-top: 0; color: #1e293b; }
            .badge { display: inline-block; padding: 5px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; margin-bottom: 10px; }
            .badge-alta { background: #fee2e2; color: #ef4444; }
            .badge-media { background: #fef3c7; color: #f59e0b; }
            .badge-baixa { background: #d1fae5; color: #10b981; }
            .section-title { font-weight: bold; margin-top: 15px; color: #475569; font-size: 14px; text-transform: uppercase; }
            ul { margin-top: 5px; padding-left: 20px; font-size: 14px;}
            .msg-box { background: #fff; border-left: 4px solid #25d366; padding: 15px; font-family: monospace; white-space: pre-wrap; margin-top: 10px; font-size: 13px; line-height: 1.5; color: #333;}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Relatório Comercial Mestre</h1>
            <p><strong>Nicho:</strong> ${niche} | <strong>Cidade:</strong> ${city}</p>
            <p><strong>Data da Captura:</strong> ${dateStr}</p>
        </div>
        
        <div class="stats">
            <strong>Total de Leads Extraídos e Qualificados:</strong> ${leads.length}
        </div>
    `;

    leads.forEach(l => {
        let pClass = 'badge-baixa';
        if (l.priority === 'alta') pClass = 'badge-alta';
        else if (l.priority === 'média') pClass = 'badge-media';

        let reasonsHtml = l.reasons && l.reasons.length > 0
            ? '<ul>' + l.reasons.map(r => `<li>${r}</li>`).join('') + '</ul>'
            : '<p>Nenhuma dor grave detectada.</p>';

        html += `
        <div class="lead-card">
            <h2>${l.name || 'Empresa Sem Nome'}</h2>
            <span class="badge ${pClass}">Prioridade Comercial: ${l.priority ? l.priority.toUpperCase() : 'BAIXA'} | Score AI: ${l.score || 0}</span>
            <p><strong>📍 Endereço:</strong> ${l.address || 'N/A'}</p>
            <p><strong>📞 Telefone:</strong> ${l.phone || 'N/A'}</p>
            <p><strong>⭐ Avaliação:</strong> ${l.rating || 0} (${l.reviews || 0} reviews)</p>
            
            <div class="section-title">Dores Detectadas (Motivos de Vendas):</div>
            ${reasonsHtml}
            
            <div class="section-title">Mensagem Pronta de Prospecção (Copiar para WhatsApp):</div>
            <div class="msg-box">${l.draft_message || 'Sem mensagem disponível.'}</div>
        </div>
        `;
    });

    html += `
    </body>
    </html>
    `;

    const pdfBrowser = await chromium.launch({ headless: true });
    const page = await pdfBrowser.newPage();
    await page.setContent(html, { waitUntil: 'load' });

    const safeName = `Relatorio_${niche}_${city}_${Date.now()}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase() + '.pdf';
    const filePath = path.join(process.cwd(), safeName);

    await page.pdf({
        path: filePath,
        format: 'A4',
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    await pdfBrowser.close();

    return filePath;
}

module.exports = { generatePDF };
