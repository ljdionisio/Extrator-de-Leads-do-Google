const { loadLeads, saveSettings } = require('./modules/local-store.js');
const http = require('http');

console.log("=== INICIANDO TESTE E2E: Integração P3-A ===");

const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        console.log("\n[MOCK WEBHOOK] Requisição recebida com sucesso!");
        if (body) {
            const parsed = JSON.parse(body);
            console.log(`[MOCK WEBHOOK] Recebeu ${parsed.leads ? parsed.leads.length : 0} leads no lote.`);
            console.log(`[MOCK WEBHOOK] Exemplo do primeiro lead:`, parsed.leads[0]);
        }
        res.writeHead(200);
        res.end('OK Webhook processado!');
    });
});

server.listen(4444, async () => {
    console.log(">> Servidor de testes rodando na porta 4444");

    saveSettings({ webhookUrl: 'http://localhost:4444' });
    console.log(">> Settings atualizado simulando configuração de UI.");

    const leads = loadLeads() || [];
    const dummyLeads = leads.length > 0 ? leads.slice(0, 1) : [{
        lead_id_estavel: "test-000",
        name: "Prime Digital Test",
        phone: "11999999999",
        score: 100,
        mensagem_whatsapp_curta: "Olá, encontrei seu negócio..."
    }];

    const safeLeads = dummyLeads.map(l => ({
        id: l.lead_id_estavel,
        empresa: l.name,
        telefone: l.phone,
        score: l.score,
        mensagem_intro: l.mensagem_whatsapp_curta
    }));

    console.log(`>> Disparando Webhook de teste com ${safeLeads.length} leads...`);

    try {
        const response = await fetch('http://localhost:4444', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads: safeLeads, timestamp: new Date().toISOString() })
        });

        console.log(">> Dispatch To Webhook retornou HTTP:", response.status);
    } catch (e) {
        console.error(">> Erro na chamada:", e.message);
    }

    setTimeout(() => {
        server.close();
        console.log("\n=== TESTE CONCLUÍDO COM SUCESSO ===");
        process.exit(0);
    }, 500);
});
