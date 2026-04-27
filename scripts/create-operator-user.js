/**
 * Cria user técnico no Supabase Auth via Management API SQL.
 */
const path = require('path');
const https = require('https');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';
const userId = process.env.SUPABASE_DEFAULT_USER_ID || '';

const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!refMatch) { console.error('❌ Ref não encontrado'); process.exit(1); }
const projectRef = refMatch[1];

const sql = `
INSERT INTO auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmation_token,
  raw_app_meta_data, raw_user_meta_data
) VALUES (
  '${userId}',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'operator@leadking.local',
  crypt('operator-tech-' || gen_random_uuid()::text, gen_salt('bf')),
  now(), now(), now(), '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"role":"operator"}'::jsonb
) ON CONFLICT (id) DO NOTHING;
`;

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

console.log('🔐 Criando user técnico no auth.users...');
const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ User criado com sucesso (${res.statusCode})`);
        } else {
            console.error(`❌ Falhou (${res.statusCode}):`, data.substring(0, 300));
        }
    });
});
req.on('error', (e) => console.error('❌ Erro:', e.message));
req.on('timeout', () => { req.destroy(); console.error('❌ Timeout'); });
req.write(postData);
req.end();
