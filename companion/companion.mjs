#!/usr/bin/env node
// WebIDE local companion — OPTIONAL, user-run execution layer (step 3).
//
// The WebIDE server (bridge.mjs) stays 100% stateless and never executes anything.
// This companion is a separate program the user runs on their OWN machine; it is
// the only component that can touch a real shell, real git and a real folder.
// It is never started by the IDE or the server: the user launches it explicitly,
// it binds to loopback only, serves exactly one root folder chosen at launch,
// and every request requires the pairing token printed at startup.
//
//   node companion/companion.mjs --root ~/my-project [--port 47399] [--agent-cmd "pi --acp"]
//
// Zero dependencies (Node >= 18, built-ins only). Terminal sessions use a real
// PTY when the optional `node-pty` package is importable, and fall back to
// plain pipes otherwise (no job control / no interactive full-screen apps in
// pipe mode, but shells, git and build tools work).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : dflt; };
const ROOT = fs.realpathSync(path.resolve(opt('root', process.cwd())));
const PORT = Number(opt('port', '47399'));
const TOKEN = opt('token', crypto.randomBytes(24).toString('hex'));
const SHELL = opt('shell', process.platform === 'win32' ? 'cmd.exe' : (process.env.SHELL || '/bin/sh'));
const AGENT_CMD = opt('agent-cmd', '');
const EXTRA_ORIGINS = (opt('origins', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const MAX_READ = 10 * 1024 * 1024, MAX_WRITE = 20 * 1024 * 1024, MAX_OUT = 4 * 1024 * 1024;

if (!fs.statSync(ROOT).isDirectory()) { console.error(`--root is not a directory: ${ROOT}`); process.exit(1); }

const tokenOk = given => {
  if (!given) return false;
  const a = Buffer.from(String(given)), b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const originOk = origin => {
  if (!origin) return true; // non-browser client (curl/tests): token still required
  if (EXTRA_ORIGINS.includes(origin)) return true;
  try { const u = new URL(origin); return (u.hostname === '127.0.0.1' || u.hostname === 'localhost') && (u.protocol === 'http:' || u.protocol === 'https:'); }
  catch { return false; }
};
// Resolve a client-supplied relative path inside ROOT; rejects escapes and
// symlink breakouts (for paths that already exist).
function safePath(rel = '') {
  const clean = String(rel).replace(/\\/g, '/').replace(/^\/+/, '');
  const abs = path.resolve(ROOT, clean);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) throw Object.assign(new Error('Path escapes the companion root.'), { status: 403 });
  if (fs.existsSync(abs)) {
    const real = fs.realpathSync(abs);
    if (real !== ROOT && !real.startsWith(ROOT + path.sep)) throw Object.assign(new Error('Path escapes the companion root via symlink.'), { status: 403 });
  }
  return abs;
}
const relOf = abs => path.relative(ROOT, abs).split(path.sep).join('/');

function sendJson(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': body.length });
  res.end(body);
}
async function readBody(req, cap = MAX_WRITE + 1024) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > cap) throw Object.assign(new Error('Request body too large.'), { status: 413 }); chunks.push(c); }
  return Buffer.concat(chunks);
}
const readJson = async req => { const b = await readBody(req); return b.length ? JSON.parse(b.toString('utf8')) : {}; };

function run(cmd, argv, { cwd = ROOT, timeoutMs = 30000, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, { cwd, env: { ...process.env, ...env }, shell: false });
    let out = Buffer.alloc(0), err = Buffer.alloc(0), done = false;
    const timer = setTimeout(() => { if (!done) { done = true; child.kill('SIGKILL'); resolve({ code: -1, stdout: out.toString('utf8'), stderr: err.toString('utf8') + '\n[killed: timeout]' }); } }, Math.min(timeoutMs, 120000));
    child.stdout.on('data', d => { if (out.length < MAX_OUT) out = Buffer.concat([out, d]).subarray(0, MAX_OUT); });
    child.stderr.on('data', d => { if (err.length < MAX_OUT) err = Buffer.concat([err, d]).subarray(0, MAX_OUT); });
    child.on('error', e => { if (!done) { done = true; clearTimeout(timer); reject(e); } });
    child.on('close', code => { if (!done) { done = true; clearTimeout(timer); resolve({ code: code ?? -1, stdout: out.toString('utf8'), stderr: err.toString('utf8') }); } });
  });
}

