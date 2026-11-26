/* Value classes shared with the former in-page extension host (Disposable, Position,
   Range, Selection, Uri, etc.), extracted unchanged so extension code sees the same
   object shapes it did before sandboxing. */
class Disposable { constructor(fn) { this._fn = fn; } dispose() { try { this._fn?.(); } catch {} } static from(...ds) { return new Disposable(() => ds.forEach(d => d?.dispose?.())); } }
class EventEmitter {
  constructor() { this._ls = new Set(); this.event = (fn, thisArg, ds) => { const f = thisArg ? fn.bind(thisArg) : fn; this._ls.add(f); const d = new Disposable(() => this._ls.delete(f)); if (Array.isArray(ds)) ds.push(d); return d; }; }
  fire(v) { for (const f of [...this._ls]) try { f(v); } catch {} }
  dispose() { this._ls.clear(); }
}
class Position {
  constructor(line, character) { this.line = line; this.character = character; }
  translate(dl = 0, dc = 0) { return new Position(this.line + dl, this.character + dc); }
  with(l = this.line, c = this.character) { return new Position(l, c); }
  compareTo(o) { return this.line !== o.line ? this.line - o.line : this.character - o.character; }
  isBefore(o) { return this.compareTo(o) < 0; }
  isBeforeOrEqual(o) { return this.compareTo(o) <= 0; }
  isAfter(o) { return this.compareTo(o) > 0; }
  isAfterOrEqual(o) { return this.compareTo(o) >= 0; }
  isEqual(o) { return !!o && o.line === this.line && o.character === this.character; }
}
class Range {
  constructor(a, b, c, d) {
    const p1 = typeof a === 'number' ? new Position(a, b) : (a instanceof Position ? a : new Position(a?.line ?? 0, a?.character ?? 0));
    const p2 = typeof a === 'number' ? new Position(c, d) : (b instanceof Position ? b : new Position(b?.line ?? p1.line, b?.character ?? p1.character));
    if (p1.isAfter(p2)) { this.start = p2; this.end = p1; } else { this.start = p1; this.end = p2; }
  }
  get isEmpty() { return this.start.isEqual(this.end); }
  get isSingleLine() { return this.start.line === this.end.line; }
  contains(posOrRange) {
    if (posOrRange?.start && posOrRange?.end) return !posOrRange.start.isBefore(this.start) && !posOrRange.end.isAfter(this.end);
    return !posOrRange.isBefore(this.start) && !posOrRange.isAfter(this.end);
  }
  isEqual(o) { return !!o && this.start.isEqual(o.start) && this.end.isEqual(o.end); }
  intersection(o) { const s = this.start.isAfter(o.start) ? this.start : o.start, e = this.end.isBefore(o.end) ? this.end : o.end; return s.isAfter(e) ? undefined : new Range(s, e); }
  union(o) { return new Range(this.start.isBefore(o.start) ? this.start : o.start, this.end.isAfter(o.end) ? this.end : o.end); }
  with(s, e) {
    if (s && typeof s === 'object' && !('line' in s) && ('start' in s || 'end' in s)) {
      return new Range(s.start ?? this.start, s.end ?? this.end);
    }
    return new Range(s ?? this.start, e ?? this.end);
  }
}
class Selection extends Range {
  constructor(a, b, c, d) {
    super(a, b, c, d);
    this.anchor = typeof a === 'number' ? new Position(a, b) : new Position(a?.line ?? 0, a?.character ?? 0);
    this.active = typeof a === 'number' ? new Position(c, d) : new Position(b?.line ?? 0, b?.character ?? 0);
  }
  get isReversed() { return this.active.isBefore(this.anchor); }
}
class TextEdit { constructor(range, newText) { this.range = range; this.newText = newText; } static replace(r, t) { return new TextEdit(r, t); } static insert(p, t) { return new TextEdit(new Range(p, p), t); } static delete(r) { return new TextEdit(r, ''); } }
class WorkspaceEdit {
  constructor() { this._edits = []; }
  replace(u, r, t) { this._edits.push({ u, r, t }); }
  insert(u, p, t) { this._edits.push({ u, r: new Range(p, p), t }); }
  delete(u, r) { this._edits.push({ u, r, t: '' }); }
  entries() {
    const m = new Map();
    for (const e of this._edits) { const k = String(e.u || ''); if (!m.has(k)) m.set(k, [e.u, []]); m.get(k)[1].push(new TextEdit(e.r, e.t)); }
    return [...m.values()];
  }
}
class Diagnostic {
  constructor(range, message, severity = 0) { this.range = range; this.message = message; this.severity = severity; this.source = ''; this.code = undefined; this.tags = []; }
}
class CodeActionKind {
  constructor(value) { this.value = value; }
  append(part) { return new CodeActionKind(this.value ? `${this.value}.${part}` : part); }
  contains(o) { const v = typeof o === 'string' ? o : o?.value || ''; return this.value === v || v.startsWith(this.value + '.'); }
}
CodeActionKind.Empty = new CodeActionKind('');
CodeActionKind.QuickFix = new CodeActionKind('quickfix');
CodeActionKind.Refactor = new CodeActionKind('refactor');
CodeActionKind.RefactorExtract = new CodeActionKind('refactor.extract');
CodeActionKind.RefactorInline = new CodeActionKind('refactor.inline');
CodeActionKind.RefactorRewrite = new CodeActionKind('refactor.rewrite');
CodeActionKind.Source = new CodeActionKind('source');
CodeActionKind.SourceOrganizeImports = new CodeActionKind('source.organizeImports');
CodeActionKind.SourceFixAll = new CodeActionKind('source.fixAll');
class CodeAction { constructor(title, kind) { this.title = title; this.kind = kind; this.diagnostics = []; this.isPreferred = false; } }
class RelativePattern { constructor(base, pattern) { this.baseUri = typeof base === 'string' ? Uri.file(base) : (base?.uri || base); this.base = this.baseUri?.path || '/'; this.pattern = pattern; } }
class CustomExecution { constructor(cb) { this._cb = cb; } }
class Task { constructor(def, scope, name, source, execution, problemMatchers) { Object.assign(this, { definition: def, scope, name, source, execution, problemMatchers }); } }
class MarkdownString { constructor(value = '') { this.value = value; } appendText(s) { this.value += s; return this; } appendMarkdown(s) { this.value += s; return this; } }
class Hover { constructor(contents, range) { this.contents = Array.isArray(contents) ? contents : [contents]; this.range = range; } }
class CompletionItem { constructor(label, kind) { this.label = label; this.kind = kind; } }
class SnippetString { constructor(value = '') { this.value = value; } }
class CancellationTokenSource { constructor() { this.token = { isCancellationRequested: false, onCancellationRequested: () => new Disposable() }; } cancel() { this.token.isCancellationRequested = true; } dispose() {} }
const normUriPath = p => {
  let s = String(p || '');
  if (s.startsWith('file://')) s = s.slice(7);
  s = s.replace(/\\/g, '/').replace(/\/+/g, '/');
  return s.startsWith('/') ? s : '/' + s;
};
const makeUri = (scheme, pathStr, query = '', fragment = '') => {
  const p = scheme === 'file' ? normUriPath(pathStr) : String(pathStr || '');
  return {
    scheme, path: p, fsPath: p, authority: '', query, fragment,
    toString: () => (scheme === 'file' ? 'file://' + p : `${scheme}:${p}`) + (query ? '?' + query : '') + (fragment ? '#' + fragment : ''),
    with(ch = {}) { return makeUri(ch.scheme ?? scheme, ch.path ?? p, ch.query ?? query, ch.fragment ?? fragment); },
  };
};
const Uri = {
  file: p => makeUri('file', normUriPath(p)),
  parse: s => {
    const raw = String(s || '');
    const m = raw.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):(\/\/[^/?#]*)?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/);
    if (!m) return makeUri('file', normUriPath(raw));
    return makeUri(m[1], m[3] || '/', m[4] || '', m[5] || '');
  },
  joinPath: (u, ...parts) => makeUri(u?.scheme || 'file', [u?.path || '/', ...parts].join('/').replace(/\/+/g, '/')),
};
const fromMPos = p => new Position((p?.lineNumber ?? 1) - 1, (p?.column ?? 1) - 1);
const fromMRange = r => new Range((r.startLineNumber ?? 1) - 1, (r.startColumn ?? 1) - 1, (r.endLineNumber ?? 1) - 1, (r.endColumn ?? 1) - 1);

'use strict';
/* WebIDE extension sandbox host.
 * This page is loaded in an <iframe sandbox="allow-scripts"> WITHOUT allow-same-origin,
 * so everything here runs on an opaque origin: extension code cannot reach the parent
 * page's DOM, localStorage, sessionStorage, cookies or IndexedDB (workspaces, GitHub
 * token). All interaction with the IDE goes through the postMessage RPC below, and the
 * parent only exposes the explicit capability methods in PARENT_CALLS.
 * Supported vscode surface (sandbox v1): commands, messages, quick pick / input box,
 * configuration (parent-synced snapshot), memento state (parent-persisted), workspace
 * file access via RPC, applyEdit, document snapshot events, and completion / hover /
 * formatting / code-action providers via RPC. Task providers are not supported. */

// ---------- RPC plumbing ----------
const pending = new Map();
let seq = 0;
const post = msg => parent.postMessage({ __extHost: 1, ...msg }, '*');
function callParent(method, params) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    post({ kind: 'call', id, method, params });
    setTimeout(() => { if (pending.delete(id)) reject(new Error('Extension host call timed out: ' + method)); }, 20000);
  });
}
const note = (method, params) => post({ kind: 'note', method, params });

