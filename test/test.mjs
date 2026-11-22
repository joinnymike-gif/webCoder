// Self-check: node test/test.mjs
// Verifies stateless server security, zero server-side storage, CORS/CSRF guards,
// and removal of cross-client server filesystem/extension/shell endpoints.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(dir, '..');
const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'webide-stateless-')));

// Syntax check web/index.html inline scripts as part of self-check
const html = fs.readFileSync(path.join(rootDir, 'web', 'index.html'), 'utf8');
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
assert.ok(scripts.length >= 1, 'web/index.html has inline script');
for (const s of scripts) new Function(s.replace(/^<script>|<\/script>$/g, ''));

const PORT = 47399, B = `http://127.0.0.1:${PORT}`;
const bridge = spawn(process.execPath, [path.join(rootDir, 'bridge.mjs')], {
  env: { ...process.env, HOME: home, WEBIDE_PORT: PORT },
  stdio: 'inherit',
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(B + '/health'); if (r.ok) break; } catch {}
    await sleep(100);
  }

  const f = (p, o = {}) => fetch(B + p, o);

  // Page & CSP
  const page = await f('/');
  assert.equal(page.status, 200, 'serves index.html');
  const csp = page.headers.get('content-security-policy') || '';
  assert.ok(csp.includes("script-src") && csp.includes("blob:") && !csp.includes("'unsafe-eval'"), 'CSP allows blob scripts without unsafe-eval');

  // Session & CORS/CSRF guards
  assert.equal((await f('/proxy/ext/search?q=dracula')).status, 401, 'proxy requires bearer token');
  assert.equal((await f('/session', { method: 'POST', headers: { origin: 'http://evil.test', 'sec-fetch-site': 'cross-site' } })).status, 403, 'rejects cross-origin session');
  assert.equal((await f('/proxy/ext/search', { headers: { origin: 'http://evil.test' } })).status, 403, 'rejects bad origin');
  const sRes = await f('/session', { method: 'POST', headers: { origin: B, 'sec-fetch-site': 'same-origin' } });
  assert.equal(sRes.status, 200, 'issues same-origin session');
  const { token, mode } = await sRes.json();
  assert.equal(mode, 'browser-only');
  const H = { authorization: 'Bearer ' + token };

  // Ensure server-side storage / FS / shell / agent / git / ext endpoints are completely gone
  for (const gone of ['/root', '/projects', '/fs/browse', '/fs/tree', '/fs/file?path=x', '/fs/search?q=a', '/git/status', '/ext/installed', '/agents']) {
    assert.equal((await f(gone, { headers: H })).status, 404, `removed server endpoint ${gone}`);
  }
  for (const gonePost of ['/term', '/agent/start', '/ext/install', '/git/clone', '/root']) {
    assert.equal((await f(gonePost, { method: 'POST', headers: H, body: '{}' })).status, 404, `removed POST endpoint ${gonePost}`);
  }

  // Proxy input validation (SSRF / traversal / scheme checks)
  assert.equal((await f('/proxy/ext/vsix?url=' + encodeURIComponent('https://evil.example.com/x.vsix'), { headers: H })).status, 400, 'rejects untrusted vsix host');
  assert.equal((await f('/proxy/ext/vsix?url=' + encodeURIComponent('http://open-vsx.org/x.vsix'), { headers: H })).status, 400, 'rejects non-HTTPS vsix');
  assert.equal((await f('/proxy/github/meta?repo=' + encodeURIComponent('../../etc/passwd'), { headers: H })).status, 400, 'rejects invalid repo slug');
  assert.equal((await f('/proxy/github/archive?repo=octocat/Hello-World&branch=..', { headers: H })).status, 400, 'rejects traversal branch');

  // Verify ZERO files/folders were created on the server (stateless host)
  assert.deepEqual(fs.readdirSync(home), [], 'server never writes user files or state to disk');

  console.log('OK: stateless browser-local bridge self-check passed');
} finally {
  bridge.kill();
  fs.rmSync(home, { recursive: true, force: true });
}
