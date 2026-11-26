# WebIDE

**Open. Private. Light. · 开放 · 隐私 · 轻量**

[中文文档](#中文文档) | [English Documentation](#english-documentation)

---

<a id="中文文档"></a>

## 中文文档

一个轻量的隐私优先本地浏览器 IDE：**所有用户数据、工作区文件、目录句柄、Git 快照与 VS Code 插件均仅存储在当前浏览器本地（IndexedDB + File System Access API）**，绝不上传至服务端或在不同 Web 客户端之间共享。服务端（[bridge.mjs](bridge.mjs)）仅作为无状态静态页面托管与公共只读 CORS 转发代理，前端单页应用（[web/index.html](web/index.html) 薄壳 + [web/app.js](web/app.js) / [web/app.css](web/app.css)，第三方依赖全部自托管于 [web/vendor/](web/vendor/)、版本锁定）基于 Monaco Editor 与 xterm.js 构建，应用 CSP 的 `script-src` 仅允许同源与 `blob:`，不再放行任何 CDN 域或 `'unsafe-inline'`。

### 目录结构

| 文件 | 说明 |
| --- | --- |
| [bridge.mjs](bridge.mjs) | 无状态本地 HTTP 服务与公共 CORS 透传代理（默认监听 `127.0.0.1:47321`），仅负责托管前端页面及转发对 VS Code Marketplace / Open VSX / GitHub 公开只读资源的请求；**不读写服务器本地目录、不保存状态、不生成服务端 Shell/进程** |
| [web/index.html](web/index.html) + [web/app.js](web/app.js) / [web/app.css](web/app.css) | WebIDE 前端单页应用（已从单文件拆分：HTML 只作薄壳，逻辑与样式为独立文件，由 bridge 以 ETag/静态缓存方式托管），内置 IndexedDB 虚拟文件系统（`webide-browser-v1`）、File System Access API 本地目录接入、纯前端 ZIP 解包/导出、极简首页、资源管理器、全文搜索、浏览器侧 Source Control、VS Code 插件市场与扩展宿主、多工程任务栏、Monaco 编辑器、Diff 视图与浏览器沙箱终端 |
| [web/ext-host.html](web/ext-host.html) / [web/ext-host.js](web/ext-host.js) | VS Code 插件代码的沙盒宿主：运行在 `<iframe sandbox="allow-scripts">`（不带 `allow-same-origin`，不透明源）中，插件代码无法触及主页面的 DOM、localStorage/sessionStorage、Cookie 与 IndexedDB，只能通过 postMessage RPC 使用父页面显式授予的能力（命令、补全/悬停/格式化/代码操作等语言服务、工作区文件读写、配置与状态同步） |
| [web/vendor/](web/vendor/) | 自托管的第三方依赖（Monaco 0.52.2、xterm 5.5.0、markdown-it 14.1.0、Prettier 3.3.3，版本见 `vendor/VERSIONS.txt`），bridge 以一年不可变缓存托管，IDE 可完全离线加载，不再运行时请求 cdnjs/jsDelivr |
| [site/launch.html](site/launch.html) | 独立入口页，点击 **Open WebIDE** 直接跳转到本地 IDE 服务地址 `http://127.0.0.1:47321/` |
| [Dockerfile](Dockerfile) / [docker-compose.yml](docker-compose.yml) / [Caddyfile](Caddyfile) | 容器化单机部署配置（Node 22 Alpine + Caddy 自动 HTTPS 反向代理，内存限制 512MB） |
| [.env.example](.env.example) | 公网部署与反爬虫/IP 限流环境变量模板 |
| [test/test.mjs](test/test.mjs) | 端到端自检脚本，验证无状态服务端安全策略、零磁盘持久化、`blob:` CSP、公网 Host 校验、反爬虫与 IP 限流及旧版写接口移除 |
| [test/mock-acp.mjs](test/mock-acp.mjs) | 保留的测试用 Mock ACP 脚本（当前浏览器隐私模式下默认不启用服务端 Agent 执行） |
| [companion/companion.mjs](companion/companion.mjs) | **可选**的本地执行层（用户在自己机器上手动运行，零依赖）：仅监听回环地址、启动时选定一个根目录、配对令牌鉴权，为 IDE 提供真实 Shell 终端（WebSocket）、真实 git 与该目录内的文件读写；bridge 服务端本身仍不执行任何代码 |

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

#### 公网容器部署（方案二：Docker + Caddy 自动 HTTPS）

```sh
cp .env.example .env
# 修改 .env 中的 WEBIDE_DOMAIN 与 WEBIDE_PUBLIC_HOSTS 为你的域名（如 ide.example.com）
docker compose up -d --build
```

内置零鉴权防护（无需密码即可直接打开，同时防止代理带宽被刷）：
- **SEO / AEO 与反爬虫**：公开页面 `/`、`/en`、`/zh`（中英文落地页，含 FAQ 与 JSON-LD）、`/llms.txt`、`/sitemap.xml` 允许搜索引擎与 AI 答案引擎（Googlebot、Bingbot、Baiduspider、Sogou、GPTBot、ClaudeBot、PerplexityBot 等）抓取；`/robots.txt` 屏蔽 `/proxy/` 与 `/session`，canonical / hreflang 按请求域名自动生成绝对地址。其他爬虫/脚本 UA（`Scrapy`、`python-requests`、`curl`、SEO 抓取器等）及所有爬虫访问 `/session`、`/proxy/*` 时一律拦截；`/session` Token 绑定客户端 IP 与 UA 哈希（2 小时滑动失效）。预发布/私有部署可设 `WEBIDE_NOINDEX=1` 恢复全站 `Disallow: /` + `noindex`。
- **单 IP 频率与流量限制**：触发上限返回 `429` 与 `Retry-After`（页面 `WEBIDE_RL_PAGE=120`/分钟、会话 `WEBIDE_RL_SESSION=20`/分钟、搜索/元信息 `WEBIDE_RL_PROXY=60`/分钟、ZIP/VSIX 下载 `WEBIDE_RL_DL=15`/分钟且单 IP 每 10 分钟下载总量上限 `WEBIDE_RL_DL_MB=500` MB）。

#### 环境变量与浏览器存储分布
- `WEBIDE_PORT` / `PORT`：HTTP 服务监听端口，默认 `47321`。
- `WEBIDE_HOST`：服务绑定地址，默认 `127.0.0.1`（容器部署设为 `0.0.0.0`）。
- `WEBIDE_PUBLIC_HOSTS`：允许公网访问的域名白名单（逗号分隔，如 `ide.example.com,www.ide.example.com`）。
- `WEBIDE_TRUST_PROXY`：置于 Caddy/Nginx 后方时设为 `1`，从反向代理覆盖写入的 `X-Real-IP`（或 `X-Forwarded-For` 最后一跳）解析真实客户端 IP。不信任 `CF-Connecting-IP`（客户端可伪造）；前面再套 Cloudflare 时，请让反向代理只接受 Cloudflare IP 并用 `CF-Connecting-IP` 设置 `X-Real-IP`。
- `WEBIDE_ORIGINS`：允许访问的额外来源列表（逗号分隔）。
- `WEBIDE_RL_PAGE` / `WEBIDE_RL_SESSION` / `WEBIDE_RL_PROXY` / `WEBIDE_RL_DL` / `WEBIDE_RL_DL_MB` / `WEBIDE_ALLOW_BOTS`：按单 IP 调节限流阈值及爬虫放行开关（测试用）。
- **浏览器端 IndexedDB（`webide-browser-v1`，v2）**：按浏览器 Profile 与 Origin 严格隔离，包含 `projects`（工程元数据与本地 `FileSystemDirectoryHandle`）、`files`（GitHub 克隆及浏览器导入文件内容）、`snapshots`（浏览器侧基线快照的**清单**：每路径仅存 SHA-256 哈希/大小/etag，不再内嵌文件内容）、`blobs`（内容寻址 Blob 索引）、`extensions`（已下载并解包的 VS Code 插件与主题/语法/片段/Web Bundle）和 `meta`（多工程顺序与活跃状态）。Blob 字节优先存入 **OPFS**（`webide-blobs/`，浏览器支持时），否则存 IndexedDB `blobs`；相同内容只存一份，提交快照只写变化的 Blob（增量 + 去重），无引用的 Blob 会被回收。旧版内嵌内容的快照记录继续可读。
- **浏览器端 `localStorage`**：仅保存布局偏好（`webidePrefs`）、当前配色主题键（`webideTheme`）与扩展配置键值。

### 核心架构与隐私隔离设计

#### 1. 全量浏览器本地存储与跨端绝对隔离（零服务端存储）
- **杜绝跨 Web 端越权读取**：服务端不再维护任何全局 `root`、工作区列表或 `$HOME` 文件浏览接口（已彻底移除 `/root`、`/projects`、`/fs/*`、`/git/*`、`/term/*`、`/agent/*`、`/ext/install` 等服务端状态/磁盘接口）。不同浏览器标签页、无痕窗口或不同 Origin（如 `127.0.0.1` 与 `localhost`）之间完全隔离，无法窥探彼此或宿主机的任何代码目录与已装插件。
- **双模本地仓库打开（兼容 Safari / Chrome / Edge）**：
  - 支持 Chromium 原生 **File System Access API**（`window.showDirectoryPicker({ mode: 'readwrite' })`），目录句柄直接保存在浏览器 IndexedDB 中；
  - 在 Apple Safari 等不支持 `showDirectoryPicker` 的浏览器中，通过兼容优化的 `<input type="file" webkitdirectory>` 或直接从 macOS Finder **拖拽文件夹到首页 / 资源管理器**（`webkitGetAsEntry()`）将本地工程分批导入浏览器 IndexedDB，全程不上传任何文件内容到服务器。
- **GitHub 仓库纯前端拉取**：通过无状态只读代理 `/proxy/github/meta` 与 `/proxy/github/archive` 拉取公开仓库 `.zip` 压缩流，由前端纯 JS `unzipBytes()`（基于浏览器原生 `DecompressionStream('deflate-raw')`）在内存中解压并直接写入浏览器 IndexedDB（`files` 与 `snapshots`）。
- **GitHub 私有仓库浏览（访问令牌，浏览器直连）**：在「从 GitHub 打开」对话框展开 **Private repository access**，粘贴只读的 GitHub 访问令牌（推荐 [Fine-grained token](https://github.com/settings/personal-access-tokens/new)，仅授予目标仓库 **Contents: Read + Metadata: Read**；经典令牌需 `repo` 权限）。令牌只保存在当前浏览器标签页的 `sessionStorage`（关闭标签页即清除，**从不写入 `localStorage`**；旧版本留在 `localStorage` 的副本会在启动时自动删除），且**只发送给 `api.github.com`，不经过 WebIDE 服务端**，沙盒中的插件代码也无法读取它。配置令牌后，克隆与拉取由浏览器直接调用 GitHub API：仓库信息 → 分支 → 递归文件树，然后用 GraphQL 每批约 80 个文件下载文本内容，二进制文件走 REST raw blob（单文件上限 5MB、总量 80MB、最多 20000 个文件）。可随时在对话框或命令面板 `GitHub: Forget Access Token` 中删除令牌。
  - 为什么不用 SSH 密钥 / 本地 git：浏览器无法建立 SSH 连接，若由服务端代持私钥则违背「服务端零状态、零凭据」的隐私设计；而网页无法调用用户电脑上的 git。已在本机用 SSH 克隆的私有仓库，可直接通过 **打开本地仓库** 浏览（桌面 Chrome/Edge）。

#### 2. 品牌 Logo、极简首页与深空曜黑视觉风格
- **左上角 Logo 导航**：活动栏顶部内置品牌 Logo 按钮（`#act-home`），任意工作区下点击即可切换回首页，再次点击或点击侧栏图标即可回到工作区。
- **极简初始页**：首页 `#home` 隐藏左右侧栏，仅保留 **Open. Private. Light.（开放 · 隐私 · 轻量）** Slogan、**打开本地仓库**（`#home-open-local`）、**从 GitHub 打开**（`#home-open-github`）与快捷键指引。
- **中英文界面一键切换**：界面右上角的 `中 | EN` 小按钮可即时切换语言（也可在命令面板运行 `View: Switch Language`），选择保存在浏览器本地；首次访问按浏览器语言自动选择。翻译只作用于界面文字（按钮、菜单、命令面板、提示、对话框），不会改动文件名、代码、搜索结果等用户内容；中文模式下命令面板支持中英文关键字过滤。
- **移动端自适应阅读模式（竖屏 `< 768px`，或横屏手机高度 `<= 500px`）**：手机端自动切换为底部导航栏 + 左侧滑出抽屉（资源管理器 / 全文搜索 / Source Control / 快速文件跳转）与单列全屏代码视图。代码以阅读优先：默认自动换行、隐藏 Minimap / 折叠栏 / 概览标尺 / Sticky Scroll，默认只读（不弹出软键盘），点击「编辑」进入编辑、「完成」退出；Markdown 默认全屏渲染预览，可一键在「预览 / 源码」间切换，预览针对小屏优化（正文 15px、表格横向滚动且不再逐字断行、代码块通栏）；Diff 自动改为内联视图；横屏手机自动压缩顶部/底部栏高度。扩展市场与 Agent 面板在手机端隐藏。
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
  - **沙盒化扩展宿主**：`browser` Web 扩展代码不再在 IDE 主页面中执行，而是加载进不透明源的沙盒 iframe（[web/ext-host.js](web/ext-host.js)），在其中包装进 `window.__webideExtDefine(dir, (require, module, exports, define) => ...)` 并通过 `Blob` URL 加载；它与主页面的存储、令牌、工作区数据完全隔离，只能通过 postMessage RPC 调用父页面授予的能力。主题/语法/片段等纯数据贡献仍在主页面直接注册，不执行任何插件代码。沙盒 v1 支持命令、消息、配置、状态（memento）、工作区文件访问、`applyEdit`、文档快照事件与补全/悬停/格式化/代码操作提供者；任务（Task）提供者暂不支持。
- **扩展运行能力**：
  - **颜色主题（`contributes.themes`）**：使用规范化 `ext-...` 主题名注册至 Monaco 并同步映射到 `:root` CSS 变量与终端配色，支持 **Preferences: Color Theme**（`#ext-themes` / `#qo`）快捷切换；
  - **语言、TextMate 语法与代码片段**：自动注册新语言与括号/注释配置，将 `.tmLanguage.json` 编译为 Monarch Tokenizer，并将 `contributes.snippets` 接入自动补全；
  - **轻量 `vscode` 兼容层**：支持扩展命令注入命令面板（`>`）以及常用格式化、补全、悬停与工作区读取能力。

#### 5. 浏览器侧 Source Control、大纲/诊断、Markdown 预览与交互加固
- **Problems 诊断、Outline 大纲与跨文件跳转**：底部面板新增 **Problems** 选项卡实时汇总工作区诊断，资源管理器下方新增 **Outline** 折叠大纲快速跳转符号；内置 TypeScript/JS 工作区类型索引、`registerEditorOpener` 跨文件 **Go to Definition** 与 **Prettier** 代码格式化。
- **Markdown 侧边实时预览**：打开 `.md` 文件时支持通过面包屑栏开关或右键菜单开启右侧实时渲染预览（含双向滚动同步）。
- **Auto Save 与 Local File History**：支持切换 **Auto Save** 自动保存，以及在浏览器内保存与回溯单文件编辑历史快照并查看 Diff。
- **浏览器侧 Diff 与本地快照提交**：通过比对当前工作区文件与 IndexedDB `snapshots` 基线自动识别新增/修改/删除文件，点击即可在 Monaco DiffEditor 查看对比，支持暂存、取消暂存、丢弃更改、本地提交记录、从 GitHub 拉取更新，以及点击 **Export ZIP** 纯前端打包导出整个工程。
- **GitHub 分支与提交历史**：关联 GitHub 远程的工程，在源代码管理中会显示 **分支** 列表（标注默认 / 当前 / 受保护分支）和所选分支的 **提交** 历史（每页 30 条，可加载更多）。点击分支只查看它的历史，点击 ⇄ 才会切换工作区到该分支（有未提交更改时先确认；本地文件夹工程不提供切换，以免覆盖磁盘文件）。点击提交会在编辑区打开详情：完整提交信息、作者与时间、SHA（可复制）、父提交（可跳转）、增删统计和每个文件的彩色 Diff（手机端自动换行）。数据由浏览器直接请求 GitHub API：公开仓库无需令牌（每小时 60 次），私有仓库使用已保存的访问令牌。
- **浏览器内置沙箱终端**：基于 `xterm.js` 提供纯前端命令环境（`help`、`pwd`、`ls`、`cd`、`cat`、`head`、`touch`、`mkdir`、`rm`、`find`、`git status|log`、`ext list`、`clear`），仅操作当前浏览器工作区。
- **输入法与弹窗交互安全**：全输入框支持 `composing(e)` 防 IME 误触；`quickOpen()` 打开前自动清除触发按钮焦点并延迟关闭执行，避免 `Enter` 关闭弹窗时误二次触发开启按钮。

#### 6. 可选本地 Companion 执行层（真实 Shell / Git，服务端仍零执行）
浏览器沙箱终端只能操作浏览器内工作区；需要真实 Shell、真实 `git` 与真实文件夹时，可在**自己机器上**手动运行零依赖的 companion（它不是服务端的一部分，bridge 永远不启动它、也不执行任何代码）：
```sh
node companion/companion.mjs --root ~/my-project   # 可选 --port 47399 / --agent-cmd "pi --acp"
```
- **安全模型**：仅绑定 `127.0.0.1`、只服务启动时 `--root` 选定的一个目录（路径逃逸与符号链接逃逸均拒绝）、所有请求都要带启动时打印的配对令牌（页面端只存 `sessionStorage`）、仅接受回环来源的浏览器跨域请求；应用 CSP 的 `connect-src` 也只额外放行回环地址。`--agent-cmd` 可选，用于把本地 ACP Agent 的 stdio 以 WebSocket 透传给页面。
- **页面接入**：命令面板 `Companion: Connect…` 输入地址与令牌完成配对；`Terminal: New Companion Terminal` 打开真实 Shell 终端（装有可选依赖 `node-pty` 时为真 PTY，否则管道模式）；另有 `/exec`、`/git`、`/fs/*` HTTP 接口供页面调用真实命令与文件操作。
- **自检覆盖**：`test/test.mjs` 会真实启动 companion 并验证令牌鉴权、根目录 confinement、exec/git 与 WebSocket 终端回显。

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

自检脚本校验前端内联脚本语法、CSP `blob:` 与禁止 `unsafe-eval` 策略、`/robots.txt` 与爬虫 UA 拦截、Token UA/IP 绑定、公网 `WEBIDE_PUBLIC_HOSTS` 隔离、`429` 单 IP 限流与 `Retry-After`、`/proxy/*` 输入与 SSRF 校验、旧版服务端写/文件/终端接口返回 `404`，以及测试全程服务端 `HOME` 目录下零文件写入。

---

<a id="english-documentation"></a>

## English Documentation

A lightweight, privacy-first browser IDE where **all user data—workspaces, local directory handles, cloned repositories, snapshot history, and downloaded VS Code extensions—stays strictly in local browser storage (`IndexedDB` + `File System Access API`) and is never uploaded to or stored on the server**. The backend ([bridge.mjs](bridge.mjs)) serves purely as a stateless static host and allowlisted public read-only CORS pass-through proxy, while the frontend ([web/index.html](web/index.html) shell + [web/app.js](web/app.js) / [web/app.css](web/app.css), with all third-party dependencies self-hosted and pinned under [web/vendor/](web/vendor/)) builds on Monaco Editor and xterm.js. The app CSP allows scripts only from the same origin plus `blob:` — no CDN hosts, no `'unsafe-inline'`.

### Repository Layout

| File | Description |
| --- | --- |
| [bridge.mjs](bridge.mjs) | Stateless local HTTP host and allowlisted public CORS pass-through proxy (default `127.0.0.1:47321`). Serves `web/index.html` and forwards read-only requests to VS Code Marketplace, Open VSX, and public GitHub archives without storing state, files, or extensions, and without spawning OS shells |
| [web/index.html](web/index.html) + [web/app.js](web/app.js) / [web/app.css](web/app.css) | Single-page WebIDE (split from the former single file: the HTML is a thin shell, logic and styles ship as separate assets served with ETag/static caching) featuring IndexedDB persistence (`webide-browser-v1`), File System Access API integration, pure-JS ZIP unpack/export, minimalist home screen, Explorer, Search, browser-local Source Control, VS Code Marketplace & Extension Host, multi-project taskbar, Monaco Editor & Diff view, and an isolated browser shell |
| [web/ext-host.html](web/ext-host.html) / [web/ext-host.js](web/ext-host.js) | Sandboxed host for VS Code extension code: runs in an `<iframe sandbox="allow-scripts">` without `allow-same-origin` (opaque origin), so extension code cannot reach the main page's DOM, localStorage/sessionStorage, cookies or IndexedDB, and can only use the capabilities the parent explicitly grants over postMessage RPC (commands, completion/hover/formatting/code-action providers, workspace file access, configuration and memento sync) |
| [web/vendor/](web/vendor/) | Self-hosted third-party dependencies (Monaco 0.52.2, xterm 5.5.0, markdown-it 14.1.0, Prettier 3.3.3; see `vendor/VERSIONS.txt`), served with one-year immutable caching — the IDE loads fully offline and no longer fetches cdnjs/jsDelivr at runtime |
| [site/launch.html](site/launch.html) | Standalone launch landing page that opens `http://127.0.0.1:47321/` via **Open WebIDE** |
| [Dockerfile](Dockerfile) / [docker-compose.yml](docker-compose.yml) / [Caddyfile](Caddyfile) | Single-host container deployment stack (Node 22 Alpine + Caddy automatic HTTPS reverse proxy, 512MB limit) |
| [.env.example](.env.example) | Environment variable template for public domains and anti-crawler / rate-limit tuning |
| [test/test.mjs](test/test.mjs) | Automated self-check verifying stateless server behavior, zero disk writes, CSP policy, public host allowlisting, bot blocking, IP rate limits, and removal of legacy endpoints |
| [test/mock-acp.mjs](test/mock-acp.mjs) | Retained mock ACP script (server-side agent spawning is disabled in browser-local privacy mode) |
| [companion/companion.mjs](companion/companion.mjs) | **Optional** local execution layer the user runs on their own machine (zero dependencies): loopback-only, one root folder chosen at launch, pairing-token auth; gives the IDE a real shell terminal (WebSocket), real git and fs access inside that folder. The bridge server itself still executes nothing |

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

#### Public Container Deployment (Docker + Caddy Automatic HTTPS)

```sh
cp .env.example .env
# Set WEBIDE_DOMAIN and WEBIDE_PUBLIC_HOSTS in .env to your domain (e.g. ide.example.com)
docker compose up -d --build
```

Built-in zero-password abuse protection:
- **SEO / AEO & Anti-Crawler**: Public pages `/`, `/en`, `/zh` (bilingual landing pages with FAQ + JSON-LD), `/llms.txt` and `/sitemap.xml` are open to search and AI answer engines (Googlebot, Bingbot, Baiduspider, Sogou, GPTBot, ClaudeBot, PerplexityBot, …); `/robots.txt` disallows `/proxy/` and `/session`, and canonical / hreflang URLs are built from the request host. Other scraper UAs (`Scrapy`, `python-requests`, `curl`, SEO crawlers, …) and every crawler on `/session` / `/proxy/*` are blocked; `/session` tokens are bound to client IP + UA hash (2h sliding TTL). Set `WEBIDE_NOINDEX=1` on staging/private deployments to restore site-wide `Disallow: /` + `noindex`.
- **Per-IP Rate & Bandwidth Limits**: Returns `429 Too Many Requests` with `Retry-After` (defaults: `WEBIDE_RL_PAGE=120`/min, `WEBIDE_RL_SESSION=20`/min, `WEBIDE_RL_PROXY=60`/min, `WEBIDE_RL_DL=15`/min, and `WEBIDE_RL_DL_MB=500` MB / 10 min per IP).

#### Environment Variables & Browser Storage Layout
- `WEBIDE_PORT` / `PORT`: Listening port, default `47321`.
- `WEBIDE_HOST`: Bind address, default `127.0.0.1` (set `0.0.0.0` in Docker/VPS).
- `WEBIDE_PUBLIC_HOSTS`: Comma-separated allowed public domain hostnames (e.g. `ide.example.com`).
- `WEBIDE_TRUST_PROXY`: Set `1` behind Caddy/Nginx to read the client IP from `X-Real-IP` (or the last `X-Forwarded-For` hop) written by your reverse proxy. `CF-Connecting-IP` is never trusted (clients can spoof it); behind Cloudflare, have the proxy accept only Cloudflare IPs and set `X-Real-IP` from `CF-Connecting-IP`.
- `WEBIDE_ORIGINS`: Comma-separated list of additional allowed CORS origins.
- `WEBIDE_RL_PAGE` / `WEBIDE_RL_SESSION` / `WEBIDE_RL_PROXY` / `WEBIDE_RL_DL` / `WEBIDE_RL_DL_MB` / `WEBIDE_ALLOW_BOTS`: Per-IP rate-limit/bandwidth thresholds and optional bot bypass flag.
- `WEBIDE_NOINDEX`: Set `1` to keep the deployment out of search engines (staging / private hosts).
- **Browser IndexedDB (`webide-browser-v1`, v2)**: Strictly isolated per browser profile and origin across 6 stores: `projects` (project metadata & `FileSystemDirectoryHandle`), `files` (GitHub clones & imported local files), `snapshots` (baseline snapshot **manifests**: per-path SHA-256 hash/size/etag, no inline content), `blobs` (content-addressed blob index), `extensions` (unpacked VS Code extensions, themes, grammars, snippets, and browser bundles), and `meta` (project taskbar ordering and active selection). Blob bytes live in **OPFS** (`webide-blobs/`) when available, else in the `blobs` store; identical contents are stored once and snapshot commits write only changed blobs (incremental + deduplicated), with unreferenced blobs garbage-collected. Legacy inline-content snapshot records remain readable.
- **Browser `localStorage`**: Stores layout preferences (`webidePrefs`), active color theme key (`webideTheme`), and extension setting values.

### Core Architecture & Privacy Isolation

#### 1. 100% Browser-Local Storage & Cross-Client Isolation (Zero Server Data)
- **Zero Cross-Client Leakage**: The server holds no shared `root`, project list, `$HOME` directory browser, host shell, or extension directory (legacy `/root`, `/projects`, `/fs/*`, `/git/*`, `/term/*`, `/agent/*`, and `/ext/install` server-disk endpoints are completely removed). Separate browser tabs, incognito sessions, or origins (`127.0.0.1` vs `localhost`) never see each other's workspaces or extensions.
- **Dual Local Folder Access (Safari, Chrome & Edge)**:
  - Uses the browser's **File System Access API** (`window.showDirectoryPicker({ mode: 'readwrite' })`) where available, storing directory handles directly in IndexedDB;
  - On Apple Safari and browsers without `showDirectoryPicker`, falls back to a Safari-compatible `<input type="file" webkitdirectory>` flow or direct **Finder folder drag & drop** onto Home / Explorer (`webkitGetAsEntry()`), chunk-importing files into browser IndexedDB without uploading file contents to any server.
- **Pure-Client GitHub Repository Cloning**: Fetches public repository ZIP archives through stateless `/proxy/github/meta` and `/proxy/github/archive`, unpacks entries in browser memory via `unzipBytes()` (`DecompressionStream('deflate-raw')`), and stores files and initial snapshot baselines strictly in IndexedDB.
- **Private GitHub Repositories (access token, browser → GitHub directly)**: In the **Open from GitHub** dialog, expand **Private repository access** and paste a read-only GitHub token (recommended: a [fine-grained token](https://github.com/settings/personal-access-tokens/new) limited to the target repos with **Contents: Read + Metadata: Read**; classic tokens need `repo`). The token is kept only in this tab's `sessionStorage` (cleared when the tab closes, **never written to `localStorage`**; a legacy localStorage copy from older versions is deleted on startup) and is **sent only to `api.github.com`, never to the WebIDE server**; sandboxed extension code cannot read it either. With a token, clone and pull call the GitHub API straight from the browser: repo → branch → recursive tree, then file contents in GraphQL batches (~80 files per request), with binaries via the REST raw-blob endpoint (5 MB per file, 80 MB / 20,000 files per repo). Remove it any time from the dialog or with `GitHub: Forget Access Token`.
  - Why not SSH keys or local git: browsers cannot open SSH connections, and holding private keys server-side would break the zero-state, zero-credential server design; a web page also cannot run the git on your computer. Private repos you already cloned locally over SSH can be browsed with **Open Local Repository** (desktop Chrome/Edge).

#### 2. Brand Logo, Minimalist Home & Obsidian Theme
- **Top-Left Logo Navigation**: Clicking `#act-home` in the Activity Bar switches back to the minimalist Home view from any open workspace.
- **Focused Entry Screen**: `#home` collapses sidebars and presents the **Open. Private. Light.** slogan, **Open Local Repository** (`#home-open-local`), **Open from GitHub** (`#home-open-github`), and essential shortcuts.
- **One-Click Chinese / English UI**: The small `中 | EN` switch in the top-right corner changes the interface language instantly (also `View: Switch Language` in the Command Palette); the choice is remembered in the browser and the first visit follows the browser language. Only UI text (buttons, menus, palette, toasts, dialogs) is translated, never file names, code, or search results; in Chinese mode the Command Palette matches both Chinese and English keywords.
- **Responsive Mobile Reading Mode (portrait `< 768px`, or landscape phones `<= 500px` tall)**: Phones get a bottom navigation dock with a slide-over drawer (Explorer, Search, Source Control, Quick Open) and a full-width editor tuned for reading: word wrap on by default; minimap, folding, overview ruler and sticky scroll hidden; read-only by default so the on-screen keyboard stays away until you tap "编辑" (Edit). Markdown opens as a full-screen rendered preview with a one-tap Preview / Source switch, and the preview is restyled for small screens (15px body text, horizontally scrollable tables without per-character wrapping, full-bleed code blocks). Diffs switch to inline view, and landscape phones get slimmer bars. Extensions and the Agent panel are hidden on phones.
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
  - **Sandboxed Extension Host**: `browser` extension code no longer executes in the IDE page. It is loaded into an opaque-origin sandboxed iframe ([web/ext-host.js](web/ext-host.js)), wrapped in `window.__webideExtDefine(dir, (require, module, exports, define) => ...)` and loaded via `Blob` URLs there; it is fully isolated from the page's storage, tokens and workspace data and can only call the capabilities the parent grants over postMessage RPC. Data contributions (themes, grammars, snippets) are still registered in-page without executing any extension code. Sandbox v1 supports commands, messages, configuration, memento state, workspace file access, `applyEdit`, document snapshot events, and completion/hover/formatting/code-action providers; task providers are not supported yet.
- **Supported Contributions**:
  - **Color Themes (`contributes.themes`)**: Applies sanitized `ext-...` Monaco themes, synchronizes `:root` CSS variables and `xterm.js` `TERM_THEME`, and integrates with **Preferences: Color Theme** (`#ext-themes` / `#qo`);
  - **Languages, TextMate Grammars & Snippets**: Registers language configs, compiles `.tmLanguage.json` patterns into Monarch tokenizers, and wires `contributes.snippets` to Monaco completions;
  - **Browser `vscode` API Shim**: Exposes lightweight `commands`, `window`, `workspace` (reading from browser VFS), and `languages` APIs and surfaces extension commands in the Command Palette (`>`).

#### 5. Browser-Local Source Control, Outline, Problems, Markdown Preview & Sandbox Shell
- **Problems Panel, Document Outline & Navigation**: Includes a bottom **Problems** tab listing workspace diagnostics, an expandable **Outline** symbol view under Explorer, TypeScript/JS workspace indexing, cross-file **Go to Definition** (`registerEditorOpener`), and **Prettier** code formatting.
- **Live Side-by-Side Markdown Preview**: Renders `.md` files in a toggleable live preview pane (`#mdpv`) with synchronized editor scrolling.
- **Auto Save & Local File History**: Supports toggleable **Auto Save** plus browser-local revision snapshots with one-click diff inspection.
- **In-Browser Diff & Snapshot History**: Computes added/modified/deleted files against IndexedDB `snapshots`, displays diffs in Monaco DiffEditor, supports staging, unstaging, discarding changes, local commits, pulling GitHub updates, and downloading the workspace directly as a `.zip` archive via **Export ZIP**.
- **GitHub Branches & Commit History**: Projects with a GitHub remote show a **Branches** list (default / current / protected marked) and the **Commits** of the selected branch (30 per page, load more) in Source Control. Tapping a branch only browses its history; the ⇄ button switches the workspace to it (with a confirmation when there are uncommitted changes; not offered for local-folder projects so disk files are never overwritten). Tapping a commit opens a full-screen detail view: full message, author and time, copyable SHA, clickable parents, +/− stats and a colored per-file diff that wraps on phones. Data comes straight from the GitHub API in the browser: public repos need no token (60 requests/hour), private repos use the saved access token.
- **In-Browser Sandbox Terminal**: Powers `xterm.js` with client-side workspace commands (`help`, `pwd`, `ls`, `cd`, `cat`, `head`, `touch`, `mkdir`, `rm`, `find`, `git status|log`, `ext list`, `clear`) without any server shell access.
- **IME & Modal Reliability**: All inputs use `composing(e)` to prevent CJK IME confirmation misfires, and `quickOpen()` blurs trigger buttons prior to `showModal()` so `Enter` dismissal never re-activates the opener button.

#### 6. Optional Local Companion (real shell / git — the server still executes nothing)
The browser sandbox terminal only sees the browser workspace. For a real shell, real `git` and a real folder, run the zero-dependency companion **on your own machine** (it is not part of the server; the bridge never starts it and never executes code):
```sh
node companion/companion.mjs --root ~/my-project   # optional --port 47399 / --agent-cmd "pi --acp"
```
- **Security model**: binds `127.0.0.1` only, serves only the `--root` folder chosen at launch (path and symlink escapes rejected), every request needs the pairing token printed at startup (the page keeps it in `sessionStorage` only), browser origins must be loopback, and the app CSP's `connect-src` extra allowance is loopback-only. `--agent-cmd` optionally relays a local ACP agent's stdio to the page over WebSocket.
- **In the IDE**: `Companion: Connect…` pairs the page, `Terminal: New Companion Terminal` opens a real shell (a true PTY when the optional `node-pty` package is installed, pipe mode otherwise), and `/exec`, `/git`, `/fs/*` endpoints expose real commands and files.
- **Coverage**: `test/test.mjs` boots a real companion and verifies token auth, root confinement, exec/git, and WebSocket terminal echo.

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

Validates frontend script syntax, `blob:` CSP without `unsafe-eval`, `/robots.txt` and bot User-Agent blocking, session token IP/UA binding, public `WEBIDE_PUBLIC_HOSTS` allowlisting, `429` per-IP rate limiting with `Retry-After`, SSRF and traversal guards on `/proxy/*`, `404` removal of all server-side workspace/shell/extension endpoints, and zero writes inside server `HOME`.