// ---------- per-extension state ----------
const exts = new Map(); // dir -> state
function stateFor(dir) { return exts.get(dir); }

class SnapshotDoc {
  constructor(snap) { this._set(snap); }
  _set(snap) {
    this._snap = snap;
    this.uri = Uri.file(snap.uriPath || ('/' + snap.rel));
    this.fileName = this.uri.path;
    this.languageId = snap.languageId || 'plaintext';
    this.version = snap.version || 0;
    this.isDirty = !!snap.isDirty;
    this.isUntitled = false;
    this.eol = 1;
    this._lines = null;
  }
  get rel() { return this._snap.rel; }
  get lineCount() { return this._text().split('\n').length; }
  _text() { return this._snap.text || ''; }
  _lineStarts() {
    if (!this._lines) {
      const t = this._text(), starts = [0];
      for (let i = 0; i < t.length; i++) if (t[i] === '\n') starts.push(i + 1);
      this._lines = starts;
    }
    return this._lines;
  }
  getText(range) {
    const t = this._text();
    if (!range) return t;
    return t.slice(this.offsetAt(range.start), this.offsetAt(range.end));
  }
  lineAt(n) {
    const line = typeof n === 'number' ? n : n.line;
    const starts = this._lineStarts(), t = this._text();
    const start = starts[line] ?? t.length;
    const end = line + 1 < starts.length ? starts[line + 1] - 1 : t.length;
    const txt = t.slice(start, end).replace(/\r$/, '');
    const range = new Range(line, 0, line, txt.length);
    return {
      lineNumber: line, text: txt, range,
      rangeIncludingLineBreak: line + 1 < starts.length ? new Range(line, 0, line + 1, 0) : range,
      firstNonWhitespaceCharacterIndex: txt.search(/\S|$/),
      isEmptyOrWhitespace: !/\S/.test(txt),
    };
  }
  positionAt(off) {
    const starts = this._lineStarts();
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; }
    return new Position(lo, off - starts[lo]);
  }
  offsetAt(pos) { const starts = this._lineStarts(); return (starts[pos.line] ?? this._text().length) + pos.character; }
  validateRange(r) { return new Range(Math.max(0, r.start.line), Math.max(0, r.start.character), Math.max(0, r.end.line), Math.max(0, r.end.character)); }
  validatePosition(p) { return new Position(Math.max(0, p.line), Math.max(0, p.character)); }
  getWordRangeAtPosition(p) {
    const line = this.lineAt(p.line).text;
    const isWord = c => /[A-Za-z0-9_$]/.test(c || '');
    let a = p.character, b = p.character;
    while (a > 0 && isWord(line[a - 1])) a--;
    while (b < line.length && isWord(line[b])) b++;
    return a < b ? new Range(p.line, a, p.line, b) : undefined;
  }
  save() { return callParent('saveDoc', { rel: this.rel }).then(() => true); }
}

