const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

const HIST_FILE = path.join(DATA_DIR, 'history_snapshots.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, JSON.stringify([]), 'utf8');
}
if (!fs.existsSync(HIST_FILE)) {
    fs.writeFileSync(HIST_FILE, JSON.stringify([]), 'utf8');
}

function loadLeads() {
    try {
        const data = fs.readFileSync(LEADS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function loadHistory() {
    try {
        return JSON.parse(fs.readFileSync(HIST_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
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

module.exports = { saveLead, loadLeads, loadHistory, clearLeadsFile };
