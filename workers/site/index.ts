import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  PRIVATE_ALLOWED_EMAIL?: string;
}

const keySets = new Map<string, JWTVerifyGetKey>();
function signingKeys(issuer: string): JWTVerifyGetKey {
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer), { timeoutDuration: 5000 });
    keySets.set(issuer, keys);
  }
  return keys;
}

function accessConfig(env: Env) {
  const domain = env.ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.ACCESS_AUD?.trim();
  const email = env.PRIVATE_ALLOWED_EMAIL?.trim().toLowerCase();
  if (!domain || !audience || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  try {
    const url = new URL(domain.includes('://') ? domain : `https://${domain}`);
    if (url.protocol !== 'https:' || !/^[a-z0-9][a-z0-9-]*\.cloudflareaccess\.com$/.test(url.hostname)
      || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return { issuer: url.origin, audience, email };
  } catch { return null; }
}

// Check decoded aliases as well as canonical paths before the asset server can
// apply redirects or HTML handling. Invalid or excessively encoded paths fail.
export function normalizePath(pathname: string) {
  let path = pathname;
  for (let pass = 0; pass < 4 && /%[\da-f]{2}/i.test(path); pass++) path = decodeURIComponent(path);
  if (path.includes('%') || /[\u0000-\u001f\u007f]/.test(path)) throw new Error('Invalid path');
  const segments: string[] = [];
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop(); else segments.push(segment);
  }
  return `/${segments.join('/')}`;
}

function isPrivate(path: string) {
  const lower = path.toLowerCase();
  return lower === '/private' || lower === '/private.html' || lower.startsWith('/private/') || lower.startsWith('/private.html/');
}

function privateHeaders(headers?: HeadersInit) {
  const result = new Headers(headers);
  result.set('Cache-Control', 'private, no-store, max-age=0');
  result.set('CDN-Cache-Control', 'no-store');
  result.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  result.set('X-Content-Type-Options', 'nosniff');
  result.set('Referrer-Policy', 'same-origin');
  result.set('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  return result;
}

function denied(request: Request, status: number) {
  const unavailable = status === 503;
  const error = unavailable ? 'Private access is not available yet.' : status === 403 ? 'This account does not have access.' : 'Sign in to continue.';
  const headers = privateHeaders();
  if (new URL(request.url).pathname.includes('/api/')) {
    headers.set('Content-Type', 'application/json');
    return new Response(request.method === 'HEAD' ? null : JSON.stringify({ error }), { status, headers });
  }
  headers.set('Content-Type', 'text/html; charset=utf-8');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Private access</title><style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#faf8f3;color:#292a25;font:16px/1.7 system-ui}main{max-width:420px;padding:32px}h1{font:normal 36px/1.2 Georgia}p{color:#737168}a{color:inherit;text-underline-offset:5px}</style></head><body><main><h1>${unavailable ? 'Not quite ready yet.' : 'A private space.'}</h1><p>${error}</p><a href="${unavailable ? '/' : '/login/'}">${unavailable ? 'Back to the portfolio' : 'Go to sign in'}</a></main></body></html>`;
  return new Response(request.method === 'HEAD' ? null : html, { status, headers });
}

// Key resolution is injectable for cryptographic tests. Production always uses
// Cloudflare's rotating signing keys at the explicitly configured team domain.
export function createSiteWorker(resolveKeys: (issuer: string) => JWTVerifyGetKey = signingKeys) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      let path: string;
      try { path = normalizePath(new URL(request.url).pathname); }
      catch { return new Response('Invalid request path.', { status: 400, headers: privateHeaders() }); }
      if (!isPrivate(path)) return env.ASSETS.fetch(request);

      const config = accessConfig(env);
      if (!config) return denied(request, 503);
      const token = request.headers.get('Cf-Access-Jwt-Assertion');
      if (!token || token.length > 8192) return denied(request, 401);
      let email: string;
      try {
        const { payload } = await jwtVerify(token, resolveKeys(config.issuer), {
          algorithms: ['RS256'], issuer: config.issuer, audience: config.audience,
          requiredClaims: ['exp', 'iat', 'sub', 'email'], clockTolerance: 5,
        });
        if (typeof payload.email !== 'string') return denied(request, 403);
        email = payload.email.trim().toLowerCase();
        if (email !== config.email) return denied(request, 403);
      } catch { return denied(request, 401); }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const headers = privateHeaders({ Allow: 'GET, HEAD' });
        return new Response('Method not allowed.', { status: 405, headers });
      }
      if (path.toLowerCase() === '/private/api/session') {
        const headers = privateHeaders({ 'Content-Type': 'application/json' });
        return new Response(request.method === 'HEAD' ? null : JSON.stringify({ email }), { headers });
      }
      if (path.toLowerCase().startsWith('/private/api/')) {
        return Response.json({ error: 'Not found.' }, { status: 404, headers: privateHeaders() });
      }
      const asset = await env.ASSETS.fetch(request);
      return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers: privateHeaders(asset.headers) });
    },
  };
}

export default createSiteWorker();
