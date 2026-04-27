// =============================================================
// CLOUD-AWARE API LAYER + AUTH MODAL
// =============================================================
window.DP_RUNTIME = window.DP_RUNTIME || 'local';
window.DP_IS_CLOUD = window.DP_RUNTIME === 'cloudflare' || !window.location.hostname.includes('localhost');

// --- Migração dp_access_code → dp_operator_access_code ---
(function () {
    const old = localStorage.getItem('dp_access_code');
    if (old && !localStorage.getItem('dp_operator_access_code')) {
        localStorage.setItem('dp_operator_access_code', old);
    }
    localStorage.removeItem('dp_access_code');
})();

// --- Access Code Helpers ---
window.dpGetAccessCode = function () {
    return localStorage.getItem('dp_operator_access_code') || '';
};
window.dpSetAccessCode = function (code) {
    if (code) localStorage.setItem('dp_operator_access_code', code);
};
window.dpClearAccessCode = function () {
    localStorage.removeItem('dp_operator_access_code');
};

// --- Modal: pedir código ao operador (retorna Promise<string|null>) ---
window.dpRequestAccessCode = function (reason) {
    return new Promise(function (resolve) {
        const modal = document.getElementById('accessCodeModal');
        const input = document.getElementById('accessCodeInput');
        const errorEl = document.getElementById('accessCodeError');
        const reasonEl = document.getElementById('accessCodeReason');
        if (!modal) { resolve(null); return; }

        const messages = {
            missing: 'Informe o código de acesso para usar o PWA online.',
            invalid: '⚠️ Código ausente ou inválido. Informe o código correto.',
        };
        reasonEl.innerText = messages[reason] || messages.missing;
        errorEl.style.display = 'none';
        input.value = window.dpGetAccessCode();
        modal.style.display = 'flex';
        input.focus();

        // Enter key support
        function onKeyDown(e) { if (e.key === 'Enter') { input.removeEventListener('keydown', onKeyDown); window._dpResolveAccessCode(input.value.trim()); } }
        input.addEventListener('keydown', onKeyDown);

        window._dpResolveAccessCode = function (val) {
            input.removeEventListener('keydown', onKeyDown);
            window._dpResolveAccessCode = null;
            modal.style.display = 'none';
            resolve(val);
        };
    });
};

// --- dpApi com retry robusto pós-401 ---
window.dpApi = async function (method, path, body, _isRetry) {
    const baseUrl = window.DP_IS_CLOUD ? '' : 'http://localhost:3939';
    const code = window.dpGetAccessCode();

    // Pré-check: cloud sem código → pedir antes
    if (window.DP_IS_CLOUD && !code && !_isRetry) {
        const newCode = await window.dpRequestAccessCode('missing');
        if (!newCode) return { ok: false, error: 'Código de acesso ausente.' };
        window.dpSetAccessCode(newCode);
        return window.dpApi(method, path, body, true);
    }

    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    const activeCode = window.dpGetAccessCode();
    if (activeCode) opts.headers['x-operator-access-code'] = activeCode;
    if (body && method !== 'GET') opts.body = JSON.stringify(body);

    try {
        const res = await fetch(baseUrl + path, opts);
        if (res.status === 401 && !_isRetry) {
            window.dpClearAccessCode();
            const newCode = await window.dpRequestAccessCode('invalid');
            if (!newCode) return { ok: false, error: 'Código de acesso ausente ou inválido.' };
            window.dpSetAccessCode(newCode);
            return window.dpApi(method, path, body, true);
        }
        if (res.status === 401) {
            window.dpClearAccessCode();
            return { ok: false, error: 'Código de acesso inválido. Tente novamente.' };
        }
        return await res.json();
    } catch (err) {
        return { ok: false, error: err.message };
    }
};

// Cloud search: criar job de pesquisa
window.dpCloudSearch = async function (queryName, city) {
    return window.dpApi('POST', '/api/search-jobs', { queryName, city });
};

// Cloud: listar search jobs
window.dpCloudSearchJobs = async function (status) {
    const params = status ? `?status=${status}` : '';
    return window.dpApi('GET', `/api/search-jobs${params}`);
};

// Cloud: criar job de diagnóstico
window.dpCloudDiagnosis = async function (leadSnapshot, candidateId) {
    return window.dpApi('POST', '/api/jobs', { leadSnapshot, candidateId });
};

// Cloud: listar diagnosis jobs
window.dpCloudDiagnosisJobs = async function (status) {
    const params = status ? `?status=${status}` : '';
    return window.dpApi('GET', `/api/jobs${params}`);
};

// Cloud: signed URL para PDF
window.dpCloudPdfUrl = async function (storagePath) {
    return window.dpApi('GET', `/api/jobs-pdf-url?path=${encodeURIComponent(storagePath)}`);
};

// Cloud: consultar job por id
window.dpCloudSearchJobById = async function (jobId) {
    return window.dpApi('GET', `/api/search-jobs?id=${jobId}`);
};
window.dpCloudDiagnosisJobById = async function (jobId) {
    return window.dpApi('GET', `/api/jobs?id=${jobId}`);
};

// Cloud polling helper — timeout curto, feedback inteligente
window.dpPollJob = async function (fetchFn, jobId, statusDiv, opts = {}) {
    const maxAttempts = opts.maxAttempts || 15;
    const interval = opts.interval || 3000;
    let lastStatus = '';
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, interval));
        const res = await fetchFn(jobId);
        if (!res.ok) continue;
        const job = res.job;
        if (!job) continue;
        lastStatus = job.status;
        const elapsed = (i + 1) * Math.round(interval / 1000);
        if (job.status === 'queued' && statusDiv) {
            statusDiv.innerHTML = `⏳ Na fila... (${elapsed}s) <span style="font-size:11px;color:#94a3b8;">— Aguardando executor local</span>`;
        }
        if (job.status === 'running' && statusDiv) {
            statusDiv.innerHTML = `🔄 Processando... (${elapsed}s)`;
        }
        if (job.status === 'succeeded') return { ok: true, job };
        if (job.status === 'failed') return { ok: false, error: job.error_message || 'Falhou', job };
    }
    if (lastStatus === 'queued') {
        return { ok: false, error: 'O executor local não está rodando. Inicie com "node index.js" no PC e tente novamente.' };
    }
    return { ok: false, error: 'Timeout — o processamento está demorando. Verifique o executor local.' };
};

