#!/usr/bin/env node
// WebIDE bridge: runs on the user's machine, listens on 127.0.0.1 only.
//   node bridge.mjs --install   register the webide:// URL scheme (macOS, Windows)
//   node bridge.mjs --url <u>   what the URL scheme runs: start (or reuse) the bridge, hand over the nonce
//   node bridge.mjs             run the bridge directly
import http from 'node:http';
import { spawn, execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const PORT = +process.env.WEBIDE_PORT || 47321;
const HOST = '127.0.0.1';
// ponytail: origin of the hosted launch page; set WEBIDE_ORIGINS to the real domain when deployed
const ORIGINS = (process.env.WEBIDE_ORIGINS || 'http://localhost:8000').split(',');
const SELF = fileURLToPath(import.meta.url);
const HOME = os.homedir();
const STATE = path.join(HOME, '.webide', 'state.json');
const EXT_DIR = path.join(HOME, '.webide', 'extensions');
const EXT_STATE = path.join(HOME, '.webide', 'extensions.json');
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
// Agents are spawned by id only; the browser never sends a command line.
const AGENTS = {
  gemini: ['gemini', '--acp'],
  codex: ['codex-acp'],
  claude: ['claude-agent-acp'],
  ...readJSON(path.join(HOME, '.webide', 'agents.json')),
  ...JSON.parse(process.env.WEBIDE_AGENTS || '{}'),
};

class HttpErr extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const inside = (base, p) => p === base || p.startsWith(base + path.sep);
// .native returns the on-disk spelling (drive letter / case on Windows), so prefix checks compare like with like.
const real = p => fs.realpathSync.native(p);
const IS_WIN = process.platform === 'win32';

const TOKEN = crypto.randomBytes(32).toString('hex');
const nonces = new Map(); // one-time, 60s, handed over by the URL-scheme launch
let root = null;
let projects = [];
let last = Date.now();
let streams = 0; // open /fs/watch streams = an IDE tab is open
const sessions = new Map();

function saveState() {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify({ root, projects }));
}
function checkProjectDir(p) {
  const dir = real(p);
  if (!fs.statSync(dir).isDirectory() || !inside(real(HOME), dir)) throw new HttpErr(403, 'root must be a folder under your home directory');
  return dir;
}
function setProjects(list = []) {
  projects = [...new Set((Array.isArray(list) ? list : []).map(x => { try { return checkProjectDir(x); } catch { return null; } }).filter(Boolean))];
  if (root && !projects.includes(root)) projects.push(root);
  saveState();
  return projects;
}
function setRoot(p, nextProjects) {
  if (p == null) root = null;
  else root = checkProjectDir(p);
  if (Array.isArray(nextProjects)) setProjects(nextProjects);
  else {
    if (root && !projects.includes(root)) projects.push(root);
    saveState();
  }
}

function safe(rel = '') {
  if (!root) throw new HttpErr(409, 'no workspace selected');
  // Resolve the nearest existing ancestor (lstat: a dangling symlink counts as existing, and realpath then rejects it),
  // so not-yet-created paths like "a/b/new.txt" are still checked against the real root.
  let existing = path.resolve(root, rel);
  const rest = [];
  for (;;) {
    try { fs.lstatSync(existing); break; } catch { rest.unshift(path.basename(existing)); existing = path.dirname(existing); }
  }
  const full = path.join(real(existing), ...rest);
  if (!inside(root, full)) throw new HttpErr(403, 'outside workspace');
  return full;
}

// Every regular file under the workspace (Quick Open, Find in Files). Symlinks are not followed: no loops, no escapes.
const SKIP = new Set(['.git', 'node_modules', '__pycache__', '.venv', 'venv', '.DS_Store']);
function listFiles(max = 20000) { // ponytail: plain walk with a cap; use `rg --files` / .gitignore when repos get huge
  const files = [];
  const walk = (dir, rel) => {
    let list;
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      if (files.length >= max) return;
      if (SKIP.has(e.name)) continue;
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
      else if (e.isFile()) files.push(r);
    }
  };
  walk(safe(''), '');
  return { files, truncated: files.length >= max };
}

// An existing entry itself (not what a symlink points to), for rename/delete. The workspace root is off-limits.
function entry(rel = '') {
  const f = path.join(safe(path.dirname(rel)), path.basename(rel));
  if (f === root || !inside(root, f)) throw new HttpErr(403, 'not allowed on the workspace root');
  fs.lstatSync(f); // ENOENT -> 404
  return f;
}