// ---------- minimal WebSocket server (RFC 6455, text/binary + ping/pong/close) ----------
function wsAccept(key) { return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64'); }
function wsEncode(data, opcode = 1) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.from([0x80 | opcode, len]); }
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}
function wsHandle(socket, handlers) {
  const onMessage = text => handlers.onMessage?.(text);
  const onClose = () => handlers.onClose?.();
  let buf = Buffer.alloc(0), frags = [], fragOp = 1;
  const send = (data, opcode) => { try { socket.write(wsEncode(data, opcode)); } catch {} };
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = !!(buf[0] & 0x80), op = buf[0] & 0x0f, masked = !!(buf[1] & 0x80);
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const maskAt = off; if (masked) off += 4;
      if (buf.length < off + len) return;
      let payload = buf.subarray(off, off + len);
      if (masked) { const m = buf.subarray(maskAt, maskAt + 4); payload = Buffer.from(payload.map((b, i) => b ^ m[i % 4])); }
      buf = buf.subarray(off + len);
      if (op === 8) { send('', 8); socket.end(); onClose?.(); return; }
      if (op === 9) { send(payload, 10); continue; }
      if (op === 10) continue;
      if (!fin) { if (!frags.length) fragOp = op; frags.push(payload); continue; }
      if (frags.length) { frags.push(payload); payload = Buffer.concat(frags); frags = []; op === 0 && (op = fragOp); }
      onMessage(payload.toString('utf8'));
    }
  });
  socket.on('error', () => onClose?.());
  socket.on('close', () => onClose?.());
  return { send: (text) => send(text, 1), close: () => { send('', 8); socket.end(); } };
}

let ptyMod = null, ptyTried = false;
async function getPty() {
  if (!ptyTried) { ptyTried = true; try { ptyMod = await import('node-pty'); } catch { ptyMod = null; } }
  return ptyMod;
}

async function handleTerm(socket, req) {
  const handlers = { onMessage: null, onClose: () => cleanup() };
  const ws = wsHandle(socket, handlers);
  let cleaned = false, write = () => {}, kill = () => {}, resize = () => {};
  function cleanup() { if (!cleaned) { cleaned = true; kill(); } }
  const pty = await getPty();
  if (pty) {
    const proc = pty.spawn(SHELL, [], { name: 'xterm-color', cols: 80, rows: 24, cwd: ROOT, env: process.env });
    proc.onData(d => ws.send(JSON.stringify({ t: 'o', d })));
    proc.onExit(({ exitCode }) => { ws.send(JSON.stringify({ t: 'x', code: exitCode })); ws.close(); });
    write = d => proc.write(d);
    kill = () => { try { proc.kill(); } catch {} };
    resize = (c, r) => { try { proc.resize(c, r); } catch {} };
  } else {
    const child = spawn(SHELL, [], { cwd: ROOT, env: process.env, shell: false });
    child.stdout.on('data', d => ws.send(JSON.stringify({ t: 'o', d: d.toString('utf8') })));
    child.stderr.on('data', d => ws.send(JSON.stringify({ t: 'o', d: d.toString('utf8') })));
    child.on('close', code => { ws.send(JSON.stringify({ t: 'x', code: code ?? -1 })); ws.close(); });
    write = d => { try { child.stdin.write(d); } catch {} };
    kill = () => { try { child.kill('SIGKILL'); } catch {} };
    ws.send(JSON.stringify({ t: 'o', d: '\r\n[companion: node-pty not installed — pipe mode (no interactive full-screen apps)]\r\n' }));
  }
  handlers.onMessage = text => {
    let m; try { m = JSON.parse(text); } catch { return; }
    if (m.t === 'i') write(m.d || '');
    else if (m.t === 'r') resize(m.c || 80, m.r || 24);
  };
}

