export async function onRequestGet(context) {
    return new Response(JSON.stringify({
        ok: true,
        service: 'lead-king-cloudflare',
        runtime: 'pages-functions',
        timestamp: new Date().toISOString(),
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
}