// Delete = move to the OS trash, so a mis-click is recoverable.
function trash(f) {
  if (IS_WIN) {
    const kind = fs.lstatSync(f).isDirectory() ? 'DeleteDirectory' : 'DeleteFile';
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::${kind}($env:WEBIDE_TRASH, 'OnlyErrorDialogs', 'SendToRecycleBin')`],
    { env: { ...process.env, WEBIDE_TRASH: f }, stdio: 'ignore', windowsHide: true }); // path via env: no quoting/injection
    return;
  }
  const bin = process.platform === 'darwin' ? path.join(HOME, '.Trash') : path.join(HOME, '.local', 'share', 'Trash', 'files');
  fs.mkdirSync(bin, { recursive: true });
  let dest = path.join(bin, path.basename(f));
  if (fs.existsSync(dest)) dest += ' ' + new Date().toISOString().replace(/[:.]/g, '-');
  // ponytail: same-volume move only (EXDEV on other disks), and no Finder "Put Back" metadata
  fs.renameSync(f, dest);
}

function startAgent(id) {
  const cmd = AGENTS[id];
  if (!cmd) throw new HttpErr(404, 'unknown agent');
  if (!root) throw new HttpErr(409, 'no workspace selected');
  // Windows: npm-installed CLIs are .cmd shims, which Node only runs through a shell.
  // ponytail: args are joined unquoted there; fine for the simple commands in agents.json
  const s = { lines: [], clients: new Set(), proc: spawn(cmd[0], cmd.slice(1), { cwd: root, shell: IS_WIN, windowsHide: true }) };
  s.proc.stdin.on('error', () => {});
  // ponytail: lines are kept for replay and never trimmed; cap or spill to disk for very long sessions
  const push = o => {
    s.lines.push(o);
    for (const c of s.clients) c.write(`id: ${s.lines.length - 1}\ndata: ${JSON.stringify(o)}\n\n`);
  };
  let buf = '';
  s.proc.stdout.setEncoding('utf8');
  s.proc.stdout.on('data', d => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!l) continue;
      try { push(JSON.parse(l)); } catch { push({ log: l }); }
    }
  });
  s.proc.stderr.on('data', d => push({ log: String(d) }));
  s.proc.on('error', e => { push({ log: `spawn failed: ${e.message}` }); push({ exit: -1 }); for (const c of s.clients) c.end(); });
  s.proc.on('close', code => { push({ exit: code }); for (const c of s.clients) c.end(); });
  const sid = crypto.randomUUID();
  sessions.set(sid, s);
  return sid;
}

// ---------- terminals ----------
// A real PTY from Node's stdlib alone: `script` (macOS/Linux) allocates one. `cat |` gives script a plain pipe as stdin
// (macOS script refuses the socketpair Node uses), and the inner sh reports the pty's name on fd 3 so stty can resize it.
// ponytail: Windows has no `script`; it gets cmd.exe over plain pipes (line mode, no full-screen programs). ConPTY needs a native addon.
const terms = new Map();
const dim = (n, d, max) => Math.max(2, Math.min(max, n | 0 || d));
function resizeTty(t, rows, cols) {
  execFile('stty', [process.platform === 'darwin' ? '-f' : '-F', t.tty, 'rows', String(dim(rows, 24, 300)), 'cols', String(dim(cols, 80, 500))], () => {});
}
function startTerm(cols, rows) {
  if (!root) throw new HttpErr(409, 'no workspace selected');
  cols = dim(cols, 80, 500); rows = dim(rows, 24, 300);
  const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'WebIDE' };
  let proc;
  if (IS_WIN) proc = spawn(process.env.ComSpec || 'cmd.exe', ['/K', 'chcp 65001>nul'], { cwd: root, env, windowsHide: true });
  else {
    env.WEBIDE_SH = process.env.SHELL || '/bin/sh';
    const inner = `tty >&3; exec 3>&-; stty rows ${rows} cols ${cols}; exec "$WEBIDE_SH" -l`;
    // When the shell exits, `kill 0` takes the waiting `cat` down too (its own process group, see detached).
    const outer = process.platform === 'darwin' ? 'cat | (script -q /dev/null /bin/sh -c "$0"; kill 0)' : 'cat | (script -qfec "$0" /dev/null; kill 0)';
    proc = spawn('/bin/sh', ['-c', outer, inner], { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe', 'pipe'] });
    proc.stdio[3].on('data', d => {
      t.tty = String(d).trim();
      if (t.tty && t.pendingSize) { resizeTty(t, t.pendingSize.rows, t.pendingSize.cols); t.pendingSize = null; }
    });
  }
  const t = { proc, pty: !IS_WIN, tty: null, pendingSize: null, out: '', client: null, everAttached: false, done: false };
  proc.stdin.on('error', () => {});
  const push = d => { if (t.client) t.client.write(`data: ${JSON.stringify(d)}\n\n`); else t.out = (t.out + d).slice(-50_000); };
  proc.stdout.setEncoding('utf8'); proc.stderr.setEncoding('utf8');
  proc.stdout.on('data', push); proc.stderr.on('data', push);
  proc.on('error', e => push(`\r\n${e.message}\r\n`));
  proc.on('close', () => { t.done = true; terms.delete(id); t.client?.end('event: exit\ndata: 0\n\n'); });
  const id = crypto.randomUUID();
  terms.set(id, t);
  setTimeout(() => { if (!t.everAttached) killTerm(t); }, 15_000).unref(); // the page never attached
  return { id, pty: t.pty, name: IS_WIN ? 'cmd' : path.basename(process.env.SHELL || 'sh') };
}
function killTerm(t) {
  if (t.done) return;
  if (IS_WIN) execFile('taskkill', ['/pid', String(t.proc.pid), '/T', '/F'], () => {});
  else try { process.kill(-t.proc.pid, 'SIGHUP'); } catch { /* already gone */ } // the whole group: sh, cat, script (the shell then gets SIGHUP from its pty)
}

const body = (req, max = 10e6) => new Promise((ok, no) => {
  const parts = []; let n = 0; // join bytes, then decode: a multi-byte character can straddle two chunks
  req.on('data', c => { parts.push(c); n += c.length; if (n > max) { no(new HttpErr(413, 'too large')); req.destroy(); } });
  req.on('end', () => ok(Buffer.concat(parts).toString('utf8')));
});
const bodyJSON = async (req, max = 5000) => { try { return JSON.parse(await body(req, max)); } catch (e) { if (e instanceof HttpErr) throw e; throw new HttpErr(400, 'bad json'); } };

// ---------- git / GitHub local bridge (uses user's existing git CLI, SSH keys & credential helpers) ----------
const gitRun = (args, cwd = root) => new Promise((ok, no) => {
  if (!cwd) return no(new HttpErr(409, 'no workspace selected'));
  execFile('git', ['-c', 'core.quotePath=false', ...args], {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    windowsHide: true,
  }, (err, stdout, stderr) => {
    if (err) return no(new HttpErr(400, (stderr || stdout || err.message).trim()));
    ok({ stdout, stderr });
  });
});
const gitTry = async (args, cwd = root) => { try { return (await gitRun(args, cwd)).stdout; } catch { return null; } };
function normRepoUrl(raw = '') {
  const s = String(raw).trim();
  if (!s || s.startsWith('-') || /^ext::|^fd::|^file:/i.test(s)) throw new HttpErr(400, 'invalid repository URL');
  if (/^[\w.-]+\/[\w.-]+$/.test(s)) return `https://github.com/${s}.git`;
  if (/^(https?:\/\/|ssh:\/\/|git@[\w.-]+:)/i.test(s)) return s;
  throw new HttpErr(400, 'use owner/repo, https://, ssh://, or git@... URL');
}
function parseGithubRemote(url = '') {
  const m = url.trim().match(/(?:github\.com[/:])([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i);
  return m ? { slug: m[1], githubUrl: `https://github.com/${m[1]}` } : { slug: null, githubUrl: null };
}
async function gitStatus() {
  if (!root) throw new HttpErr(409, 'no workspace selected');
  const insideRepo = (await gitTry(['rev-parse', '--is-inside-work-tree']))?.trim() === 'true';
  if (!insideRepo) return { isRepo: false };
  const raw = (await gitRun(['status', '--porcelain=v2', '--branch', '-z', '-uall'])).stdout;
  let branch = '', upstream = null, ahead = 0, behind = 0, initial = false;
  const staged = [], unstaged = [];
  const tokens = raw.split('\0');
  for (let i = 0; i < tokens.length; i++) {
    const rec = tokens[i];
    if (!rec) continue;
    if (rec.startsWith('# branch.oid ')) initial = rec.slice(13) === '(initial)';
    else if (rec.startsWith('# branch.head ')) branch = rec.slice(14);
    else if (rec.startsWith('# branch.upstream ')) upstream = rec.slice(18);
    else if (rec.startsWith('# branch.ab ')) {
      const m = rec.match(/\+(\d+)\s+-(\d+)/);
      if (m) { ahead = +m[1]; behind = +m[2]; }
    } else if (rec.startsWith('? ')) {
      unstaged.push({ path: rec.slice(2), status: 'U', untracked: true });
    } else if (rec.startsWith('1 ')) {
      const m = rec.match(/^1 (.)(.) (?:\S+ ){6}(.+)$/);
      if (!m) continue;
      if (m[1] !== '.') staged.push({ path: m[3], status: m[1] });
      if (m[2] !== '.') unstaged.push({ path: m[3], status: m[2] });
    } else if (rec.startsWith('2 ')) {
      const m = rec.match(/^2 (.)(.) (?:\S+ ){7}(.+)$/);
      const origPath = tokens[++i];
      if (!m) continue;
      if (m[1] !== '.') staged.push({ path: m[3], status: m[1], origPath });
      if (m[2] !== '.') unstaged.push({ path: m[3], status: m[2] });
    } else if (rec.startsWith('u ')) {
      const m = rec.match(/^u (.)(.) (?:\S+ ){8}(.+)$/);
      if (m) unstaged.push({ path: m[3], status: '!', conflict: true });
    }
  }
  const brRaw = (await gitTry(['branch', '--format=%(refname:short)'])) || '';
  const branches = brRaw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const remRaw = (await gitTry(['remote', '-v'])) || '';
  let remote = null;
  for (const line of remRaw.split(/\r?\n/)) {
    const m = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
    if (!m) continue;
    if (!remote || m[1] === 'origin') remote = { name: m[1], url: m[2], ...parseGithubRemote(m[2]) };
    if (m[1] === 'origin') break;
  }
  const userName = (await gitTry(['config', 'user.name']))?.trim() || '';
  const userEmail = (await gitTry(['config', 'user.email']))?.trim() || '';
  return { isRepo: true, initial, branch, upstream, ahead, behind, branches, remote, user: { name: userName, email: userEmail }, staged, unstaged };
}
async function gitDiff(rel, isStaged) {
  const f = safe(rel);
  const gitRel = rel.split(path.sep).join('/');
  if (isStaged) {
    const original = (await gitTry(['show', `HEAD:${gitRel}`])) ?? '';
    const modified = (await gitTry(['show', `:${gitRel}`])) ?? '';
    return { original, modified };
  }
  const original = (await gitTry(['show', `:${gitRel}`])) ?? '';
  let modified = '';
  try {
    const st = fs.statSync(f);
    if (st.size > 5e6) throw new HttpErr(413, 'file too large');
    const buf = fs.readFileSync(f);
    if (buf.includes(0)) throw new HttpErr(415, 'binary file');
    modified = buf.toString('utf8');
  } catch (e) { if (e instanceof HttpErr) throw e; if (e.code !== 'ENOENT') throw e; }
  return { original, modified };
}
function gitPaths(paths) {
  if (!Array.isArray(paths) || !paths.length) return [];
  return paths.map(rel => { safe(rel); return String(rel).split(path.sep).join('/'); });
}

// ---------- VS Code extension marketplace & VSIX local runtime bridge ----------
function parseJsonc(raw) {
  const s = String(raw || '').replace(/^\uFEFF/, '');
  let out = '', i = 0, inStr = false, esc = false;
  while (i < s.length) {
    const c = s[i], n = s[i + 1];
    if (inStr) {
      out += c;
      if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false;
      i++;
    } else if (c === '"') { inStr = true; out += c; i++; }
    else if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') i++; }
    else if (c === '/' && n === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; }
    else { out += c; i++; }
  }
  let clean = ''; inStr = false; esc = false;
  for (let j = 0; j < out.length; j++) {
    const c = out[j];
    if (inStr) {
      clean += c;
      if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false;
    } else if (c === '"') { inStr = true; clean += c; }
    else if (c === ',') {
      let k = j + 1; while (k < out.length && /\s/.test(out[k])) k++;
      if (out[k] === '}' || out[k] === ']') continue;
      clean += c;
    } else clean += c;
  }
  return JSON.parse(clean);
}
function extractZip(buf, destDir) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new HttpErr(400, 'invalid VSIX archive');
  const count = buf.readUInt16LE(eocd + 10);
  let cd = buf.readUInt32LE(eocd + 16);
  if (cd === 0xffffffff || count > 5000) throw new HttpErr(400, 'unsupported VSIX archive');
  fs.mkdirSync(destDir, { recursive: true });
  const realDest = real(destDir);
  let totalBytes = 0;
  for (let idx = 0; idx < count; idx++) {
    if (cd + 46 > buf.length || buf.readUInt32LE(cd) !== 0x02014b50) throw new HttpErr(400, 'corrupt VSIX directory');
    const method = buf.readUInt16LE(cd + 10);
    const compSize = buf.readUInt32LE(cd + 20);
    const nameLen = buf.readUInt16LE(cd + 28);
    const extraLen = buf.readUInt16LE(cd + 30);
    const commentLen = buf.readUInt16LE(cd + 32);
    const localOff = buf.readUInt32LE(cd + 42);
    const name = buf.subarray(cd + 46, cd + 46 + nameLen).toString('utf8');
    cd += 46 + nameLen + extraLen + commentLen;
    if (!name || name.endsWith('/')) continue;
    const outPath = path.resolve(realDest, name);
    if (!inside(realDest, outPath)) throw new HttpErr(403, 'unsafe path in VSIX');
    if (localOff + 30 > buf.length || buf.readUInt32LE(localOff) !== 0x04034b50) throw new HttpErr(400, 'corrupt VSIX entry');
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    const raw = method === 0 ? comp : method === 8 ? zlib.inflateRawSync(comp) : null;
    if (!raw) throw new HttpErr(400, `unsupported VSIX compression (${method})`);
    totalBytes += raw.length;
    if (totalBytes > 120 * 1024 * 1024) throw new HttpErr(413, 'extracted VSIX too large');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, raw);
  }
}
function extDisabledSet() {
  const st = readJSON(EXT_STATE);
  return new Set(Array.isArray(st.disabled) ? st.disabled : []);
}
function saveExtDisabled(set) {
  fs.mkdirSync(path.dirname(EXT_STATE), { recursive: true });
  fs.writeFileSync(EXT_STATE, JSON.stringify({ disabled: [...set] }));
}
function extSubPath(extRoot, rel) {
  if (!rel) return null;
  const full = path.resolve(extRoot, rel);
  if (!inside(extRoot, full) || !fs.existsSync(full)) return null;
  return full;
}
function loadThemeFile(extRoot, rel, seen = new Set()) {
  const f = extSubPath(extRoot, rel);
  if (!f || seen.has(f)) return null;
  seen.add(f);
  const data = parseJsonc(fs.readFileSync(f, 'utf8'));
  if (!data.include) return data;
  const inc = loadThemeFile(path.dirname(f), data.include, seen) || {};
  return {
    ...inc,
    ...data,
    colors: { ...(inc.colors || {}), ...(data.colors || {}) },
    tokenColors: [...(inc.tokenColors || []), ...(data.tokenColors || [])],
  };
}
function readExtManifest(id) {
  const rootDir = path.join(EXT_DIR, id);
  const extRoot = path.join(rootDir, 'extension');
  const pkgPath = path.join(extRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  const realExt = real(extRoot);
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const nls = readJSON(path.join(realExt, 'package.nls.json'));
  const tr = s => (typeof s === 'string' && /^%[^%]+%$/.test(s) ? (nls[s.slice(1, -1)] ?? s) : (s || ''));
  const extId = `${pkg.publisher}.${pkg.name}`;
  const c = pkg.contributes || {};
  const disabled = extDisabledSet();
  const themes = (c.themes || []).map(th => {
    try {
      const data = loadThemeFile(realExt, th.path);
      if (!data) return null;
      return { id: th.id || th.label, label: tr(th.label) || th.id, uiTheme: th.uiTheme || 'vs-dark', colors: data.colors || {}, tokenColors: data.tokenColors || [] };
    } catch { return null; }
  }).filter(Boolean);
  const languages = (c.languages || []).map(l => {
    let configuration = null;
    if (l.configuration) {
      const cf = extSubPath(realExt, l.configuration);
      if (cf) try { configuration = parseJsonc(fs.readFileSync(cf, 'utf8')); } catch {}
    }
    return { id: l.id, aliases: l.aliases || [], extensions: l.extensions || [], filenames: l.filenames || [], configuration };
  });
  const grammars = (c.grammars || []).map(g => {
    const gf = extSubPath(realExt, g.path);
    let grammar = null;
    if (gf && /\.json$/i.test(gf)) try { grammar = parseJsonc(fs.readFileSync(gf, 'utf8')); } catch {}
    return g.language && grammar ? { language: g.language, scopeName: g.scopeName, grammar } : null;
  }).filter(Boolean);
  const snippets = (c.snippets || []).map(sn => {
    const sf = extSubPath(realExt, sn.path);
    if (!sf) return null;
    try { return { language: sn.language, entries: parseJsonc(fs.readFileSync(sf, 'utf8')) }; } catch { return null; }
  }).filter(Boolean);
  const commands = (c.commands || []).map(cmd => ({ command: cmd.command, title: tr(cmd.title) || cmd.command, category: tr(cmd.category) }));
  const hasIcon = !!extSubPath(realExt, pkg.icon);
  const hasBrowser = !!extSubPath(realExt, pkg.browser);
  return {
    id: extId,
    dir: id,
    displayName: tr(pkg.displayName) || pkg.name,
    description: tr(pkg.description),
    version: pkg.version,
    publisher: pkg.publisher,
    enabled: !disabled.has(extId) && !disabled.has(id),
    iconUrl: hasIcon ? `/ext/${encPath(id)}/icon` : null,
    hasBrowser,
    hasMain: !!pkg.main,
    themes,
    languages,
    grammars,
    snippets,
    commands,
  };
}
const encPath = s => encodeURIComponent(s);
function listInstalledExts() {
  if (!fs.existsSync(EXT_DIR)) return [];
  return fs.readdirSync(EXT_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => { try { return readExtManifest(e.name); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
function allowedVsixUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  return /(^|\.)(vsassets\.io|visualstudio\.com|open-vsx\.org|github\.com|githubusercontent\.com)$/i.test(u.hostname);
}
async function searchMarketplace(q = '') {
  const installed = new Map(listInstalledExts().map(e => [e.id.toLowerCase(), e]));
  try {
    const criteria = [{ filterType: 8, value: 'Microsoft.VisualStudio.Code' }];
    if (q.trim()) criteria.push({ filterType: 10, value: q.trim() });
    const r = await fetch('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json;api-version=7.1-preview.1' },
      body: JSON.stringify({ filters: [{ criteria, pageNumber: 1, pageSize: 24, sortBy: q.trim() ? 0 : 4 }], flags: 914 }),
      signal: AbortSignal.timeout(10_000),
    });
    if (r.ok) {
      const data = await r.json();
      return (data.results?.[0]?.extensions || []).map(e => {
        const id = `${e.publisher.publisherName}.${e.extensionName}`;
        const v = (e.versions || []).find(x => !x.targetPlatform || x.targetPlatform === 'web') || e.versions?.[0];
        const files = v?.files || [];
        const vsix = files.find(f => f.assetType === 'Microsoft.VisualStudio.Services.VSIXPackage')?.source;
        const icon = files.find(f => f.assetType === 'Microsoft.VisualStudio.Services.Icons.Small')?.source
          || files.find(f => f.assetType === 'Microsoft.VisualStudio.Services.Icons.Default')?.source || null;
        const stats = Object.fromEntries((e.statistics || []).map(s => [s.statisticName, s.value]));
        return {
          id,
          displayName: e.displayName || e.extensionName,
          publisher: e.publisher.displayName || e.publisher.publisherName,
          description: e.shortDescription || '',
          version: v?.version || '',
          installs: Math.round(stats.install || 0),
          rating: stats.weightedRating ? +stats.weightedRating.toFixed(1) : null,
          iconUrl: icon,
          vsixUrl: vsix,
          categories: e.categories || [],
          installed: installed.has(id.toLowerCase()),
        };
      }).filter(x => x.vsixUrl);
    }
  } catch { /* fall back to Open VSX */ }
  const r2 = await fetch(`https://open-vsx.org/api/-/search?query=${encodeURIComponent(q.trim())}&size=24`, { signal: AbortSignal.timeout(10_000) });
  if (!r2.ok) throw new HttpErr(502, 'marketplace unavailable');
  const d2 = await r2.json();
  return (d2.extensions || []).map(e => {
    const id = `${e.namespace}.${e.name}`;
    return {
      id,
      displayName: e.displayName || e.name,
      publisher: e.namespace,
      description: e.description || '',
      version: e.version || '',
      installs: e.downloadCount || 0,
      rating: e.averageRating ? +e.averageRating.toFixed(1) : null,
      iconUrl: e.files?.icon || null,
      vsixUrl: e.files?.download || null,
      categories: e.categories || [],
      installed: installed.has(id.toLowerCase()),
    };
  }).filter(x => x.vsixUrl);
}
async function installExtension(id, vsixUrl) {
  if (!/^[\w-]+\.[\w-]+$/.test(id || '')) throw new HttpErr(400, 'invalid extension id');
  let url = vsixUrl;
  if (!url) {
    const hits = await searchMarketplace(id);
    url = hits.find(h => h.id.toLowerCase() === id.toLowerCase())?.vsixUrl;
  }
  if (!url || !allowedVsixUrl(url)) throw new HttpErr(400, 'invalid or missing VSIX package URL');
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new HttpErr(502, `failed to download VSIX (${r.status})`);
  const len = +r.headers.get('content-length') || 0;
  if (len > 60 * 1024 * 1024) throw new HttpErr(413, 'VSIX package too large (>60 MB)');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 60 * 1024 * 1024) throw new HttpErr(413, 'VSIX package too large (>60 MB)');
  const safeId = id.toLowerCase();
  const tmp = path.join(EXT_DIR, `.tmp-${safeId}-${Date.now()}`);
  const dest = path.join(EXT_DIR, safeId);
  try {
    extractZip(buf, tmp);
    if (!fs.existsSync(path.join(tmp, 'extension', 'package.json'))) throw new HttpErr(400, 'VSIX missing extension/package.json');
    fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(tmp, dest);
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
  const disabled = extDisabledSet();
  disabled.delete(safeId); disabled.delete(id);
  saveExtDisabled(disabled);
  return readExtManifest(safeId);
}
const etag = buf => crypto.createHash('sha1').update(buf).digest('hex'); // content version, for save conflicts
const reply = (res, code, data = '', type = 'text/plain; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type });
  res.end(data);
};
const json = (res, o, code = 200) => reply(res, code, JSON.stringify(o), 'application/json');

const server = http.createServer(async (req, res) => {
  last = Date.now();
  try {
    // DNS-rebinding guard: only our own literal host name is accepted.
    if (req.headers.host !== `${HOST}:${PORT}`) throw new HttpErr(403, 'bad host');
    const origin = req.headers.origin;
    if (origin) {
      if (origin !== `http://${HOST}:${PORT}` && !ORIGINS.includes(origin)) throw new HttpErr(403, 'bad origin');
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('access-control-allow-headers', 'authorization, content-type');
      res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE');
      res.setHeader('access-control-allow-private-network', 'true');
      res.setHeader('vary', 'origin');
    }
    if (req.method === 'OPTIONS') return reply(res, 204);

    const u = new URL(req.url, `http://${HOST}:${PORT}`);
    const p = u.pathname;
    const m = req.method;

    // ---- no token needed ----
    if (p === '/health') return json(res, { ok: true });
    if (p === '/' && m === 'GET') {
      res.setHeader('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; font-src https://cdnjs.cloudflare.com; worker-src blob:; connect-src 'self'; img-src 'self' data: https:");
      return reply(res, 200, fs.readFileSync(path.join(path.dirname(SELF), 'web', 'index.html')), 'text/html; charset=utf-8');
    }
    if (p === '/nonce' && m === 'POST') { // local processes only: browsers always send Origin or Sec-Fetch-Site
      if (origin || req.headers['sec-fetch-site']) throw new HttpErr(403, 'local only');
      nonces.set((await body(req, 100)).trim(), Date.now() + 60_000);
      return json(res, { ok: true });
    }
    if (p === '/pair' && m === 'POST') {
      const n = (await bodyJSON(req, 1000)).nonce;
      const exp = nonces.get(n);
      nonces.delete(n);
      if (!exp || exp < Date.now()) throw new HttpErr(403, 'unknown or expired nonce');
      return json(res, { token: TOKEN });
    }
    if (p === '/session' && m === 'POST') {
      if (origin !== `http://${HOST}:${PORT}` || req.headers['sec-fetch-site'] !== 'same-origin') throw new HttpErr(403, 'same-origin only');
      return json(res, { token: TOKEN });
    }
    const extAsset = p.match(/^\/ext\/([\w-]+\.[\w-]+)\/(bundle\.js|icon)$/);
    if (extAsset && m === 'GET') {
      if (req.headers['sec-fetch-site'] !== 'same-origin') throw new HttpErr(403, 'same-origin only');
      const extRoot = path.join(EXT_DIR, extAsset[1], 'extension');
      if (!fs.existsSync(extRoot)) throw new HttpErr(404, 'extension not found');
      const realExt = real(extRoot), pkg = readJSON(path.join(realExt, 'package.json'));
      if (extAsset[2] === 'icon') {
        const iconFile = extSubPath(realExt, pkg.icon);
        if (!iconFile) throw new HttpErr(404, 'no icon');
        const ext = path.extname(iconFile).toLowerCase();
        const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
        return reply(res, 200, fs.readFileSync(iconFile), mime);
      }
      const bFile = extSubPath(realExt, pkg.browser);
      if (!bFile) throw new HttpErr(404, 'no browser bundle');
      const id = `${pkg.publisher}.${pkg.name}`;
      const code = fs.readFileSync(bFile, 'utf8');
      return reply(res, 200, `window.__webideExtDefine(${JSON.stringify(id)}, function(require, module, exports, define) {\n${code}\n});\n`, 'application/javascript; charset=utf-8');
    }

    // ---- token required ----
    const want = Buffer.from('Bearer ' + TOKEN), got = Buffer.from(req.headers.authorization || '');
    if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) throw new HttpErr(401, 'unauthorized');

    if (p === '/root' && m === 'GET') return json(res, { root, projects });
    if (p === '/root' && m === 'POST') { const o = await bodyJSON(req, 10_000); setRoot(o.path ?? null, o.projects); return json(res, { root, projects }); }
    if (p === '/projects' && m === 'POST') return json(res, { projects: setProjects((await bodyJSON(req, 10_000)).projects) });
    if (p === '/agents') return json(res, Object.keys(AGENTS));

    if (p === '/fs/browse') { // folder picker for choosing the workspace, confined to $HOME
      const dir = real(u.searchParams.get('path') || HOME), home = real(HOME);
      if (!inside(home, dir)) throw new HttpErr(403, 'outside home');
      const dirs = fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => ({ name: e.name, path: path.join(dir, e.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return json(res, { path: dir, sep: path.sep, parent: dir === home ? null : path.dirname(dir), dirs });
    }
    if (p === '/fs/tree') {
      const items = fs.readdirSync(safe(u.searchParams.get('dir') || ''), { withFileTypes: true })
        .map(e => ({ name: e.name, dir: e.isDirectory() }))
        .sort((a, b) => b.dir - a.dir || a.name.localeCompare(b.name));
      return json(res, items);
    }
    if (p === '/fs/file') {
      const f = safe(u.searchParams.get('path') || '');
      if (m === 'GET') {
        if (fs.statSync(f).size > 5e6) throw new HttpErr(413, 'file too large');
        const buf = fs.readFileSync(f);
        if (buf.includes(0)) throw new HttpErr(415, 'binary file');
        res.setHeader('x-etag', etag(buf));
        return reply(res, 200, buf);
      }
      if (m === 'PUT') { // ?create=1 refuses to overwrite and creates missing parent folders (new-file flow)
        const create = u.searchParams.has('create'), data = Buffer.from(await body(req));
        const want = req.headers['if-match']; // the version the editor loaded; refuse if someone else changed the file since
        if (want && !create) {
          let cur = null;
          try { cur = fs.readFileSync(f); } catch (e) { if (e.code !== 'ENOENT') throw e; } // deleted on disk: saving recreates it
          if (cur && etag(cur) !== want) throw new HttpErr(412, 'The file has changed on disk.');
        }
        if (create) fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, data, { flag: create ? 'wx' : 'w' });
        return json(res, { ok: true, etag: etag(data) });
      }
    }
    if (p === '/fs/mkdir' && m === 'POST') {
      const d = safe((await bodyJSON(req, 5000)).path);
      if (fs.existsSync(d)) throw new HttpErr(409, 'already exists');
      fs.mkdirSync(d, { recursive: true });
      return json(res, { ok: true });
    }
    if (p === '/fs/rename' && m === 'POST') {
      const { from, to } = await bodyJSON(req, 5000);
      const a = entry(from), b = safe(to);
      if (b === root || path.basename(to) === '..') throw new HttpErr(400, 'bad name');
      if (b !== a && inside(a, b)) throw new HttpErr(400, 'cannot move a folder into itself');
      // Never overwrite; a case-only rename ("a.txt" -> "A.txt") on a case-insensitive disk is the same file.
      if (fs.existsSync(b) && fs.statSync(b).ino !== fs.lstatSync(a).ino) throw new HttpErr(409, 'already exists');
      fs.mkdirSync(path.dirname(b), { recursive: true });
      fs.renameSync(a, b);
      return json(res, { ok: true });
    }
    if (p === '/fs/delete' && m === 'POST') {
      trash(entry((await bodyJSON(req, 5000)).path));
      return json(res, { ok: true });
    }
    if (p === '/fs/files') return json(res, listFiles()); // Quick Open
    if (p === '/fs/search') { // Find in Files
      const q = u.searchParams.get('q') || '', on = k => u.searchParams.get(k) === '1';
      if (!q) return json(res, { results: [], truncated: false });
      let re;
      try {
        const src = on('regex') ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        re = new RegExp(on('word') ? `\\b(?:${src})\\b` : src, on('case') ? 'g' : 'gi');
      } catch (e) { throw new HttpErr(400, e.message); }
      const results = [], MAX = 2000;
      let total = 0;
      for (const rel of listFiles().files) {
        if (total >= MAX) break;
        let buf;
        try {
          const f = path.join(root, ...rel.split('/'));
          if (fs.statSync(f).size > 1e6) continue; // ponytail: skip >1 MB files (minified bundles, data dumps)
          buf = fs.readFileSync(f);
        } catch { continue; }
        if (buf.includes(0)) continue; // binary
        const matches = [];
        buf.toString('utf8').split(/\r?\n/).forEach((line, i) => {
          re.lastIndex = 0;
          for (let m; total < MAX && (m = re.exec(line));) {
            if (!m[0].length) { re.lastIndex++; continue; }
            const off = line.length > 300 ? Math.max(0, m.index - 100) : 0; // preview window around long-line hits
            matches.push({ line: i + 1, col: m.index + 1, len: m[0].length, off, text: line.slice(off, off + 300) });
            total++;
          }
        });
        if (matches.length) results.push({ file: rel, matches });
      }
      return json(res, { results, truncated: total >= MAX });
    }
    if (p === '/fs/watch') { // live refresh: batched [relPath, 'rename'|'change'] events over SSE
      if (!root) throw new HttpErr(409, 'no workspace selected');
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      res.flushHeaders();
      let batch = new Map(), timer, w;
      try {
        // Recursive watching: macOS and Windows natively, Linux on Node >= 20.
        w = fs.watch(root, { recursive: true }, (type, name) => {
          if (!name) return;
          const rel = String(name).split(path.sep).join('/');
          if (/(^|\/)(\.git|node_modules)(\/|$)/.test(rel)) return;
          batch.set(rel, batch.get(rel) === 'rename' ? 'rename' : type);
          clearTimeout(timer);
          timer = setTimeout(() => { res.write(`data: ${JSON.stringify([...batch])}\n\n`); batch = new Map(); }, 150);
        });
        w.on('error', () => { w?.close(); clearTimeout(timer); res.end(); });
      } catch { /* no recursive watch here: the IDE still works, just without live refresh */ }
      streams++;
      req.on('close', () => { streams--; w?.close(); clearTimeout(timer); });
      return;
    }

    if (p === '/agent/start' && m === 'POST') return json(res, { sid: startAgent((await bodyJSON(req, 1000)).id) });
    const a = p.match(/^\/agent\/([\w-]+)(?:\/(stream|send))?$/);
    if (a) {
      const s = sessions.get(a[1]);
      if (!s) throw new HttpErr(404, 'no such session');
      if (a[2] === 'stream') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
        res.flushHeaders(); // otherwise the client's fetch() waits for the first event
        for (let i = +u.searchParams.get('from') || 0; i < s.lines.length; i++) res.write(`id: ${i}\ndata: ${JSON.stringify(s.lines[i])}\n\n`);
        s.clients.add(res);
        req.on('close', () => s.clients.delete(res));
        return;
      }
      if (a[2] === 'send' && m === 'POST') {
        const msg = await bodyJSON(req, 10e6);
        s.proc.stdin.write(JSON.stringify(msg) + '\n');
        return json(res, { ok: true });
      }
      if (!a[2] && m === 'DELETE') { s.proc.kill(); sessions.delete(a[1]); return json(res, { ok: true }); }
    }

    if (p === '/term' && m === 'POST') { const o = await bodyJSON(req, 1000); return json(res, startTerm(o.cols, o.rows)); }
    const tm = p.match(/^\/term\/([\w-]+)(?:\/(stream|input|resize))?$/);
    if (tm) {
      const t = terms.get(tm[1]);
      if (!t) throw new HttpErr(404, 'no such terminal');
      if (tm[2] === 'stream') { // one attached client at a time; detaching hibernates the terminal without killing the shell
        if (t.client) throw new HttpErr(409, 'already attached');
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
        res.flushHeaders();
        t.everAttached = true;
        if (t.out) res.write(`data: ${JSON.stringify(t.out)}\n\n`);
        t.out = ''; t.client = res;
        req.on('close', () => { if (t.client === res) t.client = null; });
        return;
      }
      if (tm[2] === 'input' && m === 'POST') { t.proc.stdin.write(await body(req, 1e6)); return json(res, { ok: true }); }
      if (tm[2] === 'resize' && m === 'POST') {
        const o = await bodyJSON(req, 1000);
        if (t.tty) resizeTty(t, o.rows, o.cols); else t.pendingSize = { rows: o.rows, cols: o.cols };
        return json(res, { ok: true });
      }
      if (!tm[2] && m === 'DELETE') { killTerm(t); return json(res, { ok: true }); }
    }

    if (p === '/git/status' && m === 'GET') return json(res, await gitStatus());
    if (p === '/git/diff' && m === 'GET') return json(res, await gitDiff(u.searchParams.get('path') || '', u.searchParams.get('staged') === '1'));
    if (p === '/git/init' && m === 'POST') { await gitRun(['init']); return json(res, { ok: true }); }
    if (p === '/git/stage' && m === 'POST') {
      const list = gitPaths((await bodyJSON(req, 50_000)).paths);
      await gitRun(list.length ? ['add', '--', ...list] : ['add', '-A']);
      return json(res, { ok: true });
    }
    if (p === '/git/unstage' && m === 'POST') {
      const list = gitPaths((await bodyJSON(req, 50_000)).paths);
      const hasHead = (await gitTry(['rev-parse', '--verify', 'HEAD'])) !== null;
      if (hasHead) await gitRun(list.length ? ['reset', '-q', 'HEAD', '--', ...list] : ['reset', '-q', 'HEAD']);
      else await gitRun(list.length ? ['rm', '--cached', '-r', '-q', '--', ...list] : ['rm', '--cached', '-r', '-q', '.']);
      return json(res, { ok: true });
    }
    if (p === '/git/discard' && m === 'POST') {
      const { path: rel, untracked } = await bodyJSON(req, 5000);
      const f = safe(rel || '');
      if (untracked) trash(f);
      else await gitRun(['checkout', '--', String(rel).split(path.sep).join('/')]);
      return json(res, { ok: true });
    }
    if (p === '/git/commit' && m === 'POST') {
      const msg = String((await bodyJSON(req, 50_000)).message || '').trim();
      if (!msg) throw new HttpErr(400, 'commit message required');
      await gitRun(['commit', '-m', msg]);
      return json(res, { ok: true });
    }
    if (p === '/git/fetch' && m === 'POST') { await gitRun(['fetch', '--all', '--prune']); return json(res, { ok: true }); }
    if (p === '/git/pull' && m === 'POST') { await gitRun(['pull']); return json(res, { ok: true }); }
    if (p === '/git/push' && m === 'POST') {
      try { await gitRun(['push']); }
      catch (e) {
        if (!/no upstream/i.test(e.message)) throw e;
        const br = (await gitRun(['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
        await gitRun(['push', '-u', 'origin', br]);
      }
      return json(res, { ok: true });
    }
    if (p === '/git/checkout' && m === 'POST') {
      const { branch, create } = await bodyJSON(req, 5000);
      const b = String(branch || '').trim();
      if (!b || b.startsWith('-')) throw new HttpErr(400, 'invalid branch name');
      await gitRun(create ? ['checkout', '-b', b] : ['checkout', b]);
      return json(res, { ok: true });
    }
    if (p === '/git/remote' && m === 'POST') {
      const { name = 'origin', url } = await bodyJSON(req, 5000);
      const n = String(name || 'origin').trim();
      if (!/^[\w.-]+$/.test(n)) throw new HttpErr(400, 'invalid remote name');
      const u2 = normRepoUrl(url);
      const exists = (await gitTry(['remote', 'get-url', n])) !== null;
      await gitRun(exists ? ['remote', 'set-url', n, u2] : ['remote', 'add', n, u2]);
      return json(res, { ok: true, url: u2, ...parseGithubRemote(u2) });
    }
    if (p === '/git/clone' && m === 'POST') {
      const { url, parentDir, name } = await bodyJSON(req, 5000);
      const u2 = normRepoUrl(url);
      const parent = real(parentDir || HOME), home = real(HOME);
      if (!inside(home, parent) || !fs.statSync(parent).isDirectory()) throw new HttpErr(403, 'parent must be a folder under home');
      const folder = String(name || u2.replace(/\.git$/, '').split(/[/:]/).filter(Boolean).pop() || '').trim();
      if (!folder || folder === '.' || folder === '..' || /[\\/]/.test(folder)) throw new HttpErr(400, 'invalid folder name');
      const dest = path.join(parent, folder);
      if (!inside(home, dest)) throw new HttpErr(403, 'outside home');
      if (fs.existsSync(dest)) throw new HttpErr(409, 'destination folder already exists');
      await gitRun(['clone', '--', u2, dest], parent);
      setRoot(dest);
      return json(res, { root, projects });
    }
    if (p === '/git/log' && m === 'GET') {
      const lim = Math.max(1, Math.min(50, +(u.searchParams.get('limit') || 15) || 15));
      const raw = await gitTry(['log', `-n${lim}`, '--format=%H%x1f%h%x1f%an%x1f%ar%x1f%s%x1e']);
      const commits = (raw || '').split('\x1e').map(r => r.trim()).filter(Boolean).map(r => {
        const [hash, shortHash, author, date, subject] = r.split('\x1f');
        return { hash, shortHash, author, date, subject };
      });
      return json(res, commits);
    }

    if (p === '/ext/search' && m === 'GET') return json(res, await searchMarketplace(u.searchParams.get('q') || ''));
    if (p === '/ext/installed' && m === 'GET') return json(res, listInstalledExts());
    if (p === '/ext/install' && m === 'POST') {
      const o = await bodyJSON(req, 10_000);
      return json(res, await installExtension(o.id, o.vsixUrl));
    }
    if (p === '/ext/toggle' && m === 'POST') {
      const o = await bodyJSON(req, 2000);
      if (!/^[\w-]+\.[\w-]+$/.test(o.id || '')) throw new HttpErr(400, 'invalid extension id');
      const set = extDisabledSet();
      if (o.enabled) { set.delete(o.id); set.delete(o.id.toLowerCase()); } else set.add(o.id.toLowerCase());
      saveExtDisabled(set);
      return json(res, { ok: true });
    }
    if (p === '/ext/uninstall' && m === 'POST') {
      const o = await bodyJSON(req, 2000);
      if (!/^[\w-]+\.[\w-]+$/.test(o.id || '')) throw new HttpErr(400, 'invalid extension id');
      const target = path.resolve(EXT_DIR, o.id.toLowerCase());
      if (!inside(path.resolve(EXT_DIR), target)) throw new HttpErr(403, 'invalid extension path');
      fs.rmSync(target, { recursive: true, force: true });
      const set = extDisabledSet(); set.delete(o.id); set.delete(o.id.toLowerCase()); saveExtDisabled(set);
      return json(res, { ok: true });
    }

    throw new HttpErr(404, 'not found');
  } catch (e) {
    const code = e.code === 'ENOENT' ? 404 : e.code === 'EEXIST' ? 409 : e.code === 'EISDIR' ? 400 : e instanceof HttpErr ? e.code : 500;
    if (res.headersSent) return res.end();
    reply(res, code, e.message);
  }
});

// A GUI-launched process has a bare PATH/env; borrow the user's login shell env so `gemini`, API keys etc. resolve.
function importLoginEnv() {
  if (process.platform === 'win32') return;
  try {
    const out = execFileSync(process.env.SHELL || '/bin/zsh', ['-ilc', 'printf __ENV__; env -0'], { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] });
    for (const kv of out.split('__ENV__').pop().split('\0')) { const i = kv.indexOf('='); if (i > 0) process.env[kv.slice(0, i)] = kv.slice(i + 1); }
  } catch { /* ponytail: best effort; agents on an unusual PATH can be given as absolute paths in ~/.webide/agents.json */ }
}

function serve() {
  importLoginEnv();
  const saved = readJSON(STATE);
  if (Array.isArray(saved.projects)) setProjects(saved.projects);
  try { if (saved.root) setRoot(saved.root); } catch { /* no saved workspace */ }
  server.on('error', e => { console.error(e.message); process.exit(1); });
  server.listen(PORT, HOST, () => console.log(`webide bridge on http://${HOST}:${PORT}`));
  // Don't stay resident forever: quit after 30 idle minutes with no agent stream attached.
  setInterval(() => {
    const busy = streams > 0 || [...sessions.values()].some(s => s.clients.size);
    if (!busy && Date.now() - last > 30 * 60_000) process.exit(0);
  }, 60_000).unref();
  process.on('exit', () => { sessions.forEach(s => s.proc.kill()); terms.forEach(killTerm); });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0));
}

async function launch(url) {
  const nonce = new URL(url).searchParams.get('nonce') || '';
  if (!/^[0-9a-f]{32}$/.test(nonce)) process.exit(1);
  try { if ((await fetch(`http://${HOST}:${PORT}/nonce`, { method: 'POST', body: nonce })).ok) process.exit(0); } catch { /* not running yet */ }
  nonces.set(nonce, Date.now() + 60_000);
  serve();
}

// Windows: register webide:// for this user (HKCU, no admin). wscript runs node with no console window.
// The URL is untrusted (any site can open it) but only reaches launch(), which accepts a 32-hex nonce and nothing else.
function installWindows() {
  const dir = path.join(process.env.LOCALAPPDATA || HOME, 'WebIDE');
  fs.mkdirSync(dir, { recursive: true });
  const vbs = path.join(dir, 'launch.vbs');
  const q = s => s.replace(/"/g, '""'); // VBScript string escaping
  fs.writeFileSync(vbs, `CreateObject("WScript.Shell").Run """${q(process.execPath)}"" ""${q(SELF)}"" --url """ & WScript.Arguments(0) & """", 0, False\r\n`);
  const key = 'HKCU\\Software\\Classes\\webide';
  const reg = args => execFileSync('reg', ['add', ...args, '/f'], { stdio: 'ignore' });
  reg([key, '/ve', '/d', 'URL:WebIDE']);
  reg([key, '/v', 'URL Protocol', '/d', '']);
  reg([key + '\\shell\\open\\command', '/ve', '/d', `"${path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wscript.exe')}" "${vbs}" "%1"`]);
  console.log(`installed: webide:// links now start the bridge (${vbs}).\nuninstall: reg delete HKCU\\Software\\Classes\\webide /f`);
}

// macOS: a tiny AppleScript applet owns the webide:// scheme (shell-script apps never receive the URL).
function install() {
  if (IS_WIN) return installWindows();
  if (process.platform !== 'darwin') { console.error('install: macOS and Windows are implemented; Linux needs a .desktop handler'); process.exit(1); }
  const esc = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const app = path.join(HOME, 'Applications', 'WebIDE.app');
  fs.mkdirSync(path.dirname(app), { recursive: true });
  fs.rmSync(app, { recursive: true, force: true });
  const script = `on open location u\ndo shell script "nohup " & quoted form of "${esc(process.execPath)}" & " " & quoted form of "${esc(SELF)}" & " --url " & quoted form of u & " >/dev/null 2>&1 &"\nend open location`;
  const run = (c, a) => execFileSync(c, a, { stdio: 'inherit' });
  run('osacompile', ['-o', app, '-e', script]);
  const plist = path.join(app, 'Contents', 'Info.plist');
  run('plutil', ['-insert', 'CFBundleURLTypes', '-json', '[{"CFBundleURLName":"WebIDE","CFBundleURLSchemes":["webide"]}]', plist]);
  run('plutil', ['-insert', 'LSUIElement', '-bool', 'true', plist]); // no Dock icon
  run('codesign', ['--force', '--deep', '-s', '-', app]);
  run('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', app]);
  console.log(`installed ${app}; webide:// links now start the bridge.\nuninstall: rm -rf "${app}"`);
}

const [flag, arg] = process.argv.slice(2);
if (flag === '--install') install();
else if (flag === '--url') launch(arg);
else serve();
