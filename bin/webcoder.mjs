#!/usr/bin/env node
// webcoder CLI — one-command launcher for the WebIDE (option (a): distribution).
//
//   webcoder [start] [--port N] [--no-open]   start in background, open the browser
//   webcoder status                           is it running? where?
//   webcoder stop                             stop the background instance
//   webcoder update                           update (git pull in a checkout,
//                                             npm install -g when installed globally)
//   webcoder --version / --help
//
// The server (bridge.mjs) stays stateless; this launcher only manages a local
// background process and remembers { pid, port, url } in ~/.webcoder/run.json.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));
const STATE_DIR = path.join(os.homedir(), '.webcoder');
const STATE_FILE = path.join(STATE_DIR, 'run.json');
const LOG_FILE = path.join(STATE_DIR, 'bridge.log');
const BASE_PORT = 47321;

const argv = process.argv.slice(2);
const cmd = ['start', 'status', 'stop', 'update'].includes(argv[0]) ? argv[0] : 'start';
const flag = name => argv.includes('--' + name);
const optVal = name => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : null; };

if (flag('version') || argv[0] === '--version' || argv[0] === '-v') { console.log(PKG.version); process.exit(0); }
if (flag('help') || argv[0] === 'help') {
  console.log(`webcoder ${PKG.version} — Open. Private. Light WebIDE\n\nUsage:\n  webcoder [start] [--port N] [--no-open]  Start in the background and open the browser\n  webcoder status                          Show whether the IDE is running and its URL\n  webcoder stop                            Stop the background instance\n  webcoder update                          Update to the latest version\n  webcoder --version                       Print the version`);
  process.exit(0);
}

const readState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; } };
const writeState = s => { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); };
const clearState = () => { try { fs.rmSync(STATE_FILE); } catch {} };
const pidAlive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function healthy(port, timeoutMs = 1500) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(`http://127.0.0.1:${port}/health`, { signal: ctl.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}
async function waitHealthy(port, tries = 100) {
  for (let i = 0; i < tries; i++) { if (await healthy(port, 800)) return true; await sleep(100); }
  return false;
}
function portFree(port) {
  return new Promise(res => {
    const s = net.createServer();
    s.once('error', () => res(false));
    s.listen(port, '127.0.0.1', () => s.close(() => res(true)));
  });
}
async function findPort(wanted) {
  if (wanted) {
    if (await portFree(wanted)) return wanted;
    throw new Error(`Port ${wanted} is already in use. Omit --port to auto-pick a free one.`);
  }
  for (let p = BASE_PORT; p < BASE_PORT + 50; p++) if (await portFree(p)) return p;
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.once('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
function openBrowser(url) {
  try {
    const [bin, args] = process.platform === 'darwin' ? ['open', [url]]
      : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
    spawn(bin, args, { detached: true, stdio: 'ignore' }).unref();
  } catch { /* opening the browser is best-effort; the URL is printed anyway */ }
}

async function currentRunning() {
  const s = readState();
  if (!s) return null;
  if (!pidAlive(s.pid) || !(await healthy(s.port))) { clearState(); return null; }
  return s;
}

async function doStart() {
  const running = await currentRunning();
  if (running) {
    console.log(`WebIDE is already running: ${running.url} (pid ${running.pid})`);
    if (!flag('no-open') && !process.env.WEBIDE_NO_OPEN) openBrowser(running.url);
    return;
  }
  const port = await findPort(optVal('port') ? Number(optVal('port')) : null);
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const log = fs.openSync(LOG_FILE, 'a');
  const child = spawn(process.execPath, [path.join(PKG_ROOT, 'bridge.mjs')], {
    cwd: PKG_ROOT,
    detached: true,
    env: { ...process.env, WEBIDE_PORT: String(port) },
    stdio: ['ignore', log, log],
  });
  child.unref();
  const state = { pid: child.pid, port, url: `http://127.0.0.1:${port}/`, startedAt: new Date().toISOString(), version: PKG.version };
  writeState(state);
  if (!(await waitHealthy(port))) {
    clearState();
    console.error(`WebIDE failed to start. Log: ${LOG_FILE}`);
    process.exit(1);
  }
  console.log(`WebIDE ${PKG.version} running: ${state.url} (pid ${child.pid})`);
  console.log('Stop it with: webcoder stop');
  if (!flag('no-open') && !process.env.WEBIDE_NO_OPEN) openBrowser(state.url);
}

async function doStatus() {
  const s = await currentRunning();
  if (!s) { console.log('WebIDE is not running. Start it with: webcoder start'); return; }
  const up = Math.max(0, Math.round((Date.now() - Date.parse(s.startedAt)) / 1000));
  console.log(`WebIDE ${s.version} running: ${s.url} (pid ${s.pid}, up ${up}s)`);
}

async function doStop() {
  const s = readState();
  if (!s || !pidAlive(s.pid)) { clearState(); console.log('WebIDE is not running.'); return; }
  process.kill(s.pid, 'SIGTERM');
  for (let i = 0; i < 50 && pidAlive(s.pid); i++) await sleep(100);
  if (pidAlive(s.pid)) process.kill(s.pid, 'SIGKILL');
  clearState();
  console.log(`WebIDE stopped (pid ${s.pid}).`);
}

function doUpdate() {
  const running = readState();
  if (fs.existsSync(path.join(PKG_ROOT, '.git'))) {
    console.log('Updating from the git checkout…');
    const r = spawnSync('git', ['-C', PKG_ROOT, 'pull', '--ff-only'], { stdio: 'inherit' });
    if (r.status !== 0) { console.error('git pull failed; resolve it in the checkout, then retry.'); process.exit(r.status || 1); }
  } else {
    let globalRoot = '';
    try { globalRoot = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(); } catch {}
    if (globalRoot && path.resolve(globalRoot, PKG.name) === PKG_ROOT) {
      console.log('Updating the global npm install…');
      const r = spawnSync('npm', ['install', '-g', `${PKG.name}@latest`], { stdio: 'inherit', shell: process.platform === 'win32' });
      if (r.status !== 0) { console.error('npm update failed.'); process.exit(r.status || 1); }
    } else {
      console.log('This install is neither a git checkout nor a global npm install.');
      console.log(`To update an npx run, just use the latest: npx ${PKG.name}@latest`);
      return;
    }
  }
  console.log('Update complete.' + (running && pidAlive(running.pid) ? ' Restart to apply: webcoder stop && webcoder start' : ''));
}

try {
  if (cmd === 'start') await doStart();
  else if (cmd === 'status') await doStatus();
  else if (cmd === 'stop') await doStop();
  else if (cmd === 'update') doUpdate();
} catch (e) {
  console.error('webcoder: ' + (e.message || e));
  process.exit(1);
}