function selectorLangs(sel) {
  const list = Array.isArray(sel) ? sel : [sel];
  const out = new Set();
  for (const s of list) {
    if (typeof s === 'string') out.add(s);
    else if (s && s.language) out.add(s.language);
  }
  return out.size ? [...out] : ['markdown', 'plaintext'];
}
const plainRange = r => r ? { start: { line: r.start.line, character: r.start.character }, end: { line: r.end.line, character: r.end.character } } : undefined;
const plainPos = p => p ? { line: p.line, character: p.character } : undefined;
const fromPlainRange = r => r ? new Range(r.start.line, r.start.character, r.end.line, r.end.character) : undefined;
const fromPlainPos = p => p ? new Position(p.line, p.character) : undefined;

// ---------- the vscode API shim (runs inside the sandbox) ----------
function createSandboxApi(st) {
  const subs = st.subscriptions;
  const track = d => { if (d && typeof d.dispose === 'function') subs.push(d); return d; };
  const mkEvent = register => (fn, thisArg, ds) => {
    const f = thisArg ? fn.bind(thisArg) : fn;
    const d = register(f);
    if (Array.isArray(ds)) ds.push(d);
    return d;
  };
  const docEvent = channel => mkEvent(f => {
    if (!st.docListeners.has(channel)) st.docListeners.set(channel, new Set());
    st.docListeners.get(channel).add(f);
    return new Disposable(() => st.docListeners.get(channel)?.delete(f));
  });
  const editorWrap = snap => {
    if (!snap) return undefined;
    const doc = st.docs.get(snap.rel) || new SnapshotDoc(snap);
    return {
      document: doc,
      selection: new Selection(0, 0, 0, 0),
      selections: [new Selection(0, 0, 0, 0)],
      options: { tabSize: 4, insertSpaces: true },
      edit(cb) {
        const edits = [];
        cb({
          replace: (target, text) => edits.push({ path: doc.uri.path, range: plainRange(target && target.line != null ? new Range(target, target) : target), text }),
          insert: (pos, text) => edits.push({ path: doc.uri.path, range: plainRange(new Range(pos, pos)), text }),
          delete: range => edits.push({ path: doc.uri.path, range: plainRange(range), text: '' }),
        });
        return edits.length ? callParent('applyEdit', { dir: st.dir, edits }) : Promise.resolve(true);
      },
    };
  };
  st.editorWrap = editorWrap;

  const api = {
    version: '1.95.0',
    Disposable, EventEmitter, Position, Range, Selection, TextEdit, WorkspaceEdit, Diagnostic, CodeAction, CodeActionKind,
    RelativePattern, CustomExecution, Task, MarkdownString, Hover, CompletionItem, SnippetString, CancellationTokenSource, Uri,
    CompletionItemKind: { Text: 0, Method: 1, Function: 2, Constructor: 3, Field: 4, Variable: 5, Class: 6, Interface: 7, Module: 8, Property: 9, Unit: 10, Value: 11, Enum: 12, Keyword: 13, Snippet: 14, Color: 15, File: 16, Reference: 17, Folder: 18, EnumMember: 19, Constant: 20, Struct: 21, Event: 22, Operator: 23, TypeParameter: 24 },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    SymbolKind: { File: 0, Module: 1, Namespace: 2, Package: 3, Class: 4, Method: 5, Property: 6, Field: 7, Constructor: 8, Enum: 9, Interface: 10, Function: 11, Variable: 12, Constant: 13, String: 14, Number: 15, Boolean: 16, Array: 17, Object: 18, Key: 19, Null: 20, EnumMember: 21, Struct: 22, Event: 23, Operator: 24, TypeParameter: 25 },
    IndentAction: { None: 0, Indent: 1, IndentOutdent: 2, Outdent: 3 },
    UIKind: { Desktop: 1, Web: 2 },
    ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
    env: { appName: 'WebIDE', uiKind: 2, language: navigator.language || 'en', isNewAppInstall: false, remoteName: undefined, machineId: 'sandbox', sessionId: 'sandbox', openExternal: () => Promise.resolve(false), clipboard: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') } },
    extensions: { getExtension: () => undefined, all: [], onDidChange: () => new Disposable() },
    commands: {
      registerCommand(id, fn) {
        st.commands.set(id, fn);
        note('providersChanged', { dir: st.dir });
        return track(new Disposable(() => st.commands.delete(id)));
      },
      registerTextEditorCommand(id, fn) {
        return api.commands.registerCommand(id, (...args) => { const ed = editorWrap(st.activeSnap); if (ed) return fn(ed, {}, ...args); });
      },
      async executeCommand(id, ...args) {
        if (st.commands.has(id)) return st.commands.get(id)(...args);
        return callParent('relayCommand', { fromDir: st.dir, id, args });
      },
      getCommands: async () => [...st.commands.keys()],
    },
    window: {
      get activeTextEditor() { return editorWrap(st.activeSnap); },
      get visibleTextEditors() { const e = editorWrap(st.activeSnap); return e ? [e] : []; },
      showInformationMessage: (msg, ...items) => callParent('toast', { kind: 'info', msg: String(msg) }).then(() => (typeof items[0] === 'string' ? items[0] : undefined)),
      showWarningMessage: (msg, ...items) => callParent('toast', { kind: 'warn', msg: String(msg) }).then(() => (typeof items[0] === 'string' ? items[0] : undefined)),
      showErrorMessage: (msg, ...items) => callParent('toast', { kind: 'error', msg: String(msg) }).then(() => (typeof items[0] === 'string' ? items[0] : undefined)),
      showQuickPick: (items = []) => callParent('quickPick', { items: (Array.isArray(items) ? items : []).map(x => (typeof x === 'string' ? x : x?.label ?? String(x))) }).then(label => (Array.isArray(items) ? items.find(x => (typeof x === 'string' ? x : x?.label) === label) : undefined)),
      showInputBox: (opts = {}) => callParent('inputBox', { prompt: opts.prompt || opts.placeHolder || '', value: opts.value || '' }),
      showTextDocument: async docOrUri => {
        const path = String(docOrUri?.uri?.path || docOrUri?.path || docOrUri || '');
        const snap = await callParent('showDoc', { dir: st.dir, path });
        return snap ? editorWrap(snap) : undefined;
      },
      createOutputChannel: name => ({
        name,
        append() {},
        appendLine(s) { note('log', { dir: st.dir, name, msg: String(s) }); },
        replace() {}, clear() {}, show() {}, hide() {}, dispose() {},
      }),
      createStatusBarItem: () => ({ text: '', tooltip: '', command: '', show() {}, hide() {}, dispose() {} }),
      onDidChangeActiveTextEditor: docEvent('activeEditor'),
      onDidChangeVisibleTextEditors: docEvent('activeEditor'),
      onDidChangeTextEditorSelection: docEvent('selection'),
    },
    workspace: {
      isTrusted: true,
      get workspaceFolders() { return st.workspaceFolder ? [{ uri: Uri.file('/'), name: st.workspaceFolder.name, index: 0 }] : undefined; },
      getWorkspaceFolder: () => (st.workspaceFolder ? { uri: Uri.file('/'), name: st.workspaceFolder.name, index: 0 } : undefined),
      asRelativePath: p => String(typeof p === 'string' ? p : p?.path || '').replace(/^\/+/, ''),
      get textDocuments() { return [...st.docs.values()]; },
      openTextDocument: async uriOrPath => {
        const path = String(uriOrPath?.path || uriOrPath || '');
        const snap = await callParent('openDoc', { dir: st.dir, path });
        if (!snap) return undefined;
        const doc = new SnapshotDoc(snap);
        st.docs.set(doc.rel, doc);
        return doc;
      },
      getConfiguration: section => ({
        get: (k, def) => {
          const store = st.config[section || ''] || {};
          if (k in store) return store[k];
          const fullKey = section ? `${section}.${k}` : k;
          if (fullKey in st.configDefaults) return st.configDefaults[fullKey];
          return def;
        },
        has: k => (k in (st.config[section || ''] || {})) || ((section ? `${section}.${k}` : k) in st.configDefaults),
        inspect: k => {
          const fullKey = section ? `${section}.${k}` : k;
          return { key: fullKey, defaultValue: st.configDefaults[fullKey], workspaceValue: (st.config[section || ''] || {})[k] };
        },
        update: (k, v) => callParent('configUpdate', { dir: st.dir, section: section || '', key: k, value: v }).then(() => {
          if (!st.config[section || '']) st.config[section || ''] = {};
          if (v === undefined) delete st.config[section || ''][k]; else st.config[section || ''][k] = v;
        }),
      }),
      onDidOpenTextDocument: docEvent('openDoc'),
      onDidCloseTextDocument: docEvent('closeDoc'),
      onDidSaveTextDocument: docEvent('saveDoc'),
      onDidChangeTextDocument: docEvent('changeDoc'),
      onDidChangeConfiguration: mkEvent(f => { st.configListeners.add(f); return new Disposable(() => st.configListeners.delete(f)); }),
      onDidGrantWorkspaceTrust: () => new Disposable(),
      onDidChangeWorkspaceFolders: docEvent('workspaceFolders'),
      createFileSystemWatcher: () => ({ ignoreCreateEvents: false, ignoreChangeEvents: false, ignoreDeleteEvents: false, onDidCreate: () => new Disposable(), onDidChange: () => new Disposable(), onDidDelete: () => new Disposable(), dispose() {} }),
      findFiles: async () => (await callParent('findFiles', { dir: st.dir })).map(p => Uri.file('/' + p)),
      applyEdit: async we => {
        const edits = (we?._edits || []).map(x => ({ path: String(x.u?.path || x.u || ''), range: plainRange(x.r), text: x.t }));
        if (!edits.length) return false;
        return callParent('applyEdit', { dir: st.dir, edits });
      },
      fs: {
        readFile: async u => {
          const b64 = await callParent('fsRead', { dir: st.dir, path: String(u?.path || u || '') });
          const bin = atob(b64); const out = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
          return out;
        },
        writeFile: async (u, bytes) => {
          let bin = ''; const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
          for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode(...u8.subarray(i, i + 8192));
          await callParent('fsWrite', { dir: st.dir, path: String(u?.path || u || ''), b64: btoa(bin) });
        },
        stat: u => callParent('fsStat', { dir: st.dir, path: String(u?.path || u || '') }),
        readDirectory: u => callParent('fsList', { dir: st.dir, path: String(u?.path || u || '') }),
      },
    },
    tasks: {
      registerTaskProvider: () => { throw new Error('Task providers are not supported in the WebIDE extension sandbox yet.'); },
      fetchTasks: async () => [],
      executeTask: async () => ({ terminate() {} }),
    },
    languages: {
      createDiagnosticCollection(name = 'default') {
        const col = {
          name,
          set(uriOrPairs, diags) {
            const entries = Array.isArray(uriOrPairs)
              ? uriOrPairs.map(([u, d]) => ({ path: String(u?.path || u || ''), diags: marshalDiags(d) }))
              : [{ path: String(uriOrPairs?.path || uriOrPairs || ''), diags: marshalDiags(diags) }];
            callParent('diagSet', { dir: st.dir, name, entries }).catch(() => {});
          },
          delete(u) { callParent('diagSet', { dir: st.dir, name, entries: [{ path: String(u?.path || u || ''), diags: [] }] }).catch(() => {}); },
          clear() { callParent('diagClear', { dir: st.dir, name }).catch(() => {}); },
          forEach() {}, get: () => undefined, has: () => false,
          dispose() { callParent('diagClear', { dir: st.dir, name }).catch(() => {}); },
        };
        return track(col);
      },
      registerCompletionItemProvider(sel, prov, ...triggers) {
        const rec = { kind: 'completion', langs: selectorLangs(sel), triggers, prov };
        st.providers.push(rec); note('providersChanged', { dir: st.dir });
        return track(new Disposable(() => { st.providers = st.providers.filter(x => x !== rec); note('providersChanged', { dir: st.dir }); }));
      },
      registerHoverProvider(sel, prov) {
        const rec = { kind: 'hover', langs: selectorLangs(sel), prov };
        st.providers.push(rec); note('providersChanged', { dir: st.dir });
        return track(new Disposable(() => { st.providers = st.providers.filter(x => x !== rec); note('providersChanged', { dir: st.dir }); }));
      },
      registerDocumentFormattingEditProvider(sel, prov) {
        const rec = { kind: 'format', langs: selectorLangs(sel), prov };
        st.providers.push(rec); note('providersChanged', { dir: st.dir });
        return track(new Disposable(() => { st.providers = st.providers.filter(x => x !== rec); note('providersChanged', { dir: st.dir }); }));
      },
      registerDocumentRangeFormattingEditProvider(sel, prov) {
        const rec = { kind: 'rangeFormat', langs: selectorLangs(sel), prov };
        st.providers.push(rec); note('providersChanged', { dir: st.dir });
        return track(new Disposable(() => { st.providers = st.providers.filter(x => x !== rec); note('providersChanged', { dir: st.dir }); }));
      },
      registerCodeActionsProvider(sel, prov) {
        const rec = { kind: 'codeActions', langs: selectorLangs(sel), prov };
        st.providers.push(rec); note('providersChanged', { dir: st.dir });
        return track(new Disposable(() => { st.providers = st.providers.filter(x => x !== rec); note('providersChanged', { dir: st.dir }); }));
      },
      setTextDocumentLanguage: () => new Disposable(),
    },
  };
  return api;
}
function marshalDiags(diags) {
  return (Array.isArray(diags) ? diags : []).map(d => ({
    range: plainRange(d.range), message: String(d.message || ''), severity: d.severity ?? 1,
    source: d.source || '', code: typeof d.code === 'object' ? String(d.code?.value ?? '') : (d.code != null ? String(d.code) : undefined),
  }));
}

// ---------- extension lifecycle ----------
const factories = new Map();
window.__webideExtDefine = (dir, factory) => { factories.set(dir, factory); };

async function loadExtension(p) {
  unloadExtension(p.dir);
  const st = {
    dir: p.dir, id: p.id, commands: new Map(), providers: [], subscriptions: [],
    config: p.config || {}, configDefaults: p.configDefaults || {},
    mementoData: { global: { ...(p.memento?.global || {}) }, workspace: { ...(p.memento?.workspace || {}) } },
    workspaceFolder: p.workspaceFolder || null,
    docs: new Map(), docListeners: new Map(), configListeners: new Set(),
    activeSnap: null, exports: {},
  };
  for (const snap of p.docs || []) st.docs.set(snap.rel, new SnapshotDoc(snap));
  if (p.activeRel && st.docs.has(p.activeRel)) st.activeSnap = st.docs.get(p.activeRel)._snap;
  exts.set(p.dir, st);
  if (!factories.has(p.dir)) {
    const wrapped = `window.__webideExtDefine(${JSON.stringify(p.dir)}, function(require, module, exports, define) {\n${p.code}\n});`;
    const blobUrl = URL.createObjectURL(new Blob([wrapped], { type: 'text/javascript' }));
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = blobUrl; s.onload = () => { URL.revokeObjectURL(blobUrl); resolve(); };
      s.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Failed to load extension bundle')); };
      document.head.append(s);
    });
  }
  const factory = factories.get(p.dir);
  if (!factory) throw new Error('Extension factory missing after bundle load');
  const api = createSandboxApi(st);
  const pathShim = {
    join: (...a) => a.filter(Boolean).join('/').replace(/\/+/g, '/'),
    basename: pp => String(pp || '').split(/[\\/]/).filter(Boolean).pop() || '',
    dirname: pp => String(pp || '').split('/').slice(0, -1).join('/') || '/',
    extname: pp => { const b = String(pp || '').split(/[\\/]/).pop() || ''; const m = b.match(/\.[^.]+$/); return m ? m[0] : ''; },
  };
  const req = name => (name === 'vscode' ? api : name === 'path' || name === 'node:path' ? pathShim : name === 'events' ? { EventEmitter } : {});
  const mod = { exports: {} };
  factory(req, mod, mod.exports, undefined);
  st.exports = mod.exports || {};
  const makeMemento = which => ({
    get: (k, d) => (k in st.mementoData[which] ? st.mementoData[which][k] : d),
    update: (k, v) => {
      if (v === undefined) delete st.mementoData[which][k]; else st.mementoData[which][k] = v;
      return callParent('mementoUpdate', { dir: st.dir, which, key: k, value: v });
    },
    setKeysForSync: () => {},
  });
  const ctx = {
    subscriptions: st.subscriptions,
    extensionUri: api.Uri.file('/ext/' + p.dir),
    extensionPath: '/ext/' + p.dir,
    globalState: makeMemento('global'),
    workspaceState: makeMemento('workspace'),
    asAbsolutePath: pp => pp,
  };
  if (typeof st.exports.activate === 'function') await st.exports.activate(ctx);
  return { commands: [...st.commands.keys()], providers: st.providers.map(x => ({ kind: x.kind, langs: x.langs, triggers: x.triggers || [] })) };
}
function providersOf(dir) {
  const st = stateFor(dir);
  return st ? { commands: [...st.commands.keys()], providers: st.providers.map(x => ({ kind: x.kind, langs: x.langs, triggers: x.triggers || [] })) } : { commands: [], providers: [] };
}
function unloadExtension(dir) {
  const st = stateFor(dir);
  if (!st) return;
  try { st.exports?.deactivate?.(); } catch {}
  for (const d of st.subscriptions) try { d.dispose?.(); } catch {}
  exts.delete(dir);
}

