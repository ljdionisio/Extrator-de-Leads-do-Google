const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(process.cwd(), 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const HIST_FILE = path.join(DATA_DIR, 'history_snapshots.json');
const RUNS_LOG_FILE = path.join(DATA_DIR, 'runs_log.json');
const EVENTS_LOG_FILE = path.join(DATA_DIR, 'events_log.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Bloqueio padrão de reabordagem: 30 dias
const REABORDAGEM_LOCK_DAYS = 30;

// Garante existência dos arquivos
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
[LEADS_FILE, HIST_FILE, RUNS_LOG_FILE, EVENTS_LOG_FILE].forEach(f => {
    if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify([]), 'utf8');
});
if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ webhookUrl: '' }), 'utf8');
}

// === Backup Rotativo ===
function initBackup() {
    try {
        if (!fs.existsSync(HIST_FILE)) return;
        const maxBackups = 5;
        for (let i = maxBackups - 1; i >= 1; i--) {
            let oldBkp = path.join(DATA_DIR, `history_backup_${i}.json`);
            let newBkp = path.join(DATA_DIR, `history_backup_${i + 1}.json`);
            if (fs.existsSync(oldBkp)) fs.renameSync(oldBkp, newBkp);
        }
        fs.copyFileSync(HIST_FILE, path.join(DATA_DIR, 'history_backup_1.json'));
        console.log("[Backup] Rotação de histórico concluída.");
    } catch (e) {
        console.error("[Backup Error] Falha ao rotacionar backups:", e.message);
    }
}
initBackup();

// === JSON Seguro ===
function safeLoadJson(filePath, emptyFallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`[Data Integrity] Erro ao ler ${path.basename(filePath)}. Tentando recuperar...`);
        try {
            if (fs.existsSync(filePath)) {
                fs.copyFileSync(filePath, filePath + `.corrupted_${Date.now()}`);
            }
        } catch (ex) { }

        if (filePath.includes('history_')) {
            try {
                let fallback = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'history_backup_1.json'), 'utf8'));
                console.log("[Data Integrity] Histórico restaurado a partir do backup 1 com sucesso!");
                return fallback;
            } catch (ex2) {
                console.error("[Data Integrity] Falha ao restaurar pelo último backup. Resetando cache.");
            }
        }
        return emptyFallback;
    }
}

// === CRUD de Leads ===
function loadLeads() {
    return safeLoadJson(LEADS_FILE, []);
}

function loadHistory() {
    return safeLoadJson(HIST_FILE, []);
}

/**
 * Gera hash de deduplicação composto (nome + telefone + maps URL).
 */
function generateDeduplicationHash(leadData) {
    const raw = [
        (leadData.name || '').toLowerCase().trim(),
        (leadData.phone || '').replace(/\D/g, ''),
        (leadData.google_maps_url || '').split('?')[0] // remove query params
    ].join('|||');
    return crypto.createHash('md5').update(raw).digest('hex');
}

/**
 * Verifica se um lead duplicado está bloqueado para reabordagem.
 */
function isBlockedForReapproach(existingLead) {
    if (!existingLead.bloqueio_reabordagem_ate) return false;
    const bloqueioDate = new Date(existingLead.bloqueio_reabordagem_ate);
    return bloqueioDate > new Date();
}

/**
 * Salva lead com deduplicação robusta via hash composto.
 */
