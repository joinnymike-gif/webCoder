# WebIDE

**Open. Private. Light. · 开放 · 隐私 · 轻量**

[中文文档](#中文文档) | [English Documentation](#english-documentation)

---

<a id="中文文档"></a>

## 中文文档

一个轻量的本地浏览器 IDE：由本机 Node.js 服务（[bridge.mjs](bridge.mjs)）提供文件系统、PTY 终端、ACP 本地编码 Agent、本地 Git / GitHub 桥接与 VS Code 插件市场下载解包能力；前端单页应用（[web/index.html](web/index.html)）基于 Monaco Editor 与 xterm.js 构建。

### 目录结构

| 文件 | 说明 |
| --- | --- |
| [bridge.mjs](bridge.mjs) | 本地 HTTP 服务与子进程桥接层（默认监听 `127.0.0.1:47321`），负责文件读写、全文搜索、文件监听 SSE、PTY 终端、ACP Agent 会话、Git/GitHub 命令执行以及 VS Code 插件市场 `/ext/*` 管理与 Bundle 包装 |
| [web/index.html](web/index.html) | WebIDE 前端单页应用，包含极简首页、资源管理器、全文搜索、Source Control（Git/GitHub）、VS Code 插件市场与扩展宿主、多工程任务栏、Monaco 编辑器与 Diff 对比视图、多标签终端及 Agent 聊天面板 |
| [site/launch.html](site/launch.html) | 独立入口页，点击 **Open WebIDE** 直接跳转到本地 IDE 服务地址 `http://127.0.0.1:47321/` |
| [test/test.mjs](test/test.mjs) | 端到端自检脚本，覆盖鉴权、路径沙箱、保存冲突、搜索、监听、PTY 终端、Agent 往返、Git 接口及插件系统接口 |
| [test/mock-acp.mjs](test/mock-acp.mjs) | 测试用 Mock ACP Agent（stdio JSON-RPC） |

### 快速启动

运行要求：Node.js（支持 ES Module 与内置 `fetch`，Linux 下递归文件监听建议 Node >= 20）、本机已安装 `git`。

1. 启动本地 WebIDE 服务：
   ```sh
   node bridge.mjs
   ```
2. 浏览器访问：
   ```
   http://127.0.0.1:47321/
   ```
   如需独立静态启动页，也可运行 `python3 -m http.server 8000 -d site` 后访问 `http://localhost:8000/launch.html`。

#### 环境变量与本地状态目录
- `WEBIDE_PORT`：服务监听端口，默认 `47321`（仅绑定 `127.0.0.1`）。
- `WEBIDE_ORIGINS`：允许跨域访问的来源列表（逗号分隔），默认 `http://localhost:8000`。
- `WEBIDE_AGENTS` / `~/.webide/agents.json`：扩展自定义 ACP Agent 启动命令，默认内置 `gemini`（`['gemini', '--acp']`）、`codex`（`['codex-acp']`）、`claude`（`['claude-agent-acp']`）。
- `~/.webide/state.json`：自动记录多工程列表与最近激活的工作区目录（限制在 `$HOME` 内）。
- `~/.webide/extensions/` 与 `~/.webide/extensions.json`：存储已下载解包的 VS Code `.vsix` 插件及启用/禁用状态。

### 核心实现与功能架构

#### 1. 本地 WebIDE 优先直连（无登录拦截与失败锁屏）
- **同源自动会话建连**：[bridge.mjs](bridge.mjs) 提供 `POST /session`，放行同源页面请求自动颁发会话 Token；跨源或未授权 API 访问仍返回 `403` / `401`。
- **无阻塞 Token 续期**：[web/index.html](web/index.html) 移除了全屏锁屏遮罩，缺少 Token 或服务端重启返回 `401` 时由 `ensureToken()` 自动静默续期并重试请求；服务不可达时通过底部非阻塞 Toast 提示。
- **直达式启动页**：[site/launch.html](site/launch.html) 点击 **Open WebIDE** 直接打开 `http://127.0.0.1:47321/`，避免浏览器自定义协议拦截。

#### 2. 品牌 Logo、极简首页与深空曜黑视觉风格
- **左上角 Logo 导航**：活动栏顶部内置品牌 Logo 按钮（`#act-home`），在任意工作区中点击即可切换回首页，再次点击或点击侧栏图标即可回到工作区。
- **极简初始页**：首页 `#home` 隐藏左右侧栏，仅保留 **Open. Private. Light.（开放 · 隐私 · 轻量）** Slogan、**打开本地仓库**（`#home-open-local`）、**从 GitHub 打开**（`#home-open-github`）双入口与快捷键指引。
- **统一视觉体系**：采用深空曜黑（`#060608` / `#0d0d12` / `#111118`）、微网格背景光晕、毛玻璃弹窗与紫蓝青渐变高亮（`#8b5cf6` → `#3b82f6` → `#06b6d4`），覆盖活动栏、标签页、Monaco、xterm 终端、弹窗与 [site/launch.html](site/launch.html)。

#### 3. 多工程任务栏与资源休眠机制
- **任务栏多工程堆叠切换**：底部状态栏上方集成工程任务栏（`#ws-bar`），支持同时打开多个本地或 GitHub 工程并在任务栏中切换（显示活跃/休眠标识、未保存提示点、新增与关闭按钮），[bridge.mjs](bridge.mjs) 通过 `/root` 与 `/projects` 持久化工程列表。
- **非活跃工程资源休眠**：切换工程时自动触发 `hibernateCurrent()` 对切出工程执行资源回收：
  - 释放非活跃工程的 Monaco `ITextModel`，仅保留未保存文件草稿与视图状态，唤醒时按需懒加载当前标签页；
  - 中止 `/fs/watch` SSE 文件监听，清空文件树、搜索结果及 Source Control DOM；
  - 销毁浏览器侧 `xterm.js` 实例并断开终端 / Agent SSE 流以降低内存与渲染开销（后端保留 PTY 50 KB 滚动缓冲与 `?from=` 增量回放），唤醒后按需重建并无缝续接；关闭工程时彻底终止后台进程。

#### 4. VS Code 插件市场无缝衔接与 Web 端插件宿主
WebIDE 直接对接 VS Code Marketplace（不可用时自动回退至 Open VSX），支持在浏览器中搜索、下载、解包并即时生效插件：
- **后端 `/ext/*` 插件管理与安全包装（[bridge.mjs](bridge.mjs)）**：
  - `GET /ext/search?q=`：查询 VS Code Marketplace 扩展（回退 Open VSX）。
  - `GET /ext/installed`：扫描 `~/.webide/extensions/`，内置零依赖 `zlib` ZIP 解压器与 JSONC/`package.nls.json` 解析器，读取 `themes`（含 `include` 继承）、`languages`、语言配置、`grammars`、`snippets` 与 `commands`。
  - `POST /ext/install` / `POST /ext/toggle` / `POST /ext/uninstall`：校验受信任下载域名后拉取 `.vsix`（上限 60 MB）并做路径穿越校验，支持安装、启用/禁用与卸载。
  - `GET /ext/<id>/bundle.js` 与 `GET /ext/<id>/icon`：校验 `Sec-Fetch-Site: same-origin`；将 `browser` Web 入口代码包装为 `window.__webideExtDefine(id, (require, module, exports, define) => ...)` 闭包以遮蔽 Monaco 的全局 AMD `define`，无需放开 CSP `unsafe-eval`。
- **前端扩展面板与运行时（[web/index.html](web/index.html)）**：
  - **Extensions 侧栏（`⇧⌘X` / `Ctrl+Shift+X`）与详情弹窗**：支持在线检索、查看已安装与市场扩展、一键安装/启用/禁用/卸载及预览应用主题。
  - **颜色主题引擎（`contributes.themes`）**：通过 `monaco.editor.defineTheme` / `setTheme` 应用主题规则，联动更新 `:root` CSS 变量与 `xterm.js` 配色，持久化至 `localStorage.webideTheme`；命令面板支持 **Preferences: Color Theme** 快速切换或恢复默认主题。
  - **语言配置、TextMate 语法与代码片段**：为新增语言注册扩展名、括号与注释规则，将 `.tmLanguage.json` 规则转换为 Monaco Monarch Tokenizer，并注册 `contributes.snippets` 自动补全。
  - **Web 扩展 API 垫片**：提供轻量 `vscode` API 兼容层（`commands`、`window`、`workspace`、`languages` 格式化/补全/悬停等），扩展注册的命令可直接在命令面板（`>`）执行。

#### 5. 本地 Git 环境桥接与 GitHub 直连（无登录 / 无用户校验）
WebIDE 不内置 GitHub OAuth 登录或账号校验，而是直接调用本机 `git` CLI（启用 `GIT_TERMINAL_PROMPT=0`），自动复用本地 SSH 密钥、系统凭据助手（如 macOS Keychain）与 `git config`：
- **后端 `/git/*` 接口**：`GET /git/status`、`GET /git/log`、`GET /git/diff`、`POST /git/init`、`POST /git/stage`、`POST /git/unstage`、`POST /git/discard`、`POST /git/commit`、`POST /git/checkout`、`POST /git/remote`、`POST /git/clone`、`POST /git/fetch`、`POST /git/pull`、`POST /git/push`（自动识别 `owner/repo` 简写，拦截 `-` 参数注入与 `file://` 协议）。
- **前端 Source Control（`⌃⇧G` / `Ctrl+Shift+G`）**：支持未提交计数角标、状态栏分支切换与一键同步、GitHub 远端直连、Clone from GitHub 弹窗、单文件/批量暂存、丢弃确认、Commit / Commit & Push 以及 Monaco Diff 对比视图。

#### 6. 交互修复与服务端健壮性
- **IME 输入法安全**：所有输入框统一使用 `composing(e)`（`e.isComposing || e.keyCode === 229`）避免中/日/韩输入法回车选词误触发提交。
- **弹窗交互安全**：`#qp`、`#qo`、`#gitdlg`、`#extdlg` 均使用 `lightDismiss()` 防止划选拖出误关闭，并在 `quickOpen` 打开时清除触发按钮焦点避免恢复焦点触发二次点击。
- **Chat / 编辑器 / 终端加固**：`agentGen` 防止跨会话/中断竞态，`saveAll()` 冲突阻断切换目录，`/fs/rename` 禁止目录移入自身，`stdin` `'error'` 监听防止 `EPIPE` 异常，新增 `t.pendingSize` 与 `bodyJSON()`。

### 常用快捷键

| 功能 | macOS | Windows / Linux |
| --- | --- | --- |
| 快速打开文件 / Go to File | `⌘P` | `Ctrl+P` |
| 命令面板 / Command Palette | `⇧⌘P` / `F1` | `Ctrl+Shift+P` / `F1` |
| 打开本地文件夹 | `⌘O` | `Ctrl+O` |
| 保存 / 全部保存 | `⌘S` / `⌥⌘S` | `Ctrl+S` / `Ctrl+Alt+S` |
| 切换侧边栏 | `⌘B` | `Ctrl+B` |
| 资源管理器 / 全文搜索 / 插件市场 | `⇧⌘E` / `⇧⌘F` / `⇧⌘X` | `Ctrl+Shift+E` / `Ctrl+Shift+F` / `Ctrl+Shift+X` |
| Source Control (Git) | `⌃⇧G` | `Ctrl+Shift+G` |
| 跳转到行列 / 自动换行 | `⌃G` / `⌥Z` | `Ctrl+G` / `Alt+Z` |
| 终端开关 / 新建终端 | `` ⌃` `` / `` ⌃⇧` `` | `` Ctrl+` `` / `` Ctrl+Shift+` `` |
| 关闭当前标签页 | `⌃W` | `Alt+W` |

### 自检测试

```sh
node test/test.mjs
```

测试脚本会启动临时 Bridge 实例与隔离工作区，验证 `/session` 同源策略、路径沙箱、ETag `If-Match` 保存冲突、搜索与文件监听、PTY 终端 resize、Mock ACP Agent 往返、`/git/*` 全流程及 `/ext/*` 插件生命周期与同源包装校验。

---

<a id="english-documentation"></a>

## English Documentation

A lightweight, privacy-first local browser IDE powered by a local Node.js backend ([bridge.mjs](bridge.mjs)) and a single-file frontend ([web/index.html](web/index.html)) built on Monaco Editor and xterm.js. It brings local filesystem access, PTY terminals, local ACP coding agents, local Git / GitHub integration, multi-project hibernation, and seamless VS Code Extension Marketplace support straight into your browser.

### Repository Layout

| File | Description |
| --- | --- |
| [bridge.mjs](bridge.mjs) | Local HTTP server and child-process bridge (default `127.0.0.1:47321`) handling filesystem APIs, full-text search, SSE file watching, PTY terminals, ACP agent sessions, Git/GitHub CLI bridging, and VS Code Marketplace `/ext/*` management & bundle wrapping |
| [web/index.html](web/index.html) | Single-page WebIDE frontend featuring a minimalist home screen, Explorer, Search, Source Control (Git/GitHub), VS Code Extensions Marketplace & runtime host, multi-project taskbar, Monaco Editor & Diff view, multi-tab xterm terminals, and Agent Chat panel |
| [site/launch.html](site/launch.html) | Standalone launch landing page that opens `http://127.0.0.1:47321/` via **Open WebIDE** |
| [test/test.mjs](test/test.mjs) | End-to-end automated test suite covering auth & same-origin `/session`, path sandboxing, `If-Match` save conflicts, search & watch SSE, PTY resize, Mock ACP roundtrip, `/git/*`, and `/ext/*` endpoints |
| [test/mock-acp.mjs](test/mock-acp.mjs) | Mock ACP Agent (stdio JSON-RPC) used during automated testing |

### Quick Start

Prerequisites: Node.js (with ES Modules and built-in `fetch`; Node >= 20 recommended for recursive file watching on Linux) and `git` installed locally.

1. Start the local WebIDE bridge:
   ```sh
   node bridge.mjs
   ```
2. Open in your browser:
   ```
   http://127.0.0.1:47321/
   ```
   Optionally serve the standalone launcher with `python3 -m http.server 8000 -d site` and open `http://localhost:8000/launch.html`.

#### Environment Variables & Local State
- `WEBIDE_PORT`: Listening port, default `47321` (bound strictly to `127.0.0.1`).
- `WEBIDE_ORIGINS`: Comma-separated allowed CORS origins, default `http://localhost:8000`.
- `WEBIDE_AGENTS` / `~/.webide/agents.json`: Custom ACP agent commands; built-in defaults are `gemini` (`['gemini', '--acp']`), `codex` (`['codex-acp']`), and `claude` (`['claude-agent-acp']`).
- `~/.webide/state.json`: Stores the active workspace and stacked multi-project list (constrained under `$HOME`).
- `~/.webide/extensions/` & `~/.webide/extensions.json`: Stores unpacked VS Code `.vsix` extensions and persisted enabled/disabled state.

### Core Architecture & Features

#### 1. Local-First Direct Connection (No Login Gate)
- **Automatic Same-Origin Session**: [bridge.mjs](bridge.mjs) exposes `POST /session` for same-origin browser tabs to mint a session token transparently while still rejecting cross-origin or unauthorized API calls with `403` / `401`.
- **Non-Blocking Re-Auth**: [web/index.html](web/index.html) removes blocking session-expired overlays; `ensureToken()` silently renews tokens after server restarts and retries the request, surfacing connectivity issues via non-blocking toasts.
- **Direct Launcher**: [site/launch.html](site/launch.html) navigates directly to `http://127.0.0.1:47321/` without custom protocol prompts.

#### 2. Brand Logo, Minimalist Home & Obsidian UI
- **Top-Left Logo Navigation**: Clicking `#act-home` at the top of the Activity Bar toggles back to the minimalist Home view from any open project.
- **Clean Welcome Surface**: `#home` collapses sidebars and highlights only the **Open. Private. Light.** slogan, **Open Local Repository** (`#home-open-local`), **Open from GitHub** (`#home-open-github`), and essential shortcuts.
- **Cohesive Visual System**: Deep obsidian surfaces (`#060608` / `#0d0d12` / `#111118`), subtle ambient grid glow, frosted-glass dialogs, and purple-blue-cyan gradient accents across all panels and [site/launch.html](site/launch.html).

#### 3. Multi-Project Taskbar & Resource Hibernation
- **Stacked Project Taskbar (`#ws-bar`)**: Open multiple local or GitHub projects simultaneously and switch between them from the bottom taskbar (showing active/hibernated indicators, unsaved dots, quick-add buttons, and close buttons), persisted in `~/.webide/state.json`.
- **Automatic Hibernation (`hibernateCurrent()`)**: Switching away from a project hibernates its browser resources while keeping unsaved work safe:
  - Disposes Monaco `ITextModel` instances for inactive projects (preserving unsaved text and view states in memory and lazy-loading on wake);
  - Aborts `/fs/watch` SSE streams and clears Explorer, Search, and Source Control DOM trees;
  - Detaches and disposes `xterm.js` instances and closes terminal/agent SSE connections to free memory (the backend preserves a 50 KB PTY buffer and `?from=` incremental replay), reattaching seamlessly when you switch back or terminating child processes on project close.

#### 4. Seamless VS Code Extension Marketplace & Browser Extension Host
WebIDE connects directly to the VS Code Marketplace (with Open VSX fallback), downloading, unpacking, and activating `.vsix` extensions directly in the browser:
- **Backend `/ext/*` APIs & Safe Bundle Wrapping ([bridge.mjs](bridge.mjs))**:
  - `GET /ext/search?q=`: Queries VS Code Marketplace with automatic Open VSX fallback.
  - `GET /ext/installed`: Scans `~/.webide/extensions/` using a zero-dependency built-in `zlib` ZIP extractor and JSONC/`package.nls.json` resolver, parsing `themes` (including `include` inheritance), `languages`, configurations, `grammars`, `snippets`, and `commands`.
  - `POST /ext/install`, `POST /ext/toggle`, `POST /ext/uninstall`: Validates allowed `.vsix` hosts, enforces a 60 MB download cap and zip-slip path guards, and manages extension state.
  - `GET /ext/<id>/bundle.js` & `GET /ext/<id>/icon`: Enforces `Sec-Fetch-Site: same-origin` and wraps `browser` extension entries inside `window.__webideExtDefine(id, (require, module, exports, define) => ...)` to shadow Monaco's global AMD `define` without requiring `unsafe-eval`.
- **Frontend Extensions View & Runtime Host ([web/index.html](web/index.html))**:
  - **Extensions Sidebar (`⇧⌘X` / `Ctrl+Shift+X`) & Detail Dialog (`#extdlg`)**: Search the Marketplace, inspect details, install, enable/disable, uninstall, and switch themes in one click.
  - **Color Theme Engine (`contributes.themes`)**: Applies VS Code themes via `monaco.editor.defineTheme` / `setTheme`, synchronizes `:root` CSS variables and `xterm.js` `TERM_THEME`, persists to `localStorage.webideTheme`, and exposes **Preferences: Color Theme** in the Command Palette.
  - **Languages, TextMate Grammars & Snippets**: Registers new language IDs and `language-configuration.json` rules, compiles `.tmLanguage.json` patterns into Monaco Monarch tokenizers, and registers snippet completion providers.
  - **Browser Extension Shim (`vscode` API)**: Exposes lightweight `commands`, `window`, `workspace`, and `languages` APIs (document formatting, completion, hover) and surfaces extension commands in the Command Palette (`>`).

#### 5. Local Git CLI Bridge & Direct GitHub Integration (Zero Auth Gate)
Instead of embedding GitHub OAuth or user authentication flows, [bridge.mjs](bridge.mjs) delegates directly to your local `git` CLI (`GIT_TERMINAL_PROMPT=0`), automatically reusing your existing SSH keys, OS credential helpers (such as macOS Keychain), and `git config`:
- **Backend `/git/*` Endpoints**: `GET /git/status`, `GET /git/log`, `GET /git/diff`, `POST /git/init`, `POST /git/stage`, `POST /git/unstage`, `POST /git/discard`, `POST /git/commit`, `POST /git/checkout`, `POST /git/remote`, `POST /git/clone`, `POST /git/fetch`, `POST /git/pull`, and `POST /git/push` (expands `owner/repo` shorthand while blocking flag injection and `file://` URLs).
- **Source Control UI (`⌃⇧G` / `Ctrl+Shift+G`)**: Live dirty badge count, status-bar branch checkout & sync buttons, GitHub repository links, Clone from GitHub dialog, stage/unstage/discard controls, Commit & Push, and side-by-side Monaco Diff Editor views.

#### 6. UX & Backend Hardening
- **IME-Safe Input**: All inputs use `composing(e)` (`e.isComposing || e.keyCode === 229`) so CJK composition `Enter` never misfires submits.
- **Dialog Safety**: `#qp`, `#qo`, `#gitdlg`, and `#extdlg` share `lightDismiss()` backdrop handling, and `quickOpen()` blurs trigger buttons before `showModal()` so `Enter` key dismissal never re-triggers the opener.
- **Runtime Reliability**: `agentGen` guards prevent stale agent turns, `saveAll()` aborts workspace switches on save conflicts, `/fs/rename` blocks self-nesting moves, `stdin` `'error'` listeners prevent `EPIPE` crashes, `t.pendingSize` preserves early PTY resizes, and `bodyJSON()` returns HTTP `400` on malformed JSON.

### Keyboard Shortcuts

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Quick Open / Go to File | `⌘P` | `Ctrl+P` |
| Command Palette | `⇧⌘P` / `F1` | `Ctrl+Shift+P` / `F1` |
| Open Local Folder | `⌘O` | `Ctrl+O` |
| Save / Save All | `⌘S` / `⌥⌘S` | `Ctrl+S` / `Ctrl+Alt+S` |
| Toggle Primary Sidebar | `⌘B` | `Ctrl+B` |
| Explorer / Search / Extensions | `⇧⌘E` / `⇧⌘F` / `⇧⌘X` | `Ctrl+Shift+E` / `Ctrl+Shift+F` / `Ctrl+Shift+X` |
| Source Control (Git) | `⌃⇧G` | `Ctrl+Shift+G` |
| Go to Line / Toggle Word Wrap | `⌃G` / `⌥Z` | `Ctrl+G` / `Alt+Z` |
| Toggle Terminal / New Terminal | `` ⌃` `` / `` ⌃⇧` `` | `` Ctrl+` `` / `` Ctrl+Shift+` `` |
| Close Active Editor Tab | `⌃W` | `Alt+W` |

### Automated Tests

```sh
node test/test.mjs
```

Runs an isolated temporary Bridge instance and temporary workspace to verify `/session` same-origin enforcement, path sandboxing, `If-Match` concurrency checks, full-text search & file watching, PTY resizing, Mock ACP roundtrips, `/git/*` workflows, and `/ext/*` extension lifecycle & bundle wrapping.
