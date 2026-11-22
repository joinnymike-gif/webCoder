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

const PORT = +process.env.WEBIDE_PORT || 47321;
const HOST = process.env.WEBIDE_HOST || '127.0.0.1';
const ORIGINS = (process.env.WEBIDE_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
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

const tokens = new Set();
const newToken = () => {
  const t = crypto.randomBytes(24).toString('base64url');
  tokens.add(t);
  if (tokens.size > 200) tokens.delete(tokens.values().next().value);
  return t;
};

const allowedOrigins = () => new Set([
  ...ORIGINS,
  `http://127.0.0.1:${PORT}`,
  `http://localhost:${PORT}`,
]);

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
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', ...extraHeaders });
  res.end(body);
}

const json = (res, code, x) => reply(res, code, JSON.stringify(x), 'application/json; charset=utf-8');

const server = http.createServer(async (req, res) => {
  try {
    const rawHost = String(req.headers.host || '');
    const hostName = rawHost.split(':')[0];
    if (hostName !== '127.0.0.1' && hostName !== 'localhost') return reply(res, 403, 'bad host');

    const origin = req.headers.origin;
    if (origin) {
      if (!allowedOrigins().has(origin)) return reply(res, 403, 'bad origin');
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('access-control-allow-headers', 'authorization, content-type');
      res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
      res.setHeader('vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    const u = new URL(req.url, `http://${HOST}:${PORT}`);
    const p = u.pathname;

    if (p === '/' && req.method === 'GET') {
      const csp = "default-src 'none'; script-src 'self' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src https://cdnjs.cloudflare.com data:; img-src 'self' data: https:; connect-src 'self' https:; worker-src blob:; frame-ancestors 'none'";
      const { raw, gz } = getHtmlPayload();
      const useGz = /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
      return reply(res, 200, useGz ? gz : raw, 'text/html; charset=utf-8', {
        'content-security-policy': csp,
        'x-content-type-options': 'nosniff',
        ...(useGz && { 'content-encoding': 'gzip', vary: 'Accept-Encoding' }),
      });
    }

    if (p === '/health' && req.method === 'GET') return reply(res, 200, 'ok');

    if (p === '/session' && req.method === 'POST') {
      const fetchSite = req.headers['sec-fetch-site'];
      if (fetchSite && fetchSite !== 'same-origin' && !allowedOrigins().has(origin || '')) {
        return reply(res, 403, 'forbidden');
      }
      return json(res, 200, { token: newToken(), mode: 'browser-only' });
    }

    // All proxy calls require bearer session token + same-origin check and hold zero server state
    const auth = req.headers.authorization || '';
    const tok = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!tok || !tokens.has(tok)) return reply(res, 401, 'unauthorized');

    if (p === '/proxy/ext/search' && req.method === 'GET') {
      return json(res, 200, await searchMarketplace(u.searchParams.get('q') || ''));
    }

    if (p === '/proxy/ext/vsix' && req.method === 'GET') {
      const vsixUrl = String(u.searchParams.get('url') || '');
      if (!allowedVsixUrl(vsixUrl)) throw new HttpErr(400, 'Disallowed VSIX download URL');
      const { buf } = await fetchBoundedBytes(vsixUrl, 60 * 1024 * 1024, { 'user-agent': 'WebIDE-Stateless-Proxy/1.0' });
      return reply(res, 200, buf, 'application/octet-stream');
    }

    if (p === '/proxy/github/meta' && req.method === 'GET') {
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
      const repo = parseRepoParam(u.searchParams.get('repo'));
      const branch = parseBranchParam(u.searchParams.get('branch'));
      const ref = branch ? `refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}` : 'HEAD';
      const { buf } = await fetchBoundedBytes(`https://codeload.github.com/${repo}/zip/${ref}`, 80 * 1024 * 1024, {
        'user-agent': 'WebIDE-Stateless-Proxy/1.0',
      });
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
