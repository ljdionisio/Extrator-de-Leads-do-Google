/**
 * Shared auth simples para Cloudflare Pages Functions.
 * Proteção por access code (header x-operator-access-code).
 */

export function requireOperatorAccess(request, env) {
    const expectedCode = env.PWA_OPERATOR_ACCESS_CODE;
    if (!expectedCode) {
        // Sem código configurado = acesso livre (dev/staging)
        return null;
    }
    const provided = request.headers.get('x-operator-access-code') || '';
    if (provided !== expectedCode) {
        return new Response(JSON.stringify({ error: 'Acesso não autorizado' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    return null; // Autorizado
}
