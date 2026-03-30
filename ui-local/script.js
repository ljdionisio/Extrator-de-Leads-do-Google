window.leads = [];
window.tokensUsed = 0;
window.serperUsed = 0;

window.updateStatusMsg = function(msg) {
    document.getElementById('sys-status').innerText = "> " + msg;
};

window.updateTokens = function(amount) {
    window.tokensUsed += amount;
    document.getElementById('st-tokens').innerText = window.tokensUsed;
};

window.addSerperCredit = function(amount) {
    window.serperUsed += amount;
    document.getElementById('st-serper').innerText = window.serperUsed;
};

async function iniciarCaptacao() {
    const niche = document.getElementById('i-niche').value;
    const city = document.getElementById('i-city').value;

    if(!niche || !city) {
        alert("Preencha Nicho e Cidade para continuar.");
        return;
    }

    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-stop').style.display = 'block';
    document.getElementById('btn-stop').innerHTML = "🛑 PAUSAR MOTOR";
    document.getElementById('btn-stop').style.background = "#ef4444";

    // Limpa listagem visual
    window.leads = [];
    document.getElementById('lead-list').innerHTML = '';
    
    // Ativa o gatilho da função Expose do Node.js
    window.updateStatusMsg("Conectando ao navegador escravo e gerando variações semânticas de busca...");
    await window.startEngine(niche, city);
    
    // Quando a função Promise retornar finalizada, reseta os botões
    document.getElementById('btn-stop').style.display = 'none';
    document.getElementById('btn-start').style.display = 'block';
}

async function pausarCaptacao() {
    await window.setRobotStopped(true);
    document.getElementById('btn-stop').innerHTML = "SUSPENDER MOTOR (LOTE EM ANDAMENTO)...";
    document.getElementById('btn-stop').style.background = "#eab308";
}

// ==========================
// UI Mapeamento e Relatório
// ==========================
// Apply Filter Live
document.getElementById('i-filter').addEventListener('change', () => {
     const val = document.getElementById('i-filter').value;
     let filtered = window.leads;
     if (val === '0-3') filtered = window.leads.filter(l => l.rating < 4);
     else if (val === '4-4.9') filtered = window.leads.filter(l => l.rating >= 4 && l.rating < 5);
     else if (val === '5') filtered = window.leads.filter(l => l.rating === 5);
     
     // Re-render Custom Filter
     const tbody = document.getElementById('lead-list');
     tbody.innerHTML = '';
     filtered.forEach(l => window.renderLeadRow(l, tbody));
});