async function runProvider(p) {
  const st = stateFor(p.dir);
  if (!st) throw new Error('Extension not loaded');
  const rec = st.providers.find(x => x.kind === p.kind && x.langs.includes(p.lang));
  if (!rec) return null;
  const doc = new SnapshotDoc(p.doc);
  st.docs.set(doc.rel, doc);
  const token = { isCancellationRequested: false, onCancellationRequested: () => new Disposable() };
  if (p.kind === 'completion') {
    const res = await rec.prov.provideCompletionItems?.(doc, fromPlainPos(p.position), token, {});
    const items = Array.isArray(res) ? res : res?.items || [];
    return {
      incomplete: !!res?.isIncomplete,
      items: items.map(it => ({
        label: typeof it.label === 'string' ? it.label : it.label?.label || '',
        kind: it.kind, detail: it.detail,
        documentation: typeof it.documentation === 'string' ? it.documentation : it.documentation?.value,
        insertText: it.insertText?.value != null ? { snippet: it.insertText.value } : (typeof it.insertText === 'string' ? it.insertText : undefined),
        filterText: it.filterText, sortText: it.sortText,
      })),
    };
  }
  if (p.kind === 'hover') {
    const h = await rec.prov.provideHover?.(doc, fromPlainPos(p.position), token);
    if (!h) return null;
    return { contents: (h.contents || []).map(c => (typeof c === 'string' ? c : c?.value || '')), range: plainRange(h.range) };
  }
  if (p.kind === 'format') {
    const res = await rec.prov.provideDocumentFormattingEdits?.(doc, p.options || {}, token);
    return (res || []).map(ed => ({ range: plainRange(ed.range), newText: ed.newText }));
  }
  if (p.kind === 'rangeFormat') {
    const res = await rec.prov.provideDocumentRangeFormattingEdits?.(doc, fromPlainRange(p.range), p.options || {}, token);
    return (res || []).map(ed => ({ range: plainRange(ed.range), newText: ed.newText }));
  }
  if (p.kind === 'codeActions') {
    const ctx = { diagnostics: (p.diagnostics || []).map(d => ({ ...d, range: fromPlainRange(d.range) })), only: undefined, triggerKind: 1 };
    const res = await rec.prov.provideCodeActions?.(doc, fromPlainRange(p.range), ctx, token);
    return (res || []).map(a => ({
      title: a.title, kind: typeof a.kind === 'string' ? a.kind : a.kind?.value || 'quickfix', isPreferred: !!a.isPreferred,
      edit: a.edit?._edits?.length ? { edits: a.edit._edits.map(x => ({ path: String(x.u?.path || x.u || ''), range: plainRange(x.r), text: x.t })) } : undefined,
      command: a.command?.command ? { command: a.command.command, title: a.command.title || a.title, arguments: a.command.arguments } : undefined,
    }));
  }
  return null;
}

