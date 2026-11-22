# WebIDE

**Open. Private. Light. · 开放 · 隐私 · 轻量**

[中文文档](#中文文档) | [English Documentation](#english-documentation)

---

<a id="中文文档"></a>

## 中文文档

一个轻量的隐私优先本地浏览器 IDE：**所有用户数据、工作区文件、目录句柄、Git 快照与 VS Code 插件均仅存储在当前浏览器本地（IndexedDB + File System Access API）**，绝不上传至服务端或在不同 Web 客户端之间共享。服务端（[bridge.mjs](bridge.mjs)）仅作为无状态静态页面托管与公共只读 CORS 转发代理，前端单页应用（[web/index.html](web/index.html)）基于 Monaco Editor 与 xterm.js 构建。

### 目录结构

| 文件 | 说明 |
| --- | --- |
| [bridge.mjs](bridge.mjs) | 无状态本地 HTTP 服务与公共 CORS 透传代理（默认监听 `127.0.0.1:47321`），仅负责托管前端页面及转发对 VS Code Marketplace / Open VSX / GitHub 公开只读资源的请求；**不读写服务器本地目录、不保存状态、不生成服务端 Shell/进程** |
| [web/index.html](web/index.html) | WebIDE 前端单页应用，内置 IndexedDB 虚拟文件系统（`webide-browser-v1`）、File System Access API 本地目录接入、纯前端 ZIP 解包/导出、极简首页、资源管理器、全文搜索、浏览器侧 Source Control、VS Code 插件市场与扩展宿主、多工程任务栏、Monaco 编辑器、Diff 视图与浏览器沙箱终端 |
| [site/launch.html](site/launch.html) | 独立入口页，点击 **Open WebIDE** 直接跳转到本地 IDE 服务地址 `http://127.0.0.1:47321/` |
| [test/test.mjs](test/test.mjs) | 端到端自检脚本，验证无状态服务端安全策略、零磁盘持久化、`blob:` CSP、同源 Session 校验、SSRF/路径穿越拦截以及旧版服务端文件/终端/插件写接口已彻底移除 |
| [test/mock-acp.mjs](test/mock-acp.mjs) | 保留的测试用 Mock ACP 脚本（当前浏览器隐私模式下默认不启用服务端 Agent 执行） |

### 快速启动

运行要求：Node.js（支持 ES Module 与内置 `fetch`）与现代桌面浏览器（支持 `IndexedDB` 与 `DecompressionStream('deflate-raw')`；Chrome / Edge 额外支持 `showDirectoryPicker` 直接读写本机目录）。

1. 启动无状态 WebIDE 托管服务：
   ```sh
   node bridge.mjs
   ```
2. 浏览器访问：
   ```
   http://127.0.0.1:47321/
   ```
   如需独立静态启动页，也可运行 `python3 -m http.server 8000 -d site` 后访问 `http://localhost:8000/launch.html`。

#### 环境变量与浏览器存储分布
- `WEBIDE_PORT`：HTTP 服务监听端口，默认 `47321`。
- `WEBIDE_HOST`：服务绑定地址，默认 `127.0.0.1`。
- `WEBIDE_ORIGINS`：允许访问的额外来源列表（逗号分隔）。
- **浏览器端 IndexedDB（`webide-browser-v1`）**：按浏览器 Profile 与 Origin 严格隔离，包含 `projects`（工程元数据与本地 `FileSystemDirectoryHandle`）、`files`（GitHub 克隆及浏览器导入文件内容）、`snapshots`（浏览器侧基线快照）、`extensions`（已下载并解包的 VS Code 插件与主题/语法/片段/Web Bundle）和 `meta`（多工程顺序与活跃状态）。
- **浏览器端 `localStorage`**：仅保存布局偏好（`webidePrefs`）、当前配色主题键（`webideTheme`）与扩展配置键值。

### 核心架构与隐私隔离设计

#### 1. 全量浏览器本地存储与跨端绝对隔离（零服务端存储）
- **杜绝跨 Web 端越权读取**：服务端不再维护任何全局 `root`、工作区列表或 `$HOME` 文件浏览接口（已彻底移除 `/root`、`/projects`、`/fs/*`、`/git/*`、`/term/*`、`/agent/*`、`/ext/install` 等服务端状态/磁盘接口）。不同浏览器标签页、无痕窗口或不同 Origin（如 `127.0.0.1` 与 `localhost`）之间完全隔离，无法窥探彼此或宿主机的任何代码目录与已装插件。
- **双模本地仓库打开**：
  - 优先调用浏览器原生 **File System Access API**（`window.showDirectoryPicker({ mode: 'readwrite' })`），目录句柄直接保存在浏览器 IndexedDB 中；
  - 若浏览器不支持或处于受限上下文，自动回退至 `<input type="file" webkitdirectory>` 导入文件至浏览器 IndexedDB，全程不上传任何文件内容到服务器。
- **GitHub 仓库纯前端拉取**：通过无状态只读代理 `/proxy/github/meta` 与 `/proxy/github/archive` 拉取公开仓库 `.zip` 压缩流，由前端纯 JS `unzipBytes()`（基于浏览器原生 `DecompressionStream('deflate-raw')`）在内存中解压并直接写入浏览器 IndexedDB（`files` 与 `snapshots`）。

#### 2. 品牌 Logo、极简首页与深空曜黑视觉风格
- **左上角 Logo 导航**：活动栏顶部内置品牌 Logo 按钮（`#act-home`），任意工作区下点击即可切换回首页，再次点击或点击侧栏图标即可回到工作区。
- **极简初始页**：首页 `#home` 隐藏左右侧栏，仅保留 **Open. Private. Light.（开放 · 隐私 · 轻量）** Slogan、**打开本地仓库**（`#home-open-local`）、**从 GitHub 打开**（`#home-open-github`）与快捷键指引。
- **统一视觉体系**：深空曜黑（`#060608` / `#0d0d12` / `#111118`）、微网格环境光晕、毛玻璃弹窗与紫蓝青渐变高亮（`#8b5cf6` → `#3b82f6` → `#06b6d4`）。

#### 3. 多工程任务栏与资源休眠机制
- **任务栏多工程切换**：底部状态栏上方集成工程任务栏（`#ws-bar`），支持同时打开多个本地或 GitHub 工程并在任务栏中切换（显示活跃/休眠状态标识、未保存提示点、新增与关闭按钮），顺序持久化于 IndexedDB `meta`。
- **非活跃工程资源休眠（`hibernateCurrent()`）**：
  - 释放非活跃工程的 Monaco `ITextModel` 与内存文件缓存 `_fileMap`，仅在内存暂存未保存草稿文本与光标/滚动视图状态；
  - 清空资源管理器、搜索结果与 Source Control DOM 节点；
  - 销毁非活跃工程的 `xterm.js` 实例（保留虚拟终端会话历史与当前路径），唤醒时按需懒加载恢复；关闭工程时同步清理对应 IndexedDB 工程文件与快照。

#### 4. VS Code 插件市场无缝衔接（浏览器端下载解包运行）
- **无状态市场透传（[bridge.mjs](bridge.mjs)）**：`GET /proxy/ext/search?q=` 与 `GET /proxy/ext/vsix?url=` 仅在校验受信任市场域名（VS Code Marketplace / Open VSX）与包体大小上限（60 MB）后直接转发响应字节，服务端**零解包、零落盘、零持久化**。
- **浏览器端 `.vsix` 解包与 IndexedDB 存储（[web/index.html](web/index.html)）**：
  - 前端下载 `.vsix` 后通过 `unzipVsixToManifest()` 在浏览器内完成 ZIP 解压、JSONC / `package.nls.json` 本地化解析、颜色主题 `include` 继承合并、图标转 Base64 `data:` URI，并将完整清单与 `browser` Web 入口代码存入本地 IndexedDB（`extensions`）。
  - **零服务端 `Bundle` 注入**：`browser` Web 扩展代码在前端包装进 `window.__webideExtDefine(dir, (require, module, exports, define) => ...)`（遮蔽 Monaco 的全局 AMD `define`），通过 `Blob` URL 加载（CSP 仅允许 `blob:` 而无需开启 `'unsafe-eval'`）。
- **扩展运行能力**：
  - **颜色主题（`contributes.themes`）**：使用规范化 `ext-...` 主题名注册至 Monaco 并同步映射到 `:root` CSS 变量与终端配色，支持 **Preferences: Color Theme**（`#ext-themes` / `#qo`）快捷切换；
  - **语言、TextMate 语法与代码片段**：自动注册新语言与括号/注释配置，将 `.tmLanguage.json` 编译为 Monarch Tokenizer，并将 `contributes.snippets` 接入自动补全；
  - **轻量 `vscode` 兼容层**：支持扩展命令注入命令面板（`>`）以及常用格式化、补全、悬停与工作区读取能力。

#### 5. 浏览器侧 Source Control、终端与交互加固
- **浏览器侧 Diff 与本地快照提交**：通过比对当前工作区文件与 IndexedDB `snapshots` 基线自动识别新增/修改/删除文件，点击即可在 Monaco DiffEditor 查看对比，支持暂存、取消暂存、丢弃更改、本地提交记录、从 GitHub 拉取更新，以及点击 **Export ZIP** 纯前端打包导出整个工程。
- **浏览器内置沙箱终端**：基于 `xterm.js` 提供纯前端命令环境（`help`、`pwd`、`ls`、`cd`、`cat`、`head`、`touch`、`mkdir`、`rm`、`find`、`git status|log`、`ext list`、`clear`），仅操作当前浏览器工作区。
- **输入法与弹窗交互安全**：全输入框支持 `composing(e)` 防 IME 误触；`quickOpen()` 打开前自动清除触发按钮焦点并延迟关闭执行，避免 `Enter` 关闭弹窗时误二次触发开启按钮。

### 常用快捷键

| 功能 | macOS | Windows / Linux |
| --- | --- | --- |
| 快速打开文件 / Go to File | `⌘P` | `Ctrl+P` |
| 命令面板 / Command Palette | `⇧⌘P` / `F1` | `Ctrl+Shift+P` / `F1` |
| 打开本地文件夹 | `⌘O` | `Ctrl+O` |
| 保存 / 全部保存 | `⌘S` / `⌥⌘S` | `Ctrl+S` / `Ctrl+Alt+S` |
| 切换侧边栏 | `⌘B` | `Ctrl+B` |
| 资源管理器 / 全文搜索 / 插件市场 | `⇧⌘E` / `⇧⌘F` / `⇧⌘X` | `Ctrl+Shift+E` / `Ctrl+Shift+F` / `Ctrl+Shift+X` |
| Source Control (浏览器快照) | `⌃⇧G` | `Ctrl+Shift+G` |
| 跳转到行列 / 自动换行 | `⌃G` / `⌥Z` | `Ctrl+G` / `Alt+Z` |
| 终端开关 / 新建终端 | `` ⌃` `` / `` ⌃⇧` `` | `` Ctrl+` `` / `` Ctrl+Shift+` `` |
| 关闭当前标签页 | `⌃W` | `Alt+W` |

### 自检测试

```sh
node test/test.mjs
```

自检脚本校验前端内联脚本语法、CSP `blob:` 与禁止 `unsafe-eval` 策略、`/session` 同源校验、`/proxy/*` 输入与域名校验、旧版服务端写/文件/终端接口返回 `404`，以及测试全程服务端 `HOME` 目录下零文件写入。

---

<a id="english-documentation"></a>

## English Documentation

A lightweight, privacy-first browser IDE where **all user data—workspaces, local directory handles, cloned repositories, snapshot history, and downloaded VS Code extensions—stays strictly in local browser storage (`IndexedDB` + `File System Access API`) and is never uploaded to or stored on the server**. The backend ([bridge.mjs](bridge.mjs)) serves purely as a stateless static host and allowlisted public read-only CORS pass-through proxy, while the single-file frontend ([web/index.html](web/index.html)) builds on Monaco Editor and xterm.js.

### Repository Layout

| File | Description |
| --- | --- |
| [bridge.mjs](bridge.mjs) | Stateless local HTTP host and allowlisted public CORS pass-through proxy (default `127.0.0.1:47321`). Serves `web/index.html` and forwards read-only requests to VS Code Marketplace, Open VSX, and public GitHub archives without storing state, files, or extensions, and without spawning OS shells |
| [web/index.html](web/index.html) | Single-page WebIDE featuring IndexedDB persistence (`webide-browser-v1`), File System Access API integration, pure-JS ZIP unpack/export, minimalist home screen, Explorer, Search, browser-local Source Control, VS Code Marketplace & Extension Host, multi-project taskbar, Monaco Editor & Diff view, and an isolated browser shell |
| [site/launch.html](site/launch.html) | Standalone launch landing page that opens `http://127.0.0.1:47321/` via **Open WebIDE** |
| [test/test.mjs](test/test.mjs) | Automated self-check verifying stateless server behavior, zero disk writes, CSP policy, same-origin `/session`, SSRF/traversal rejection on `/proxy/*`, and removal of server-side FS/shell/extension storage endpoints |
| [test/mock-acp.mjs](test/mock-acp.mjs) | Retained mock ACP script (server-side agent spawning is disabled in browser-local privacy mode) |

### Quick Start

Prerequisites: Node.js (with ES Modules and built-in `fetch`) and a modern desktop browser supporting `IndexedDB` and `DecompressionStream('deflate-raw')` (Chromium browsers additionally support `showDirectoryPicker` for direct local folder read/write).

1. Start the stateless WebIDE server:
   ```sh
   node bridge.mjs
   ```
2. Open in your browser:
   ```
   http://127.0.0.1:47321/
   ```
   Optionally serve the standalone landing page with `python3 -m http.server 8000 -d site` and visit `http://localhost:8000/launch.html`.

#### Environment Variables & Browser Storage Layout
- `WEBIDE_PORT`: Listening port, default `47321`.
- `WEBIDE_HOST`: Bind address, default `127.0.0.1`.
- `WEBIDE_ORIGINS`: Comma-separated list of additional allowed CORS origins.
- **Browser IndexedDB (`webide-browser-v1`)**: Strictly isolated per browser profile and origin across 5 stores: `projects` (project metadata & `FileSystemDirectoryHandle`), `files` (GitHub clones & imported local files), `snapshots` (browser-local baseline snapshots), `extensions` (unpacked VS Code extensions, themes, grammars, snippets, and browser bundles), and `meta` (project taskbar ordering and active selection).
- **Browser `localStorage`**: Stores layout preferences (`webidePrefs`), active color theme key (`webideTheme`), and extension setting values.

### Core Architecture & Privacy Isolation

#### 1. 100% Browser-Local Storage & Cross-Client Isolation (Zero Server Data)
- **Zero Cross-Client Leakage**: The server holds no shared `root`, project list, `$HOME` directory browser, host shell, or extension directory (legacy `/root`, `/projects`, `/fs/*`, `/git/*`, `/term/*`, `/agent/*`, and `/ext/install` server-disk endpoints are completely removed). Separate browser tabs, incognito sessions, or origins (`127.0.0.1` vs `localhost`) never see each other's workspaces or extensions.
- **Dual Local Folder Access**:
  - Uses the browser's **File System Access API** (`window.showDirectoryPicker({ mode: 'readwrite' })`), storing directory handles directly in IndexedDB;
  - Automatically falls back to `<input type="file" webkitdirectory>` importing files into browser IndexedDB when FSA is unavailable, never uploading file contents to any server.
- **Pure-Client GitHub Repository Cloning**: Fetches public repository ZIP archives through stateless `/proxy/github/meta` and `/proxy/github/archive`, unpacks entries in browser memory via `unzipBytes()` (`DecompressionStream('deflate-raw')`), and stores files and initial snapshot baselines strictly in IndexedDB.

#### 2. Brand Logo, Minimalist Home & Obsidian Theme
- **Top-Left Logo Navigation**: Clicking `#act-home` in the Activity Bar switches back to the minimalist Home view from any open workspace.
- **Focused Entry Screen**: `#home` collapses sidebars and presents the **Open. Private. Light.** slogan, **Open Local Repository** (`#home-open-local`), **Open from GitHub** (`#home-open-github`), and essential shortcuts.
- **Unified Visual Design**: Obsidian dark surfaces (`#060608` / `#0d0d12` / `#111118`), subtle ambient grid glow, frosted-glass dialogs, and purple-blue-cyan gradient highlights shared across the IDE and [site/launch.html](site/launch.html).

#### 3. Multi-Project Taskbar & Resource Hibernation
- **Stacked Project Taskbar (`#ws-bar`)**: Open multiple local or GitHub projects side-by-side and switch directly from the bottom taskbar (with active/hibernated badges, dirty dots, quick-add buttons, and close buttons).
- **Automatic Resource Hibernation (`hibernateCurrent()`)**:
  - Disposes Monaco `ITextModel` instances and clears `_fileMap` memory caches on switched-out projects, keeping only unsaved drafts and view state;
  - Clears Explorer, Search, and Source Control DOM trees;
  - Disposes inactive `xterm.js` instances while retaining virtual terminal history and cwd, lazily restoring active editors upon wake and purging IndexedDB stores on project close.

#### 4. Seamless VS Code Extension Marketplace (In-Browser Unpack & Execution)
- **Stateless Marketplace Pass-Through ([bridge.mjs](bridge.mjs))**: `GET /proxy/ext/search?q=` and `GET /proxy/ext/vsix?url=` validate allowlisted Marketplace CDNs (VS Code Marketplace / Open VSX) and enforce a 60 MB cap while streaming raw payloads to the browser with **zero disk writes and zero server caching**.
- **In-Browser `.vsix` Unpacking & IndexedDB Persistence ([web/index.html](web/index.html))**:
  - `unzipVsixToManifest()` unpacks `.vsix` archives inside the browser, resolves JSONC & `package.nls.json`, merges theme `include` inheritance, encodes extension icons as `data:` URIs, and persists manifests plus `browser` JS code in IndexedDB (`extensions`).
  - **Blob-Isolated Bundle Loader**: Wraps `browser` extension code into `window.__webideExtDefine(dir, (require, module, exports, define) => ...)` (shadowing Monaco's global AMD `define`) and loads it via same-origin `Blob` URLs (`CSP script-src ... blob:` with no `'unsafe-eval'`).
- **Supported Contributions**:
  - **Color Themes (`contributes.themes`)**: Applies sanitized `ext-...` Monaco themes, synchronizes `:root` CSS variables and `xterm.js` `TERM_THEME`, and integrates with **Preferences: Color Theme** (`#ext-themes` / `#qo`);
  - **Languages, TextMate Grammars & Snippets**: Registers language configs, compiles `.tmLanguage.json` patterns into Monarch tokenizers, and wires `contributes.snippets` to Monaco completions;
  - **Browser `vscode` API Shim**: Exposes lightweight `commands`, `window`, `workspace` (reading from browser VFS), and `languages` APIs and surfaces extension commands in the Command Palette (`>`).

#### 5. Browser-Local Source Control, Sandbox Shell & UX Hardening
- **In-Browser Diff & Snapshot History**: Computes added/modified/deleted files against IndexedDB `snapshots`, displays diffs in Monaco DiffEditor, supports staging, unstaging, discarding changes, local commits, pulling GitHub updates, and downloading the workspace directly as a `.zip` archive via **Export ZIP**.
- **In-Browser Sandbox Terminal**: Powers `xterm.js` with client-side workspace commands (`help`, `pwd`, `ls`, `cd`, `cat`, `head`, `touch`, `mkdir`, `rm`, `find`, `git status|log`, `ext list`, `clear`) without any server shell access.
- **IME & Modal Reliability**: All inputs use `composing(e)` to prevent CJK IME confirmation misfires, and `quickOpen()` blurs trigger buttons prior to `showModal()` so `Enter` dismissal never re-activates the opener button.

### Keyboard Shortcuts

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Quick Open / Go to File | `⌘P` | `Ctrl+P` |
| Command Palette | `⇧⌘P` / `F1` | `Ctrl+Shift+P` / `F1` |
| Open Local Folder | `⌘O` | `Ctrl+O` |
| Save / Save All | `⌘S` / `⌥⌘S` | `Ctrl+S` / `Ctrl+Alt+S` |
| Toggle Primary Sidebar | `⌘B` | `Ctrl+B` |
| Explorer / Search / Extensions | `⇧⌘E` / `⇧⌘F` / `⇧⌘X` | `Ctrl+Shift+E` / `Ctrl+Shift+F` / `Ctrl+Shift+X` |
| Source Control (Browser Snapshots) | `⌃⇧G` | `Ctrl+Shift+G` |
| Go to Line / Toggle Word Wrap | `⌃G` / `⌥Z` | `Ctrl+G` / `Alt+Z` |
| Toggle Terminal / New Terminal | `` ⌃` `` / `` ⌃⇧` `` | `` Ctrl+` `` / `` Ctrl+Shift+` `` |
| Close Active Editor Tab | `⌃W` | `Alt+W` |

### Automated Verification

```sh
node test/test.mjs
```

Validates frontend script syntax, `blob:` CSP without `unsafe-eval`, same-origin `/session` enforcement, SSRF and traversal guards on `/proxy/*`, `404` removal of all server-side workspace/shell/extension endpoints, and zero writes inside server `HOME`.