function saveLead(leadData) {
    const leads = loadLeads();
    const history = loadHistory();

    // Gera hash de deduplicação
    const dedup_hash = generateDeduplicationHash(leadData);
    leadData.dedup_hash = dedup_hash;

    // Verificar duplicação no HISTÓRICO GLOBAL via hash
    const duplicateInHistory = history.find(l =>
        l.dedup_hash === dedup_hash ||
        (l.name === leadData.name) ||
        (leadData.phone && l.phone === leadData.phone) ||
        (leadData.google_maps_url && l.google_maps_url === leadData.google_maps_url)
    );

    if (duplicateInHistory) {
        leadData.duplicado_de = duplicateInHistory.lead_id_estavel;

        // Se está bloqueado para reabordagem, marca e pula
        if (isBlockedForReapproach(duplicateInHistory)) {
            leadData.bloqueio_ativo = true;
            leadData.bloqueio_reabordagem_ate = duplicateInHistory.bloqueio_reabordagem_ate;
        }
    }

    // Apenas insere na pipeline ativa se não for duplicata da sessão atual
    const isDuplicateInSession = leads.some(l =>
        l.dedup_hash === dedup_hash ||
        l.name === leadData.name ||
        (leadData.phone && l.phone === leadData.phone)
    );

    if (!isDuplicateInSession) {
        leads.push(leadData);
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
    }

    // Sempre arquiva no snapshot global
    history.push(leadData);
    fs.writeFileSync(HIST_FILE, JSON.stringify(history, null, 2), 'utf8');

    return !isDuplicateInSession;
}

function clearLeadsFile() {
    fs.writeFileSync(LEADS_FILE, JSON.stringify([]), 'utf8');
}

/**
 * Atualiza status do pipeline e aplica bloqueio de reabordagem quando "Contatado".
 */
function updatePipelineStatus(leadId, newStatus) {
    const leads = loadLeads();
    const history = loadHistory();

    const applyUpdate = (arr) => {
        const idx = arr.findIndex(l => l.lead_id_estavel === leadId);
        if (idx !== -1) {
            arr[idx].status_pipeline = newStatus;
            arr[idx].ultima_acao = new Date().toISOString();

            // Quando muda para "Contatado", registra data e aplica bloqueio
            if (newStatus.toLowerCase().includes('contatado') || newStatus.toLowerCase().includes('enviado')) {
                arr[idx].data_ultimo_envio = new Date().toISOString();
                arr[idx].status_contato = newStatus;
                const lockDate = new Date();
                lockDate.setDate(lockDate.getDate() + REABORDAGEM_LOCK_DAYS);
                arr[idx].bloqueio_reabordagem_ate = lockDate.toISOString();
            }
        }
    };

    applyUpdate(leads);
    applyUpdate(history);

    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
    fs.writeFileSync(HIST_FILE, JSON.stringify(history, null, 2), 'utf8');
}

// === Runs Log ===
function loadRuns() {
    try {
        return JSON.parse(fs.readFileSync(RUNS_LOG_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveRunLog(runObj) {
    const runs = loadRuns();
    const idx = runs.findIndex(r => r.run_id === runObj.run_id);
    if (idx !== -1) {
        runs[idx] = { ...runs[idx], ...runObj };
    } else {
        runs.push(runObj);
    }
    fs.writeFileSync(RUNS_LOG_FILE, JSON.stringify(runs, null, 2), 'utf8');
}

// === Events Log ===
function loadEventsLog() {
    try {
        return JSON.parse(fs.readFileSync(EVENTS_LOG_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveEventLog(type, msg) {
    const events = loadEventsLog();
    events.unshift({ timestamp: new Date().toISOString(), type, message: msg });
    if (events.length > 50) events.length = 50;
    fs.writeFileSync(EVENTS_LOG_FILE, JSON.stringify(events, null, 2), 'utf8');
}

// === Settings ===
function loadSettings() {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    } catch (e) {
        return { webhookUrl: '' };
    }
}

function saveSettings(settingsObj) {
    const current = loadSettings();
    const updated = { ...current, ...settingsObj };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');
}

module.exports = {
    saveLead, loadLeads, loadHistory, clearLeadsFile,
    saveRunLog, loadRuns,
    saveEventLog, loadEventsLog,
    loadSettings, saveSettings,
    updatePipelineStatus,
    generateDeduplicationHash,
    isBlockedForReapproach
};
