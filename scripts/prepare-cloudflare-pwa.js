/**
 * Prepara UI para deploy no Cloudflare Pages.
 * Copia ui-local/ para cloudflare/public/ com ajustes para modo cloud.
 * 
 * Não copia: .env, data/, reports/, exports/, node_modules/, .git/
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'ui-local');
const DEST = path.join(ROOT, 'cloudflare', 'public');

// Limpar destino
if (fs.existsSync(DEST)) {
    fs.rmSync(DEST, { recursive: true, force: true });
}
fs.mkdirSync(DEST, { recursive: true });

// Arquivos para copiar
const filesToCopy = [
    'index.html',
    'script.js',
    'style.css',
    'manifest.webmanifest',
    'sw.js',
];

let copied = 0;

for (const file of filesToCopy) {
    const src = path.join(SOURCE, file);
    if (fs.existsSync(src)) {
        let content = fs.readFileSync(src, 'utf8');

        // Injetar runtime marker no HTML
        if (file === 'index.html') {
            content = content.replace(
                '<head>',
                '<head>\n    <script>window.DP_RUNTIME="cloudflare";</script>'
            );
        }

        fs.writeFileSync(path.join(DEST, file), content, 'utf8');
        copied++;
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ⚠️ ${file} não encontrado, ignorando.`);
    }
}

// Copiar diretório icons/ se existir
const iconsDir = path.join(SOURCE, 'icons');
if (fs.existsSync(iconsDir)) {
    const destIcons = path.join(DEST, 'icons');
    fs.mkdirSync(destIcons, { recursive: true });
    const icons = fs.readdirSync(iconsDir);
    for (const icon of icons) {
        fs.copyFileSync(path.join(iconsDir, icon), path.join(destIcons, icon));
        copied++;
    }
    console.log(`  ✅ icons/ (${icons.length} arquivos)`);
}

console.log(`\n✅ Preparação concluída: ${copied} arquivos copiados para cloudflare/public/`);
