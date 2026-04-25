/**
 * Deploy Cloudflare Pages — totalmente automatizado.
 * 
 * 1. Carrega .env com segurança
 * 2. Valida variáveis obrigatórias sem imprimir valores
 * 3. Gera PWA_OPERATOR_ACCESS_CODE se ausente
 * 4. Prepara UI
 * 5. Configura secrets no Cloudflare via wrangler pages secret bulk
 * 6. Faz deploy via wrangler pages deploy
 * 7. Valida endpoints pós-deploy
 * 
 * NUNCA imprime secrets.
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const os = require('os');

// 1. Carregar .env
require('dotenv').config({ path: ENV_PATH });

// 2. Validar variáveis
const required = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'SUPABASE_URL'];
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const missing = required.filter(k => !process.env[k]);

if (missing.length > 0) {
    console.error(`❌ Variáveis ausentes no .env: ${missing.join(', ')}`);
    process.exit(1);
}
if (!serviceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEY ausente no .env');
    process.exit(1);
}

console.log('✅ Variáveis obrigatórias presentes (valores não impressos).');

// 3. Gerar PWA_OPERATOR_ACCESS_CODE se ausente
let accessCode = process.env.PWA_OPERATOR_ACCESS_CODE || '';
if (!accessCode) {
    accessCode = crypto.randomBytes(24).toString('base64url');
    // Salvar no .env local sem imprimir
    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    if (envContent.includes('PWA_OPERATOR_ACCESS_CODE=')) {
        const updated = envContent.replace(/PWA_OPERATOR_ACCESS_CODE=.*/, `PWA_OPERATOR_ACCESS_CODE=${accessCode}`);
        fs.writeFileSync(ENV_PATH, updated, 'utf8');
    } else {
        fs.appendFileSync(ENV_PATH, `\nPWA_OPERATOR_ACCESS_CODE=${accessCode}\n`, 'utf8');
    }
    console.log('🔐 PWA_OPERATOR_ACCESS_CODE gerado e salvo no .env (valor não impresso).');
} else {
    console.log('🔐 PWA_OPERATOR_ACCESS_CODE já existe (valor não impresso).');
}

const projectName = process.env.CLOUDFLARE_PROJECT_NAME || 'extrator-leads-google';
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const userId = process.env.SUPABASE_DEFAULT_USER_ID || '';

// 4. Preparar UI
console.log('\n📦 Preparando UI para Cloudflare...');
execSync('node scripts/prepare-cloudflare-pwa.js', { cwd: ROOT, stdio: 'inherit' });

// 5. Configurar secrets via arquivo temporário seguro
console.log('\n🔒 Configurando secrets no Cloudflare Pages...');

const secrets = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    PWA_OPERATOR_ACCESS_CODE: accessCode,
};
if (userId) secrets.SUPABASE_DEFAULT_USER_ID = userId;

const tmpFile = path.join(os.tmpdir(), `cf-secrets-${Date.now()}.json`);
let secretsConfigured = false;

try {
    // Tentar wrangler pages secret bulk
    fs.writeFileSync(tmpFile, JSON.stringify(secrets), 'utf8');

    const bulkResult = spawnSync(
        'npx', ['wrangler', 'pages', 'secret', 'bulk', tmpFile, '--project-name', projectName],
        {
            cwd: ROOT,
            stdio: 'pipe',
            env: { ...process.env, CLOUDFLARE_API_TOKEN: apiToken, CLOUDFLARE_ACCOUNT_ID: accountId },
            shell: true,
            timeout: 60000,
        }
    );

    if (bulkResult.status === 0) {
        secretsConfigured = true;
        console.log(`✅ ${Object.keys(secrets).length} secrets configurados via bulk.`);
    } else {
        const errMsg = (bulkResult.stderr || '').toString().substring(0, 200);
        console.warn(`⚠️ Bulk falhou: ${errMsg}`);
        console.log('Tentando put individual...');

        // Fallback: put individual via stdin
        let putSuccess = 0;
        for (const [key, value] of Object.entries(secrets)) {
            const putResult = spawnSync(
                'npx', ['wrangler', 'pages', 'secret', 'put', key, '--project-name', projectName],
                {
                    cwd: ROOT,
                    input: value,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: { ...process.env, CLOUDFLARE_API_TOKEN: apiToken, CLOUDFLARE_ACCOUNT_ID: accountId },
                    shell: true,
                    timeout: 30000,
                }
            );
            if (putResult.status === 0) {
                putSuccess++;
            } else {
                console.warn(`  ⚠️ Falhou: ${key}`);
            }
        }
        if (putSuccess === Object.keys(secrets).length) {
            secretsConfigured = true;
            console.log(`✅ ${putSuccess} secrets configurados via put individual.`);
        } else {
            console.warn(`⚠️ ${putSuccess}/${Object.keys(secrets).length} secrets configurados.`);
        }
    }
} catch (err) {
    console.warn('⚠️ Erro ao configurar secrets:', err.message);
} finally {
    // Apagar arquivo temporário
    try { fs.unlinkSync(tmpFile); } catch (e) { /* ok */ }
}