function fireDocEvent(p) {
  const st = stateFor(p.dir);
  if (!st) return;
  if (p.doc) {
    const existing = st.docs.get(p.doc.rel);
    if (existing) existing._set(p.doc); else st.docs.set(p.doc.rel, new SnapshotDoc(p.doc));
  }
  if (p.channel === 'closeDoc' && p.rel) st.docs.delete(p.rel);
  if (p.channel === 'activeEditor') st.activeSnap = p.doc || null;
  const ls = st.docListeners.get(p.channel);
  if (!ls?.size) return;
  const doc = p.doc ? st.docs.get(p.doc.rel) : undefined;
  for (const f of [...ls]) {
    try {
      if (p.channel === 'activeEditor') f(p.doc ? createEditorArg(st, p.doc) : undefined);
      else if (p.channel === 'selection') { const ed = p.doc ? createEditorArg(st, p.doc) : undefined; f({ textEditor: ed, selections: ed?.selections || [], kind: 0 }); }
      else if (p.channel === 'changeDoc') f({ document: doc, contentChanges: (p.contentChanges || []).map(c => ({ range: fromPlainRange(c.range), rangeOffset: c.rangeOffset, rangeLength: c.rangeLength, text: c.text })) });
      else f(doc);
    } catch (e) { console.warn('sandbox ext listener error:', e); }
  }
}
function createEditorArg(st, snap) {
  const doc = st.docs.get(snap.rel) || new SnapshotDoc(snap);
  return {
    document: doc, selection: new Selection(0, 0, 0, 0), selections: [new Selection(0, 0, 0, 0)],
    options: { tabSize: 4, insertSpaces: true },
    edit(cb) {
      const edits = [];
      cb({
        replace: (target, text) => edits.push({ path: doc.uri.path, range: plainRange(target && target.line != null ? new Range(target, target) : target), text }),
        insert: (pos, text) => edits.push({ path: doc.uri.path, range: plainRange(new Range(pos, pos)), text }),
        delete: range => edits.push({ path: doc.uri.path, range: plainRange(range), text: '' }),
      });
      return edits.length ? callParent('applyEdit', { dir: st.dir, edits }) : Promise.resolve(true);
    },
  };
}

