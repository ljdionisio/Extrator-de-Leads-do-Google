const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

const HIST_FILE = path.join(DATA_DIR, 'history_snapshots.json');
const RUNS_LOG_FILE = path.join(DATA_DIR, 'runs_log.json');
const EVENTS_LOG_FILE = path.join(DATA_DIR, 'events_log.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, JSON.stringify([]), 'utf8');
}
if (!fs.existsSync(HIST_FILE)) {
    fs.writeFileSync(HIST_FILE, JSON.stringify([]), 'utf8');
}
if (!fs.existsSync(RUNS_LOG_FILE)) {
    fs.writeFileSync(RUNS_LOG_FILE, JSON.stringify([]), 'utf8');
}
if (!fs.existsSync(EVENTS_LOG_FILE)) {
    fs.writeFileSync(EVENTS_LOG_FILE, JSON.stringify([]), 'utf8');
}
if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ webhookUrl: '' }), 'utf8');
}
function initBackup() {
    try {
        if (!fs.existsSync(HIST_FILE)) return;

        // Rotação de 1 a 5
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

function safeLoadJson(filePath, emptyFallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`[Data Integrity] Erro ao ler ${path.basename(filePath)}. Tentando recuperar...`);
        // Copia o arquivo corrompido para não varrer se for um typo manual
        try {
            if (fs.existsSync(filePath)) {
                fs.copyFileSync(filePath, filePath + `.corrupted_${Date.now()}`);
            }
        } catch (ex) { }

        // Se for o arquivo de história, tenta ler o backup primário
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

function loadLeads() {
    return safeLoadJson(LEADS_FILE, []);
}

function loadHistory() {
    return safeLoadJson(HIST_FILE, []);
}

function saveLead(leadData) {
    const leads = loadLeads();
    const history = loadHistory();

    // Verificar duplicação firme no HISTÓRICO GLOBAL
    const duplicateInHistory = history.find(l =>
        (l.name === leadData.name) ||
        (leadData.phone && l.phone === leadData.phone) ||
        (leadData.website && l.website === leadData.website) ||
        (leadData.google_maps_url && l.google_maps_url === leadData.google_maps_url)
    );

    if (duplicateInHistory) {
        leadData.duplicado_de = duplicateInHistory.lead_id_estavel;
    }

    // Apenas insere na pipeline ativa se não estiver duplicando a sessão atual
    const isDuplicateInSession = leads.some(l => l.name === leadData.name || (leadData.phone && l.phone === leadData.phone));

    if (!isDuplicateInSession) {
        leads.push(leadData);
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
    }

    // Sempre arquiva no snapshot global
    history.push(leadData);
    fs.writeFileSync(HIST_FILE, JSON.stringify(history, null, 2), 'utf8');

    return !isDuplicateInSession; // Se inseriu na sessão atual retorna true (não foi duplicado cruzado visivel)
}

function clearLeadsFile() {
    // Apenas limpa a pipeline (sessão ativa), não destrói os snapshots.
    fs.writeFileSync(LEADS_FILE, JSON.stringify([]), 'utf8');
}

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
    if (events.length > 50) events.length = 50; // Limitar painel a 50 logs recentes
    fs.writeFileSync(EVENTS_LOG_FILE, JSON.stringify(events, null, 2), 'utf8');
}

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

module.exports = { saveLead, loadLeads, loadHistory, clearLeadsFile, saveRunLog, loadRuns, saveEventLog, loadEventsLog, loadSettings, saveSettings };
