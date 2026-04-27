export async function onRequestGet(context) {
    return Response.json({
        ok: true,
        service: 'lead-king-cloudflare',
        runtime: 'pages-functions',
        timestamp: new Date().toISOString(),
    });
}
