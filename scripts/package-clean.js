/**
 * Script de empacotamento limpo para distribuição.
 * Gera pasta dist_clean/ contendo apenas os arquivos necessários para rodar.
 * 
 * Exclui: .env, .git, data/*.json, node_modules, backups, *.corrupted_*
 * Inclui: código, UI, .env.example, READMEs, package.json
 * 
 * Uso: npm run package:clean
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist_clean');

// Arquivos e pastas a EXCLUIR
const EXCLUDE = [
    '.env',
    '.git',
    'node_modules',
    'data',
    'dist_clean',
    'tmp_test',
    '.gemini',
    '.testsprite',
];

const EXCLUDE_PATTERNS = [
    /\.corrupted_/,
    /history_backup_/,
    /_legacy_backup/,
    /^KEYS/i,
];

function shouldExclude(name) {
    if (EXCLUDE.includes(name)) return true;
    return EXCLUDE_PATTERNS.some(p => p.test(name));
}

function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        const baseName = path.basename(src);
        if (shouldExclude(baseName)) return;

        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

        const entries = fs.readdirSync(src);
        entries.forEach(entry => {
            if (shouldExclude(entry)) return;
            copyRecursive(path.join(src, entry), path.join(dest, entry));
        });
    } else {
        const baseName = path.basename(src);
        if (shouldExclude(baseName)) return;
        fs.copyFileSync(src, dest);
    }
}

// === MAIN ===
console.log("🔧 Limpando dist_clean/ anterior...");
if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
}

console.log("📦 Copiando arquivos para dist_clean/...");
copyRecursive(ROOT, DIST);

// Criar pasta data/ vazia com bootstrap
const dataDir = path.join(DIST, 'data');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'leads.json'), '[]', 'utf8');
fs.writeFileSync(path.join(dataDir, 'history_snapshots.json'), '[]', 'utf8');
fs.writeFileSync(path.join(dataDir, 'runs_log.json'), '[]', 'utf8');
fs.writeFileSync(path.join(dataDir, 'events_log.json'), '[]', 'utf8');
fs.writeFileSync(path.join(dataDir, 'settings.json'), '{"webhookUrl":""}', 'utf8');

console.log("\n✅ Pacote limpo gerado em: dist_clean/");

// Listar conteúdo
function listFiles(dir, prefix = '') {
    const entries = fs.readdirSync(dir);
    entries.forEach(e => {
        const full = path.join(dir, e);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            console.log(`  ${prefix}📁 ${e}/`);
            listFiles(full, prefix + '  ');
        } else {
            const size = (stat.size / 1024).toFixed(1);
            console.log(`  ${prefix}📄 ${e} (${size} KB)`);
        }
    });
}
listFiles(DIST);

// === CHECKLIST DE SEGURANÇA ===
console.log("\n🔒 Checklist de Segurança:");
const checks = [
    { name: '.env ausente', ok: !fs.existsSync(path.join(DIST, '.env')) },
    { name: '.git ausente', ok: !fs.existsSync(path.join(DIST, '.git')) },
    { name: 'data/leads.json vazio', ok: fs.readFileSync(path.join(DIST, 'data', 'leads.json'), 'utf8') === '[]' },
    { name: '.env.example presente', ok: fs.existsSync(path.join(DIST, '.env.example')) },
    { name: 'package.json presente', ok: fs.existsSync(path.join(DIST, 'package.json')) },
];

let allOk = true;
checks.forEach(c => {
    console.log(`  ${c.ok ? '✅' : '❌'} ${c.name}`);
    if (!c.ok) allOk = false;
});

if (!allOk) {
    console.error("\n❌ FALHA: Pacote contém itens proibidos!");
    process.exit(1);
} else {
    console.log("\n✅ Pacote limpo e seguro para distribuição.");
    process.exit(0);
}
