const fs = require('fs');
const path = require('path');
const { getDesktopExportDir } = require('./path-helper.js');

/**
 * Gera CSV com schema reforçado.
 * @param {Array} leads - Array de leads
 * @param {string} niche - Nicho pesquisado
 * @param {string} city - Cidade pesquisada
 * @param {string} mode - 'interno' (completo) ou 'externo' (sem score/SDR/mensagens)
 * @param {string} loteId - ID do lote de captação (opcional)
 * @returns {string|null} - Caminho do arquivo gerado
 */
async function generateCSV(leads, niche, city, mode = 'interno', loteId = '') {
    if (!leads || leads.length === 0) return null;

    const isExternal = mode === 'externo';

    // Headers internos (completo)
    const headersInterno = [
        'LeadID', 'LoteID', 'DataCaptura', 'Operador',
        'Score', 'Prioridade', 'Rating', 'Reviews',
        'Empresa', 'CategoriaMaps', 'Endereco', 'Telefone', 'Email',
        'Site', 'WebsiteStatus', 'Instagram', 'InstagramStatus',
        'Facebook', 'WhatsApp', 'Pesquisa', 'MapsURL',
        'OutrosLinks', 'RatingStatus',
        'UltimoPostGMB', 'StatusPipeline', 'StatusContato', 'DataUltimoEnvio',
        'ConcorrentesIniciais', 'ObservacaoValidacao',
        'ArgumentoComercial', 'MensagemWhatsApp',
        'Repescado', 'QualidadeEnriquecimento'
    ];

    // Headers externos (sem informação sensível de prospecção)
    const headersExterno = [
        'LeadID', 'LoteID', 'DataCaptura',
        'Rating', 'Reviews',
        'Empresa', 'CategoriaMaps', 'Endereco', 'Telefone', 'Email',
        'Site', 'WebsiteStatus', 'Instagram', 'InstagramStatus',
        'Facebook', 'WhatsApp', 'MapsURL',
        'OutrosLinks', 'RatingStatus',
        'UltimoPostGMB', 'ConcorrentesIniciais',
        'QualidadeEnriquecimento'
    ];

    const headers = isExternal ? headersExterno : headersInterno;
    let csv = headers.join(',') + '\n';

    leads.forEach(l => {
        const safe = (val) => {
            if (val === null || val === undefined) return '';
            return String(val).replace(/"/g, '""');
        };

        // Nível de confiança por campo
        const websiteStatus = l.website ? 'confirmed' : 'not_found';
        const instagramStatus = l.instagram
            ? (l.instagram_source === 'maps' ? 'confirmed' : 'suspected')
            : 'not_found';
        const ratingStatus = (l.rating !== null && l.rating !== undefined && l.rating > 0)
            ? 'confirmed' : 'not_found';

        if (isExternal) {
            csv += [
                safe(l.lead_id_estavel || ''),
                safe(loteId || l.lote_id || ''),
                safe(l.data_captacao || ''),
                l.rating || 0,
                l.reviews || 0,
                `"${safe(l.name)}"`,
                `"${safe(l.categoria_maps || '')}"`,
                `"${safe(l.address)}"`,
                `"${safe(l.phone)}"`,
                `"${safe(l.email || '')}"`,
                `"${safe(l.website)}"`,
                websiteStatus,
                `"${safe(l.instagram)}"`,
                instagramStatus,
                `"${safe(l.facebook)}"`,
                `"${safe(l.whatsapp_url)}"`,
                `"${safe(l.google_maps_url)}"`,
                `"${safe((l.other_public_links || []).join(';'))}"`,
                ratingStatus,
                `"${safe(l.last_post)}"`,
                `"${safe(l.concorrentes_referencia || '')}"`,
                `"${safe(l.enrichment_quality || 'Básico')}"`
            ].join(',') + '\n';
        } else {
            csv += [
                safe(l.lead_id_estavel || ''),
                safe(loteId || l.lote_id || ''),
                safe(l.data_captacao || ''),
                `"${safe(l.responsavel || '')}"`,
                l.score || 0,
                safe(l.prioridade_comercial || l.priority || ''),
                l.rating || 0,
                l.reviews || 0,
                `"${safe(l.name)}"`,
                `"${safe(l.categoria_maps || '')}"`,
                `"${safe(l.address)}"`,
                `"${safe(l.phone)}"`,
                `"${safe(l.email || '')}"`,
                `"${safe(l.website)}"`,
                websiteStatus,
                `"${safe(l.instagram)}"`,
                instagramStatus,
                `"${safe(l.facebook)}"`,
                `"${safe(l.whatsapp_url)}"`,
                `"${safe(l.source_search_url)}"`,
                `"${safe(l.google_maps_url)}"`,
                `"${safe((l.other_public_links || []).join(';'))}"`,
                ratingStatus,
                `"${safe(l.last_post)}"`,
                `"${safe(l.status_pipeline || 'Novo')}"`,
                `"${safe(l.status_contato || '')}"`,
                `"${safe(l.data_ultimo_envio || '')}"`,
                `"${safe(l.concorrentes_referencia || '')}"`,
                `"${safe(l.observacao_validacao || '')}"`,
                `"${safe(l.argumento_comercial || '')}"`,
                `"${safe(l.mensagem_whatsapp || l.draft_message || '')}"`,
                safe(l.duplicado_de ? 'SIM' : 'NAO'),
                `"${safe(l.enrichment_quality || 'Básico')}"`
            ].join(',') + '\n';
        }
    });

    const modeLabel = isExternal ? 'externo' : 'interno';
    const safeName = `Extracao_${modeLabel}_${niche}_${city}_${Date.now()}`.replace(/[^a-z0-9_]/gi, '_').toLowerCase() + '.csv';
    const filePath = path.join(getDesktopExportDir(), safeName);

    fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8'); // BOM para Excel reconhecer UTF-8
    return filePath;
}

module.exports = { generateCSV };