window.exportCSV = function() {
    if(window.leads.length === 0) return alert("Nenhum lead extraído ainda.");
    let csv = 'Score,Prioridade,Rating,Reviews,Empresa,Endereco,Telefone,Site,Instagram,Facebook,UltimoPostGMB\n';
    window.leads.forEach(l => {
      let lName = l.name ? l.name.replace(/"/g, '""') : '';
      let lAddr = l.address ? l.address.replace(/"/g, '""') : '';
      csv += (l.score||0) + ',' + (l.priority||'') + ',' + (l.rating||0) + ',' + (l.reviews||0) + ',"' + lName + '","' + lAddr + '","' + (l.phone||'') + '","' + (l.website||'') + '","' + (l.instagram||'') + '","' + (l.facebook||'') + '","' + (l.last_post||'') + '"\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'extracao_prime_forense.csv';
    link.click();
};

window.renderLeadRow = function(l, tbody) {
      const tr = document.createElement('tr');
      tr.className = 'lead-row';
      tr.onclick = () => window.showDetails(window.leads.indexOf(l));
      
      let scoreClass = 'score-100';
        if (l.priority === 'alta') scoreClass = 'score-0';
        else if (l.priority === 'média') scoreClass = 'score-60';
        else scoreClass = 'score-100';

        let priorityBadge = l.priority ? l.priority.toUpperCase() : 'BAIXA';
        let resumo = l.reasons ? l.reasons.join(" | ") : "";

        tr.innerHTML = 
        '<td class="' + scoreClass + '">' + l.score + ' pts<br><span style="font-size:10px;">Prio: ' + priorityBadge + '</span></td>' +
        '<td><strong style="color:#f8fafc; font-size:13px;">' + l.name + '</strong><br><span style="color:#64748b; font-size:11px;">' + (l.address || 'Sem Endereço') + '</span></td>' +
        '<td><span style="color:#cbd5e1; font-size:11px; line-height:1.4; display:block;">' + resumo + '</span></td>';
        tbody.appendChild(tr);
}

window.addLead = function(lead) {
    if (window.leads.some(l => l.name === lead.name)) return;
    window.leads.push(lead);
    // Ordenar: Piores primeiro! (0 avaliações ou menores stars no topo)
    window.leads.sort((a,b) => {
        let sA = a.score || 0; let sB = b.score || 0;
        return sB - sA;
    });
    
    const tbody = document.getElementById('lead-list');
    tbody.innerHTML = '';
    window.leads.forEach((l) => window.renderLeadRow(l, tbody));
};

window.showDetails = async function(idx) {
    const l = window.leads[idx];
    document.getElementById('leadModal').style.display = 'block';
    document.getElementById('m-name').innerText = l.name;
    
    let info = '<p><strong>📍</strong> ' + (l.address || 'Local não mapeado') + '</p>';
    info += '<p><strong>📞</strong> ' + (l.phone ? l.phone : 'Sem contato telefônico') + '</p>';
    info += '<p><strong>🌐</strong> ' + (l.website ? '<a href="' + l.website + '" target="_blank" style="color:#3b82f6;">Acessar Website</a>' : 'Sem Domínio') + '</p>';
    info += '<p><strong>📸</strong> ' + (l.instagram ? '<a href="' + l.instagram + '" target="_blank" style="color:#d946ef;">Instagram</a>' : 'Sem Instagram') + '</p>';
    
    document.getElementById('m-info').innerHTML = info;
    
    // Render FORENSE
    let forenseHtml = '<p style="color:#10b981; font-size:11px; text-transform:uppercase; margin-bottom:15px;">✓ Dossiê de Vendas (Score: ' + (l.score||0) + ')</p>';
    forenseHtml += '<div style="background:#1e293b; padding:15px; border-radius:6px; margin-bottom: 15px; color: #cbd5e1;">';
    forenseHtml += '<strong>Prioridade Comercial:</strong> ' + (l.priority ? l.priority.toUpperCase() : 'N/A') + '<br>';
    if (l.reasons) {
        forenseHtml += '<strong>Motivos:</strong><ul>';
        l.reasons.forEach(r => { forenseHtml += '<li>' + r + '</li>'; });
        forenseHtml += '</ul><br>';
    }
    forenseHtml += '<strong>Avaliação do Google:</strong> ' + (l.rating ? l.rating + ' Estrelas (' + l.reviews + ' reviews)' : 'NENHUMA AVALIAÇÃO') + '<br>';
    forenseHtml += '<strong>Última Postagem GMB:</strong> ' + (l.last_post ? l.last_post : '<span style="color:#ef4444">Nunca postou na aba Atualizações.</span>') + '<br><br>';
    
    if(l.negative_reviews && l.negative_reviews.length > 0) {
       forenseHtml += '<strong style="color:#ef4444">💣 Reclamações Encontradas (Piores Avaliações):</strong><br>';
       l.negative_reviews.forEach(nr => {
           forenseHtml += '<blockquote style="border-left: 3px solid #ef4444; margin: 10px 0; padding-left: 10px; font-style:italic;">"' + nr + '"</blockquote>';
       });
    } else {
       forenseHtml += '<span style="color:#10b981">Nenhuma avaliação negativa grave identificada no topo da listagem.</span>';
    }
    
    forenseHtml += '</div>';

        if (l.draft_message) {
        forenseHtml += '<br><strong>📲 Sugestão de Abordagem (WhatsApp):</strong><br><div style="white-space: pre-wrap; background: #0f172a; padding: 15px; border-radius: 6px; font-size: 13px; margin-top: 10px; border-left: 4px solid #25d366; font-style: italic; color: #f8fafc; font-family: monospace; line-height: 1.6;">' + l.draft_message + '</div>';
    }
    document.getElementById('m-ai-text').innerHTML = forenseHtml;
};

window.exportPDF = async function() {
    if(window.leads.length === 0) return alert("Nenhum lead extraído ainda.");
    const niche = document.getElementById('i-niche') ? document.getElementById('i-niche').value : 'Nicho';
    const city = document.getElementById('i-city') ? document.getElementById('i-city').value : 'Cidade';
    
    document.getElementById('sys-status').innerText = "> Gerando PDF Comercial, aguarde...";
    try {
        const filePath = await window.exportToPDF(window.leads, niche, city);
        document.getElementById('sys-status').innerText = "> ✅ PDF Gerado com sucesso em: " + filePath;
    } catch(e) {
        console.error(e);
        document.getElementById('sys-status').innerText = "> ❌ Erro ao gerar PDF.";
    }
};

window.initLocalLeads = async function() {
    if (window.getSavedLeads) {
        document.getElementById('sys-status').innerText = "> Carregando banco de dados local...";
        const saved = await window.getSavedLeads();
        saved.forEach(l => {
            window.addLead(l);
        });
        document.getElementById('sys-status').innerText = "> ✅ Sessão recuperada: " + saved.length + " leads offline vivos.";
    }
};

window.addEventListener('load', () => { setTimeout(() => window.initLocalLeads(), 1000); });
