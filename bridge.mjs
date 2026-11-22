#!/usr/bin/env node
// WebIDE stateless static host + allowlisted public CORS pass-through proxy.
// ZERO user code, directories, state files, or extensions are persisted on the server;
// all user workspaces, files, snapshots, and extensions live strictly in browser storage.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const PORT = +(process.env.WEBIDE_PORT || process.env.PORT || 47321);
const HOST = process.env.WEBIDE_HOST || '127.0.0.1';
const ORIGINS = (process.env.WEBIDE_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const PUBLIC_HOSTS = new Set(
  (process.env.WEBIDE_PUBLIC_HOSTS || '')
    .split(',')
    .map(s => s.trim().toLowerCase().replace(/:\d+$/, ''))
    .filter(Boolean)
);
const TRUST_PROXY = /^(1|true|yes)$/i.test(process.env.WEBIDE_TRUST_PROXY || '');
const ALLOW_BOTS = /^(1|true|yes)$/i.test(process.env.WEBIDE_ALLOW_BOTS || '');

const envPosInt = (name, def) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
};

// Configurable per-IP rate limits (zero auth required, prevents proxy & bandwidth abuse)
const RL = {
  pageMax: envPosInt('WEBIDE_RL_PAGE', 120),        // GET / requests per minute per IP
  sessionMax: envPosInt('WEBIDE_RL_SESSION', 20),   // POST /session requests per minute per IP
  proxyMax: envPosInt('WEBIDE_RL_PROXY', 60),       // search/meta API requests per minute per IP
  dlMax: envPosInt('WEBIDE_RL_DL', 15),             // .vsix / .zip downloads per minute per IP
  dlBytesMax: envPosInt('WEBIDE_RL_DL_MB', 500) * 1024 * 1024, // download bytes per 10 min per IP
};

const SELF = fileURLToPath(import.meta.url);
const HTML_PATH = path.join(path.dirname(SELF), 'web', 'index.html');
let cachedHtml = { mtimeMs: -1, raw: null, gz: null };
function getHtmlPayload() {
  const st = fs.statSync(HTML_PATH);
  if (st.mtimeMs !== cachedHtml.mtimeMs) {
    const raw = fs.readFileSync(HTML_PATH);
    cachedHtml = { mtimeMs: st.mtimeMs, raw, gz: zlib.gzipSync(raw, { level: 6 }) };
  }
  return cachedHtml;
}

class HttpErr extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}

// ---------- client IP, anti-crawler, IP rate limiting ----------
function normIp(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'unknown';
  return s.startsWith('::ffff:') ? s.slice(7) : s;
}

function getClientIp(req) {
  if (TRUST_PROXY) {
    const cf = req.headers['cf-connecting-ip'];
    if (cf) return normIp(cf);
    const xr = req.headers['x-real-ip'];
    if (xr) return normIp(xr);
    const xff = String(req.headers['x-forwarded-for'] || '');
    if (xff) {
      const parts = xff.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length) return normIp(parts[parts.length - 1]);
    }
  }
  return normIp(req.socket?.remoteAddress);
}

const uaHash = ua => crypto.createHash('sha256').update(String(ua || '')).digest('base64url').slice(0, 12);

const BOT_UA_RE = /(?:^|[\s;/(_-])(bot|spider|crawl(?:er|ing)?|scrapy|python-requests|python-urllib|aiohttp|go-http-client|httpclient|libwww-perl|wget|curl|masscan|zgrab|sqlmap|nikto|nmap|ahrefsbot|semrushbot|mj12bot|bytespider|gptbot|claudebot|ccbot|petalbot|yandexbot|bingbot|baiduspider|googlebot|duckduckbot|slurp|facebookexternalhit|twitterbot)(?:$|[\s;/),_-])/i;
function isBlockedBot(req) {
  if (ALLOW_BOTS) return false;
  const ua = String(req.headers['user-agent'] || '').trim();
  if (!ua && PUBLIC_HOSTS.size > 0) return true;
  return BOT_UA_RE.test(ua);
}