// =============================================================
// EXECUTOR STATUS (M11C) — Badge visual no cloud
// =============================================================
window.dpCheckExecutorStatus = async function () {
    if (!window.DP_IS_CLOUD) return;
    const badge = document.getElementById('executorStatusBadge');
    if (!badge) return;

    try {
        const res = await fetch('/api/executor-status');
        const data = await res.json();
        if (!data.ok || !data.executor) {
            badge.style.display = 'block';
            badge.style.background = '#7f1d1d';
            badge.style.color = '#fca5a5';
            badge.innerText = '⚠️ Status indisponível';
            return;
        }
        const { status, label } = data.executor;
        badge.style.display = 'block';
        if (status === 'online') {
            badge.style.background = '#064e3b';
            badge.style.color = '#6ee7b7';
            badge.innerText = `🟢 Executor: ${label}`;
        } else if (status === 'delayed') {
            badge.style.background = '#78350f';
            badge.style.color = '#fcd34d';
            badge.innerText = `🟡 Executor: ${label}`;
        } else {
            badge.style.background = '#7f1d1d';
            badge.style.color = '#fca5a5';
            badge.innerText = `🔴 Executor: ${label}`;
        }
    } catch {
        badge.style.display = 'block';
        badge.style.background = '#7f1d1d';
        badge.style.color = '#fca5a5';
        badge.innerText = '🔴 Executor: sem conexão';
    }
};

// Auto-check no cloud a cada 30s
if (window.DP_IS_CLOUD) {
    window.dpCheckExecutorStatus();
    setInterval(window.dpCheckExecutorStatus, 30000);
}

window.leads = [];

// === PWA: Registro do Service Worker ===
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('[PWA] Service Worker registrado:', reg.scope))
            .catch(err => console.warn('[PWA] Service Worker falhou:', err.message));
    });
}

