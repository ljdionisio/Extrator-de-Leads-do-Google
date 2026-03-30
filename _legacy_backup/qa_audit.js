const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log('🚀 Iniciando QA E2E Audit - Lead King');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const logs = [];
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
        }
    });

    const errors = [];
    page.on('pageerror', err => {
        errors.push(err.message);
    });

    try {
        console.log('1️⃣  Testando Landing Page (/)');
        await page.goto('http://localhost:5173/');
        await page.waitForLoadState('networkidle');
        const title = await page.title();
        console.log('   ✅ Título da página:', title);

        console.log('2️⃣  Testando Página de Login (/login)');
        await page.goto('http://localhost:5173/login');
        await page.waitForLoadState('networkidle');
        const loginBtn = await page.getByRole('button', { name: /entrar/i });
        if (await loginBtn.count() > 0) {
            console.log('   ✅ Botão de login encontrado.');
        } else {
            console.log('   ❌ Botão de login ausente!');
        }

        console.log('3️⃣  Testando Proteção de Rota Admin (/admin/users)');
        await page.goto('http://localhost:5173/admin/users');
        await page.waitForTimeout(2000);
        const urlAfterRedirect = page.url();
        if (urlAfterRedirect.includes('/login')) {
            console.log('   ✅ Redirecionamento correto. Proteção ativa.');
        } else {
            console.log('   ❌ FALHA DE SEGURANÇA: Rota acessada sem auth!', urlAfterRedirect);
        }

    } catch (e) {
        console.log('❌ Ocorreu um erro no script principal:', e.message);
    } finally {
        console.log('\n--- RELATÓRIO DE LOGS DO BROWSER ---');
        console.log('Erros Críticos:', errors.length > 0 ? errors : 'Nenhum');
        console.log('Avisos de Console:', logs.length > 0 ? logs : 'Nenhum');

        await browser.close();
        console.log('🏁 QA Audit Finalizado.');
    }
})();
