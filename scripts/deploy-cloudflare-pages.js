/**
 * Deploy Cloudflare Pages via Wrangler CLI.
 * 
 * Usa CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID do ambiente.
 * Nunca imprime tokens.
 */

const { execSync } = require('child_process');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const projectName = process.env.CLOUDFLARE_PROJECT_NAME || 'extrator-leads-google';
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const apiToken = process.env.CLOUDFLARE_API_TOKEN || '';

if (!apiToken) {
    console.error('❌ CLOUDFLARE_API_TOKEN não encontrado no .env');
    process.exit(1);
}

// 1. Preparar UI
console.log('\n📦 Preparando UI para Cloudflare...');
execSync('node scripts/prepare-cloudflare-pwa.js', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });

// 2. Deploy via Wrangler
console.log(`\n🚀 Deploy para Cloudflare Pages: ${projectName}`);

const env = {
    ...process.env,
    CLOUDFLARE_API_TOKEN: apiToken,
};

if (accountId) {
    env.CLOUDFLARE_ACCOUNT_ID = accountId;
}

try {
    execSync(
        `npx wrangler pages deploy cloudflare/public --project-name=${projectName}`,
        {
            cwd: path.resolve(__dirname, '..'),
            stdio: 'inherit',
            env,
        }
    );
    console.log('\n✅ Deploy concluído com sucesso!');
} catch (err) {
    console.error('\n❌ Deploy falhou:', err.message);
    process.exit(1);
}