// 6. Deploy
console.log(`\n🚀 Deploy para Cloudflare Pages: ${projectName}`);

let deployUrl = '';
try {
    const deployOut = execSync(
        `npx wrangler pages deploy cloudflare/public --project-name=${projectName}`,
        {
            cwd: ROOT,
            env: { ...process.env, CLOUDFLARE_API_TOKEN: apiToken, CLOUDFLARE_ACCOUNT_ID: accountId },
            encoding: 'utf8',
            timeout: 120000,
        }
    );

    console.log(deployOut);

    // Capturar URL
    const urlMatch = deployOut.match(/https:\/\/[^\s]+\.pages\.dev/);
    if (urlMatch) deployUrl = urlMatch[0];
    else {
        // Tentar padrão do project
        deployUrl = `https://${projectName}.pages.dev`;
    }

    console.log(`\n✅ Deploy concluído: ${deployUrl}`);
} catch (err) {
    console.error('❌ Deploy falhou:', err.message?.substring(0, 300));
    process.exit(1);
}

// 7. Validação pós-deploy
console.log('\n🔍 Validando endpoints pós-deploy...');

async function validate() {
    const results = [];
    const wait = ms => new Promise(r => setTimeout(r, ms));

    // Esperar propagação
    console.log('⏳ Aguardando propagação (15s)...');
    await wait(15000);

    // Helper
    async function check(label, method, path, body, headers, expectStatus) {
        const url = deployUrl + path;
        const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
        if (body) opts.body = JSON.stringify(body);

        try {
            const res = await fetch(url, opts);
            const data = await res.json().catch(() => ({}));
            const ok = expectStatus ? res.status === expectStatus : res.ok;
            results.push({ label, status: res.status, ok, data: JSON.stringify(data).substring(0, 100) });
            console.log(`  ${ok ? '✅' : '❌'} ${label}: ${res.status}`);
            return { ok, data, status: res.status };
        } catch (err) {
            results.push({ label, status: 0, ok: false, error: err.message });
            console.log(`  ❌ ${label}: ${err.message}`);
            return { ok: false, error: err.message };
        }
    }

    const authHeaders = { 'x-operator-access-code': accessCode };

    // Validações
    await check('GET /', 'GET', '/', null, {});
    await check('GET /api/health', 'GET', '/api/health', null, {});
    await check('GET /api/supabase-status', 'GET', '/api/supabase-status', null, authHeaders);
    await check('POST /api/search-jobs sem auth → 401', 'POST', '/api/search-jobs', { queryName: 'Test' }, {}, 401);

    const searchResult = await check(
        'POST /api/search-jobs com auth',
        'POST', '/api/search-jobs',
        { queryName: 'Teste Deploy', city: 'São Paulo' },
        authHeaders, 201
    );

    if (searchResult.ok && searchResult.data?.jobId) {
        await check('GET /api/search-jobs', 'GET', '/api/search-jobs', null, authHeaders);
    }

    const diagResult = await check(
        'POST /api/jobs com auth',
        'POST', '/api/jobs',
        { leadSnapshot: { name: 'Teste Deploy', city: 'SP' } },
        authHeaders, 201
    );

    if (diagResult.ok && diagResult.data?.jobId) {
        await check('GET /api/jobs', 'GET', '/api/jobs', null, authHeaders);
    }

    // Resumo
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;

    console.log(`\n═══════════════════════════════════`);
    console.log(`📊 Validação: ${passed} ok, ${failed} fail`);
    console.log(`🌐 URL: ${deployUrl}`);
    console.log(`🔒 Secrets: ${secretsConfigured ? '✅ configurados' : '⚠️ parcial'}`);
    console.log(`═══════════════════════════════════`);
}

validate().catch(err => console.error('Erro na validação:', err.message));