const rlBuckets = new Map();
const MAX_RL_ENTRIES = 10_000;
function checkRateLimit(key, max, windowMs, cost = 1) {
  const now = Date.now();
  let b = rlBuckets.get(key);
  if (!b || now >= b.reset) {
    if (!b && rlBuckets.size >= MAX_RL_ENTRIES) {
      for (const [k, v] of rlBuckets) {
        if (now >= v.reset) rlBuckets.delete(k);
        if (rlBuckets.size < MAX_RL_ENTRIES * 0.8) break;
      }
      if (rlBuckets.size >= MAX_RL_ENTRIES) rlBuckets.delete(rlBuckets.keys().next().value);
    }
    b = { count: 0, reset: now + windowMs };
    rlBuckets.set(key, b);
  }
  if (b.count + cost > max) {
    const retryAfter = Math.max(1, Math.ceil((b.reset - now) / 1000));
    return { ok: false, retryAfter, remaining: 0, limit: max };
  }
  b.count += cost;
  return { ok: true, retryAfter: 0, remaining: Math.max(0, max - b.count), limit: max };
}

// ---------- session tokens (bound to client IP + UA hash, short TTL) ----------
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const tokens = new Map(); // tok -> { ip, uah, exp }
function newToken(ip, ua) {
  const now = Date.now();
  const t = crypto.randomBytes(24).toString('base64url');
  tokens.set(t, { ip, uah: uaHash(ua), exp: now + TOKEN_TTL_MS });
  if (tokens.size > 2000) {
    for (const [k, v] of tokens) {
      if (now > v.exp || tokens.size > 2000) tokens.delete(k);
      if (tokens.size <= 1600) break;
    }
  }
  return t;
}
function validToken(tok, ip, ua) {
  const rec = tokens.get(tok);
  if (!rec) return false;
  const now = Date.now();
  if (now > rec.exp) { tokens.delete(tok); return false; }
  if (rec.ip !== ip || rec.uah !== uaHash(ua)) return false;
  rec.exp = now + TOKEN_TTL_MS;
  return true;
}

function isAllowedHost(hostName) {
  const h = String(hostName || '').toLowerCase();
  if (h === '127.0.0.1' || h === 'localhost') return true;
  if (PUBLIC_HOSTS.has('*')) return true;
  return PUBLIC_HOSTS.has(h);
}

function allowedOrigins(reqHost) {
  const set = new Set([
    ...ORIGINS,
    `http://127.0.0.1:${PORT}`,
    `http://localhost:${PORT}`,
  ]);
  if (reqHost) {
    const raw = String(reqHost).trim();
    const h = raw.split(':')[0].toLowerCase();
    if (isAllowedHost(h)) {
      set.add(`https://${raw}`);
      set.add(`http://${raw}`);
      set.add(`https://${h}`);
      set.add(`http://${h}`);
    }
  }
  for (const h of PUBLIC_HOSTS) {
    if (h !== '*') {
      set.add(`https://${h}`);
      set.add(`http://${h}`);
    }
  }
  return set;
}

function allowedVsixUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  return h.endsWith('.vsassets.io') || h.endsWith('.visualstudio.com') || h === 'open-vsx.org' || h === 'github.com' || h.endsWith('.githubusercontent.com');
}

function parseRepoParam(raw) {
  const s = String(raw || '').trim();
  if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(s) || s.includes('..')) {
    throw new HttpErr(400, 'Invalid GitHub repository slug (expected owner/repo)');
  }
  return s;
}

function parseBranchParam(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.length > 120 || s.includes('..') || !/^[a-zA-Z0-9._/-]+$/.test(s)) {
    throw new HttpErr(400, 'Invalid GitHub branch name');
  }
  return s;
}

