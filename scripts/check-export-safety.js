/**
 * Security Check — Verifica padrões perigosos em arquivos versionáveis.
 * Não lê nem imprime o conteúdo de .env.
 */
const fs = require('fs');
const path = require('path');

const PATTERNS = [
    { name: 'secret_key_prefix', regex: /sk[-_][a-zA-Z0-9]{10,}/g },
    { name: 'token_assignment', regex: /token\s*=\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi },
    { name: 'secret_assignment', regex: /secret\s*=\s*['"][a-zA-Z0-9_\-]{10,}['"]/gi },
    { name: 'password_assignment', regex: /password\s*=\s*['"][^'"]{5,}['"]/gi },
    { name: 'bearer_token', regex: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/g },
    { name: 'supabase_service_role_value', regex: /eyJ[a-zA-Z0-9_\-]{50,}/g },
    { name: 'cloudflare_token_value', regex: /cfut_[a-zA-Z0-9]{30,}/g },
    { name: 'github_pat_value', regex: /ghp_[a-zA-Z0-9]{30,}/g },
    { name: 'access_code_hardcoded', regex: /PWA_OPERATOR_ACCESS_CODE\s*[:=]\s*['"][a-zA-Z0-9]{10,}['"]/g },
];

const IGNORE_DIRS = ['node_modules', '.git', 'data', 'dist_clean', '.gemini'];
const IGNORE_FILES = ['.env', '.env.local', '.env.production', '.env.example'];
const IGNORE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.zip', '.pdf'];

// Files that legitimately reference patterns (config, not values)
const ALLOWLIST_FILES = [
    'check-export-safety.js',    // this file
    'deploy-cloudflare-pages.js', // reads from env, doesn't hardcode
    'apply-schema.js',
    'create-operator-user.js',
    'find-operator-user.js',
    '.env.example',
];

function shouldIgnore(filePath) {
    const basename = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (IGNORE_FILES.includes(basename)) return true;
    if (IGNORE_EXTENSIONS.includes(ext)) return true;
    if (ALLOWLIST_FILES.includes(basename)) return true;
    return false;
}

function scanDir(dirPath) {
    const findings = [];
    let entries;
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch { return findings; }

    for (const entry of entries) {
        if (IGNORE_DIRS.includes(entry.name)) continue;
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            findings.push(...scanDir(fullPath));
        } else if (entry.isFile()) {
            if (shouldIgnore(fullPath)) continue;
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                for (const pattern of PATTERNS) {
                    const matches = content.match(pattern.regex);
                    if (matches) {
                        findings.push({
                            file: path.relative(process.cwd(), fullPath),
                            pattern: pattern.name,
                            count: matches.length,
                        });
                    }
                }
            } catch { /* skip binary or unreadable */ }
        }
    }
    return findings;
}

console.log('🔒 Security Check — Auditoria de segredos em arquivos versionáveis\n');

const findings = scanDir(process.cwd());

if (findings.length === 0) {
    console.log('✅ OK — Nenhum padrão perigoso encontrado em arquivos versionáveis.\n');
    process.exit(0);
} else {
    console.log(`❌ FAIL — ${findings.length} padrão(ões) perigoso(s) encontrado(s):\n`);
    for (const f of findings) {
        console.log(`  ⚠️  ${f.file} → ${f.pattern} (${f.count}x)`);
    }
    console.log('\n  Verifique os arquivos acima e remova segredos hardcoded.\n');
    process.exit(1);
}
