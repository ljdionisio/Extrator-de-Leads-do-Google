/**
 * Gera log de evidências executável que acompanha o pacote de distribuição.
 * Roda TODOS os testes disponíveis, registra saídas e exit codes, 
 * e salva um relatório de evidência em EVIDENCIA_HOMOLOGACAO.md
 * 
 * Uso: node scripts/generate-evidence.js
 * 
 * O auditor pode rodar este script no ambiente dele para reproduzir a prova.
 * Pré-requisito: npx playwright install chromium
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, label) {
    console.log(`\n>> ${label}...`);
    try {
        const output = execSync(cmd, {
            cwd: path.resolve(__dirname, '..'),
            encoding: 'utf8',
            timeout: 60000,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log(output);
        return { label, status: 'PASSOU', exitCode: 0, output: output.trim() };
    } catch (e) {
        const output = (e.stdout || '') + (e.stderr || '');
        console.log(output);
        return { label, status: 'FALHOU', exitCode: e.status || 1, output: output.trim() };
    }
}

async function main() {
    const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: path.resolve(__dirname, '..') }).trim();
    const dateStr = new Date().toLocaleString('pt-BR');

    console.log("=== GERADOR DE EVIDÊNCIA DE HOMOLOGAÇÃO ===");
    console.log(`Commit: ${commitHash}`);
    console.log(`Data: ${dateStr}`);

    const results = [];

    // Teste 1: Separação interno/externo
    results.push(run('node tests/test-separation.js', 'Teste de Separação Interno/Externo'));

    // Teste 2: UI E2E (requer Playwright)
    results.push(run('node test_ui.js', 'Teste E2E de Interface (7 testes)'));

    // Teste 3: Smoke test comercial
    results.push(run('node tests/smoke-test-comercial.js', 'Smoke Test Comercial Real'));

    // Teste 4: Empacotamento limpo
    results.push(run('node scripts/package-clean.js', 'Empacotamento Limpo'));

    // Gerar relatório
    const allPassed = results.every(r => r.exitCode === 0);
    const veredito = allPassed ? 'GO DEFINITIVO' : 'AJUSTES NECESSÁRIOS';

    let md = `# Evidência de Homologação — Lead King v2.0\n\n`;
    md += `**Commit**: \`${commitHash}\`  \n`;
    md += `**Data**: ${dateStr}  \n`;
    md += `**Veredito**: ${veredito}  \n\n`;
    md += `## Resultados\n\n`;
    md += `| Teste | Status | Exit Code |\n`;
    md += `|---|---|---|\n`;
    results.forEach(r => {
        md += `| ${r.label} | ${r.status} | ${r.exitCode} |\n`;
    });
    md += `\n## Saídas Completas\n\n`;
    results.forEach(r => {
        md += `### ${r.label}\n\`\`\`\n${r.output.substring(0, 2000)}\n\`\`\`\n\n`;
    });

    const evidencePath = path.resolve(__dirname, '..', 'EVIDENCIA_HOMOLOGACAO.md');
    fs.writeFileSync(evidencePath, md, 'utf8');
    console.log(`\n✅ Evidência salva em: EVIDENCIA_HOMOLOGACAO.md`);
    console.log(`Veredito: ${veredito}`);

    process.exit(allPassed ? 0 : 1);
}

main();