function handleAcp(socket) {
  if (!AGENT_CMD) { socket.destroy(); return; }
  const parts = AGENT_CMD.split(' ').filter(Boolean);
  const child = spawn(parts[0], parts.slice(1), { cwd: ROOT, env: process.env, shell: false });
  const ws = wsHandle(socket, { onMessage: text => { try { child.stdin.write(text.endsWith('\n') ? text : text + '\n'); } catch {} }, onClose: () => { try { child.kill('SIGKILL'); } catch {} } });
  let buf = '';
  child.stdout.on('data', d => {
    buf += d.toString('utf8');
    let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) ws.send(line); }
  });
  child.stderr.on('data', () => {});
  child.on('close', () => ws.close());
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const origin = req.headers.origin || '';
  if (!originOk(origin)) return sendJson(res, 403, { error: 'Origin not allowed.' });
  if (origin) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-headers', 'authorization, content-type');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('vary', 'Origin');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    if (u.pathname === '/health') return sendJson(res, 200, { ok: true, name: 'webide-companion', version: 1, pty: !!(await getPty().catch(() => null)) || undefined, agent: !!AGENT_CMD });
    if (!tokenOk((req.headers.authorization || '').replace(/^Bearer\s+/i, ''))) return sendJson(res, 401, { error: 'Pairing token required.' });
    if (u.pathname === '/fs/list' && req.method === 'GET') {
      const abs = safePath(u.searchParams.get('path') || '');
      const entries = fs.readdirSync(abs, { withFileTypes: true })
        .filter(e => e.name !== '.git')
        .map(e => ({ name: e.name, dir: e.isDirectory() })).sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name));
      return sendJson(res, 200, { path: relOf(abs), entries });
    }
    if (u.pathname === '/fs/read' && req.method === 'GET') {
      const abs = safePath(u.searchParams.get('path') || '');
      const st = fs.statSync(abs);
      if (!st.isFile()) return sendJson(res, 400, { error: 'Not a file.' });
      if (st.size > MAX_READ) return sendJson(res, 413, { error: 'File too large for companion read (10 MB).' });
      const data = fs.readFileSync(abs);
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': data.length });
      return res.end(data);
    }
    if (u.pathname === '/fs/write' && req.method === 'POST') {
      const { path: rel, content } = await readJson(req);
      const data = Buffer.from(content || '', 'base64');
      if (data.length > MAX_WRITE) return sendJson(res, 413, { error: 'Write too large (20 MB).' });
      const abs = safePath(rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, data);
      return sendJson(res, 200, { ok: true, size: data.length });
    }
    if (u.pathname === '/fs/mkdir' && req.method === 'POST') {
      const { path: rel } = await readJson(req);
      fs.mkdirSync(safePath(rel), { recursive: true });
      return sendJson(res, 200, { ok: true });
    }
    if (u.pathname === '/fs/delete' && req.method === 'POST') {
      const { path: rel } = await readJson(req);
      const abs = safePath(rel);
      if (abs === ROOT) return sendJson(res, 400, { error: 'Refusing to delete the companion root.' });
      fs.rmSync(abs, { recursive: true, force: true });
      return sendJson(res, 200, { ok: true });
    }
    if (u.pathname === '/exec' && req.method === 'POST') {
      const { cmd, args: argv = [], cwd = '', timeoutMs = 30000, shell = false } = await readJson(req);
      if (!cmd || typeof cmd !== 'string') return sendJson(res, 400, { error: 'cmd required.' });
      if (shell) {
        const r = await run(process.platform === 'win32' ? 'cmd.exe' : '/bin/sh', [process.platform === 'win32' ? '/c' : '-c', cmd], { cwd: safePath(cwd), timeoutMs });
        return sendJson(res, 200, r);
      }
      const r = await run(cmd, Array.isArray(argv) ? argv.map(String) : [], { cwd: safePath(cwd), timeoutMs });
      return sendJson(res, 200, r);
    }
    if (u.pathname === '/git' && req.method === 'POST') {
      const { args: argv = [], cwd = '' } = await readJson(req);
      const r = await run('git', (Array.isArray(argv) ? argv : []).map(String), { cwd: safePath(cwd), timeoutMs: 60000 });
      return sendJson(res, 200, r);
    }
    return sendJson(res, 404, { error: 'Unknown endpoint.' });
  } catch (e) {
    return sendJson(res, e.status || 500, { error: e.message || 'Companion error.' });
  }
});

server.on('upgrade', (req, socket) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (!originOk(req.headers.origin || '') || !tokenOk(u.searchParams.get('token') || '')) { socket.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + wsAccept(key) + '\r\n\r\n');
  if (u.pathname === '/term') handleTerm(socket, req).catch(() => socket.destroy());
  else if (u.pathname === '/acp') handleAcp(socket);
  else socket.destroy();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('WebIDE companion listening on http://127.0.0.1:' + PORT);
  console.log('Root folder : ' + ROOT);
  console.log('Pairing token: ' + TOKEN);
  console.log('In WebIDE: Command Palette → "Companion: Connect…" → paste the URL and token.');
  console.log('Stop with Ctrl+C. Nothing here is reachable from the network (loopback only).');
});
