const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    let globalIsStopped = false;
    await context.exposeFunction('getRobotStopped', () => globalIsStopped);
    await context.exposeFunction('setRobotStopped', () => { globalIsStopped = true; });

    await page.goto('https://www.google.com/maps/search/Barbearia+em+Peruíbe/');
    await page.waitForTimeout(5000);

    await page.evaluate(async () => {
        const isStopped = await window.getRobotStopped();
        const btn = document.createElement('button');
        btn.id = 'robot-stop-btn';
        btn.innerHTML = 'PAUSAR MOTOR TESTE';
        btn.style.cssText = 'position:fixed; bottom:30px; right:30px; z-index:2147483647; padding:15px 30px; font-size:14px; letter-spacing:1px; color:#f8fafc; font-weight:700; border-radius:8px; cursor:pointer; background:#334155; border:2px solid #94a3b8; box-shadow:0 10px 25px rgba(0,0,0,0.8); font-family:sans-serif; transition: all 0.2s;';
        document.body.appendChild(btn);
    });

    console.log("Injetado. Aguardando 10s...");
    await page.waitForTimeout(10000);
    await browser.close();
})();
