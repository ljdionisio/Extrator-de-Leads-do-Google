/**
 * Aplica schema.sql ao Supabase via Management API.
 * Usa SUPABASE_ACCESS_TOKEN e project ref extraído da URL.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';

if (!supabaseUrl || !accessToken) {
    console.error('❌ SUPABASE_URL ou SUPABASE_ACCESS_TOKEN ausente.');
    process.exit(1);
}

// Extrair project ref da URL
const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!refMatch) {
    console.error('❌ Não foi possível extrair project ref da URL.');
    process.exit(1);
}
const projectRef = refMatch[1];
console.log(`📦 Project ref: ${projectRef}`);

// Ler schema
const schemaPath = path.resolve(__dirname, '..', 'supabase', 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');
console.log(`📄 Schema: ${sql.length} chars`);

// Enviar via Management API
const postData = JSON.stringify({ query: sql });

const options = {
    hostname: 'api.supabase.com',
    port: 443,
    path: `/v1/projects/${projectRef}/database/query`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Length': Buffer.byteLength(postData),
    },
    timeout: 30000,
};

console.log(`🚀 Aplicando schema...`);

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ Schema aplicado com sucesso (${res.statusCode})`);
        } else {
            console.error(`❌ Falhou (${res.statusCode}):`, data.substring(0, 500));
        }
    });
});

req.on('error', (e) => console.error('❌ Erro:', e.message));
req.on('timeout', () => { req.destroy(); console.error('❌ Timeout'); });
req.write(postData);
req.end();
