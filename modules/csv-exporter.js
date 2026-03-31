const fs = require('fs');
const path = require('path');
const { getDesktopExportDir } = require('./path-helper.js');

async function generateCSV(leads, niche, city) {
    if (!leads || leads.length === 0) return null;

    let csv = 'Score,Prioridade,Rating,Reviews,Empresa,Endereco,Telefone,Site,Instagram,Facebook,WhatsApp,Pesquisa,MapsURL,OutrosLinks,StatusPipeline,ArgumentoComercial,UltimoPostGMB\n';

    leads.forEach(l => {
        let lName = l.name ? l.name.replace(/"/g, '""') : '';
        let lAddr = l.address ? l.address.replace(/"/g, '""') : '';
        let arg = l.argumento_comercial ? l.argumento_comercial.replace(/"/g, '""') : '';
        csv += (l.score || 0) + ',' +
            (l.prioridade_comercial || l.priority || '') + ',' +
            (l.rating || 0) + ',' +
            (l.reviews || 0) + ',"' +
            lName + '","' +
            lAddr + '","' +
            (l.phone || '') + '","' +
            (l.website || '') + '","' +
            (l.instagram || '') + '","' +
            (l.facebook || '') + '","' +
            (l.whatsapp_url || '') + '","' +
            (l.source_search_url || '') + '","' +
            (l.google_maps_url || '') + '","' +
            ((l.other_public_links || []).join(';')) + '","' +
            (l.status_pipeline || 'Novo') + '","' +
            arg + '","' +
            (l.last_post || '') + '"\n';
    });

    const safeName = `Extracao_${niche}_${city}_${Date.now()}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase() + '.csv';
    const filePath = path.join(getDesktopExportDir(), safeName);

    fs.writeFileSync(filePath, csv, 'utf8');
    return filePath;
}

module.exports = { generateCSV };
