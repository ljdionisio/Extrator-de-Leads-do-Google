const os = require('os');
const path = require('path');
const fs = require('fs');

function getDesktopExportDir() {
    const desktopPath = path.join(os.homedir(), 'Desktop', 'CRM Extrator Leads');
    if (!fs.existsSync(desktopPath)) {
        fs.mkdirSync(desktopPath, { recursive: true });
    }
    return desktopPath;
}

module.exports = { getDesktopExportDir };
