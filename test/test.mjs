// Self-check: node test/test.mjs  (starts a throwaway bridge with a temp HOME and a mock agent)
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'webide-')));
const proj = path.join(home, 'proj');
fs.mkdirSync(proj);
fs.writeFileSync(path.join(home, 'secret.txt'), 'outside the workspace');

const PORT = 47399, B = `http://127.0.0.1:${PORT}`;
const bridge = spawn(process.execPath, [path.join(dir, '..', 'bridge.mjs')], {
  env: { ...process.env, HOME: home, WEBIDE_PORT: PORT, SHELL: '/bin/sh', WEBIDE_AGENTS: JSON.stringify({ mock: [process.execPath, path.join(dir, 'mock-acp.mjs')] }) },
  stdio: 'inherit',
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  for (let i = 0; i < 50; i++) { try { await fetch(B + '/health'); break; } catch { await sleep(100); } }

  const f = (p, o = {}) => fetch(B + p, o);
  assert.equal((await f('/root')).status, 401, 'token required');
  assert.equal((await f('/session', { method: 'POST', headers: { origin: 'http://localhost:8000', 'sec-fetch-site': 'cross-site' } })).status, 403, 'session rejects cross-origin');
  assert.equal((await f('/session', { method: 'POST', headers: { origin: B, 'sec-fetch-site': 'same-origin' } })).status, 200, 'session allows same-origin');
  assert.equal((await f('/pair', { method: 'POST', body: '{"nonce":"x"}' })).status, 403, 'unknown nonce rejected');
  assert.equal((await f('/nonce', { method: 'POST', headers: { origin: 'http://evil.test' }, body: 'x' })).status, 403, 'bad origin rejected');

  const nonce = 'a'.repeat(32);
  assert.equal((await f('/nonce', { method: 'POST', body: nonce })).status, 200);
  const { token } = await (await f('/pair', { method: 'POST', headers: { origin: 'http://localhost:8000' }, body: JSON.stringify({ nonce }) })).json();
  assert.equal((await f('/pair', { method: 'POST', body: JSON.stringify({ nonce }) })).status, 403, 'nonce is one-time');
  const H = { authorization: 'Bearer ' + token };
  const j = async (p, o = {}) => (await f(p, { ...o, headers: H })).json();

  assert.equal((await f('/root', { method: 'POST', headers: H, body: JSON.stringify({ path: '/etc' }) })).status, 403, 'root must be under HOME');
  await f('/root', { method: 'POST', headers: H, body: JSON.stringify({ path: proj }) });
  const rootInfo = await j('/root');
  assert.ok(rootInfo.projects.includes(proj), 'root persists projects list');
  const p2 = path.join(home, 'proj2');
  fs.mkdirSync(p2);
  const up = await (await f('/projects', { method: 'POST', headers: H, body: JSON.stringify({ projects: [proj, p2, '/etc'] }) })).json();
  assert.equal(up.projects.length, 2, 'projects filters outside HOME');
  assert.ok(up.projects.includes(proj) && up.projects.includes(p2) && !up.projects.includes('/etc'), 'projects keeps valid HOME dirs');

  assert.equal((await f('/fs/file?path=a.txt', { method: 'PUT', headers: H, body: 'hello' })).status, 200);
  assert.equal(await (await f('/fs/file?path=a.txt', { headers: H })).text(), 'hello');
  assert.equal((await f('/fs/file?path=../secret.txt', { headers: H })).status, 403, 'no path traversal');
  assert.equal((await f('/fs/file?path=%2Fetc%2Fpasswd', { headers: H })).status, 403, 'no absolute escape');
  fs.symlinkSync(path.join(home, 'secret.txt'), path.join(proj, 'link.txt'));
  assert.equal((await f('/fs/file?path=link.txt', { headers: H })).status, 403, 'no symlink escape');

  // save conflicts: PUT with If-Match fails once the file changed on disk
  const r0 = await f('/fs/file?path=a.txt', { headers: H }), tag = r0.headers.get('x-etag');
  const put = (body, tag) => f('/fs/file?path=a.txt', { method: 'PUT', headers: { ...H, ...(tag && { 'if-match': tag }) }, body });
  const tag2 = (await (await put('hello', tag)).json()).etag;
  assert.equal(tag2, tag, 'same content, same version');
  fs.writeFileSync(path.join(proj, 'a.txt'), 'changed elsewhere');
  assert.equal((await put('mine', tag)).status, 412, 'stale version is refused');
  assert.equal(fs.readFileSync(path.join(proj, 'a.txt'), 'utf8'), 'changed elsewhere', 'disk version kept');
  assert.equal((await put('hello')).status, 200, 'overwrite without If-Match');
  const big = '中文'.repeat(100000); // multi-byte chars across request chunks
  await f('/fs/file?path=big.txt', { method: 'PUT', headers: H, body: big });
  assert.equal(fs.readFileSync(path.join(proj, 'big.txt'), 'utf8'), big, 'large UTF-8 body intact');

  // new file / folder
  assert.equal((await f('/fs/file?create=1&path=a.txt', { method: 'PUT', headers: H, body: '' })).status, 409, 'create never overwrites');
  assert.equal(await (await f('/fs/file?path=a.txt', { headers: H })).text(), 'hello', 'existing file untouched');
  assert.equal((await f('/fs/file?create=1&path=deep/er/new.js', { method: 'PUT', headers: H, body: 'x' })).status, 200, 'nested create');
  assert.ok(fs.existsSync(path.join(proj, 'deep/er/new.js')));
  assert.equal((await f('/fs/mkdir', { method: 'POST', headers: H, body: '{"path":"lib/util"}' })).status, 200, 'mkdir nested');
  assert.equal((await f('/fs/mkdir', { method: 'POST', headers: H, body: '{"path":"lib"}' })).status, 409, 'mkdir existing');
  assert.equal((await f('/fs/mkdir', { method: 'POST', headers: H, body: '{"path":"../evil"}' })).status, 403, 'mkdir traversal');
  assert.equal((await f('/fs/file?create=1&path=nope%2F..%2F..%2Fx', { method: 'PUT', headers: H, body: '' })).status, 403, 'create traversal');
  fs.symlinkSync(path.join(home, 'missing-target'), path.join(proj, 'dangling'));
  assert.equal((await f('/fs/file?path=dangling', { method: 'PUT', headers: H, body: 'x' })).status, 404, 'no write through dangling symlink');
  assert.ok(!fs.existsSync(path.join(home, 'missing-target')));

  // rename / delete / file list
  const post = (p, o) => f(p, { method: 'POST', headers: H, body: JSON.stringify(o) });
  assert.equal((await post('/fs/rename', { from: 'a.txt', to: 'deep/er/new.js' })).status, 409, 'rename never overwrites');
  assert.equal((await post('/fs/rename', { from: 'a.txt', to: 'renamed/b.txt' })).status, 200, 'rename into new folder');
  assert.equal(fs.readFileSync(path.join(proj, 'renamed/b.txt'), 'utf8'), 'hello');
  assert.equal((await post('/fs/rename', { from: 'renamed/b.txt', to: '../escaped.txt' })).status, 403, 'rename traversal');
  assert.equal((await post('/fs/rename', { from: '../secret.txt', to: 'stolen.txt' })).status, 403, 'rename source traversal');
  assert.equal((await post('/fs/rename', { from: '', to: 'x' })).status, 403, 'cannot rename root');
  assert.equal((await post('/fs/rename', { from: 'renamed', to: 'renamed/sub' })).status, 400, 'cannot move folder into itself');
  assert.equal((await f('/fs/mkdir', { method: 'POST', headers: H, body: '{' })).status, 400, 'bad json -> 400');
  if (process.platform !== 'linux') { // case-insensitive disks: case-only rename is allowed
    assert.equal((await post('/fs/rename', { from: 'renamed/b.txt', to: 'renamed/B.txt' })).status, 200, 'case-only rename');
  }
  assert.equal((await post('/fs/delete', { path: 'link.txt' })).status, 200, 'delete a symlink itself');
  assert.ok(fs.existsSync(path.join(home, 'secret.txt')), 'symlink target untouched');
  assert.equal((await post('/fs/delete', { path: 'lib' })).status, 200, 'delete folder');
  assert.ok(!fs.existsSync(path.join(proj, 'lib')) && fs.existsSync(path.join(home, '.Trash', 'lib')), 'folder went to the trash');
  assert.equal((await post('/fs/delete', { path: '' })).status, 403, 'cannot delete root');
  assert.equal((await post('/fs/delete', { path: '../secret.txt' })).status, 403, 'delete traversal');
  assert.equal((await post('/fs/delete', { path: 'nope.txt' })).status, 404, 'delete missing');
  fs.mkdirSync(path.join(proj, 'node_modules/x'), { recursive: true });
  fs.writeFileSync(path.join(proj, 'node_modules/x/i.js'), '');
  const { files } = await j('/fs/files');
  assert.ok(files.includes('deep/er/new.js') && !files.some(x => x.startsWith('node_modules')), 'file list skips node_modules');

  // find in files
  fs.writeFileSync(path.join(proj, 'find.txt'), 'Alpha beta\r\nalphabet ALPHA\n' + ' '.repeat(400) + 'alpha far right\n');
  const search = async qs => (await f('/fs/search?' + qs, { headers: H })).json();
  let r = await search('q=alpha');
  const hits = r.results.find(x => x.file === 'find.txt').matches;
  assert.equal(hits.length, 4, 'case-insensitive by default');
  assert.deepEqual(hits.slice(0, 3).map(m => [m.line, m.col]), [[1, 1], [2, 1], [2, 10]], 'line/col (CRLF-safe)');
  assert.ok(hits[3].off > 0 && hits[3].text.slice(hits[3].col - 1 - hits[3].off, hits[3].col - 1 - hits[3].off + 5) === 'alpha', 'long-line preview window');
  r = await search('q=alpha&case=1&word=1');
  assert.equal(r.results.find(x => x.file === 'find.txt').matches.length, 1, 'match case + whole word');
  r = await search('q=' + encodeURIComponent('al.ha\\b') + '&regex=1&case=1');
  assert.equal(r.results.find(x => x.file === 'find.txt').matches.length, 1, 'regex');
  assert.equal((await f('/fs/search?q=(&regex=1', { headers: H })).status, 400, 'bad regex -> 400');
  assert.ok(!(await search('q=hello')).results.some(x => x.file.includes('secret')), 'search stays inside the workspace');

  // live refresh over SSE
  const ac = new AbortController();
  const ws = (await f('/fs/watch', { headers: H, signal: ac.signal })).body.getReader();
  const got = [];
  (async () => { const dec = new TextDecoder(); try { for (;;) { const { value, done } = await ws.read(); if (done) break; got.push(dec.decode(value)); } } catch { /* aborted */ } })();
  await sleep(200);
  fs.writeFileSync(path.join(proj, 'watched.txt'), 'x');
  for (let i = 0; i < 30 && !got.join('').includes('watched.txt'); i++) await sleep(100);
  assert.ok(got.join('').includes('watched.txt'), 'watch reports new files');
  ac.abort();

  // terminal: a real pty in the workspace, resizable, ends with an exit event
  if (process.platform !== 'win32') {
    const { id, pty } = await j('/term', { method: 'POST', body: '{"cols":90,"rows":20}' });
    assert.ok(pty, 'pty mode');
    const tc = new AbortController();
    const tr = (await f(`/term/${id}/stream`, { headers: H, signal: tc.signal })).body.getReader();
    let out = '';
    (async () => { const dec = new TextDecoder(); try { for (;;) { const { value, done } = await tr.read(); if (done) break; out += dec.decode(value); } } catch { /* detached or killed */ } })();
    const input = s => f(`/term/${id}/input`, { method: 'POST', headers: H, body: s });
    const until = async s => { for (let i = 0; i < 50 && !out.includes(s); i++) await sleep(100); assert.ok(out.includes(s), `terminal printed ${s}: ${out.slice(-300)}`); };
    await input('stty size; pwd; echo $((6*7))x\n');
    await until('42x'); await until('20 90'); await until(proj);
    await post(`/term/${id}/resize`, { cols: 120, rows: 33 });
    await sleep(200);
    await input('stty size\n'); await until('33 120');
    // hibernate detach + re-attach replay
    tc.abort();
    await sleep(150);
    await input('echo hibernated_ok\n');
    await sleep(150);
    const tr2 = (await f(`/term/${id}/stream`, { headers: H })).body.getReader();
    (async () => { const dec = new TextDecoder(); try { for (;;) { const { value, done } = await tr2.read(); if (done) break; out += dec.decode(value); } } catch { /* killed */ } })();
    await until('hibernated_ok');
    await input('exit\n'); await until('event: exit');
    assert.equal((await f(`/term/${id}/input`, { method: 'POST', headers: H, body: 'x' })).status, 404, 'terminal gone after exit');
  }

  // agent round trip over the pipe
  const { sid } = await j('/agent/start', { method: 'POST', body: '{"id":"mock"}' });
  const send = o => f(`/agent/${sid}/send`, { method: 'POST', headers: H, body: JSON.stringify(o) });
  const stream = (await f(`/agent/${sid}/stream`, { headers: H })).body.getReader();
  const seen = [];
  (async () => { const dec = new TextDecoder(); try { for (;;) { const { value, done } = await stream.read(); if (done) break; seen.push(dec.decode(value)); } } catch { /* bridge killed at the end */ } })();
  await send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  await send({ jsonrpc: '2.0', id: 2, method: 'session/new', params: { cwd: proj } });
  await send({ jsonrpc: '2.0', id: 3, method: 'session/prompt', params: { sessionId: 's1', prompt: [{ type: 'text', text: 'hi' }] } });
  for (let i = 0; i < 50 && !seen.join('').includes('end_turn'); i++) await sleep(100);
  assert.ok(seen.join('').includes('echo: hi'), 'agent streamed a message');
  assert.equal(fs.readFileSync(path.join(proj, 'agent-was-here.txt'), 'utf8'), 'prompt: hi\n', 'agent ran in the workspace');
  await f('/agent/' + sid, { method: 'DELETE', headers: H });

  // git / GitHub bridge
  assert.equal((await j('/git/status')).isRepo, false, 'not a git repo initially');
  assert.equal((await post('/git/init', {})).status, 200, 'git init');
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: proj });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: proj });
  assert.equal((await post('/git/remote', { url: 'octocat/hello-world' })).status, 200, 'connect GitHub shorthand remote');
  assert.equal((await post('/git/remote', { url: '--upload-pack=evil' })).status, 400, 'reject git arg injection');
  assert.equal((await post('/git/clone', { url: 'file:///etc/passwd' })).status, 400, 'reject file:// clone');
  let gs = await j('/git/status');
  assert.equal(gs.isRepo, true);
  assert.equal(gs.remote.slug, 'octocat/hello-world');
  assert.equal(gs.remote.githubUrl, 'https://github.com/octocat/hello-world');
  assert.ok(gs.unstaged.some(x => x.path === 'agent-was-here.txt' && x.untracked), 'tracks untracked files');
  assert.equal((await post('/git/stage', { paths: ['agent-was-here.txt'] })).status, 200, 'stage file');
  gs = await j('/git/status');
  assert.ok(gs.staged.some(x => x.path === 'agent-was-here.txt' && x.status === 'A'), 'file staged');
  assert.equal((await post('/git/unstage', { paths: ['agent-was-here.txt'] })).status, 200, 'unstage unborn HEAD');
  assert.equal((await post('/git/stage', { paths: ['agent-was-here.txt'] })).status, 200, 're-stage file');
  assert.equal((await post('/git/commit', { message: 'initial commit' })).status, 200, 'git commit');
  fs.writeFileSync(path.join(proj, 'agent-was-here.txt'), 'modified\n');
  const diffRes = await j('/git/diff?path=agent-was-here.txt&staged=0');
  assert.equal(diffRes.original, 'prompt: hi\n');
  assert.equal(diffRes.modified, 'modified\n');
  assert.equal((await post('/git/checkout', { branch: 'feat/test', create: true })).status, 200, 'create branch');
  gs = await j('/git/status');
  assert.equal(gs.branch, 'feat/test');
  const log = await j('/git/log?limit=5');
  assert.equal(log.length, 1, 'no trailing empty commit entry');
  assert.equal(log[0].subject, 'initial commit');

  // VS Code extension host & endpoints
  const extRoot = path.join(home, '.webide', 'extensions', 'demo.theme-pack', 'extension');
  fs.mkdirSync(path.join(extRoot, 'themes'), { recursive: true });
  fs.mkdirSync(path.join(extRoot, 'syntaxes'), { recursive: true });
  fs.mkdirSync(path.join(extRoot, 'snippets'), { recursive: true });
  fs.mkdirSync(path.join(extRoot, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(extRoot, 'icon.png'), Buffer.from('iVBORw0KGgo=', 'base64'));
  fs.writeFileSync(path.join(extRoot, 'package.json'), JSON.stringify({
    name: 'theme-pack', publisher: 'demo', displayName: 'Demo Pack', version: '1.2.3', description: 'Test pack',
    icon: 'icon.png', browser: './dist/web.js',
    contributes: {
      themes: [{ label: 'Demo Obsidian', uiTheme: 'vs-dark', path: './themes/demo.json' }],
      languages: [{ id: 'demolang', extensions: ['.dlang'] }],
      grammars: [{ language: 'demolang', scopeName: 'source.demolang', path: './syntaxes/demo.tmLanguage.json' }],
      snippets: [{ language: 'demolang', path: './snippets/demo.json' }],
      commands: [{ command: 'demo.hello', title: 'Say Hello', category: 'Demo' }],
    },
  }));
  fs.writeFileSync(path.join(extRoot, 'themes', 'demo.json'), '// JSONC theme\n{ "colors": { "editor.background": "#10121a", }, "tokenColors": [{ "scope": "comment", "settings": { "foreground": "#6b7280" } }] }');
  fs.writeFileSync(path.join(extRoot, 'syntaxes', 'demo.tmLanguage.json'), JSON.stringify({ patterns: [{ match: '\\b(fn|let)\\b', name: 'keyword.control' }] }));
  fs.writeFileSync(path.join(extRoot, 'snippets', 'demo.json'), JSON.stringify({ Hello: { prefix: 'hi', body: ['hello $1'] } }));
  fs.writeFileSync(path.join(extRoot, 'dist', 'web.js'), 'exports.activate = () => {};');

  let exts = await j('/ext/installed');
  assert.equal(exts.length, 1, 'lists installed extension');
  assert.equal(exts[0].themes[0].colors['editor.background'], '#10121a', 'parses JSONC theme');
  assert.equal(exts[0].grammars.length, 1, 'loads grammar');
  assert.equal(exts[0].snippets.length, 1, 'loads snippets');
  assert.equal(exts[0].hasBrowser, true, 'detects browser entry');

  assert.equal((await f('/ext/demo.theme-pack/bundle.js')).status, 403, 'blocks cross-site bundle fetch without sec-fetch-site');
  const bRes = await f('/ext/demo.theme-pack/bundle.js', { headers: { 'sec-fetch-site': 'same-origin' } });
  assert.equal(bRes.status, 200, 'serves wrapped bundle to same-origin');
  const bText = await bRes.text();
  assert.ok(bText.includes('window.__webideExtDefine("demo.theme-pack"') && bText.includes('define'), 'wraps bundle & shadows AMD define');
  assert.equal((await f('/ext/demo.theme-pack/icon', { headers: { 'sec-fetch-site': 'same-origin' } })).status, 200, 'serves local extension icon');
  assert.equal((await post('/ext/install', { id: 'a.b', vsixUrl: 'https://evil.example.com/x.vsix' })).status, 400, 'rejects untrusted vsix host');
  assert.equal((await post('/ext/toggle', { id: 'demo.theme-pack', enabled: false })).status, 200, 'disables extension');
  exts = await j('/ext/installed');
  assert.equal(exts[0].enabled, false, 'persisted disabled state');
  assert.equal((await post('/ext/uninstall', { id: 'demo.theme-pack' })).status, 200, 'uninstalls extension');
  assert.equal((await j('/ext/installed')).length, 0, 'extension removed');

  console.log('OK: bridge self-check passed');
} finally {
  bridge.kill();
  fs.rmSync(home, { recursive: true, force: true });
}
