/**
 * Service Worker — Lead King PWA
 * 
 * Estratégia:
 * - Shell estático: cache-first (install pre-cache)
 * - API (/api/*): network-only (nunca cachear)
 * - Fallback: network-first para tudo que não é shell nem API
 */

const CACHE_NAME = 'lead-king-shell-v5';
const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.webmanifest',
    '/icons/icon-192.svg',
    '/icons/icon-512.svg',
];

// === INSTALL: pre-cache shell estático ===
self.addEventListener('install', (event) => {
    console.log('[SW] Install: cacheando shell estático...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// === ACTIVATE: limpar caches antigos ===
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate: limpando caches antigos...');
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] Removendo cache antigo:', key);
                        return caches.delete(key);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

// === FETCH: roteamento por tipo de request ===
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API: NUNCA cachear — network-only
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Shell estático: cache-first, fallback para network
    if (SHELL_ASSETS.includes(url.pathname)) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                return cached || fetch(event.request).then(response => {
                    // Atualiza cache em background
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // Outros: network-first, fallback para cache
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Cache apenas GET bem-sucedidos
                if (response.ok && event.request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