// Stateless Marketplace search (forwards query only; nothing cached or written to disk)
async function searchMarketplace(query = '') {
  const q = String(query || '').trim().slice(0, 200);
  try {
    const criteria = [
      { filterType: 8, value: 'Microsoft.VisualStudio.Code' },
      { filterType: 12, value: '4096' },
    ];
    if (q) criteria.push({ filterType: 10, value: q });
    const body = {
      filters: [{ criteria, pageNumber: 1, pageSize: 24, sortBy: q ? 0 : 4, sortOrder: 0 }],
      assetTypes: ['Microsoft.VisualStudio.Services.Icons.Default', 'Microsoft.VisualStudio.Services.VSIXPackage'],
      flags: 0x1 | 0x2 | 0x10 | 0x80 | 0x100 | 0x200,
    };
    const r = await fetch('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json;api-version=7.1-preview.1',
        'user-agent': 'WebIDE-Stateless-Proxy/1.0',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    if (r.ok) {
      const data = await r.json();
      const exts = data?.results?.[0]?.extensions || [];
      if (exts.length) {
        return exts.map(x => {
          const pub = x.publisher?.publisherName || '';
          const name = x.extensionName || '';
          const v = x.versions?.[0] || {};
          const files = v.files || [];
          const findAsset = t => files.find(f => f.assetType === t)?.source || '';
          const stats = Object.fromEntries((x.statistics || []).map(s => [s.statisticName, s.value]));
          return {
            id: `${pub}.${name}`,
            displayName: x.displayName || name,
            publisher: x.publisher?.displayName || pub,
            description: x.shortDescription || '',
            version: v.version || '',
            installs: Math.round(stats.install || 0),
            rating: +(stats.averagerating || 0).toFixed(1),
            iconUrl: findAsset('Microsoft.VisualStudio.Services.Icons.Default'),
            vsixUrl: findAsset('Microsoft.VisualStudio.Services.VSIXPackage') || (pub && name && v.version ? `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${encodeURIComponent(pub)}/vsextensions/${encodeURIComponent(name)}/${encodeURIComponent(v.version)}/vspackage` : ''),
            categories: x.categories || [],
          };
        });
      }
    }
  } catch { /* fallback to Open VSX */ }

  const url = `https://open-vsx.org/api/-/search?query=${encodeURIComponent(q)}&size=24&sortBy=downloadCount`;
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new HttpErr(502, `Marketplace search failed (${r.status})`);
  const data = await r.json();
  return (data.extensions || []).map(x => ({
    id: `${x.namespace}.${x.name}`,
    displayName: x.displayName || x.name,
    publisher: x.namespace,
    description: x.description || '',
    version: x.version || '',
    installs: x.downloadCount || 0,
    rating: +(x.averageRating || 0).toFixed(1),
    iconUrl: x.files?.icon || '',
    vsixUrl: x.files?.download || '',
    categories: [],
  }));
}

async function fetchBoundedBytes(url, maxBytes, headers = {}) {
  const r = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new HttpErr(502, `Upstream returned ${r.status}`);
  const cl = Number(r.headers.get('content-length') || 0);
  if (cl > maxBytes) throw new HttpErr(413, `Payload exceeds ${Math.round(maxBytes / 1048576)} MB limit`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > maxBytes) throw new HttpErr(413, `Payload exceeds ${Math.round(maxBytes / 1048576)} MB limit`);
  return { buf, type: r.headers.get('content-type') || 'application/octet-stream' };
}

function reply(res, code, body, type = 'text/plain; charset=utf-8', extraHeaders = {}) {
  res.writeHead(code, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'same-origin',
    'x-robots-tag': 'noindex, nofollow, noarchive',
    ...extraHeaders,
  });
  res.end(body);
}

const json = (res, code, x, extraHeaders = {}) => reply(res, code, JSON.stringify(x), 'application/json; charset=utf-8', extraHeaders);

