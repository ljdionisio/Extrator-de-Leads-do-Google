const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log('🚀 Iniciando QA Interno - Páginas Logadas (Mock Admin)');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const logs = [];
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
        }
    });

    const routes = [
        { name: 'Dashboard', url: 'http://localhost:5173/' },
        { name: 'Leads Capturados', url: 'http://localhost:5173/leads' },
        { name: 'Qualificados (IA)', url: 'http://localhost:5173/qualified' },
        { name: 'Histórico', url: 'http://localhost:5173/history' },
        { name: 'Motor Digital Prime', url: 'http://localhost:5173/capture' },
        { name: 'Admin - Chaves', url: 'http://localhost:5173/admin/keys' },
        { name: 'Admin - Usuários', url: 'http://localhost:5173/admin/users' },
    ];

    try {
        for (const route of routes) {
            console.log(`\n🔍 Testando rota: ${route.name}`);
            await page.goto(route.url);
            await page.waitForTimeout(2000); // Aguarda renderização completa (React Suspense, etc)

            const title = await page.title();
            const urlNow = page.url();

            console.log(`   🔸 URL atual: ${urlNow}`);
            if (urlNow.includes('login')) {
                console.log(`   ❌ FALHA: A rota caiu no Login. O Mock falhou.`);
            } else {
                console.log(`   ✅ SUCESSO: Rota acessada. UI Rederizada.`);
            }
        }
    } catch (e) {
        console.log('❌ Ocorreu um erro no loop:', e.message);
    } finally {
        console.log('\n--- RELATÓRIO DE BUGS UI NO CONSOLE DO REACT ---');
        if (logs.length > 0) {
            console.log(logs.join('\n'));
        } else {
            console.log('✅ NENHUM ERRO OU WARNING REGISTRADO!');
        }
        await browser.close();
        console.log('🏁 FIM DO QA INTERNO.');
    }
})();
