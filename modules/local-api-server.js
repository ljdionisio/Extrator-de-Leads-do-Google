/**
 * Local API Server — Servidor HTTP nativo para servir UI e API
 * 
 * Usa apenas módulos nativos: node:http, node:fs, node:path
 * ZERO dependências externas.
 * 
 * Funcionalidades:
 * - Serve arquivos estáticos de ui-local/ (HTML, CSS, JS, imagens)
 * - API REST mínima em /api/*
 * - CORS habilitado para desenvolvimento
 * - Content-Type correto por extensão
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.webmanifest': 'application/manifest+json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.pdf': 'application/pdf',
};

const UI_DIR = path.join(__dirname, '..', 'ui-local');

/**
 * Cria e inicia o servidor HTTP local
 * @param {Object} options
 * @param {number} options.port - Porta (default 3939)
 * @param {Object} options.apiHandlers - Map de handlers: { 'GET /api/xxx': async (req, res, ctx) => {} }
 * @param {Object} options.context - Contexto compartilhado (browser, leads, etc)
 * @returns {{ server: http.Server, close: () => Promise<void> }}
 */
function createLocalServer({ port = 3939, apiHandlers = {}, context = {} } = {}) {
    const server = http.createServer(async (req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url, `http://localhost:${port}`);
        const pathname = url.pathname;

        // === API ROUTES ===
        if (pathname.startsWith('/api/')) {
            const routeKey = `${req.method} ${pathname}`;

            // Health check embutido
            if (req.method === 'GET' && pathname === '/api/health') {
                sendJson(res, 200, { ok: true, service: 'lead-king-local-api', timestamp: new Date().toISOString() });
                return;
            }

            // Handler registrado?
            if (apiHandlers[routeKey]) {
                try {
                    const body = await parseBody(req);
                    await apiHandlers[routeKey](req, res, { ...context, body, query: Object.fromEntries(url.searchParams) });
                } catch (err) {
                    console.error(`[API ERROR] ${routeKey}:`, err.message);
                    sendJson(res, 500, { error: err.message });
                }
                return;
            }

            // 404 para API não encontrada
            sendJson(res, 404, { error: 'Endpoint não encontrado', path: pathname });
            return;
        }

        // === STATIC FILE SERVING ===
        let filePath = pathname === '/' ? '/index.html' : pathname;

        // Sanitização: bloqueia traversal 
        const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
        const fullPath = path.join(UI_DIR, safePath);

        // Verifica que está dentro de UI_DIR
        if (!fullPath.startsWith(UI_DIR)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        // Verifica existência
        if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
            // SPA fallback: se não é arquivo, entrega index.html
            const indexPath = path.join(UI_DIR, 'index.html');
            if (fs.existsSync(indexPath)) {
                serveFile(res, indexPath);
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
            return;
        }

        serveFile(res, fullPath);
    });

    return new Promise((resolve, reject) => {
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`⚠️ Porta ${port} em uso, tentando ${port + 1}...`);
                server.listen(port + 1, () => {
                    const actualPort = server.address().port;
                    console.log(`\n🌐 API Local: http://localhost:${actualPort}`);
                    console.log(`📋 Health:    http://localhost:${actualPort}/api/health`);
                    console.log(`🖥️  UI:        http://localhost:${actualPort}/\n`);
                    resolve({ server, port: actualPort, close: () => new Promise(r => server.close(r)) });
                });
            } else {
                reject(err);
            }
        });

        server.listen(port, () => {
            console.log(`\n🌐 API Local: http://localhost:${port}`);
            console.log(`📋 Health:    http://localhost:${port}/api/health`);
            console.log(`🖥️  UI:        http://localhost:${port}/\n`);
            resolve({ server, port, close: () => new Promise(r => server.close(r)) });
        });
    });
}

// === Helpers ===

function serveFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const stream = fs.createReadStream(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    stream.pipe(res);
    stream.on('error', () => {
        res.writeHead(500);
        res.end('Internal Server Error');
    });
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}

async function parseBody(req) {
    if (req.method === 'GET' || req.method === 'HEAD') return null;
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        const MAX_BODY = 10 * 1024 * 1024; // 10MB

        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY) {
                req.destroy();
                reject(new Error('Payload muito grande (limite: 10MB)'));
                return;
            }
            chunks.push(chunk);
        });

        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            try {
                resolve(raw ? JSON.parse(raw) : null);
            } catch (e) {
                resolve(raw); // Retorna texto se não for JSON
            }
        });

        req.on('error', reject);
    });
}

module.exports = { createLocalServer, sendJson };