function enforceRate(res, bucketKey, max, windowMs, cost = 1) {
  const rl = checkRateLimit(bucketKey, max, windowMs, cost);
  res.setHeader('x-ratelimit-limit', String(rl.limit));
  res.setHeader('x-ratelimit-remaining', String(rl.remaining));
  if (!rl.ok) {
    reply(res, 429, `Too many requests. Retry in ${rl.retryAfter}s.`, 'text/plain; charset=utf-8', {
      'retry-after': String(rl.retryAfter),
    });
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const rawHost = String(req.headers.host || '');
    const hostName = rawHost.split(':')[0];
    if (!isAllowedHost(hostName)) return reply(res, 403, 'bad host');

    const origins = allowedOrigins(rawHost);
    const origin = req.headers.origin;
    if (origin) {
      if (!origins.has(origin)) return reply(res, 403, 'bad origin');
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('access-control-allow-headers', 'authorization, content-type');
      res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
      res.setHeader('vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    const u = new URL(req.url, `http://${rawHost || `${HOST}:${PORT}`}`);
    const p = u.pathname;
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';

    // Health check stays unthrottled for container / PaaS readiness probes
    if (p === '/health' && req.method === 'GET') return reply(res, 200, 'ok');

    if (p === '/robots.txt' && req.method === 'GET') {
      return reply(res, 200, 'User-agent: *\nDisallow: /\n', 'text/plain; charset=utf-8');
    }

    // Block automated scrapers / crawlers
    if (isBlockedBot(req)) {
      return reply(res, 403, 'forbidden (automated client)');
    }

    if (p === '/' && req.method === 'GET') {
      if (!enforceRate(res, `page:${ip}`, RL.pageMax, 60_000)) return;
      const csp = "default-src 'none'; script-src 'self' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src https://cdnjs.cloudflare.com data:; img-src 'self' data: https:; connect-src 'self' https:; worker-src blob:; frame-ancestors 'none'";
      const { raw, gz } = getHtmlPayload();
      const useGz = /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
      return reply(res, 200, useGz ? gz : raw, 'text/html; charset=utf-8', {
        'content-security-policy': csp,
        ...(useGz && { 'content-encoding': 'gzip', vary: 'Accept-Encoding' }),
      });
    }

    if (p === '/session' && req.method === 'POST') {
      if (!enforceRate(res, `sess:${ip}`, RL.sessionMax, 60_000)) return;
      const fetchSite = req.headers['sec-fetch-site'];
      if (fetchSite && fetchSite !== 'same-origin' && !origins.has(origin || '')) {
        return reply(res, 403, 'forbidden');
      }
      if (PUBLIC_HOSTS.size > 0 && req.headers.referer) {
        try {
          if (!origins.has(new URL(req.headers.referer).origin)) return reply(res, 403, 'forbidden');
        } catch { return reply(res, 403, 'forbidden'); }
      }
      return json(res, 200, { token: newToken(ip, ua), mode: 'browser-only' });
    }

    // All proxy calls require bearer session token bound to client IP/UA + same-origin check
    const auth = req.headers.authorization || '';
    const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!tok || !validToken(tok, ip, ua)) return reply(res, 401, 'unauthorized');

    if (p === '/proxy/ext/search' && req.method === 'GET') {
      if (!enforceRate(res, `proxy:${ip}`, RL.proxyMax, 60_000)) return;
      return json(res, 200, await searchMarketplace(u.searchParams.get('q') || ''));
    }

    if (p === '/proxy/ext/vsix' && req.method === 'GET') {
      if (!enforceRate(res, `dl:${ip}`, RL.dlMax, 60_000)) return;
      const vsixUrl = String(u.searchParams.get('url') || '');
      if (!allowedVsixUrl(vsixUrl)) throw new HttpErr(400, 'Disallowed VSIX download URL');
      const { buf } = await fetchBoundedBytes(vsixUrl, 60 * 1024 * 1024, { 'user-agent': 'WebIDE-Stateless-Proxy/1.0' });
      if (!enforceRate(res, `dlb:${ip}`, RL.dlBytesMax, 10 * 60_000, buf.length)) return;
      return reply(res, 200, buf, 'application/octet-stream');
    }

    if (p === '/proxy/github/meta' && req.method === 'GET') {
      if (!enforceRate(res, `proxy:${ip}`, RL.proxyMax, 60_000)) return;
      const repo = parseRepoParam(u.searchParams.get('repo'));
      const r = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { accept: 'application/vnd.github+json', 'user-agent': 'WebIDE-Stateless-Proxy/1.0' },
        signal: AbortSignal.timeout(12000),
      });
      if (r.status === 404) throw new HttpErr(404, `GitHub repository not found: ${repo}`);
      if (!r.ok) {
        // Fallback when API rate-limited: codeload Archive can still fetch default HEAD
        return json(res, 200, { slug: repo, defaultBranch: 'HEAD', htmlUrl: `https://github.com/${repo}` });
      }
      const d = await r.json();
      return json(res, 200, {
        slug: d.full_name || repo,
        defaultBranch: d.default_branch || 'main',
        description: d.description || '',
        htmlUrl: d.html_url || `https://github.com/${repo}`,
      });
    }

    if (p === '/proxy/github/archive' && req.method === 'GET') {
      if (!enforceRate(res, `dl:${ip}`, RL.dlMax, 60_000)) return;
      const repo = parseRepoParam(u.searchParams.get('repo'));
      const branch = parseBranchParam(u.searchParams.get('branch'));
      const ref = branch ? `refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}` : 'HEAD';
      const { buf } = await fetchBoundedBytes(`https://codeload.github.com/${repo}/zip/${ref}`, 80 * 1024 * 1024, {
        'user-agent': 'WebIDE-Stateless-Proxy/1.0',
      });
      if (!enforceRate(res, `dlb:${ip}`, RL.dlBytesMax, 10 * 60_000, buf.length)) return;
      return reply(res, 200, buf, 'application/zip');
    }

    return reply(res, 404, 'not found');
  } catch (e) {
    const code = e instanceof HttpErr ? e.code : 500;
    return reply(res, code, e?.message || 'internal error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`webide bridge on http://${HOST}:${PORT}`);
});

const shutdown = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
