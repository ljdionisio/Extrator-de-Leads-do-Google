window.leads = [];

window.updateStatusMsg = function (msg) {
    document.getElementById('sys-status').innerText = "> " + msg;
};

async function iniciarCaptacao(triggerType = 'manual') {
    const niche = document.getElementById('i-niche').value;
    const city = document.getElementById('i-city').value;

    if (!niche || !city) {
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
    if (window.logEvent) window.logEvent('START', `Iniciando extração ${triggerType.toUpperCase()}: ${niche} em ${city}`);
    window.updateStatusMsg(`Conectando ao navegador escravo [Trigger: ${triggerType.toUpperCase()}]...`);
    await window.startEngine(niche, city, triggerType);

    // Quando a função Promise retornar finalizada, reseta os botões
    document.getElementById('btn-stop').style.display = 'none';
    document.getElementById('btn-start').style.display = 'block';
}

async function pausarCaptacao() {
    await window.setRobotStopped(true);
    document.getElementById('btn-stop').innerHTML = "SUSPENDER MOTOR (LOTE EM ANDAMENTO)...";
    document.getElementById('btn-stop').style.background = "#eab308";
}

window.clearLeads = async function () {
    const confirmed = confirm("Tem certeza que deseja apagar todas as captações salvas? Isso não pode ser desfeito.");
    if (confirmed) {
        if (window.pausarCaptacao) await window.pausarCaptacao();
        window.leads = [];
        document.getElementById('lead-list').innerHTML = '';
        if (window.clearLocalStore) {
            await window.clearLocalStore();
        }
        if (window.logEvent) window.logEvent('WARN', 'Sessão limpa pelo usuário. Histórico foi mantido.');
        window.updateStatusMsg("Captações limpas com sucesso.");
    }
};

// ==========================
// UI Mapeamento e Relatório
// ==========================
window.applyFilters = function () {
    const aval = document.getElementById('i-filter') ? document.getElementById('i-filter').value : 'all';
    const pipe = document.getElementById('f-pipeline') ? document.getElementById('f-pipeline').value : 'all';
    const temp = document.getElementById('f-temperatura') ? document.getElementById('f-temperatura').value : 'all';
    const fSite = document.getElementById('f-site') ? document.getElementById('f-site').value : 'all';
    const fWhats = document.getElementById('f-whats') ? document.getElementById('f-whats').value : 'all';
    const fInsta = document.getElementById('f-insta') ? document.getElementById('f-insta').value : 'all';

    let filtered = window.leads;

    // Avaliações
    if (aval === '0-3') filtered = filtered.filter(l => l.rating < 4);
    else if (aval === '4-4.9') filtered = filtered.filter(l => l.rating >= 4 && l.rating < 5);
    else if (aval === '5') filtered = filtered.filter(l => l.rating === 5);

    // Pipeline
    if (pipe !== 'all') filtered = filtered.filter(l => l.status_pipeline === pipe);

    // Temperatura
    if (temp !== 'all') filtered = filtered.filter(l => l.prioridade_comercial === temp);

    // Site
    if (fSite === 'yes') filtered = filtered.filter(l => l.website && l.website.length > 3);
    else if (fSite === 'no') filtered = filtered.filter(l => !l.website);

    // Whats
    if (fWhats === 'yes') filtered = filtered.filter(l => l.whatsapp_url && l.whatsapp_url.length > 3);
    else if (fWhats === 'no') filtered = filtered.filter(l => !l.whatsapp_url);

    // Insta
    if (fInsta === 'yes') filtered = filtered.filter(l => l.instagram && l.instagram.length > 3);
    else if (fInsta === 'no') filtered = filtered.filter(l => !l.instagram);

    const tbody = document.getElementById('lead-list');
    tbody.innerHTML = '';
    filtered.forEach(l => window.renderLeadRow(l, tbody));
};

window.updatePipelineStatus = async function (leadId, newStatus) {
    const l = window.leads.find(x => x.lead_id_estavel === leadId);
    if (l) {
        l.status_pipeline = newStatus;
        if (window.savePipelineUpdate) {
            await window.savePipelineUpdate(leadId, newStatus);
        }
        window.applyFilters();
    }
};

window.exportCSV = function () {
    if (window.leads.length === 0) return alert("Nenhum lead extraído ainda.");
    let csv = 'Score,Prioridade,Rating,Reviews,Empresa,Endereco,Telefone,Site,Instagram,Facebook,WhatsApp,Pesquisa,MapsURL,OutrosLinks,StatusPipeline,ArgumentoComercial,UltimoPostGMB\n';
    window.leads.forEach(l => {
        let lName = l.name ? l.name.replace(/"/g, '""') : '';
        let lAddr = l.address ? l.address.replace(/"/g, '""') : '';
        let arg = l.argumento_comercial ? l.argumento_comercial.replace(/"/g, '""') : '';
        csv += (l.score || 0) + ',' + (l.prioridade_comercial || l.priority || '') + ',' + (l.rating || 0) + ',' + (l.reviews || 0) + ',"' + lName + '","' + lAddr + '","' + (l.phone || '') + '","' + (l.website || '') + '","' + (l.instagram || '') + '","' + (l.facebook || '') + '","' + (l.whatsapp_url || '') + '","' + (l.source_search_url || '') + '","' + (l.google_maps_url || '') + '","' + ((l.other_public_links || []).join(';')) + '","' + (l.status_pipeline || 'Novo') + '","' + arg + '","' + (l.last_post || '') + '"\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'extracao_prime_forense.csv';
    link.click();
    if (window.logEvent) window.logEvent('SYS', `Exportou relatório CSV de ${window.leads.length} leads.`);
};

window.renderLeadRow = function (l, tbody) {
    const tr = document.createElement('tr');
    tr.className = 'lead-row';
    tr.onclick = () => window.showDetails(window.leads.indexOf(l));

    let scoreClass = 'score-100';
    if (l.prioridade_comercial === 'quente') scoreClass = 'score-0';
    else if (l.prioridade_comercial === 'morno') scoreClass = 'score-60';
    else scoreClass = 'score-100';

    let priorityBadge = l.prioridade_comercial ? l.prioridade_comercial.toUpperCase() : (l.priority ? l.priority.toUpperCase() : 'FRIO');
    let resumo = l.prioridade_motivos ? l.prioridade_motivos.join(" | ") : (l.reasons ? l.reasons.join(" | ") : "");

    let bgStatus = l.status_pipeline === 'Perdido' ? '#ef4444' : l.status_pipeline === 'Fechado' ? '#10b981' : '#334155';

    tr.innerHTML =
        '<td class="' + scoreClass + '">' + l.score + ' pts<br><span style="font-size:10px;">' + priorityBadge + '</span></td>' +
        '<td><strong style="color:#f8fafc; font-size:13px;">' + l.name + '</strong><br><span style="color:#64748b; font-size:11px;">' + (l.address || 'Sem Endereço') + '</span></td>' +
        '<td><select onclick="event.stopPropagation()" onchange="window.updatePipelineStatus(\'' + l.lead_id_estavel + '\', this.value)" style="background: ' + bgStatus + '; color: white; border: none; padding: 4px; border-radius: 4px; font-size: 11px;">' +
        '<option value="Novo" ' + (l.status_pipeline === 'Novo' ? 'selected' : '') + '>Novo</option>' +
        '<option value="Analisado" ' + (l.status_pipeline === 'Analisado' ? 'selected' : '') + '>Analisado</option>' +
        '<option value="Abordado" ' + (l.status_pipeline === 'Abordado' ? 'selected' : '') + '>Abordado</option>' +
        '<option value="Respondeu" ' + (l.status_pipeline === 'Respondeu' ? 'selected' : '') + '>Respondeu</option>' +
        '<option value="Proposta Enviada" ' + (l.status_pipeline === 'Proposta Enviada' ? 'selected' : '') + '>Proposta Enviada</option>' +
        '<option value="Fechado" ' + (l.status_pipeline === 'Fechado' ? 'selected' : '') + '>Fechado</option>' +
        '<option value="Perdido" ' + (l.status_pipeline === 'Perdido' ? 'selected' : '') + '>Perdido</option>' +
        '</select><br><span style="color:#cbd5e1; font-size:11px; line-height:1.4; display:block; margin-top: 4px;">' + resumo + '</span></td>';
    tbody.appendChild(tr);
}

window.addLead = function (lead) {
    if (window.leads.some(l => l.name === lead.name)) return;
    window.leads.push(lead);
    // Ordenar: Piores primeiro! (0 avaliações ou menores stars no topo)
    window.leads.sort((a, b) => {
        let sA = a.score || 0; let sB = b.score || 0;
        return sB - sA;
    });

    const tbody = document.getElementById('lead-list');
    tbody.innerHTML = '';
    window.leads.forEach((l) => window.renderLeadRow(l, tbody));
};

window.showDetails = async function (idx) {
    const l = window.leads[idx];
    document.getElementById('leadModal').style.display = 'block';
    document.getElementById('m-name').innerText = l.name;

    let info = '<p><strong>📍 Maps:</strong> ' + (l.google_maps_url ? '<a href="' + l.google_maps_url + '" target="_blank" style="color:#3b82f6;">Google Maps</a>' : 'N/A') + '</p>';
    info += '<p><strong>📞</strong> ' + (l.phone ? l.phone : 'Sem contato telefônico') + '</p>';
    info += '<p><strong>🌐 Web:</strong> ' + (l.website ? '<a href="' + l.website + '" target="_blank" style="color:#3b82f6;">Acessar Website</a>' : 'Sem Domínio') + '</p>';
    info += '<p><strong>📸 Insta:</strong> ' + (l.instagram ? '<a href="' + l.instagram + '" target="_blank" style="color:#d946ef;">Instagram</a>' : 'N/A') + ' | <strong>📘 Face:</strong> ' + (l.facebook ? '<a href="' + l.facebook + '" target="_blank" style="color:#3b82f6;">Facebook</a>' : 'N/A') + ' | <strong>💬 Whats:</strong> ' + (l.whatsapp_url ? '<a href="' + l.whatsapp_url + '" target="_blank" style="color:#25d366;">WhatsApp</a>' : 'N/A') + '</p>';

    if (l.other_public_links && l.other_public_links.length > 0) {
        info += '<p><strong>🔗 Outros Links (' + l.other_public_links.length + '):</strong><br>';
        l.other_public_links.forEach(ol => {
            info += `<a href="${ol}" target="_blank" style="color:#94a3b8; font-size:11px; margin-right:8px; display:inline-block; margin-bottom:5px;">${ol}</a><br>`;
        });
        info += '</p>';
    }

    document.getElementById('m-info').innerHTML = info;

    // Render FORENSE
    let forenseHtml = '<p style="color:#10b981; font-size:11px; text-transform:uppercase; margin-bottom:15px;">✓ Dossiê de Vendas (Score: ' + (l.score || 0) + ')</p>';
    forenseHtml += '<div style="background:#1e293b; padding:15px; border-radius:6px; margin-bottom: 15px; color: #cbd5e1;">';
    forenseHtml += '<strong>Prioridade Comercial:</strong> ' + (l.priority ? l.priority.toUpperCase() : 'N/A') + '<br>';
    if (l.reasons) {
        forenseHtml += '<strong>Motivos:</strong><ul>';
        l.reasons.forEach(r => { forenseHtml += '<li>' + r + '</li>'; });
        forenseHtml += '</ul><br>';
    }
    forenseHtml += '<strong>Avaliação do Google:</strong> ' + (l.rating ? l.rating + ' Estrelas (' + l.reviews + ' reviews)' : 'NENHUMA AVALIAÇÃO') + '<br>';
    forenseHtml += '<strong>Última Postagem GMB:</strong> ' + (l.last_post ? l.last_post : '<span style="color:#ef4444">Nunca postou na aba Atualizações.</span>') + '<br><br>';

    if (l.negative_reviews && l.negative_reviews.length > 0) {
        forenseHtml += '<strong style="color:#ef4444">💣 Reclamações Encontradas (Piores Avaliações):</strong><br>';
        l.negative_reviews.forEach(nr => {
            forenseHtml += '<blockquote style="border-left: 3px solid #ef4444; margin: 10px 0; padding-left: 10px; font-style:italic;">"' + nr + '"</blockquote>';
        });
    } else {
        forenseHtml += '<span style="color:#10b981">Nenhuma avaliação negativa grave identificada no topo da listagem.</span>';
    }

    forenseHtml += '</div>';

    if (l.concorrentes_referencia) {
        forenseHtml += '<br><strong style="color:#f59e0b">⚔️ Referência Competitiva:</strong><br><div style="background: #0f172a; padding: 10px; border-radius: 6px; font-size: 12px; margin-top: 5px; color: #cbd5e1;">' + l.concorrentes_referencia + '</div>';
    }

    const waMsgOptions = l.mensagem_whatsapp_curta || l.draft_message || '';
    if (waMsgOptions) {
        forenseHtml += '<br><strong>📲 Sugestão de Abordagem Curta (WhatsApp/Intro):</strong><br><div style="white-space: pre-wrap; background: #0f172a; padding: 15px; border-radius: 6px; font-size: 13px; margin-top: 10px; border-left: 4px solid #25d366; font-style: italic; color: #f8fafc; font-family: monospace; line-height: 1.6;">' + waMsgOptions + '</div>';
    }
    if (l.mensagem_whatsapp) {
        forenseHtml += '<br><strong>📲 Abordagem Consultiva (WhatsApp):</strong><br><div style="white-space: pre-wrap; background: #0f172a; padding: 15px; border-radius: 6px; font-size: 13px; margin-top: 10px; border-left: 4px solid #3b82f6; font-style: italic; color: #f8fafc; font-family: monospace; line-height: 1.6;">' + l.mensagem_whatsapp + '</div>';
    }
    if (l.argumento_comercial) {
        forenseHtml += '<br><strong style="color:#f59e0b">🎯 Argumento de Vendas (SDR):</strong><br><div style="white-space: pre-wrap; background: #0f172a; padding: 15px; border-radius: 6px; font-size: 13px; margin-top: 10px; border-left: 4px solid #f59e0b; color: #cbd5e1; font-family: monospace; line-height: 1.6;">' + l.argumento_comercial + '</div>';
    }

    document.getElementById('m-ai-text').innerHTML = forenseHtml;
};

window.exportPDF = async function () {
    if (window.leads.length === 0) return alert("Nenhum lead extraído ainda.");
    const niche = document.getElementById('i-niche') ? document.getElementById('i-niche').value : 'Nicho';
    const city = document.getElementById('i-city') ? document.getElementById('i-city').value : 'Cidade';

    document.getElementById('sys-status').innerText = "> Gerando PDF Comercial, aguarde...";
    try {
        const filePath = await window.exportToPDF(window.leads, niche, city);
        document.getElementById('sys-status').innerText = "> ✅ PDF Gerado com sucesso em: " + filePath;
        if (window.logEvent) window.logEvent('SYS', `Exportou PDF com sucesso.`);
    } catch (e) {
        console.error(e);
        document.getElementById('sys-status').innerText = "> ❌ Erro ao gerar PDF.";
    }
};

window.initLocalLeads = async function () {
    if (window.getSavedLeads) {
        document.getElementById('sys-status').innerText = "> Carregando banco de dados local...";
        const saved = await window.getSavedLeads();
        saved.forEach(l => {
            window.addLead(l);
        });
        document.getElementById('sys-status').innerText = "> ✅ Sessão recuperada: " + saved.length + " leads offline vivos.";
        if (window.getSettings) {
            const s = await window.getSettings();
            if (s && s.webhookUrl) document.getElementById('i-webhook-url').value = s.webhookUrl;
        }
    }
};

window.saveWebhook = async function () {
    const url = document.getElementById('i-webhook-url').value;
    if (window.saveSettings) {
        await window.saveSettings({ webhookUrl: url });
        if (window.logEvent) window.logEvent('SYS', 'URL de Webhook atualizada com sucesso.');
        window.updateStatusMsg("✅ Webhook Salvo!");
    }
};

window.syncWebhook = async function () {
    if (!window.leads || window.leads.length === 0) return alert("Nenhum lead para sincronizar.");
    const url = document.getElementById('i-webhook-url').value;
    if (!url || !url.startsWith("http")) return alert("Configure uma URL de Webhook válida primeiro.");

    document.getElementById('sys-status').innerText = "> Sincronizando lotes via Webhook...";

    // Safely structure payload to avoid circular JSON and huge unnecessary nested strings for Make.com
    const safeLeads = window.leads.map(l => ({
        id: l.lead_id_estavel,
        score: l.score,
        prioridade: l.prioridade_comercial || l.priority || "",
        status_pipeline: l.status_pipeline,
        empresa: l.name,
        telefone: l.phone,
        endereco: l.address,
        website: l.website,
        whatsapp_url: l.whatsapp_url,
        instagram: l.instagram,
        facebook: l.facebook,
        google_maps_url: l.google_maps_url,
        source_search_url: l.source_search_url,
        avaliacao_google: l.rating,
        total_avaliacoes: l.reviews,
        mensagem_intro: l.mensagem_whatsapp_curta || "",
        mensagem_consultiva: l.mensagem_whatsapp || "",
        argumento_sdr: l.argumento_comercial || "",
        concorrentes: l.concorrentes_referencia || "",
        ultimo_post: l.last_post || ""
    }));

    if (window.dispatchToWebhook) {
        const result = await window.dispatchToWebhook(url, safeLeads);
        if (result.success) {
            document.getElementById('sys-status').innerText = `> ✅ Sincronização Concluída! ${window.leads.length} leads enviados.`;
            if (window.logEvent) window.logEvent('SYS', `Webhook: Lote de ${window.leads.length} leads sincronizado com sucesso.`);
        } else {
            document.getElementById('sys-status').innerText = "> ❌ Erro ao sincronizar: " + (result.error || result.status);
            if (window.logEvent) window.logEvent('ERROR', `Webhook falhou (Status: ${result.status}). ${result.error}`);
        }
    }
};

window.addEventListener('load', () => {
    setTimeout(() => window.initLocalLeads(), 1000);
    setInterval(() => window.fetchObservability(), 3000);
});

window.fetchObservability = async function () {
    if (window.getRunLogs && window.getEventsLog) {
        const runs = await window.getRunLogs();
        if (runs && runs.length > 0) {
            const last = runs[runs.length - 1];
            document.getElementById('obs-last-run').innerHTML = `
                <span id="obs-lr-target" style="color:#f8fafc;"><strong>Alvo:</strong> ${last.niche} em ${last.city}</span><br>
                Status: <strong id="obs-lr-status" style="color:${last.status_final === 'OK' ? '#10b981' : '#ef4444'}">${last.status_final}</strong><br>
                Duração: <span id="obs-lr-duration" style="color:#f8fafc;">${last.duration_ms ? (last.duration_ms / 1000).toFixed(1) + 's' : 'Rodando...'}</span><br>
                Retorno: <strong id="obs-lr-novos" style="color:#10b981;">Novos: ${last.total_novos || 0}</strong> | Dups: <span id="obs-lr-dups">${last.total_duplicados || 0}</span> | Err: <span style="color:#ef4444">${last.total_erros || 0}</span>
            `;
        }

        const events = await window.getEventsLog();
        const evBox = document.getElementById('obs-events');
        if (events && events.length > 0) {
            evBox.innerHTML = events.map(e => `
                <div style="border-left: 2px solid ${e.type === 'ERROR' ? '#ef4444' : e.type === 'WARN' ? '#f59e0b' : '#3b82f6'}; padding-left: 6px;">
                    <span style="color:#64748b;">${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> 
                    <strong style="color:#e2e8f0;">[${e.type}]</strong> ${e.message}
                </div>
            `).join('');
        }
    }
};

// ==========================
// Cron / Agendamento UI
// ==========================
window.cronTimer = null;

window.toggleCron = function () {
    if (window.cronTimer) {
        clearInterval(window.cronTimer);
        window.cronTimer = null;
        document.getElementById('btn-cron').innerText = "Agendar";
        document.getElementById('btn-cron').style.background = "#2563eb";
        document.getElementById('cron-status').style.display = "none";
        document.getElementById('i-cron-min').disabled = false;
        window.updateStatusMsg("⏹️ Automação Recorrente (Cron) cancelada.");
    } else {
        const mins = parseInt(document.getElementById('i-cron-min').value);
        if (!mins || mins < 1) return alert("Insira um intervalo em minutos válido (ex: 60).");

        document.getElementById('btn-cron').innerText = "Parar Cron";
        document.getElementById('btn-cron').style.background = "#ef4444";
        document.getElementById('cron-status').style.display = "block";
        document.getElementById('lbl-cron-time').innerText = mins;
        document.getElementById('i-cron-min').disabled = true;

        window.updateStatusMsg(`⏱️ Automação ativada! Iniciando primeira corrida agora, a próxima será em ${mins} minutos.`);
        if (window.logEvent) window.logEvent('CRON', `Temporizador agendado para ciclos de ${mins} minutos.`);

        if (document.getElementById('btn-start').style.display !== 'none') {
            iniciarCaptacao('cron');
        } else {
            if (window.logEvent) window.logEvent('WARN', 'Bloqueio na ignição: Cron tentou rodar com captação já ativa.');
        }

        window.cronTimer = setInterval(() => {
            if (document.getElementById('btn-start').style.display !== 'none') {
                iniciarCaptacao('cron');
            } else {
                if (window.logEvent) window.logEvent('WARN', 'Bloqueio de colisão: Captação saltada porque motor já estava ocupado.');
            }
        }, mins * 60 * 1000);
    }
}
