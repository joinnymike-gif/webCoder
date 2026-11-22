// Self-check: node test/test.mjs
// Verifies stateless server security, zero server-side storage, CORS/CSRF guards,
// public host allowlisting, anti-crawler rules, token UA/IP binding, IP rate limits,
// and removal of cross-client server filesystem/extension/shell endpoints.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
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

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitReady(baseUrl) {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(baseUrl + '/health'); if (r.ok) return; } catch {}
    await sleep(100);
  }
  throw new Error('Bridge did not become ready: ' + baseUrl);
}

function rawHttp(port, reqPath, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: reqPath, method, headers }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

const PORT = 47399, B = `http://127.0.0.1:${PORT}`;
const bridge = spawn(process.execPath, [path.join(rootDir, 'bridge.mjs')], {
  env: { ...process.env, HOME: home, WEBIDE_PORT: PORT },
  stdio: 'inherit',
});

let prodBridge = null;
try {
  await waitReady(B);
  const f = (p, o = {}) => fetch(B + p, o);

  // Page, CSP & security/robots headers
  const page = await f('/');
  assert.equal(page.status, 200, 'serves index.html');
  const csp = page.headers.get('content-security-policy') || '';
  assert.ok(csp.includes('script-src') && csp.includes('blob:') && !csp.includes("'unsafe-eval'"), 'CSP allows blob scripts without unsafe-eval');
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.ok((page.headers.get('x-robots-tag') || '').startsWith('index'), 'app page is indexable');
  const pageHtml = await page.text();
  assert.ok(pageHtml.includes(`<link rel="canonical" href="${B}/">`) && !pageHtml.includes('%ORIGIN%'), 'absolute canonical filled from request origin');

  const robots = await f('/robots.txt');
  assert.equal(robots.status, 200, 'serves robots.txt');
  const robotsTxt = await robots.text();
  assert.ok(robotsTxt.includes('Allow: /') && robotsTxt.includes('Disallow: /proxy/') && robotsTxt.includes(`Sitemap: ${B}/sitemap.xml`), 'robots allows pages, hides API, links sitemap');

  // SEO / AEO entry points
  for (const [pth, needle] of [['/en', `href="${B}/en"`], ['/zh', 'lang="zh-Hans"'], ['/llms.txt', `${B}/en`], ['/sitemap.xml', `<loc>${B}/zh</loc>`], ['/favicon.svg', '<svg']]) {
    const r = await f(pth);
    const body = await r.text();
    assert.equal(r.status, 200, `serves ${pth}`);
    assert.ok(body.includes(needle) && !body.includes('%ORIGIN%'), `${pth} content`);
  }
  for (const pth of ['/en', '/zh']) {
    const ld = (await (await f(pth)).text()).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(JSON.parse(ld[1])['@graph'].some(n => n['@type'] === 'FAQPage'), `${pth} has valid FAQPage JSON-LD`);
  }

  // Search / AI answer engines may read public pages, never session or proxy
  for (const goodUa of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; GPTBot/1.0)', 'Sogou web spider/4.0', 'Mozilla/5.0 (compatible; PerplexityBot/1.0)']) {
    assert.equal((await f('/', { headers: { 'user-agent': goodUa } })).status, 200, `allows search/AI bot on /: ${goodUa}`);
    assert.equal((await f('/en', { headers: { 'user-agent': goodUa } })).status, 200, `allows search/AI bot on /en: ${goodUa}`);
    const rs = await f('/session', { method: 'POST', headers: { origin: B, 'sec-fetch-site': 'same-origin', 'user-agent': goodUa } });
    assert.equal(rs.status, 403, `blocks search/AI bot on /session: ${goodUa}`);
  }

  // Anti-crawler blocking
  for (const botUa of ['python-requests/2.31.0', 'Scrapy/2.11', 'Mozilla/5.0 (compatible; SemrushBot/7)', 'curl/8.7.1']) {
    const r = await f('/', { headers: { 'user-agent': botUa } });
    assert.equal(r.status, 403, `blocks bot UA on /: ${botUa}`);
    const rs = await f('/session', { method: 'POST', headers: { origin: B, 'sec-fetch-site': 'same-origin', 'user-agent': botUa } });
    assert.equal(rs.status, 403, `blocks bot UA on /session: ${botUa}`);
  }
  assert.equal((await f('/health', { headers: { 'user-agent': 'curl/8.7.1' } })).status, 200, '/health stays reachable for monitors');

  // Session, token UA binding, & CORS/CSRF guards
  assert.equal((await f('/proxy/ext/search?q=dracula')).status, 401, 'proxy requires bearer token');
  assert.equal((await f('/session', { method: 'POST', headers: { origin: 'http://evil.test', 'sec-fetch-site': 'cross-site' } })).status, 403, 'rejects cross-origin session');
  assert.equal((await f('/proxy/ext/search', { headers: { origin: 'http://evil.test' } })).status, 403, 'rejects bad origin');
  const BROWSER_UA = 'Mozilla/5.0 TestBrowser/1.0';
  const sRes = await f('/session', { method: 'POST', headers: { origin: B, 'sec-fetch-site': 'same-origin', 'user-agent': BROWSER_UA } });
  assert.equal(sRes.status, 200, 'issues same-origin session');
  const { token, mode } = await sRes.json();
  assert.equal(mode, 'browser-only');
  const H = { authorization: 'Bearer ' + token, 'user-agent': BROWSER_UA };

  // Replaying token with mismatched UA is rejected
  assert.equal((await f('/proxy/ext/search?q=test', { headers: { authorization: 'Bearer ' + token, 'user-agent': 'Mozilla/5.0 DifferentBrowser/2.0' } })).status, 401, 'rejects token with mismatched UA');

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

  // Verify public host allowlist, reverse-proxy client IP resolution, & 429 rate limiting
  const PROD_PORT = 47400;
  prodBridge = spawn(process.execPath, [path.join(rootDir, 'bridge.mjs')], {
    env: {
      ...process.env,
      HOME: home,
      WEBIDE_PORT: PROD_PORT,
      WEBIDE_PUBLIC_HOSTS: 'ide.example.com',
      WEBIDE_TRUST_PROXY: '1',
      WEBIDE_RL_PAGE: '2',
      WEBIDE_RL_SESSION: '2',
      WEBIDE_NOINDEX: '1',
    },
    stdio: 'pipe',
  });
  await waitReady(`http://127.0.0.1:${PROD_PORT}`);

  const badHost = await rawHttp(PROD_PORT, '/', 'GET', { host: 'evil.example.com', 'user-agent': BROWSER_UA });
  assert.equal(badHost.status, 403, 'rejects non-allowlisted public Host');

  const okHost1 = await rawHttp(PROD_PORT, '/', 'GET', { host: 'ide.example.com', 'user-agent': BROWSER_UA, 'x-real-ip': '203.0.113.10' });
  const okHost2 = await rawHttp(PROD_PORT, '/', 'GET', { host: 'ide.example.com', 'user-agent': BROWSER_UA, 'x-real-ip': '203.0.113.10' });
  const rlHit = await rawHttp(PROD_PORT, '/', 'GET', { host: 'ide.example.com', 'user-agent': BROWSER_UA, 'x-real-ip': '203.0.113.10' });
  const otherIp = await rawHttp(PROD_PORT, '/', 'GET', { host: 'ide.example.com', 'user-agent': BROWSER_UA, 'x-real-ip': '203.0.113.11' });
  assert.equal(okHost1.status, 200);
  assert.equal(okHost2.status, 200);
  assert.equal(rlHit.status, 429, 'enforces per-IP rate limit');
  assert.ok(Number(rlHit.headers['retry-after']) >= 1, 'includes Retry-After header on 429');
  assert.equal(otherIp.status, 200, 'isolates rate limit bucket by client IP');

  // Behind a TLS proxy the origin is https; WEBIDE_NOINDEX restores Disallow-all + noindex
  const prodEn = await rawHttp(PROD_PORT, '/en', 'GET', { host: 'ide.example.com', 'user-agent': BROWSER_UA, 'x-real-ip': '203.0.113.12', 'x-forwarded-proto': 'https' });
  assert.ok(prodEn.body.includes('href="https://ide.example.com/en"'), 'uses forwarded https origin');
  assert.ok(prodEn.headers['x-robots-tag'].includes('noindex'), 'NOINDEX sets noindex header');
  const prodRobots = await rawHttp(PROD_PORT, '/robots.txt', 'GET', { host: 'ide.example.com', 'user-agent': BROWSER_UA });
  assert.ok(prodRobots.body.includes('Disallow: /\n') && !prodRobots.body.includes('Sitemap'), 'NOINDEX robots disallows all');
  const prodBot = await rawHttp(PROD_PORT, '/en', 'GET', { host: 'ide.example.com', 'user-agent': 'Googlebot/2.1', 'x-real-ip': '203.0.113.13' });
  assert.equal(prodBot.status, 403, 'NOINDEX blocks search bots');
  const evilPort = await rawHttp(PROD_PORT, '/en', 'GET', { host: 'ide.example.com:"><x', 'user-agent': BROWSER_UA, 'x-real-ip': '203.0.113.14' });
  assert.ok(!evilPort.body.includes('"><x'), 'Host port is not echoed into HTML');

  // Verify ZERO files/folders were created on the server (stateless host)
  assert.deepEqual(fs.readdirSync(home), [], 'server never writes user files or state to disk');

  console.log('OK: stateless browser-local bridge self-check passed');
} finally {
  bridge.kill();
  prodBridge?.kill();
  fs.rmSync(home, { recursive: true, force: true });
}
