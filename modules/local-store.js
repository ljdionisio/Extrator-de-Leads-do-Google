const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, JSON.stringify([]), 'utf8');
}

function loadLeads() {
    try {
        const data = fs.readFileSync(LEADS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveLead(leadData) {
    const leads = loadLeads();

    // Check duplicates by phone or exact name or website
    const isDuplicate = leads.some(l =>
        (l.name === leadData.name) ||
        (leadData.phone && l.phone === leadData.phone) ||
        (leadData.website && l.website === leadData.website)
    );

    if (!isDuplicate) {
        leads.push(leadData);
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
        return true;
    }
    return false; // Duplicado
}

module.exports = { saveLead, loadLeads };
