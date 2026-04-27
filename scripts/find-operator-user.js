/**
 * Busca o ID do user operator no auth.users via Management API.
 */
const path = require('path');
const https = require('https');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';
const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!refMatch) { console.error('❌ Ref não encontrado'); process.exit(1); }
const projectRef = refMatch[1];

const sql = `SELECT id, email FROM auth.users WHERE email = 'operator@leadking.local' LIMIT 1;`;
const postData = JSON.stringify({ query: sql });
const options = {
    hostname: 'api.supabase.com', port: 443,
    path: `/v1/projects/${projectRef}/database/query`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Length': Buffer.byteLength(postData),
    },
    timeout: 30000,
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(data);
    });
});
req.on('error', (e) => console.error('❌', e.message));
req.write(postData);
req.end();