// Helper de sanitização XSS — escapa HTML em dados de scraping
window.escapeHtml = function (str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

window.updateStatusMsg = function (msg) {
    document.getElementById('sys-status').innerText = "> " + msg;
};

window.lastCampaignName = "";

async function iniciarCaptacao(triggerType = 'manual') {
    const niche = document.getElementById('i-niche').value;
    const city = document.getElementById('i-city').value;

    if (!niche || !city) {
        alert("⚠️ Por favor, informe o Nicho e a Cidade para o robô iniciar a varredura.");
        return;
    }

    const currentCampaignName = (niche + " em " + city).toLowerCase().trim();

    // Auto-Segmentação: Impede que o usuário misture relatórios sem querer.
    if (window.lastCampaignName && window.lastCampaignName !== currentCampaignName && window.leads.length > 0) {
        // Confirm bloqueia a UI em alguns casos do Chrome/Playwright, substituido por execução limpa + log.
        window.isClearing = true;
        try {
            if (window.clearLocalStore) await window.clearLocalStore();
            window.leads = [];
            window.renderEmptyState();
            document.getElementById('sys-status').innerText = "> Auto-limpeza efetuada para proteger segmentação...";
            await new Promise(res => setTimeout(res, 300));
        } catch (err) {
            console.error(err);
        } finally {
            window.isClearing = false;
        }
    }

    window.lastCampaignName = currentCampaignName;

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

window.isClearing = false;

window.renderEmptyState = function (tbody) {
    if (!tbody) tbody = document.getElementById('lead-list');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 30px; color: #94a3b8; font-style: italic;">Nenhum lead disponível nesta sessão. Inicie uma nova busca ou aguarde.</td></tr>';
};

window.clearLeads = async function () {
    if (window.isClearing) return console.warn("Limpeza em andamento, lock ativo.");

    // Removemos a caixa de "confirm" pois a ação é 100% segura (tudo tem backup) e o Chrome às vezes trava nela.
    window.isClearing = true;
    const btnClear = document.getElementById('btn-clear');
    if (btnClear) btnClear.disabled = true;

    try {
        const btnStop = document.getElementById('btn-stop');
        const isEngineActive = btnStop && window.getComputedStyle(btnStop).display !== 'none';

        // Pausar motor fisicamente se estiver ativo e aguardar expurgo da inércia
        if (window.pausarCaptacao && isEngineActive) {
            await window.pausarCaptacao();
            document.getElementById('sys-status').innerText = "> Drenando inércia do motor para garantir corte limpo...";
            await new Promise(res => setTimeout(res, 2000));
        }

        // Limpeza Lógica
        window.leads = [];
        window.lastCampaignName = ""; // Reseta segmentação de campanha

        // Limpeza Fisica Local (via NodeJS bridge)
        if (window.clearLocalStore) {
            await window.clearLocalStore();
        }

        // Limpeza Visual
        if (window.renderEmptyState) window.renderEmptyState();

        document.querySelectorAll('select[id^=f-]').forEach(e => e.value = 'all');
        const iFilter = document.getElementById('i-filter');
        if (iFilter) iFilter.value = 'all';

        if (window.logEvent) window.logEvent('WARN', 'Sessão descarregada pelo operador. Histórico salvo.');
        if (window.updateStatusMsg) window.updateStatusMsg("✅ Captações limpas! Pronto para novo lote.");

    } catch (err) {
        console.error("Falha bruta no Clean:", err);
        alert("⚠️ Erro interno de interface ao limpar. Veja os logs.");
        if (window.updateStatusMsg) window.updateStatusMsg("❌ Falha na limpeza.");
    } finally {
        if (btnClear) btnClear.disabled = false;
        window.isClearing = false;
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

    if (!filtered || filtered.length === 0) {
        if (window.renderEmptyState) window.renderEmptyState(tbody);
    } else {
        filtered.forEach(l => window.renderLeadRow(l, tbody));
    }
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

window.exportCSV = async function () {
    if (window.leads.length === 0) return alert("⚠️ Nenhum lead na tela para exportar. Faça uma captação primeiro.");

    document.getElementById('sys-status').innerText = "> Exportando CSV, aguarde...";

    const niche = document.getElementById('i-niche') ? document.getElementById('i-niche').value : 'Nicho';
    const city = document.getElementById('i-city') ? document.getElementById('i-city').value : 'Cidade';

    if (window.exportToCSV) {
        try {
            const filePath = await window.exportToCSV(window.leads, niche, city);
            document.getElementById('sys-status').innerText = "> ✅ CSV Gerado com sucesso em: " + filePath;
            if (window.logEvent) window.logEvent('SYS', `Exportou relatório CSV.`);
        } catch (e) {
            console.error(e);
            document.getElementById('sys-status').innerText = "> ❌ Erro ao exportar CSV.";
        }
    } else {
        alert("Função de exportar nativa não encontrada.");
    }
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
    let badgeDup = l.duplicado_de ? '<span style="background:#f59e0b; color:#fff; padding:2px 4px; border-radius:4px; font-size:9px; margin-left:6px; vertical-align:middle;">⚠️ REPESCADO</span>' : '';

    const esc = window.escapeHtml;
    tr.innerHTML =
        '<td class="' + scoreClass + '">' + (l.score || 0) + ' pts<br><span style="font-size:10px;">' + esc(priorityBadge) + '</span></td>' +
        '<td><strong style="color:#f8fafc; font-size:13px;">' + esc(l.name) + badgeDup + '</strong><br><span style="color:#64748b; font-size:11px;">' + esc(l.address || 'Sem Endereço') + '</span></td>' +
        '<td><select onclick="event.stopPropagation()" onchange="window.updatePipelineStatus(\'' + esc(l.lead_id_estavel) + '\', this.value)" style="background: ' + bgStatus + '; color: white; border: none; padding: 4px; border-radius: 4px; font-size: 11px;">' +
        '<option value="Novo" ' + (l.status_pipeline === 'Novo' ? 'selected' : '') + '>Novo</option>' +
        '<option value="Analisado" ' + (l.status_pipeline === 'Analisado' ? 'selected' : '') + '>Analisado</option>' +
        '<option value="Abordado" ' + (l.status_pipeline === 'Abordado' ? 'selected' : '') + '>Abordado</option>' +
        '<option value="Respondeu" ' + (l.status_pipeline === 'Respondeu' ? 'selected' : '') + '>Respondeu</option>' +
        '<option value="Proposta Enviada" ' + (l.status_pipeline === 'Proposta Enviada' ? 'selected' : '') + '>Proposta Enviada</option>' +
        '<option value="Fechado" ' + (l.status_pipeline === 'Fechado' ? 'selected' : '') + '>Fechado</option>' +
        '<option value="Perdido" ' + (l.status_pipeline === 'Perdido' ? 'selected' : '') + '>Perdido</option>' +
        '</select><br><span style="color:#cbd5e1; font-size:11px; line-height:1.4; display:block; margin-top: 4px;">' + esc(resumo) + '</span></td>';
    tbody.appendChild(tr);
}

window.addLead = function (lead) {
    if (window.isClearing) return;
    if (!lead || !lead.name) return;
    if (window.leads.some(l => l.name === lead.name)) return;

    window.leads.push(lead);

    window.leads.sort((a, b) => {
        let sA = a.score || 0; let sB = b.score || 0;
        return sB - sA;
    });

    if (window.applyFilters) {
        window.applyFilters();
    } else {
        const tbody = document.getElementById('lead-list');
        tbody.innerHTML = '';
        window.leads.forEach((l) => window.renderLeadRow(l, tbody));
    }
};

window.showDetails = async function (idx) {
    const l = window.leads[idx];
    document.getElementById('leadModal').style.display = 'block';
    document.getElementById('m-name').innerText = l.name;

    const esc = window.escapeHtml;
    // Links são sanitizados: apenas o texto exibido é escapado, href é validado como URL
    const safeUrl = (url) => { try { new URL(url); return url; } catch (e) { return '#'; } };

    let info = '<p><strong>📍 Maps:</strong> ' + (l.google_maps_url ? '<a href="' + safeUrl(l.google_maps_url) + '" target="_blank" style="color:#3b82f6;">Google Maps</a>' : 'N/A') + '</p>';
    info += '<p><strong>📞</strong> ' + esc(l.phone || 'Sem contato telefônico') + '</p>';
    info += '<p><strong>🌐 Web:</strong> ' + (l.website ? '<a href="' + safeUrl(l.website) + '" target="_blank" style="color:#3b82f6;">Acessar Website</a>' : 'Sem Domínio') + '</p>';
    info += '<p><strong>📸 Insta:</strong> ' + (l.instagram ? '<a href="' + safeUrl(l.instagram) + '" target="_blank" style="color:#d946ef;">Instagram</a>' : 'N/A') + ' | <strong>📘 Face:</strong> ' + (l.facebook ? '<a href="' + safeUrl(l.facebook) + '" target="_blank" style="color:#3b82f6;">Facebook</a>' : 'N/A') + ' | <strong>💬 Whats:</strong> ' + (l.whatsapp_url ? '<a href="' + safeUrl(l.whatsapp_url) + '" target="_blank" style="color:#25d366;">WhatsApp</a>' : 'N/A') + '</p>';

    if (l.other_public_links && l.other_public_links.length > 0) {
        info += '<p><strong>🔗 Outros Links (' + l.other_public_links.length + '):</strong><br>';
        l.other_public_links.forEach(ol => {
            info += '<a href="' + safeUrl(ol) + '" target="_blank" style="color:#94a3b8; font-size:11px; margin-right:8px; display:inline-block; margin-bottom:5px;">' + esc(ol) + '</a><br>';
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
    forenseHtml += '<strong>Última Postagem GMB:</strong> ' + (l.last_post ? esc(l.last_post) : '<span style="color:#ef4444">Nunca postou na aba Atualizações.</span>') + '<br><br>';

    if (l.negative_reviews && l.negative_reviews.length > 0) {
        forenseHtml += '<strong style="color:#ef4444">💣 Reclamações Encontradas (Piores Avaliações):</strong><br>';
        l.negative_reviews.forEach(nr => {
            forenseHtml += '<blockquote style="border-left: 3px solid #ef4444; margin: 10px 0; padding-left: 10px; font-style:italic;">"' + esc(nr) + '"</blockquote>';
        });
    } else {
        forenseHtml += '<span style="color:#10b981">Nenhuma avaliação negativa grave identificada no topo da listagem.</span>';
    }

    forenseHtml += '</div>';

    if (l.concorrentes_referencia) {
        forenseHtml += '<br><strong style="color:#f59e0b">⚔️ Referência Competitiva:</strong><br><div style="background: #0f172a; padding: 10px; border-radius: 6px; font-size: 12px; margin-top: 5px; color: #cbd5e1;">' + esc(l.concorrentes_referencia) + '</div>';
    }

    const waMsgOptions = l.mensagem_whatsapp_curta || l.draft_message || '';
    if (waMsgOptions) {
        forenseHtml += '<br><strong>📲 Sugestão de Abordagem Curta (WhatsApp/Intro):</strong><br><div style="white-space: pre-wrap; background: #0f172a; padding: 15px; border-radius: 6px; font-size: 13px; margin-top: 10px; border-left: 4px solid #25d366; font-style: italic; color: #f8fafc; font-family: monospace; line-height: 1.6;">' + esc(waMsgOptions) + '</div>';
    }
    if (l.mensagem_whatsapp) {
        forenseHtml += '<br><strong>📲 Abordagem Consultiva (WhatsApp):</strong><br><div style="white-space: pre-wrap; background: #0f172a; padding: 15px; border-radius: 6px; font-size: 13px; margin-top: 10px; border-left: 4px solid #3b82f6; font-style: italic; color: #f8fafc; font-family: monospace; line-height: 1.6;">' + esc(l.mensagem_whatsapp) + '</div>';
    }
    if (l.argumento_comercial) {
        forenseHtml += '<br><strong style="color:#f59e0b">🎯 Argumento de Vendas (SDR):</strong><br><div style="white-space: pre-wrap; background: #0f172a; padding: 15px; border-radius: 6px; font-size: 13px; margin-top: 10px; border-left: 4px solid #f59e0b; color: #cbd5e1; font-family: monospace; line-height: 1.6;">' + esc(l.argumento_comercial) + '</div>';
    }

    document.getElementById('m-ai-text').innerHTML = forenseHtml;

    // --- BOTÃO DIAGNÓSTICO PREMIUM ---
    const premiumDiv = document.createElement('div');
    premiumDiv.style.cssText = 'margin-top: 25px; padding-top: 20px; border-top: 1px solid #334155;';
    premiumDiv.innerHTML = `
        <button id="btn-premium-${idx}" onclick="window.runPremiumDiagnostic(${idx})"
            style="width:100%; background: linear-gradient(135deg, #8b5cf6, #6d28d9); color:white; border:none; padding:14px; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer; letter-spacing:0.5px;">
            🔬 DIAGNÓSTICO PREMIUM (Evidência Visual)
        </button>
        <p style="font-size:11px; color:#94a3b8; margin-top:8px; text-align:center;">
            Gera relatório aprofundado com screenshots, evidência e PDF premium para este lead.
        </p>
        <div id="premium-status-${idx}" style="margin-top:10px; font-size:12px; color:#94a3b8; display:none;"></div>
    `;
    document.getElementById('m-ai-text').appendChild(premiumDiv);
};

window.exportPDF = async function () {
    if (window.leads.length === 0) return alert("⚠️ A tabela está vazia. Não há como gerar o PDF comercial agora.");
    const niche = document.getElementById('i-niche') ? document.getElementById('i-niche').value : 'Nicho';
    const city = document.getElementById('i-city') ? document.getElementById('i-city').value : 'Cidade';

    document.getElementById('sys-status').innerText = "> Gerando PDF Interno, aguarde...";
    try {
        const filePath = await window.exportToPDF(window.leads, niche, city);
        document.getElementById('sys-status').innerText = "> ✅ PDF Interno gerado em: " + filePath;
        if (window.logEvent) window.logEvent('SYS', `Exportou PDF Interno com sucesso.`);
    } catch (e) {
        console.error(e);
        document.getElementById('sys-status').innerText = "> ❌ Erro ao gerar PDF Interno.";
    }
};

window.exportExternalReport = async function () {
    if (window.leads.length === 0) return alert("⚠️ Nenhum lead disponível para gerar diagnóstico externo.");
    const niche = document.getElementById('i-niche') ? document.getElementById('i-niche').value : 'Nicho';
    const city = document.getElementById('i-city') ? document.getElementById('i-city').value : 'Cidade';

    document.getElementById('sys-status').innerText = "> 🎯 Gerando Diagnósticos Externos para cada lead...";

    let gerados = 0;
    let erros = 0;

    for (const lead of window.leads) {
        try {
            if (window.exportExternalPDF) {
                await window.exportExternalPDF(lead, niche, city);
                gerados++;
                document.getElementById('sys-status').innerText = `> 🎯 Diagnóstico ${gerados}/${window.leads.length}: ${lead.name}`;
            }
        } catch (e) {
            erros++;
            console.error(`Erro no diagnóstico de ${lead.name}:`, e);
        }
    }

    document.getElementById('sys-status').innerText = `> ✅ ${gerados} Diagnósticos Externos gerados! ${erros > 0 ? `(${erros} erros)` : ''}`;
    if (window.logEvent) window.logEvent('SYS', `Exportou ${gerados} diagnósticos externos.`);
};

window.runPremiumDiagnostic = async function (idx) {
    const lead = window.leads[idx];
    if (!lead) return alert('Lead não encontrado.');

    const niche = document.getElementById('i-niche') ? document.getElementById('i-niche').value : (lead.niche || 'Nicho');
    const city = document.getElementById('i-city') ? document.getElementById('i-city').value : (lead.city || 'Cidade');

    const btn = document.getElementById(`btn-premium-${idx}`);
    const statusDiv = document.getElementById(`premium-status-${idx}`);

    if (btn) { btn.disabled = true; btn.innerText = '⏳ Gerando Diagnóstico Premium...'; btn.style.opacity = '0.6'; }
    if (statusDiv) { statusDiv.style.display = 'block'; statusDiv.innerHTML = '⏳ Enviando para análise...'; }
    document.getElementById('sys-status').innerText = `> 🔬 Diagnóstico Premium em andamento: ${lead.name}...`;

    try {
        // C3: Cloud path — envia para fila Supabase
        if (window.DP_IS_CLOUD) {
            const snapshot = { name: lead.name, city: lead.city || city, phone: lead.phone, website: lead.website, google_maps_url: lead.google_maps_url, instagram: lead.instagram, facebook: lead.facebook, whatsapp_url: lead.whatsapp_url, rating: lead.rating, reviews: lead.reviews };
            statusDiv.innerHTML = '⏳ Diagnóstico enviado para fila online...';
            const createRes = await window.dpCloudDiagnosis(snapshot);
            if (!createRes.ok) {
                statusDiv.innerHTML = `<span style="color:#ef4444;">❌ ${window.escapeHtml(createRes.error)}</span>`;
                return;
            }
            statusDiv.innerHTML = '⏳ Na fila. Aguardando executor local processar...';
            const pollRes = await window.dpPollJob(window.dpCloudDiagnosisJobById, createRes.jobId, statusDiv, { interval: 5000 });
            if (!pollRes.ok) {
                statusDiv.innerHTML = `<span style="color:#ef4444;">❌ ${window.escapeHtml(pollRes.error)}</span>`;
                return;
            }
            const job = pollRes.job;
            const storagePath = job.pdf_storage_path || (job.result && job.result.storagePath) || '';
            let pdfButtons = '';
            if (storagePath) {
                pdfButtons = `
                    <div style="margin-top:15px; display:flex; gap:8px; flex-wrap:wrap;">
                        <button onclick="(async()=>{const r=await window.dpCloudPdfUrl('${storagePath.replace(/'/g, "\\'")}');if(r.ok&&r.signedUrl)window.open(r.signedUrl,'_blank');else alert('Erro ao obter URL do PDF');})()"
                            style="flex:1; min-width:140px; background:linear-gradient(135deg,#8b5cf6,#6d28d9); color:white; border:none; padding:14px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; min-height:48px;">
                            📄 Abrir PDF
                        </button>
                    </div>`;
            }
            statusDiv.innerHTML = `
                <div style="background:#0f2a0f; border:1px solid #10b981; border-radius:8px; padding:15px; margin-top:10px;">
                    <p style="color:#10b981; font-weight:700;">✅ Diagnóstico Premium Concluído!</p>
                    <p style="color:#cbd5e1; font-size:12px;">Score: ${job.diagnosis_score || 'N/A'}</p>
                    ${storagePath ? '<p style="color:#94a3b8; font-size:11px;">PDF disponível no Storage seguro.</p>' : '<p style="color:#94a3b8; font-size:11px;">PDF será gerado pelo executor local.</p>'}
                    ${pdfButtons}
                </div>`;
            document.getElementById('sys-status').innerText = `> ✅ Diagnóstico cloud concluído: ${lead.name}`;
            return;
        }

        // Local path — fluxo original
        const result = await window.generatePremiumReport(lead, niche, city);

        if (result && result.pdfPath) {
            const reportUrl = window.getReportFileUrl(result.pdfPath);
            const safeLeadName = lead.name.replace(/[^a-zA-Z0-9\u00C0-\u00FF ]/g, '').trim().replace(/\s+/g, '-');
            const msg = `
                <div style="background:#0f2a0f; border: 1px solid #10b981; border-radius:8px; padding:15px; margin-top:10px;">
                    <p style="color:#10b981; font-weight:700; margin-bottom:8px;">✅ Diagnóstico Premium Gerado!</p>
                    <p style="color:#cbd5e1; font-size:12px;">📄 <strong>PDF:</strong> ${window.escapeHtml(result.pdfPath)}</p>
                    <p style="color:#cbd5e1; font-size:12px;">📋 <strong>Evidência:</strong> ${window.escapeHtml(result.evidencePath)}</p>
                    <p style="color:#94a3b8; font-size:11px; margin-top:8px;">Screenshots e evidência salvos em data/screenshots/ e data/evidence/</p>
                    <div style="margin-top:15px; display:flex; gap:8px; flex-wrap:wrap;">
                        <button onclick="window.sharePremiumReport('${result.pdfPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', '${safeLeadName}')"
                            style="flex:1; min-width:140px; background:linear-gradient(135deg,#8b5cf6,#6d28d9); color:white; border:none; padding:14px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; min-height:48px;">
                            📲 Compartilhar PDF
                        </button>
                        <a href="${reportUrl}" target="_blank" rel="noopener"
                            style="flex:1; min-width:140px; display:flex; align-items:center; justify-content:center; background:#334155; color:#f8fafc; border:none; padding:14px; border-radius:8px; font-size:13px; font-weight:600; text-decoration:none; text-align:center; min-height:48px;">
                            📄 Abrir PDF
                        </a>
                    </div>
                    <p id="share-status-${idx}" style="font-size:11px; color:#94a3b8; margin-top:8px; display:none;"></p>
                </div>
            `;
            if (statusDiv) statusDiv.innerHTML = msg;
            document.getElementById('sys-status').innerText = `> ✅ Diagnóstico Premium gerado para: ${lead.name}`;
            if (window.logEvent) window.logEvent('SYS', `Diagnóstico Premium gerado: ${lead.name} → ${result.pdfPath}`);
        } else {
            if (statusDiv) statusDiv.innerHTML = '<span style="color:#ef4444;">❌ Diagnóstico retornou vazio.</span>';
            document.getElementById('sys-status').innerText = '> ❌ Erro no Diagnóstico Premium.';
        }
    } catch (e) {
        console.error('Premium error:', e);
        if (statusDiv) statusDiv.innerHTML = `<span style="color:#ef4444;">❌ Erro: ${window.escapeHtml(e.message || 'Falha desconhecida')}</span>`;
        document.getElementById('sys-status').innerText = '> ❌ Erro ao gerar Diagnóstico Premium.';
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = '🔬 DIAGNÓSTICO PREMIUM (Evidência Visual)'; btn.style.opacity = '1'; }
    }
};

window.exportCSVExternal = async function () {
    if (window.leads.length === 0) return alert("⚠️ Nenhum lead na tela para exportar.");
    const niche = document.getElementById('i-niche') ? document.getElementById('i-niche').value : 'Nicho';
    const city = document.getElementById('i-city') ? document.getElementById('i-city').value : 'Cidade';

    document.getElementById('sys-status').innerText = "> Exportando CSV Externo (sem dados internos)...";
    try {
        if (window.exportToCSVExternal) {
            const filePath = await window.exportToCSVExternal(window.leads, niche, city);
            document.getElementById('sys-status').innerText = "> ✅ CSV Externo gerado em: " + filePath;
            if (window.logEvent) window.logEvent('SYS', `Exportou CSV Externo (${window.leads.length} leads).`);
        }
    } catch (e) {
        console.error(e);
        document.getElementById('sys-status').innerText = "> ❌ Erro ao gerar CSV Externo.";
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
    if (!window.leads || window.leads.length === 0) return alert("⚠️ Sem leads na matriz para envio.");
    const url = document.getElementById('i-webhook-url').value;
    if (!url || !url.startsWith("http")) return alert("⚙️ Configure a URL HTTPS do Hook do Make.com ou RD Station no menu lateral antes.");

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
                Horário: <span style="color:#94a3b8; font-size:11px;">${new Date(last.started_at).toLocaleString()}</span><br>
                Origem: <span style="color:#f59e0b; font-size:11px;">${last.trigger_type ? last.trigger_type.toUpperCase() : 'MANUAL'}</span><br>
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

// ==========================
// PESQUISA INDIVIDUAL (M1)
// ==========================
window.singleSearchCandidates = [];

window.singleSearch = async function () {
    const name = document.getElementById('i-single-name').value.trim();
    const city = document.getElementById('i-single-city').value.trim();

    if (!name) return alert("⚠️ Informe o nome da empresa.");
    if (!city) return alert("⚠️ Informe a cidade.");

    const btn = document.getElementById('btn-single-search');
    const statusDiv = document.getElementById('single-status');
    btn.disabled = true;
    btn.innerText = '⏳ Buscando...';
    statusDiv.style.display = 'block';
    statusDiv.innerText = 'Pesquisando no Google Maps...';
    window.updateStatusMsg(`🔍 Pesquisa individual: "${name}" em "${city}"...`);

    try {
        // C1: Cloud path — envia para fila Supabase
        if (window.DP_IS_CLOUD) {
            statusDiv.innerText = 'Enviando busca para fila online...';
            const createRes = await window.dpCloudSearch(name, city);
            if (!createRes.ok) {
                statusDiv.innerHTML = `<span style="color:#ef4444;">❌ Erro: ${window.escapeHtml(createRes.error)}</span>`;
                return;
            }
            statusDiv.innerHTML = '⏳ Busca enviada. Aguardando executor local...';
            window.updateStatusMsg('⏳ Busca na fila. Aguardando executor...');

            const pollRes = await window.dpPollJob(window.dpCloudSearchJobById, createRes.jobId, statusDiv);
            if (!pollRes.ok) {
                statusDiv.innerHTML = `<span style="color:#ef4444;">❌ ${window.escapeHtml(pollRes.error)}</span>`;
                window.updateStatusMsg('❌ Busca falhou.');
                return;
            }

            const candidates = (pollRes.job.result && pollRes.job.result.candidates) || [];
            window.singleSearchCandidates = candidates;
            if (candidates.length === 0) {
                statusDiv.innerHTML = '<span style="color:#ef4444;">❌ Nenhum candidato encontrado.</span>';
                return;
            }
            statusDiv.innerHTML = `<span style="color:#10b981;">✅ ${candidates.length} candidato(s). Selecione abaixo.</span>`;
            window.updateStatusMsg(`✅ ${candidates.length} candidato(s) encontrado(s).`);
            window.renderCandidates(candidates);
            return;
        }

        // Local path — fluxo original
        if (typeof window.searchSingle !== 'function') {
            statusDiv.innerHTML = '<span style="color:#ef4444;">❌ Motor local indisponível. Limpe o cache do navegador e tente novamente.</span>';
            window.updateStatusMsg('❌ Motor local não disponível neste dispositivo.');
            return;
        }
        const candidates = await window.searchSingle(name, city);
        window.singleSearchCandidates = candidates;

        if (!candidates || candidates.length === 0) {
            statusDiv.innerHTML = '<span style="color:#ef4444;">❌ Nenhum candidato encontrado.</span>';
            window.updateStatusMsg('❌ Pesquisa individual: nenhum resultado.');
            return;
        }

        statusDiv.innerHTML = `<span style="color:#10b981;">✅ ${candidates.length} candidato(s). Selecione abaixo.</span>`;
        window.updateStatusMsg(`✅ ${candidates.length} candidato(s) encontrado(s). Selecione o correto.`);
        window.renderCandidates(candidates);

    } catch (e) {
        console.error('Erro na pesquisa individual:', e);
        statusDiv.innerHTML = `<span style="color:#ef4444;">❌ Erro: ${window.escapeHtml(e.message)}</span>`;
        window.updateStatusMsg('❌ Erro na pesquisa individual.');
    } finally {
        btn.disabled = false;
        btn.innerText = '🔍 BUSCAR EMPRESA';
    }
};

window.renderCandidates = function (candidates) {
    const list = document.getElementById('candidate-list');
    const modal = document.getElementById('candidateModal');
    const esc = window.escapeHtml;

    list.innerHTML = candidates.map((c, i) => `
        <div style="background:#1e293b; border:1px solid #334155; border-radius:8px; padding:15px; cursor:pointer; transition: border-color 0.2s;"
             onmouseover="this.style.borderColor='#8b5cf6'"
             onmouseout="this.style.borderColor='#334155'"
             onclick="window.selectCandidate(${i})">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="color:#f8fafc; font-size:15px;">${esc(c.name)}</strong>
                    ${c.category ? `<span style="background:#334155; color:#94a3b8; padding:2px 8px; border-radius:10px; font-size:10px; margin-left:8px;">${esc(c.category)}</span>` : ''}
                </div>
                <div style="text-align:right;">
                    <span style="color:#f59e0b; font-size:14px;">${c.rating > 0 ? c.rating + '⭐' : 'Sem nota'}</span>
                    <span style="color:#94a3b8; font-size:11px; display:block;">${c.reviews > 0 ? c.reviews + ' reviews' : ''}</span>
                </div>
            </div>
            <div style="margin-top:8px; color:#94a3b8; font-size:12px;">
                ${c.address ? '📍 ' + esc(c.address) : ''}
                ${c.phone ? ' | 📞 ' + esc(c.phone) : ''}
            </div>
        </div>
    `).join('');

    modal.style.display = 'block';
};

window.selectCandidate = async function (idx) {
    const candidate = window.singleSearchCandidates[idx];
    if (!candidate) return alert('Candidato não encontrado.');

    const list = document.getElementById('candidate-list');
    const actionDiv = document.getElementById('candidate-action');

    // Highlight selecionado
    const cards = list.querySelectorAll('div[onclick]');
    cards.forEach((c, i) => {
        c.style.borderColor = i === idx ? '#8b5cf6' : '#334155';
        c.style.opacity = i === idx ? '1' : '0.5';
    });

    actionDiv.style.display = 'block';
    actionDiv.innerHTML = `
        <div style="background:#0f2a0f; border:1px solid #10b981; border-radius:8px; padding:15px;">
            <p style="color:#10b981; font-weight:700; margin-bottom:8px;">✅ Selecionado: ${window.escapeHtml(candidate.name)}</p>
            <p style="color:#94a3b8; font-size:12px; margin-bottom:10px;">${window.DP_IS_CLOUD ? 'Adicionando ao pipeline...' : 'Auditando empresa completa e adicionando ao pipeline...'}</p>
            <div id="candidate-progress" style="color:#94a3b8; font-size:11px;">⏳ ${window.DP_IS_CLOUD ? 'Preparando...' : 'Realizando auditoria forense...'}</div>
        </div>
    `;

    window.updateStatusMsg(`🔍 ${window.DP_IS_CLOUD ? 'Selecionando' : 'Auditoria individual'}: ${candidate.name}...`);

    try {
        // === DEDUP M2 ===
        const mapsUrl = candidate.google_maps_url;
        if (mapsUrl) {
            const existingByUrl = window.leads.find(l => l.google_maps_url && l.google_maps_url.split('?')[0] === mapsUrl.split('?')[0]);
            if (existingByUrl) {
                const existingIdx = window.leads.indexOf(existingByUrl);
                document.getElementById('candidate-progress').innerHTML = `<span style="color:#f59e0b;">⚠️ ${window.escapeHtml(existingByUrl.name)} já está no pipeline.</span>`;
                setTimeout(() => { document.getElementById('candidateModal').style.display = 'none'; window.showDetails(existingIdx); }, 800);
                return;
            }
        }

        const niche = document.getElementById('i-single-name').value.trim();
        const city = document.getElementById('i-single-city').value.trim();

        // C2: Cloud path — sem auditSingleCandidate, usa dados do candidato direto
        if (window.DP_IS_CLOUD) {
            const leadId = 'cloud_' + Date.now();
            const fullLead = {
                name: candidate.name || '',
                address: candidate.address || '',
                source_search_url: `Pesquisa cloud: ${niche} em ${city}`,
                google_maps_url: candidate.google_maps_url || '',
                website: candidate.website || '',
                instagram: candidate.instagram_url || '',
                facebook: candidate.facebook_url || '',
                whatsapp_url: candidate.whatsapp_url || '',
                phone: candidate.phone || '',
                categoria_maps: candidate.category || '',
                rating: candidate.rating || 0,
                reviews: candidate.reviews || 0,
                score: 0,
                priority: 'individual',
                reasons: ['Pesquisa cloud — lead selecionado manualmente'],
                niche: niche,
                city: city,
                lead_id_estavel: leadId,
                data_captacao: new Date().toISOString(),
                prioridade_comercial: 'individual',
                prioridade_motivos: ['Lead selecionado via cloud'],
                status_pipeline: 'Novo',
                origem_snapshot: 'Pesquisa Cloud V1',
                other_public_links: [],
                negative_reviews: [],
            };
            window.addLead(fullLead);
            const realIdx = window.leads.findIndex(l => l.lead_id_estavel === leadId);
            document.getElementById('candidate-progress').innerHTML = `<span style="color:#10b981;">✅ ${window.escapeHtml(fullLead.name)} adicionado ao pipeline!</span>`;
            setTimeout(() => { document.getElementById('candidateModal').style.display = 'none'; window.showDetails(realIdx >= 0 ? realIdx : window.leads.length - 1); }, 800);
            window.updateStatusMsg(`✅ Lead cloud: ${fullLead.name}`);
            return;
        }

        // Local path — auditoria completa original
        const auditResult = await window.auditSingleCandidate(candidate.google_maps_url);
        if (!auditResult || !auditResult.name) {
            document.getElementById('candidate-progress').innerHTML = '<span style="color:#ef4444;">❌ Falha na auditoria. Tente outro candidato.</span>';
            return;
        }

        const existingByName = window.leads.find(l => l.name === auditResult.name && l.city === city);
        if (existingByName) {
            const existingIdx = window.leads.indexOf(existingByName);
            document.getElementById('candidate-progress').innerHTML = `<span style="color:#f59e0b;">⚠️ ${window.escapeHtml(existingByName.name)} já está no pipeline.</span>`;
            setTimeout(() => { document.getElementById('candidateModal').style.display = 'none'; window.showDetails(existingIdx); }, 800);
            return;
        }

        const leadId = 'single_' + Date.now();
        const fullLead = {
            name: auditResult.name,
            address: auditResult.address ? auditResult.address.split('-')[0].trim() : '',
            source_search_url: `Pesquisa individual: ${niche} em ${city}`,
            google_maps_url: candidate.google_maps_url,
            website: auditResult.website || '',
            instagram: auditResult.instagram || '',
            instagram_source: auditResult.instagram_source || '',
            facebook: auditResult.facebook || '',
            whatsapp_url: auditResult.whatsapp || '',
            other_public_links: auditResult.other_public_links || [],
            phone: auditResult.phone || '',
            email: auditResult.email || '',
            categoria_maps: auditResult.categoria_maps || '',
            rating: auditResult.rating || 0,
            reviews: auditResult.reviews || 0,
            negative_reviews: auditResult.negative_reviews || [],
            last_post: auditResult.last_post || null,
            score: 0,
            priority: 'individual',
            reasons: ['Pesquisa individual — lead selecionado manualmente'],
            motives_detailed: [],
            niche_profile: 'individual',
            draft_message: '',
            status: 'success',
            warnings: auditResult.warnings || [],
            niche: niche,
            city: city,
            lead_id_estavel: leadId,
            data_captacao: new Date().toISOString(),
            prioridade_comercial: 'individual',
            prioridade_motivos: ['Lead selecionado manualmente'],
            resumo_executivo: '',
            concorrentes_referencia: '',
            oferta_recomendada: '',
            mensagem_whatsapp_curta: '',
            mensagem_whatsapp: '',
            mensagem_email: '',
            argumento_comercial: '',
            status_pipeline: 'Novo',
            status_contato: '',
            data_ultimo_envio: '',
            observacao_validacao: '',
            responsavel: '',
            ultima_acao: null,
            proxima_acao: null,
            origem_snapshot: 'Pesquisa Individual V1',
            duplicado_de: null,
            enrichment_quality: (auditResult.other_public_links && auditResult.other_public_links.length > 0) ? 'Enriquecido' : 'Básico',
            evidence_summary: ''
        };

        window.addLead(fullLead);
        if (window.logEvent) window.logEvent('SYS', `Lead individual adicionado: ${fullLead.name}`);
        const realIdx = window.leads.findIndex(l => l.lead_id_estavel === leadId);

        document.getElementById('candidate-progress').innerHTML = `
            <span style="color:#10b981;">✅ ${window.escapeHtml(fullLead.name)} adicionado ao pipeline!</span><br>
            <span style="font-size:11px; color:#94a3b8;">Canais: 
                ${fullLead.website ? '🌐' : ''}
                ${fullLead.instagram ? '📸' : ''}
                ${fullLead.facebook ? '📘' : ''}
                ${fullLead.whatsapp_url ? '💬' : ''}
                ${fullLead.phone ? '📞' : ''}
            </span>
            <p style="font-size:12px; color:#8b5cf6; margin-top:10px;">⏳ Abrindo detalhes e diagnóstico premium...</p>
        `;

        setTimeout(() => {
            document.getElementById('candidateModal').style.display = 'none';
            window.showDetails(realIdx >= 0 ? realIdx : window.leads.length - 1);
        }, 1000);

        window.updateStatusMsg(`✅ Lead individual: ${fullLead.name} — abrindo diagnóstico...`);

    } catch (e) {
        console.error('Erro na seleção:', e);
        document.getElementById('candidate-progress').innerHTML = `<span style="color:#ef4444;">❌ Erro: ${window.escapeHtml(e.message)}</span>`;
        window.updateStatusMsg('❌ Erro na auditoria do candidato.');
    }
};

// ==========================
// M6A: SHARE PDF PREMIUM
// ==========================

// Gera URL HTTP para acessar PDF via API local
window.getReportFileUrl = function (pdfPath) {
    if (!pdfPath) return '';
    return `/api/report-file?path=${encodeURIComponent(pdfPath)}`;
};

// Compartilhar PDF via Web Share API com fallbacks
window.sharePremiumReport = async function (pdfPath, leadName) {
    if (!pdfPath) {
        alert('Não foi possível localizar o PDF gerado.');
        return;
    }

    const reportUrl = window.getReportFileUrl(pdfPath);
    const fullUrl = `${window.location.origin}${reportUrl}`;
    const fileName = `diagnostico-${(leadName || 'empresa').toLowerCase().replace(/[^a-z0-9-]/g, '-')}.pdf`;

    try {
        // Tenta buscar o PDF para compartilhar como arquivo
        const response = await fetch(reportUrl);
        if (!response.ok) throw new Error('PDF não encontrado no servidor');

        const blob = await response.blob();
        const file = new File([blob], fileName, { type: 'application/pdf' });

        // Fallback 1: Web Share com arquivo
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: `Diagnóstico Premium - ${leadName || 'Empresa'}`,
                text: 'Diagnóstico Digital Premium gerado pela Digital Prime Studio.',
                files: [file],
            });
            console.log('[M6A] PDF compartilhado via Web Share (arquivo)');
            return;
        }

        // Fallback 2: Web Share com URL (sem arquivo)
        if (navigator.share) {
            await navigator.share({
                title: `Diagnóstico Premium - ${leadName || 'Empresa'}`,
                text: 'Diagnóstico Digital Premium gerado pela Digital Prime Studio.',
                url: fullUrl,
            });
            console.log('[M6A] PDF compartilhado via Web Share (URL)');
            return;
        }

        // Fallback 3: Abrir em nova aba
        window.open(reportUrl, '_blank');
        console.log('[M6A] PDF aberto em nova aba (fallback)');

    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('[M6A] Compartilhamento cancelado pelo usuário');
            return;
        }
        console.warn('[M6A] Erro no compartilhamento, abrindo PDF:', err.message);
        // Fallback final: abre em nova aba
        window.open(reportUrl, '_blank');
    }
};