// ---------- message dispatch ----------
addEventListener('message', async e => {
  const m = e.data;
  if (!m || m.__extHost !== 1) return;
  if (m.kind === 'call-reply') {
    const p = pending.get(m.id);
    if (p) { pending.delete(m.id); if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error || 'Extension host call failed')); }
    return;
  }
  if (m.kind !== 'rpc') return;
  const reply = (ok, result, error) => post({ kind: 'rpc-reply', id: m.id, ok, result, error });
  try {
    let result;
    if (m.method === 'load') result = await loadExtension(m.params);
    else if (m.method === 'unload') { unloadExtension(m.params.dir); result = {}; }
    else if (m.method === 'providersOf') result = providersOf(m.params.dir);
    else if (m.method === 'invokeCommand') {
      const st = stateFor(m.params.dir);
      if (!st?.commands.has(m.params.id)) throw new Error('Command not registered: ' + m.params.id);
      result = await st.commands.get(m.params.id)(...(m.params.args || []));
    } else if (m.method === 'provider') result = await runProvider(m.params);
    else if (m.method === 'event') {
      if (m.params.channel === 'configChanged') {
        const st = stateFor(m.params.dir);
        if (st) {
          st.config = m.params.config || {};
          const ev = { affectsConfiguration: s => !m.params.section || s === m.params.section || s.startsWith(m.params.section + '.') };
          for (const f of [...st.configListeners]) try { f(ev); } catch {}
        }
      } else fireDocEvent(m.params);
      result = {};
    } else throw new Error('Unknown sandbox method: ' + m.method);
    reply(true, result === undefined ? null : result);
  } catch (err) {
    reply(false, null, String(err?.message || err));
  }
});
post({ kind: 'ready' });
