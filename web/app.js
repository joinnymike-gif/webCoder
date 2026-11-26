const HOME_TITLE = document.title; // SEO title from <head>, restored on the Home view
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const enc = encodeURIComponent;
const MONACO = '/vendor/monaco/min'; // self-hosted, pinned 0.52.2 (see vendor/VERSIONS.txt)
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const isWin = /Win/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';
// Shortcut labels, shown the way each OS writes them. Chrome never lets a page take Ctrl+W / Ctrl+N / Ctrl+T,
// so "close editor" is ⌃W on macOS and Alt+W elsewhere.
const K = isMac
  ? { save: '⌘S', saveAll: '⌥⌘S', open: '⌘O', quick: '⌘P', cmd: '⇧⌘P', close: '⌃W', side: '⌘B', rename: 'F2', del: '⌘⌫', line: '⌃G', find: '⇧⌘F', explorer: '⇧⌘E', git: '⌃⇧G', ext: '⇧⌘X', wrap: '⌥Z', term: '⌃`', newTerm: '⌃⇧`', mdpv: '⇧⌘V', prob: '⇧⌘M' }
  : { save: 'Ctrl+S', saveAll: 'Ctrl+Alt+S', open: 'Ctrl+O', quick: 'Ctrl+P', cmd: 'Ctrl+Shift+P', close: 'Alt+W', side: 'Ctrl+B', rename: 'F2', del: 'Delete', line: 'Ctrl+G', find: 'Ctrl+Shift+F', explorer: 'Ctrl+Shift+E', git: 'Ctrl+Shift+G', ext: 'Ctrl+Shift+X', wrap: 'Alt+Z', term: 'Ctrl+`', newTerm: 'Ctrl+Shift+`', mdpv: 'Ctrl+Shift+V', prob: 'Ctrl+Shift+M' };
const keyCaps = k => (isMac ? [...k.replace('F2', '\u0001')].map(c => c === '\u0001' ? 'F2' : c) : k.split('+')).map(c => el('kbd', '', c));
const TRASH = isWin ? 'Recycle Bin' : 'Trash';
const HIDDEN = new Set(['.git', '.DS_Store', 'Thumbs.db', 'desktop.ini']);
const base = p => (p || '').split(/[\\/]/).filter(Boolean).pop() || p || '';
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const icon = (name, cls = '') => el('span', `codicon codicon-${name} ${cls}`);
const composing = e => e.isComposing || e.keyCode === 229;

// ---------- UI language (English source strings + Chinese dictionary) ----------
// Source strings stay English. A MutationObserver translates static and dynamically inserted UI text plus
// title/placeholder/aria-label as they appear, remembering each original so switching back is lossless.
// User content (file tree, editor, tabs, search results, terminal, previews) is never touched.
const ZH = {
  // shell & views
  'About': '关于', 'About WebIDE': '关于 WebIDE', 'FAQ': '常见问题', 'Browser-Local': '浏览器本地', 'Isolated': '隔离',
  'Explorer': '资源管理器', 'Search': '搜索', 'Source Control': '源代码管理', 'Extensions': '扩展', 'Chat': '聊天', 'Terminal': '终端',
  'Problems': '问题', 'Outline': '大纲', 'Export ZIP': '导出 ZIP', 'Loading editor…': '正在加载编辑器…', 'Agent': 'Agent',
  'Open · Private · Light': '开放 · 隐私 · 轻量', 'Open Local Repository': '打开本地仓库', 'Open from GitHub': '从 GitHub 打开',
  'Local': '本地', 'Browse Files': '浏览文件目录', 'Quick Find File': '快速查找文件', 'Clone Repository from GitHub': '从 GitHub 克隆仓库',
  'Quick Open File': '快速打开文件', 'Command Palette': '命令面板', 'Find in Files': '在文件中查找', 'Show All Commands': '显示所有命令',
  'Go to File': '转到文件', 'Open Folder': '打开文件夹', 'Toggle Sidebar': '切换侧栏', 'Go to Line': '转到行',
  'You have not yet opened a folder.': '尚未打开文件夹。', 'Clone from GitHub': '从 GitHub 克隆',
  'Open a local folder, or clone a GitHub repository (public, or private with an access token).': '打开本地文件夹，或克隆 GitHub 仓库（公开仓库直接克隆，私有仓库需访问令牌）。',
  'Open a folder to use Source Control, or clone a repository directly from GitHub.': '打开文件夹以使用源代码管理，或直接从 GitHub 克隆仓库。',
  'Initialize Repository': '初始化仓库', 'Commit (Local)': '提交（本地）', 'Staged Changes': '暂存的更改', 'Changes': '更改',
  'Local Snapshot History': '本地快照历史', 'recently opened': '最近打开', 'files': '文件', 'Sleeping': '休眠', 'Close Project': '关闭工程',
  'Edit': '编辑', 'Done': '完成', 'Preview': '预览', 'Source': '源码', 'Edit this file': '编辑此文件', 'Done editing (read-only)': '完成编辑（只读）',
  'Show Markdown source': '显示 Markdown 源码', 'Show rendered Markdown': '显示渲染后的 Markdown', 'Markdown Preview': 'Markdown 预览',
  'Zero Server Storage': '服务端零存储',
  'Workspaces, files, snapshots, and VS Code extensions stay 100% inside this browser profile. Server-side shell/agent execution is disabled to prevent cross-client directory access.': '工作区、文件、快照和 VS Code 扩展 100% 保存在此浏览器配置中。服务端 Shell/Agent 执行已禁用，以防止跨客户端访问目录。',
  'Browser-Local Privacy Mode: server-side agent execution is disabled.': '浏览器本地隐私模式：已禁用服务端 Agent 执行。',
  // titles, placeholders, aria-labels
  'All workspaces, files & extensions live only in your browser': '所有工作区、文件与扩展都只保存在你的浏览器中', 'Browser Privacy Status': '浏览器隐私状态',
  'Checkout Branch…': '切换分支…', 'Clear Search': '清除搜索', 'Clear Search Results': '清除搜索结果', 'Clone from GitHub (Browser IndexedDB)…': '从 GitHub 克隆（浏览器 IndexedDB）…',
  'Close': '关闭', 'Collapse All': '全部折叠', 'Collapse Folders in Explorer': '在资源管理器中折叠文件夹', 'Commit locally and download workspace ZIP': '本地提交并下载工作区 ZIP',
  'Commit message (⌘Enter to commit)': '提交信息（⌘Enter 提交）', 'Commit message (Ctrl+Enter to commit)': '提交信息（Ctrl+Enter 提交）', 'Export / Sync': '导出 / 同步', 'Export Workspace as ZIP': '将工作区导出为 ZIP',
  'Extensions (VS Code Marketplace)': '扩展（VS Code 市场）', 'File encoding': '文件编码', 'Hide Panel': '隐藏面板', 'Kill Terminal': '终止终端',
  'Match Case': '区分大小写', 'Match Whole Word': '全字匹配', 'Use Regular Expression': '使用正则表达式', 'New File…': '新建文件…', 'New Folder…': '新建文件夹…', 'New Terminal': '新建终端',
  'Next Problem (Extension Diagnostics)': '下一个问题（扩展诊断）', 'Open Folder…': '打开文件夹…', 'Open Local Folder…': '打开本地文件夹…', 'Open Projects Taskbar': '打开工程任务栏',
  'Pull Updates from GitHub': '从 GitHub 拉取更新', 'Refresh': '刷新', 'Refresh Explorer': '刷新资源管理器', 'Refresh Extensions': '刷新扩展',
  'Search Extensions in Marketplace': '在市场中搜索扩展', 'Search Extensions in VS Code Marketplace': '在 VS Code 市场中搜索扩展',
  'Search files by name, or type > for commands': '按名称搜索文件，或输入 > 执行命令', 'Select Color Theme…': '选择颜色主题…',
  'Select End of Line Sequence': '选择行尾序列', 'Select Indentation': '选择缩进', 'Send (Enter)': '发送（Enter）', 'Source Control (Git / GitHub)': '源代码管理（Git / GitHub）',
  'Start agent': '启动 Agent', 'Start an agent to chat': '启动 Agent 开始聊天', 'WebIDE Home': 'WebIDE 首页', 'WebIDE Home — Open · Private · Light': 'WebIDE 首页 — 开放 · 隐私 · 轻量',
  'Hide Side Bar': '隐藏侧栏', 'Hide Chat': '隐藏聊天', 'Toggle Problems': '切换问题面板', 'Toggle Word Wrap': '切换自动换行',
  'Open Preview to the Side': '在侧边打开预览', 'Close Preview to the Side': '关闭侧边预览', 'Switch language': '切换语言',
  // GitHub dialog
  'Repository (owner/repo, HTTPS, or git@github.com:...)': '仓库（owner/repo、HTTPS 或 git@github.com:...）',
  'Branch (optional — saved locally in browser IndexedDB)': '分支（可选，保存在浏览器 IndexedDB 中）',
  'e.g. main (leave blank for default HEAD)': '例如 main（留空则使用默认分支）', 'e.g. owner/repo or https://github.com/owner/repo.git': '例如 owner/repo 或 https://github.com/owner/repo.git',
  'Private repository access': '私有仓库访问', 'GitHub access token — read-only is enough.': 'GitHub 访问令牌，只读权限即可。',
  'Create a fine-grained token': '创建 Fine-grained 令牌', 'with': '，授予', 'for the repos you want.': '（限定为需要的仓库）。',
  'Forget saved token': '删除已保存的令牌', 'Public repos need no token': '公开仓库无需令牌',
  'The token is kept only for this browser session (sessionStorage, cleared when the tab closes) and is sent only to api.github.com. The WebIDE server never receives it.': '令牌只在本浏览器会话内保存（sessionStorage，关闭标签页即清除），且只发送给 api.github.com，WebIDE 服务器永远不会收到。',
  'Cancel': '取消', 'Clone': '克隆', 'Save Remote': '保存远程', 'Saving…': '正在保存…', 'Downloading ZIP…': '正在下载 ZIP…', 'Connecting to GitHub…': '正在连接 GitHub…',
  'Clone from GitHub (Browser-Local)': '从 GitHub 克隆（浏览器本地）', 'Connect GitHub Remote': '连接 GitHub 远程仓库',
  'GitHub token removed from this browser.': '已从此浏览器删除 GitHub 令牌。',
  'That does not look like a GitHub token (expected github_pat_… or ghp_…).': '这看起来不像 GitHub 令牌（应以 github_pat_… 或 ghp_… 开头）。',
  'Could not reach api.github.com from this browser (offline, or blocked by a network filter).': '此浏览器无法连接 api.github.com（离线或被网络过滤拦截）。',
  'GitHub rejected the access token (401: invalid or expired). Enter a new token in the GitHub dialog.': 'GitHub 拒绝了访问令牌（401：无效或已过期），请在 GitHub 对话框中输入新令牌。',
  'Repository or branch not found on GitHub (404). Check the name, and that the token has read access to this repository (fine-grained token: Contents + Metadata, read-only).': 'GitHub 上未找到该仓库或分支（404）。请检查名称，并确认令牌对该仓库有读取权限（Fine-grained 令牌：Contents + Metadata 只读）。',
  'GitHub API rate limit reached for this token. Try again later.': '此令牌已达到 GitHub API 调用上限，请稍后再试。',
  'Enter a valid GitHub repository (owner/repo or https://github.com/owner/repo).': '请输入有效的 GitHub 仓库（owner/repo 或 https://github.com/owner/repo）。',
  // command palette & menus
  'Change End of Line Sequence (LF / CRLF)': '更改行尾序列（LF / CRLF）', 'Change GitHub Remote…': '更改 GitHub 远程…', 'Connect GitHub Remote…': '连接 GitHub 远程…',
  'Click a color theme to apply in WebIDE:': '点击颜色主题以应用到 WebIDE：', 'Close All': '全部关闭', 'Close Others': '关闭其他', 'Close Saved': '关闭已保存', 'Close to the Right': '关闭右侧',
  'Collapse Folders': '折叠文件夹', 'Compare': '比较', 'Convert Indentation to Spaces': '将缩进转换为空格', 'Convert Indentation to Tabs': '将缩进转换为制表符',
  'Copy Path': '复制路径', 'Copy Relative Path': '复制相对路径', 'Delete': '删除', 'Move': '移动', 'Open': '打开', 'Open File': '打开文件', 'Rename…': '重命名…', 'Save': '保存',
  'Explorer: Collapse Folders': '资源管理器：折叠文件夹', 'Explorer: Refresh': '资源管理器：刷新', 'File: New File…': '文件：新建文件…', 'File: New Folder…': '文件：新建文件夹…',
  'File: Open Folder…': '文件：打开文件夹…', 'File: Reveal Active File in Explorer View': '文件：在资源管理器中显示当前文件', 'File: Save': '文件：保存', 'File: Save All': '文件：全部保存',
  'Format Document': '格式化文档', 'Git: Checkout / Create Branch…': 'Git：切换 / 创建分支…', 'Git: Clone from GitHub…': 'Git：从 GitHub 克隆…', 'Git: Connect GitHub Remote…': 'Git：连接 GitHub 远程…',
  'Git: Initialize Local Snapshot Repository': 'Git：初始化本地快照仓库', 'Git: Pull Updates from GitHub': 'Git：从 GitHub 拉取更新',
  'GitHub: Forget Access Token': 'GitHub：删除访问令牌', 'GitHub: Set Access Token (Private Repositories)…': 'GitHub：设置访问令牌（私有仓库）…',
  'Go to File…': '转到文件…', 'Go to Line/Column…': '转到行/列…', 'Go to Symbol in Editor…': '转到编辑器中的符号…', 'Local History: Find Entry to Restore…': '本地历史记录：查找要恢复的条目…',
  'Markdown: Open Preview to the Side': 'Markdown：在侧边打开预览', 'Open Local History…': '打开本地历史记录…', 'Open on GitHub': '在 GitHub 上打开',
  'Preferences: Color Theme': '首选项：颜色主题', 'Reveal in Explorer View': '在资源管理器中显示', 'Search: Find in Files': '搜索：在文件中查找',
  'Stage All Changes': '暂存所有更改', 'Unstage All Changes': '取消暂存所有更改', 'Terminal: Clear': '终端：清除', 'Terminal: Create New Terminal': '终端：新建终端',
  'Terminal: New Companion Terminal': '终端：新建 Companion 终端', 'Companion: Connect…': 'Companion：连接…', 'Companion: Disconnect': 'Companion：断开连接',
  'Terminal: Kill the Active Terminal Instance': '终端：终止当前终端实例', 'View: Close All Editors': '视图：关闭所有编辑器', 'View: Close Editor': '视图：关闭编辑器',
  'View: Show Explorer': '视图：显示资源管理器', 'View: Show Extensions': '视图：显示扩展', 'View: Show Home': '视图：显示首页', 'View: Show Source Control': '视图：显示源代码管理',
  'View: Toggle Chat': '视图：切换聊天', 'View: Toggle Primary Side Bar Visibility': '视图：切换主侧栏可见性', 'View: Toggle Problems': '视图：切换问题面板',
  'View: Toggle Terminal': '视图：切换终端', 'View: Toggle Word Wrap': '视图：切换自动换行', 'Workspace: Export Project as ZIP…': '工作区：将工程导出为 ZIP…',
  'View: Switch Language (中文 / English)': '视图：切换语言（中文 / English）',
  'No matching commands': '没有匹配的命令', 'No matching entries': '没有匹配的条目', 'No matching color themes installed.': '没有匹配的已安装颜色主题。', 'Open a folder to search its files.': '打开文件夹后即可搜索其文件。',
  // extensions
  'Trust & Install': '信任并安装', 'This extension contains code that runs in a sandboxed frame, isolated from your projects, storage and tokens; it can only use the IDE capabilities it is granted (commands, providers, workspace file access for the active project). Only install extensions from publishers you trust.': '此扩展包含会在沙盒框架内运行的代码，与你的项目、存储和令牌隔离，只能使用被授予的 IDE 能力（命令、语言服务、当前工程的工作区文件访问）。请只安装你信任的发布者的扩展。',
  'Install': '安装', 'Installed': '已安装', 'Installing…': '正在安装…', 'Uninstall': '卸载', 'VS Code Marketplace': 'VS Code 市场', 'No extensions found.': '未找到扩展。',
  // editor, history, conflicts
  'Overwrite': '覆盖', 'Overwrite with Mine': '用我的版本覆盖', 'Use Disk Version': '使用磁盘版本', 'File modified outside editor': '文件已在编辑器外被修改',
  'Discard your changes and load the file from disk': '放弃你的更改并从磁盘加载文件', 'Edit the right side to merge, then save.': '编辑右侧进行合并，然后保存。',
  'Restore This Version': '恢复此版本', 'Replace the editor contents with this version (undoable; save to keep it)': '用此版本替换编辑器内容（可撤销；保存后生效）',
  'Download browser workspace as ZIP (zero server upload)': '将浏览器工作区下载为 ZIP（不上传服务器）', 'Searching…': '正在搜索…',
  // toasts & errors
  'Committed snapshot locally in browser IndexedDB.': '已在浏览器 IndexedDB 中本地提交快照。', 'Connect a GitHub remote first.': '请先连接 GitHub 远程仓库。',
  'Connected GitHub remote.': '已连接 GitHub 远程仓库。', 'Could not access the clipboard.': '无法访问剪贴板。', 'Enter a commit message first.': '请先输入提交信息。',
  'Initialize a repository snapshot first.': '请先初始化仓库快照。', 'Initialized browser-local snapshot repository.': '已初始化浏览器本地快照仓库。',
  'No changes to commit.': '没有可提交的更改。', 'No editor is active.': '没有活动的编辑器。', 'No open project': '没有打开的工程',
  'No problems have been detected in the open editors.': '在打开的编辑器中未检测到问题。', 'No symbols found in document.': '文档中未找到符号。', 'No uncommitted changes.': '没有未提交的更改。',
  'Open a folder first.': '请先打开文件夹。', 'Open a folder or GitHub repo to search its files.': '打开文件夹或 GitHub 仓库后即可搜索其文件。',
  'Open a folder or GitHub repository first.': '请先打开文件夹或 GitHub 仓库。', 'Open a project first.': '请先打开工程。',
  'Prettier could not be loaded (offline?)': '无法加载 Prettier（是否离线？）', 'Session unauthorized.': '会话未授权。', 'The WebIDE server is not reachable.': '无法连接 WebIDE 服务器。',
  'Auto Save on — files save 1s after you stop typing': '自动保存已开启：停止输入 1 秒后保存', 'Auto Save off': '自动保存已关闭',
  'Browser folder permission was declined. Re-open the folder or grant access when prompted.': '浏览器文件夹权限被拒绝。请重新打开文件夹，或在提示时授予访问权限。',
  'Cannot move a folder inside itself': '不能把文件夹移动到它自身内部',
  // GitHub branches & commit history
  'Branches': '分支', 'Commits': '提交', 'default': '默认', 'current': '当前', 'Loading branches…': '正在加载分支…', 'Loading commits…': '正在加载提交…',
  'Load more commits': '加载更多提交', 'Switch to Branch': '切换到此分支', 'Switch Branch': '切换分支', 'Refresh Branches & Commits': '刷新分支和提交',
  'Add Access Token…': '添加访问令牌…', 'Loading commit…': '正在加载提交…', 'Copy SHA': '复制 SHA', 'Parents': '父提交', 'No commits on this branch.': '此分支没有提交。',
  'Binary file or diff too large to display.': '二进制文件或差异过大，无法显示。', 'Diff truncated (too many lines).': '差异过长，已截断。',
  'Show history of this branch': '查看此分支的提交历史', 'View commit details': '查看提交详情',
  'Uncommitted changes in this browser workspace will be replaced by the files of that branch.': '此浏览器工作区中未提交的更改将被该分支的文件替换。',
  'Private repository: add a GitHub access token to see its branches and commits.': '私有仓库：添加 GitHub 访问令牌后即可查看分支和提交。',
  'GitHub API rate limit reached (60 requests/hour without a token). Add an access token to raise it.': '已达到 GitHub API 调用上限（无令牌时每小时 60 次），添加访问令牌可提高上限。',
  "Switching branches would overwrite files in your local folder. Use git in that folder instead; you can still browse this branch's commits here.": '切换分支会覆盖本地文件夹中的文件，请在该文件夹中使用 git 切换；这里仍可浏览该分支的提交。', 'Target already exists': '目标已存在',
  'Local folder handle': '本地目录句柄', 'Browser IndexedDB': '浏览器 IndexedDB', '— hibernated, click to wake': '— 休眠中，点击唤醒', '— running': '— 当前运行',
};
const ZH_RE = [
  [/^Trust (.+) and run '(.+)'\?$/, '信任 $1 并运行“$2”？'],
  [/^Downloading (\d+)\/(\d+)…$/, '正在下载 $1/$2…'],
  [/^Cloned (private repo )?(.+?) \((\d+) files\) strictly into browser IndexedDB\.(?: (\d+) oversized file\(s\) skipped\.)?$/, (_, pr, s, n, k) => `已将${pr ? '私有仓库 ' : ' '}${s} 克隆到浏览器 IndexedDB（${n} 个文件）。${k ? `跳过了 ${k} 个超大文件。` : ''}`],
  [/^Pulled latest snapshot from (.+) into browser storage\.$/, '已从 $1 拉取最新快照到浏览器存储。'],
  [/^Exported (\d+) files to (.+)\.$/, '已导出 $1 个文件到 $2。'],
  [/^Applied theme "(.+)"\.$/, '已应用主题“$1”。'],
  [/^Uninstalled (.+)\.$/, '已卸载 $1。'],
  [/^Switched local branch label to (.+)\.$/, '已将本地分支标签切换为 $1。'],
  [/^(.+) was not found as a public repository\. If it is private, add a GitHub access token in this dialog\.$/, '未找到公开仓库 $1。如果它是私有仓库，请在此对话框中添加 GitHub 访问令牌。'],
  [/^(.+) is private: add a GitHub access token to pull\.$/, '$1 是私有仓库：请添加 GitHub 访问令牌后再拉取。'],
  [/^File: Toggle Auto Save \(now (on|off)\)$/, (_, v) => `文件：切换自动保存（当前${v === 'on' ? '已开启' : '已关闭'}）`],
  [/^Saved token (\S+) in use — paste a new one to replace$/, '正在使用已保存的令牌 $1，粘贴新令牌可替换'],
  [/^Token (\S+)$/, '令牌 $1'],
  [/^Indent Using Spaces: (\d+)$/, '使用空格缩进：$1'],
  [/^Indent Using Tabs: Tab Size (\d+)$/, '使用制表符缩进：宽度 $1'],
  [/^GitHub refused the request \(403\): (.*)$/, 'GitHub 拒绝了请求（403）：$1'],
  [/^GitHub API error (\d+)(.*)$/, 'GitHub API 错误 $1$2'],
  [/^Importing (.+) \((\d+) files\)…$/, '正在导入 $1（$2 个文件）…'],
  [/^No local history for (.+) yet — versions are recorded when you save\.$/, '$1 暂无本地历史记录，保存时会记录版本。'],
  [/^Restored (.+) to (.+)\. Save to keep it\.$/, '已将 $1 恢复到 $2。保存后生效。'],
  [/^(.+) is a binary file and can't be opened in the text editor\.$/, '$1 是二进制文件，无法在文本编辑器中打开。'],
  [/^(.+) is larger than 5 MB and can't be opened\.$/, '$1 超过 5 MB，无法打开。'],
  [/^File not found: (.+)$/, '文件未找到：$1'],
  [/^"(.+)" already exists$/, '“$1”已存在'],
  [/^\+ Create branch "(.+)"$/, '+ 创建分支“$1”'],
  [/^Switch to branch "(.+)"\?$/, '切换到分支“$1”？'],
  [/^Switched to branch (.+)\.$/, '已切换到分支 $1。'],
  [/^(\d+) files? changed$/, '$1 个文件已更改'],
  [/^Commit ([0-9a-f]{7})$/, '提交 $1'],
  [/^(.+) \(current\)$/, '$1（当前）'],
  [/^Toggle Word Wrap \((on|off)\)$/, (_, v) => `切换自动换行（当前${v === 'on' ? '开启' : '关闭'}）`],
];
// Chinese for an English UI string, or null when it is not a known UI string.
function zhOf(s) {
  const out = zhRaw(s);
  return out && out.replace(/^\s+(?=[，。（）：、])/, '').replace(/(?<=[，。（）：、])\s+$/, ''); // no stray spaces around CJK punctuation
}
function zhRaw(s) {
  if (typeof s !== 'string' || !s) return null;
  const k = s.trim();
  if (!k || !/[A-Za-z]/.test(k)) return null;
  if (Object.hasOwn(ZH, k)) return s.replace(k, ZH[k]);
  for (const [re, rep] of ZH_RE) if (re.test(k)) return s.replace(k, k.replace(re, rep));
  const m = k.match(/^(.+?) \(([^()]+)\)$/); // "Label (⌘B)": keep the shortcut
  if (m && Object.hasOwn(ZH, m[1])) return s.replace(k, `${ZH[m[1]]} (${m[2]})`);
  return null;
}
let LANG = 'en';
try { LANG = localStorage.webideLang || ((navigator.languages || [navigator.language]).some(l => /^zh\b/i.test(l || '')) ? 'zh' : 'en'); } catch { /* storage unavailable */ }
if (LANG !== 'zh') LANG = 'en';
const t = s => (LANG === 'zh' && zhOf(s)) || s;
const I18N_SKIP = '[class*="monaco"], .xterm, #tree, #tabs, .cr-path, #outline li:not(.ol-empty), #sr-res, #probbody .pmsg, .edlg-readme, iframe, script, style, code, pre, .gh-user, [data-i18n-skip]';
const I18N_ATTRS = ['title', 'placeholder', 'aria-label'];
const i18nOrig = new WeakMap(); // text node -> English original
function i18nText(n) {
  let orig = i18nOrig.get(n);
  if (orig === undefined || (n.data !== orig && n.data !== zhOf(orig))) {
    orig = n.data; // first sight, or the app replaced the text since
    if (zhOf(orig) == null) { i18nOrig.delete(n); return; }
    i18nOrig.set(n, orig);
  }
  const want = LANG === 'zh' ? zhOf(orig) : orig;
  if (n.data !== want) n.data = want;
}
function i18nAttr(e, a) {
  const v = e.getAttribute(a), key = 'i18n' + a.replace('-', '');
  if (v == null) return;
  let orig = e.dataset[key];
  if (orig === undefined || (v !== orig && v !== zhOf(orig))) {
    orig = v;
    if (zhOf(orig) == null) { delete e.dataset[key]; return; }
    e.dataset[key] = orig;
  }
  const want = LANG === 'zh' ? zhOf(orig) : orig;
  if (v !== want) e.setAttribute(a, want);
}
function i18nWalk(rootNode) {
  if (rootNode.nodeType === 3) { if (!rootNode.parentElement?.closest(I18N_SKIP)) i18nText(rootNode); return; }
  if (rootNode.nodeType !== 1 || rootNode.closest(I18N_SKIP)) return;
  const w = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.nodeType === 1 && n.matches(I18N_SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = rootNode; n; n = w.nextNode()) {
    if (n.nodeType === 3) i18nText(n);
    else for (const a of I18N_ATTRS) if (n.hasAttribute(a)) i18nAttr(n, a);
  }
}
const i18nObs = new MutationObserver(recs => {
  for (const r of recs) {
    if (r.type === 'attributes') { if (!r.target.closest(I18N_SKIP)) i18nAttr(r.target, r.attributeName); continue; }
    if (r.target.nodeType === 1 && r.target.closest(I18N_SKIP)) continue; // Monaco/xterm churn: cheap early out
    for (const n of r.addedNodes) i18nWalk(n);
  }
});
function applyLang() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  i18nWalk(document.body);
  for (const b of document.querySelectorAll('#lang-sw button')) b.setAttribute('aria-pressed', String(b.dataset.lang === LANG));
}
function setLang(l) {
  LANG = l === 'zh' ? 'zh' : 'en';
  try { localStorage.webideLang = LANG; } catch { /* storage unavailable */ }
  applyLang();
  // Views that bake t() into their data rather than DOM text
  renderProjectBar(); renderCrumbs(); renderGit();
  if ($('#qo').open) qoRender();
}
applyLang();
i18nObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: I18N_ATTRS });
for (const b of document.querySelectorAll('#lang-sw button')) b.onclick = () => setLang(b.dataset.lang);

const safeUid = (len = 8) => (typeof crypto?.randomUUID === 'function'
  ? crypto.randomUUID().replace(/-/g, '')
  : [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('')
).slice(0, len);
function lightDismiss(d, closeFn) {
  let downOnBackdrop = false;
  d.addEventListener('pointerdown', e => { downOnBackdrop = e.target === d; });
  d.addEventListener('click', e => { if (downOnBackdrop && e.target === d) closeFn(); downOnBackdrop = false; });
}

// ---------- auth ----------
// The token arrives in the URL fragment (when launched remotely) or via same-origin /session (when opened directly).
let token = sessionStorage.token;
if (location.hash.startsWith('#token=')) { token = location.hash.slice(7); sessionStorage.token = token; history.replaceState(null, '', location.pathname); }
let tokenReq = null;
function ensureToken() {
  return (tokenReq ??= fetch('/session', { method: 'POST' })
    .then(async r => { if (!r.ok) return false; token = (await r.json()).token; sessionStorage.token = token; return true; })
    .catch(() => false)
    .finally(() => { tokenReq = null; }));
}

async function api(p, o = {}) {
  if (!token) await ensureToken();
  const send = () => fetch(p, { ...o, headers: { ...(token && { authorization: 'Bearer ' + token }), ...o.headers } });
  let r;
  try { r = await send(); }
  catch { throw new Error('The WebIDE server is not reachable.'); }
  if (r.status === 401 && await ensureToken()) {
    try { r = await send(); } catch { throw new Error('The WebIDE server is not reachable.'); }
  }
  if (r.status === 401) throw new Error('Session unauthorized.');
  if (!r.ok) throw Object.assign(new Error((await r.text()) || r.statusText), { status: r.status });
  return r;
}
const getJSON = async p => (await api(p)).json();
const postJSON = (p, o) => api(p, { method: 'POST', body: JSON.stringify(o) });
// Monaco rejects internal promises with "Canceled" when models are swapped; that is noise, not an error.
addEventListener('unhandledrejection', e => { if (e.reason?.name === 'Canceled') e.preventDefault(); });
// Keep the server from idling out while this page is open.
setInterval(() => fetch('/health').catch(() => toast('The WebIDE server is not reachable.', 'warn')), 5 * 60_000);

// ---------- toasts ----------
function toast(text, kind = 'info') {
  const t = el('div', 'toast');
  t.append(icon(kind === 'error' ? 'error' : kind === 'warn' ? 'warning' : 'info', kind === 'error' ? 'err' : kind === 'warn' ? 'warn' : ''), el('span', '', text));
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 5000);
}
const fail = e => { toast(e?.message || String(e), 'error'); };

// ---------- layout ----------
// Phone layout (portrait phones up to tablets' width, plus landscape phones). Keep in sync with the CSS @media rule.
const MOBILE_MQ = '(max-width: 767px), (pointer: coarse) and (max-height: 500px)';
const isMobileUI = () => window.matchMedia(MOBILE_MQ).matches;
// Phones get a reading-first editor: wrapped lines, no minimap/folding/rulers, and read-only (no on-screen keyboard)
// until the user taps "Edit". Desktop values are Monaco's defaults so switching back restores them.
let mobEdit = false;
const wrapOn = (mob = isMobileUI()) => mob ? prefs.wrapMob !== false : !!prefs.wrap;
function edLayoutOpts(mob = isMobileUI()) {
  return {
    minimap: { enabled: !mob }, glyphMargin: !mob, folding: !mob, lineNumbersMinChars: mob ? 2 : 5, lineDecorationsWidth: mob ? 6 : 10,
    fontSize: 13, lineHeight: mob ? 20 : 0, overviewRulerLanes: mob ? 0 : 3, overviewRulerBorder: !mob, hideCursorInOverviewRuler: mob,
    scrollbar: { verticalScrollbarSize: mob ? 5 : 14, horizontalScrollbarSize: mob ? 5 : 12, useShadows: !mob },
    stickyScroll: { enabled: !mob }, renderLineHighlight: mob ? 'none' : 'all', occurrencesHighlight: mob ? 'off' : 'singleFile', selectionHighlight: !mob,
    contextmenu: !mob, wordWrap: wrapOn(mob) ? 'on' : 'off', wrappingIndent: 'same',
  };
}
const diffLayoutOpts = (mob = isMobileUI()) => ({ ...edLayoutOpts(mob), renderSideBySide: !mob, renderOverviewRuler: !mob, useInlineViewWhenSpaceIsLimited: true });
function applyEdMode() {
  if (!editor) return;
  const hasFile = !!(active && tabs.has(active)), ro = !hasFile || (isMobileUI() && !mobEdit);
  editor.updateOptions({ readOnly: ro, domReadOnly: ro && isMobileUI() });
}
const prefs = { sideW: 260, chatW: 340, side: true, chat: false, view: 'explorer', wrap: false, termH: 260 };
try { Object.assign(prefs, JSON.parse(localStorage.webidePrefs || '{}')); } catch { /* storage unavailable */ }
// prefs = what the user chose (saved). shown = what fits in this window right now (never saved),
// so a narrow window can fold a panel without the user's choice being lost.
const shown = { ...prefs };
let lastOpened = 'side', homeOn = false, root = null, editor = null, mobDrawer = false, lastMob = isMobileUI();
const projects = new Map(); // projRoot -> hibernated/active project state
function layout() {
  const mob = isMobileUI();
  Object.assign(shown, prefs);
  const activeView = (mob && prefs.view === 'ext') ? 'explorer' : prefs.view;
  const barOn = projects.size > 0 && !(homeOn && !root);
  if (mob) {
    shown.side = mobDrawer;
    shown.chat = false;
    const sideOn = !homeOn && mobDrawer;
    $('#app').style.gridTemplateColumns = 'minmax(0, 1fr)';
    $('#app').style.gridTemplateRows = `minmax(0, 1fr) ${barOn ? 'var(--wsbar)' : '0px'} calc(var(--dock) + env(safe-area-inset-bottom, 0px))`;
    $('#side').hidden = !sideOn;
    $('#sash-side').hidden = $('#sash-chat').hidden = $('#chat').hidden = $('#status').hidden = true;
    $('#mob-backdrop').hidden = !sideOn;
    $('#ws-bar').hidden = !barOn;
    $('#view-explorer').hidden = activeView !== 'explorer';
    $('#view-search').hidden = activeView !== 'search';
    $('#view-git').hidden = activeView !== 'git';
    $('#view-ext').hidden = true;
    $('#act-files').classList.toggle('on', sideOn && activeView === 'explorer');
    $('#act-search').classList.toggle('on', sideOn && activeView === 'search');
    $('#act-git').classList.toggle('on', sideOn && activeView === 'git');
    $('#act-ext').classList.remove('on');
    $('#act-chat').classList.remove('on');
    const maxMobPanel = Math.max(100, Math.floor((innerHeight - 96) * 0.45));
    $('#panel').style.height = Math.max(100, Math.min(prefs.termH, maxMobPanel)) + 'px';
  } else {
    const avail = innerWidth - 48, ed = () => avail - (shown.side ? shown.sideW : 0) - (shown.chat ? shown.chatW : 0);
    const other = lastOpened === 'side' ? 'chat' : 'side';
    if (ed() < 360 && shown.side && shown.chat) shown[other] = false; // both don't fit: keep the one opened last
    if (ed() < 360 && shown.chat) shown.chatW = Math.max(260, avail - 360 - (shown.side ? shown.sideW : 0));
    if (ed() < 360 && shown.side) shown.sideW = Math.max(170, avail - 360 - (shown.chat ? shown.chatW : 0));
    const sideOn = !homeOn && shown.side, chatOn = !homeOn && shown.chat;
    const stHidden = homeOn && !root;
    $('#app').style.gridTemplateColumns = `48px ${sideOn ? shown.sideW : 0}px 0 minmax(0, 1fr) 0 ${chatOn ? shown.chatW : 0}px`;
    $('#app').style.gridTemplateRows = `minmax(0, 1fr) ${barOn ? '34px' : '0px'} ${stHidden ? '0px' : '22px'}`;
    $('#side').hidden = $('#sash-side').hidden = !sideOn;
    $('#chat').hidden = $('#sash-chat').hidden = !chatOn;
    $('#mob-backdrop').hidden = true;
    $('#ws-bar').hidden = !barOn;
    $('#status').hidden = stHidden;
    $('#view-explorer').hidden = activeView !== 'explorer';
    $('#view-search').hidden = activeView !== 'search';
    $('#view-git').hidden = activeView !== 'git';
    $('#view-ext').hidden = activeView !== 'ext';
    $('#act-files').classList.toggle('on', sideOn && activeView === 'explorer');
    $('#act-search').classList.toggle('on', sideOn && activeView === 'search');
    $('#act-git').classList.toggle('on', sideOn && activeView === 'git');
    $('#act-ext').classList.toggle('on', sideOn && activeView === 'ext');
    $('#act-chat').classList.toggle('on', chatOn);
    $('#panel').style.height = Math.max(100, Math.min(prefs.termH, innerHeight - 22 - 35 - 120)) + 'px'; // the editor keeps ~120px
  }
  if (editor && lastMob !== mob) {
    lastMob = mob;
    // Booted in the narrow/mobile layout skips extensions; activate them once the window becomes desktop-sized
    if (!mob && !extsLoaded) loadExtensions().then(() => installedExts.forEach(e => notifyExtOpenDocs(e.dir))).catch(e => console.warn('Extensions init:', e));
    if (!mob) mobEdit = false;
    editor.updateOptions(edLayoutOpts(mob));
    diff?.de.updateOptions(diffLayoutOpts(mob));
    applyEdMode(); renderCrumbs();
  }
  try { localStorage.webidePrefs = JSON.stringify(prefs); } catch { /* storage unavailable */ }
}
function toggle(key) {
  if (isMobileUI()) {
    if (key === 'chat') return;
    if (key === 'side') { mobDrawer = !mobDrawer; layout(); return; }
  }
  prefs[key] = !shown[key];
  if (prefs[key]) lastOpened = key;
  layout();
}
// Quick "hide" button at the right end of every side bar / chat header (the bottom panel already has one)
for (const [sel, key, ic, title] of [['#side .view > .ptitle', 'side', 'layout-sidebar-left-off', `Hide Side Bar (${K.side})`], ['#chat > .ptitle', 'chat', 'layout-sidebar-right-off', 'Hide Chat']]) {
  for (const t of document.querySelectorAll(sel)) {
    const b = el('button', 'ibtn'); b.title = title; b.append(icon(ic));
    b.onclick = () => toggle(key);
    t.append(b);
  }
}
function sash(id, key, dir, min, max) {
  const s = $(id);
  s.onpointerdown = e => {
    e.preventDefault();
    lastOpened = key === 'sideW' ? 'side' : 'chat';
    s.setPointerCapture(e.pointerId); s.classList.add('drag');
    const x0 = e.clientX, w0 = shown[key];
    s.onpointermove = m => { prefs[key] = Math.max(min, Math.min(max, w0 + dir * (m.clientX - x0))); layout(); };
    s.onpointerup = s.onpointercancel = () => { s.onpointermove = null; s.classList.remove('drag'); };
  };
}
$('#sash-panel').onpointerdown = e => { // drag the panel's top edge
  const s = e.currentTarget, y0 = e.clientY, h0 = $('#panel').offsetHeight;
  e.preventDefault(); s.setPointerCapture(e.pointerId); s.classList.add('drag');
  s.onpointermove = m => { prefs.termH = Math.max(100, h0 - (m.clientY - y0)); layout(); };
  s.onpointerup = s.onpointercancel = () => { s.onpointermove = null; s.classList.remove('drag'); };
};
sash('#sash-side', 'sideW', 1, 170, 600);
sash('#sash-chat', 'chatW', -1, 260, 800);
addEventListener('resize', layout);
// Side bar views (Explorer / Search). As in VS Code, clicking the icon of the view already showing hides the side bar.
function showView(v) {
  if (isMobileUI() && v === 'ext') v = 'explorer';
  if (homeOn) showHome(false);
  prefs.view = v;
  if (isMobileUI()) { mobDrawer = true; layout(); return; }
  if (!shown.side) toggle('side'); else layout();
}
const activityClick = v => () => {
  if (homeOn) return showView(v);
  shown.side && prefs.view === v ? toggle('side') : showView(v);
};
function showHome(on) {
  homeOn = !!on;
  if (homeOn && isMobileUI()) mobDrawer = false;
  $('#home').hidden = !homeOn;
  $('#act-home').classList.toggle('on', homeOn);
  renderProjectBar();
}
$('#mob-backdrop').onclick = () => { if (mobDrawer) { mobDrawer = false; layout(); } };
$('#act-home').onclick = () => showHome(root ? !homeOn : true);
$('#home-open-local').onclick = () => openFolder().catch(fail);
$('#home-open-github').onclick = () => openGitDialog('clone');
$('#act-files').onclick = activityClick('explorer');
$('#act-search').onclick = () => (!homeOn && shown.side && prefs.view === 'search' ? toggle('side') : openSearch());
$('#act-git').onclick = () => (!homeOn && shown.side && prefs.view === 'git' ? toggle('side') : openGitView());
$('#act-quick').onclick = () => quickOpen('');
$('#empty-browse').onclick = () => showView('explorer');
$('#empty-quick').onclick = () => quickOpen('');
$('#act-ext').onclick = () => (!homeOn && shown.side && prefs.view === 'ext' ? toggle('side') : openExtView());
$('#act-chat').onclick = () => (homeOn ? (showHome(false), !prefs.chat && toggle('chat')) : toggle('chat'));
$('#st-agent').onclick = () => toggle('chat');
layout();
$('#keys').append(...[['Show All Commands', K.cmd], ['Go to File', K.quick], ['Find in Files', K.find], ['Open Folder', K.open], ['Toggle Sidebar', K.side]]
  .flatMap(([label, k]) => { const dd = el('dd'); dd.append(...keyCaps(k)); return [el('dt', '', label), dd]; }));
$('#home-keys').append(...[['Open Local Repository', K.open], ['Quick Open File', K.quick], ['Command Palette', K.cmd], ['Find in Files', K.find], ['Source Control', K.git], ['Terminal', K.term]].map(([label, k]) => {
  const s = el('span'); s.append(el('span', '', label), ...keyCaps(k)); return s;
}));
$$('kbd.mod').forEach(k => k.textContent = MOD);

// ---------- browser-local IndexedDB + ZIP + Virtual File System (zero server storage) ----------
const IDB_NAME = 'webide-browser-v1', IDB_VER = 2;
let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('files')) {
        const s = db.createObjectStore('files', { keyPath: 'key' });
        s.createIndex('byProj', 'projectId');
      }
      if (!db.objectStoreNames.contains('snapshots')) {
        const s = db.createObjectStore('snapshots', { keyPath: 'key' });
        s.createIndex('byProj', 'projectId');
      }
      if (!db.objectStoreNames.contains('extensions')) db.createObjectStore('extensions', { keyPath: 'dir' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'hash' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error || new Error('IndexedDB unavailable'));
  });
  return dbPromise;
}
const idbTx = async (store, mode, fn) => {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, mode), st = tx.objectStore(store);
    let out;
    try { out = fn(st); } catch (e) { rej(e); return; }
    tx.oncomplete = () => res(out && 'result' in out ? out.result : out);
    tx.onerror = () => rej(tx.error || new Error('IndexedDB error'));
  });
};
const dbGet = (store, key) => idbTx(store, 'readonly', st => st.get(key));
const dbPut = (store, val) => idbTx(store, 'readwrite', st => st.put(val));
const dbDel = (store, key) => idbTx(store, 'readwrite', st => st.delete(key));
const dbAll = store => idbTx(store, 'readonly', st => st.getAll());
const dbByProj = (store, projId) => idbTx(store, 'readonly', st => st.index('byProj').getAll(projId));
const dbPutMany = (store, items) => idbTx(store, 'readwrite', st => { for (const x of items) st.put(x); });
const dbDelByProj = (store, projId) => idbTx(store, 'readwrite', st => {
  const req = st.index('byProj').openCursor(projId);
  req.onsuccess = () => { const c = req.result; if (c) { c.delete(); c.continue(); } };
});

// ---------- content-addressed blob store (step 4: incremental, deduplicated snapshots) ----------
// File contents are stored once per unique SHA-256 hash; snapshot records keep only a
// manifest entry { hash, size, etag } per path. Committing a snapshot therefore writes
// only the blobs that actually changed (incremental), and identical contents share one
// blob across paths and projects (deduplication). Blob bytes live in OPFS when the
// browser offers it (navigator.storage.getDirectory), otherwise in the IndexedDB
// 'blobs' store; an IDB index record always exists ({ hash, opfs: 1 } or { hash, content }).
async function sha256Hex(u8) {
  const buf = await crypto.subtle.digest('SHA-256', u8);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
let opfsBlobsDirP = null;
function opfsBlobsDir() {
  if (!opfsBlobsDirP) {
    opfsBlobsDirP = (async () => {
      if (!navigator.storage?.getDirectory) return null;
      const rootDir = await navigator.storage.getDirectory();
      return rootDir.getDirectoryHandle('webide-blobs', { create: true });
    })().catch(() => null);
  }
  return opfsBlobsDirP;
}
async function blobPut(u8) {
  const hash = await sha256Hex(u8);
  if (await dbGet('blobs', hash)) return hash; // already stored: incremental no-op
  const dir = await opfsBlobsDir();
  if (dir) {
    try {
      const fh = await dir.getFileHandle(hash, { create: true });
      const w = await fh.createWritable();
      await w.write(u8); await w.close();
      await dbPut('blobs', { hash, opfs: 1, size: u8.length });
      return hash;
    } catch { /* OPFS write failed: fall through to IndexedDB */ }
  }
  await dbPut('blobs', { hash, content: u8, size: u8.length });
  return hash;
}
async function blobGet(hash) {
  if (!hash) return null;
  const rec = await dbGet('blobs', hash);
  if (rec?.content) return rec.content instanceof Uint8Array ? rec.content : new Uint8Array(rec.content);
  const dir = await opfsBlobsDir();
  if (dir) {
    try {
      const fh = await dir.getFileHandle(hash);
      return new Uint8Array(await (await fh.getFile()).arrayBuffer());
    } catch { return null; }
  }
  return null;
}
async function blobDel(hash) {
  await dbDel('blobs', hash);
  const dir = await opfsBlobsDir();
  if (dir) { try { await dir.removeEntry(hash); } catch {} }
}
// New snapshot records are manifest entries (no inline content). Legacy records that
// still carry `content` inline keep working through snapshotBytes().
async function snapshotPut(projId, rel, bytes) {
  const hash = await blobPut(bytes);
  const rec = { key: fKey(projId, rel), projectId: projId, path: rel, hash, size: bytes.length, etag: bytesEtag(bytes) };
  await dbPut('snapshots', rec);
  return rec;
}
async function snapshotBytes(rec) {
  if (!rec) return null;
  if (rec.content) return rec.content instanceof Uint8Array ? rec.content : textEnc.encode(String(rec.content));
  return blobGet(rec.hash);
}
// Drop blobs no snapshot references anymore (after project delete / snapshot reset).
async function gcBlobs() {
  try {
    const snaps = await dbAll('snapshots');
    const used = new Set(snaps.map(s => s.hash).filter(Boolean));
    for (const b of await dbAll('blobs')) if (!used.has(b.hash)) await blobDel(b.hash);
  } catch {}
}

// Pure-JS browser ZIP reader (store + DEFLATE via DecompressionStream)
async function inflateRawBytes(bytes) {
  if (typeof DecompressionStream !== 'function') throw new Error('Browser DecompressionStream("deflate-raw") is required.');
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter();
  w.write(bytes); w.close();
  const ab = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(ab);
}
async function unzipBytes(buf, { maxBytes = 150 * 1024 * 1024, maxFiles = 10000, filter = null, concurrency = 24 } = {}) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65558); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid ZIP / VSIX archive');
  const entries = dv.getUint16(eocd + 10, true);
  const cdSize = dv.getUint32(eocd + 12, true), cdOff = dv.getUint32(eocd + 16, true);
  if (entries > maxFiles || cdOff + cdSize > u8.length) throw new Error('Invalid or oversized archive directory');
  const dec = new TextDecoder('utf-8', { fatal: false });
  const files = new Map(), deflateTasks = [];
  let off = cdOff, total = 0;
  for (let i = 0; i < entries; i++) {
    if (off + 46 > u8.length || dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const uncompSize = dv.getUint32(off + 24, true);
    const nameLen = dv.getUint16(off + 28, true), extLen = dv.getUint16(off + 30, true), cmtLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = dec.decode(u8.subarray(off + 46, off + 46 + nameLen)).replace(/\\/g, '/');
    off += 46 + nameLen + extLen + cmtLen;
    if (!name || name.endsWith('/') || name.startsWith('/') || name.split('/').some(s => s === '..')) continue;
    if (filter && !filter(name)) continue;
    total += uncompSize;
    if (total > maxBytes) throw new Error('Extracted archive exceeds size limit');
    if (localOff + 30 > u8.length || dv.getUint32(localOff, true) !== 0x04034b50) continue;
    const lNameLen = dv.getUint16(localOff + 26, true), lExtLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtLen;
    if (dataStart + compSize > u8.length) throw new Error('Truncated ZIP entry: ' + name);
    const slice = u8.subarray(dataStart, dataStart + compSize);
    if (method === 0) files.set(name, new Uint8Array(slice));
    else if (method === 8) deflateTasks.push([name, slice]);
  }
  for (let i = 0; i < deflateTasks.length; i += concurrency) {
    const batch = deflateTasks.slice(i, i + concurrency);
    const out = await Promise.all(batch.map(([, slice]) => inflateRawBytes(slice)));
    for (let j = 0; j < batch.length; j++) files.set(batch[j][0], out[j]);
  }
  return files;
}

const CRC_TBL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(u8) {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = CRC_TBL[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function buildZipBlob(entries) {
  const encUtf8 = new TextEncoder(), locals = [], centrals = [];
  let offset = 0;
  for (const [nameRaw, rawBytes] of entries) {
    const name = encUtf8.encode(nameRaw), data = rawBytes instanceof Uint8Array ? rawBytes : encUtf8.encode(String(rawBytes));
    const sum = crc32(data);
    const lh = new Uint8Array(30 + name.length), lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(14, sum, true);
    lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, name.length, true);
    lh.set(name, 30);
    locals.push(lh, data);

    const ch = new Uint8Array(46 + name.length), cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint32(16, sum, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
    ch.set(name, 46);
    centrals.push(ch);
    offset += lh.length + data.length;
  }
  const cdSize = centrals.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array(22), ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, centrals.length, true); ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
  return new Blob([...locals, ...centrals, eocd], { type: 'application/zip' });
}

const fKey = (projId, rel) => `${projId}\0${rel}`;
const textEnc = new TextEncoder(), textDec = new TextDecoder('utf-8', { ignoreBOM: true });
function bytesEtag(u8) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < u8.length; i++) { h ^= u8[i]; h = Math.imul(h, 16777619) >>> 0; }
  return `${u8.length.toString(36)}-${h.toString(36)}`;
}
function decodeTextBytes(u8, rel = '') {
  if (u8.length > 5 * 1024 * 1024) throw Object.assign(new Error(`${base(rel)} is larger than 5 MB and can't be opened.`), { status: 413 });
  const n = Math.min(8192, u8.length);
  for (let i = 0; i < n; i++) if (u8[i] === 0) throw Object.assign(new Error(`${base(rel)} is a binary file and can't be opened in the text editor.`), { status: 415 });
  return { text: textDec.decode(u8), etag: bytesEtag(u8), bytes: u8 };
}
async function ensureFsaPerm(handle, write = false) {
  if (!handle?.queryPermission) return true;
  const opts = { mode: write ? 'readwrite' : 'read' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  throw new Error('Browser folder permission was declined. Re-open the folder or grant access when prompted.');
}
async function fsaResolveParent(rootHandle, rel, createDirs = false) {
  const parts = rel.split('/').filter(Boolean);
  const name = parts.pop();
  let cur = rootHandle;
  for (const seg of parts) cur = await cur.getDirectoryHandle(seg, { create: createDirs });
  return { parent: cur, name };
}
async function ensureProjIndex(proj) {
  if (!proj || proj.kind === 'fsa') return null;
  if (proj.fileMeta) return proj.fileMeta;
  // One-time migration for projects created before fileMeta/snapMeta index existed
  const [fList, sList] = await Promise.all([dbByProj('files', proj.id), dbByProj('snapshots', proj.id)]);
  const fileMeta = {}, snapMeta = {};
  proj._fileCache ??= new Map();
  for (const r of fList) {
    const b = r.content instanceof Uint8Array ? r.content : textEnc.encode(String(r.content || ''));
    fileMeta[r.path] = r.etag || bytesEtag(b);
    proj._fileCache.set(r.path, b);
  }
  for (const s of sList) {
    if (s.etag) { snapMeta[s.path] = s.etag; continue; } // manifest entries carry their etag
    const b = s.content instanceof Uint8Array ? s.content : textEnc.encode(String(s.content || ''));
    snapMeta[s.path] = bytesEtag(b);
  }
  proj.fileMeta = fileMeta; proj.snapMeta = snapMeta;
  await dbPut('projects', serializeProjMeta(proj));
  return proj.fileMeta;
}
async function vfsListDir(proj, dirRel = '') {
  if (!proj) return [];
  const items = [];
  if (proj.kind === 'fsa') {
    await ensureFsaPerm(proj.handle, false);
    let dh = proj.handle;
    for (const seg of dirRel.split('/').filter(Boolean)) dh = await dh.getDirectoryHandle(seg);
    for await (const [name, h] of dh.entries()) {
      if (!HIDDEN.has(name)) items.push({ name, dir: h.kind === 'directory' });
    }
  } else {
    const meta = await ensureProjIndex(proj);
    const prefix = dirRel ? dirRel + '/' : '';
    const seen = new Map();
    for (const rel of Object.keys(meta)) {
      if (!rel.startsWith(prefix)) continue;
      const rest = rel.slice(prefix.length);
      if (!rest) continue;
      const slash = rest.indexOf('/'), name = slash < 0 ? rest : rest.slice(0, slash);
      if (HIDDEN.has(name)) continue;
      seen.set(name, seen.get(name) || slash >= 0);
    }
    for (const f of proj.folders || []) {
      if (!f.startsWith(prefix)) continue;
      const rest = f.slice(prefix.length);
      if (!rest) continue;
      const slash = rest.indexOf('/'), name = slash < 0 ? rest : rest.slice(0, slash);
      if (!HIDDEN.has(name) && !seen.has(name)) seen.set(name, true);
    }
    for (const [name, dir] of seen) items.push({ name, dir });
  }
  return items.sort((a, b) => (a.dir !== b.dir ? (a.dir ? -1 : 1) : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
}
async function vfsReadBytes(proj, rel) {
  if (!proj) throw new Error('No open project');
  if (proj.kind === 'fsa') {
    await ensureFsaPerm(proj.handle, false);
    const { parent, name } = await fsaResolveParent(proj.handle, rel, false);
    const fh = await parent.getFileHandle(name);
    const f = await fh.getFile();
    const u8 = new Uint8Array(await f.arrayBuffer());
    proj._fsaMeta ??= new Map();
    proj._fsaMeta.set(rel, { size: f.size, mtime: f.lastModified, etag: bytesEtag(u8) });
    return u8;
  }
  proj._fileCache ??= new Map();
  if (proj._fileCache.has(rel)) return proj._fileCache.get(rel);
  const rec = await dbGet('files', fKey(proj.id, rel));
  if (!rec) throw Object.assign(new Error(`File not found: ${rel}`), { status: 404 });
  const u8 = rec.content instanceof Uint8Array ? rec.content : textEnc.encode(String(rec.content || ''));
  proj._fileCache.set(rel, u8);
  return u8;
}
async function vfsReadFile(proj, rel) {
  return decodeTextBytes(await vfsReadBytes(proj, rel), rel);
}
async function vfsWriteFile(proj, rel, textOrBytes, { create = false, expectedEtag = null, force = false } = {}) {
  const bytes = textOrBytes instanceof Uint8Array ? textOrBytes : textEnc.encode(String(textOrBytes ?? ''));
  const nextEtag = bytesEtag(bytes);
  if (proj.kind === 'fsa') {
    await ensureFsaPerm(proj.handle, true);
    const { parent, name } = await fsaResolveParent(proj.handle, rel, !create);
    let existing = null;
    try { existing = await parent.getFileHandle(name); } catch {}
    if (create && existing) throw Object.assign(new Error(`"${name}" already exists`), { status: 409 });
    if (!force && expectedEtag && existing) {
      const curEtag = bytesEtag(new Uint8Array(await (await existing.getFile()).arrayBuffer()));
      if (curEtag !== expectedEtag) throw Object.assign(new Error('File modified outside editor'), { status: 412 });
    }
    const fh = await parent.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(bytes); await w.close();
    const f = await fh.getFile();
    proj._fsaMeta ??= new Map();
    proj._fsaMeta.set(rel, { size: f.size, mtime: f.lastModified, etag: nextEtag });
    return nextEtag;
  }
  const meta = await ensureProjIndex(proj);
  const existingEtag = meta[rel];
  if (create && existingEtag !== undefined) throw Object.assign(new Error(`"${base(rel)}" already exists`), { status: 409 });
  if (!force && expectedEtag && existingEtag && existingEtag !== expectedEtag) {
    throw Object.assign(new Error('File modified outside editor'), { status: 412 });
  }
  const rec = { key: fKey(proj.id, rel), projectId: proj.id, path: rel, content: bytes, etag: nextEtag, mtime: Date.now() };
  meta[rel] = nextEtag;
  proj._fileCache ??= new Map();
  proj._fileCache.set(rel, bytes);
  await Promise.all([dbPut('files', rec), dbPut('projects', serializeProjMeta(proj))]);
  return nextEtag;
}
async function vfsMkdir(proj, rel) {
  if (proj.kind === 'fsa') {
    await ensureFsaPerm(proj.handle, true);
    const { parent, name } = await fsaResolveParent(proj.handle, rel, true);
    let exists = false;
    try { await parent.getDirectoryHandle(name); exists = true; } catch {}
    if (exists) throw Object.assign(new Error(`"${name}" already exists`), { status: 409 });
    await parent.getDirectoryHandle(name, { create: true });
    return;
  }
  const meta = await ensureProjIndex(proj);
  const folders = new Set(proj.folders || []);
  if (folders.has(rel) || Object.keys(meta).some(k => k === rel || k.startsWith(rel + '/'))) {
    throw Object.assign(new Error(`"${base(rel)}" already exists`), { status: 409 });
  }
  folders.add(rel);
  proj.folders = [...folders];
  await dbPut('projects', serializeProjMeta(proj));
}
async function vfsCopyFsaDir(srcDh, dstDh) {
  for await (const [name, h] of srcDh.entries()) {
    if (h.kind === 'directory') {
      const sub = await dstDh.getDirectoryHandle(name, { create: true });
      await vfsCopyFsaDir(h, sub);
    } else {
      const f = await h.getFile(), nh = await dstDh.getFileHandle(name, { create: true });
      const w = await nh.createWritable();
      await w.write(await f.arrayBuffer()); await w.close();
    }
  }
}
async function vfsRename(proj, from, to) {
  if (to === from || to.startsWith(from + '/')) throw Object.assign(new Error('Cannot move a folder inside itself'), { status: 400 });
  if (proj.kind === 'fsa') {
    await ensureFsaPerm(proj.handle, true);
    const src = await fsaResolveParent(proj.handle, from, false);
    const dst = await fsaResolveParent(proj.handle, to, true);
    let collision = false;
    try { await dst.parent.getFileHandle(dst.name); collision = true; } catch {}
    try { await dst.parent.getDirectoryHandle(dst.name); collision = true; } catch {}
    if (collision) throw Object.assign(new Error('Target already exists'), { status: 409 });
    let isDir = false;
    try {
      const dh = await src.parent.getDirectoryHandle(src.name); isDir = true;
      const newDh = await dst.parent.getDirectoryHandle(dst.name, { create: true });
      await vfsCopyFsaDir(dh, newDh);
    } catch (e) { if (isDir) throw e; }
    if (!isDir) {
      const fh = await src.parent.getFileHandle(src.name), f = await fh.getFile();
      const nfh = await dst.parent.getFileHandle(dst.name, { create: true }), w = await nfh.createWritable();
      await w.write(await f.arrayBuffer()); await w.close();
    }
    await src.parent.removeEntry(src.name, { recursive: true });
    proj._fsaMeta = null;
    return;
  }
  const meta = await ensureProjIndex(proj);
  const paths = Object.keys(meta);
  const hasCollision = (to in meta) || paths.some(k => k.startsWith(to + '/')) || (proj.folders || []).includes(to);
  if (hasCollision) throw Object.assign(new Error('Target already exists'), { status: 409 });
  const matching = paths.filter(k => k === from || k.startsWith(from + '/'));
  for (const k of matching) {
    const nk = k === from ? to : to + k.slice(from.length);
    const bytes = await vfsReadBytes(proj, k);
    const etag = meta[k] || bytesEtag(bytes);
    await dbDel('files', fKey(proj.id, k));
    delete meta[k];
    meta[nk] = etag;
    proj._fileCache?.delete(k);
    proj._fileCache?.set(nk, bytes);
    await dbPut('files', { key: fKey(proj.id, nk), projectId: proj.id, path: nk, content: bytes, etag, mtime: Date.now() });
  }
  proj.folders = (proj.folders || []).map(f => (f === from ? to : f.startsWith(from + '/') ? to + f.slice(from.length) : f));
  await dbPut('projects', serializeProjMeta(proj));
}
async function vfsDelete(proj, rel) {
  if (proj.kind === 'fsa') {
    await ensureFsaPerm(proj.handle, true);
    const { parent, name } = await fsaResolveParent(proj.handle, rel, false);
    await parent.removeEntry(name, { recursive: true });
    proj._fsaMeta = null;
    return;
  }
  const meta = await ensureProjIndex(proj);
  for (const k of Object.keys(meta)) {
    if (k === rel || k.startsWith(rel + '/')) {
      delete meta[k];
      proj._fileCache?.delete(k);
      await dbDel('files', fKey(proj.id, k));
    }
  }
  proj.folders = (proj.folders || []).filter(f => f !== rel && !f.startsWith(rel + '/'));
  await dbPut('projects', serializeProjMeta(proj));
}
async function vfsAllFiles(proj, { skipHeavy = true, limit = 20000 } = {}) {
  const files = [];
  let truncated = false;
  if (!proj) return { files, truncated };
  if (proj.kind === 'fsa') {
    await ensureFsaPerm(proj.handle, false);
    const walk = async (dh, prefix) => {
      for await (const [name, h] of dh.entries()) {
        if (files.length >= limit) { truncated = true; return; }
        if (HIDDEN.has(name) || (skipHeavy && name === 'node_modules')) continue;
        const rel = prefix ? prefix + '/' + name : name;
        if (h.kind === 'directory') await walk(h, rel);
        else files.push(rel);
      }
    };
    await walk(proj.handle, '');
  } else {
    const meta = await ensureProjIndex(proj);
    for (const rel of Object.keys(meta)) {
      if (skipHeavy && rel.split('/').some(s => s === 'node_modules' || HIDDEN.has(s))) continue;
      files.push(rel);
      if (files.length >= limit) { truncated = true; break; }
    }
  }
  files.sort();
  return { files, truncated };
}
async function vfsSearch(proj, query, opts) {
  const escRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let pat = opts.regex ? query : escRx(query);
  if (opts.word) pat = `\\b(?:${pat})\\b`;
  const rx = new RegExp(pat, opts.case ? 'g' : 'gi');
  const { files } = await vfsAllFiles(proj, { skipHeavy: true, limit: 20000 });
  const results = [];
  let totalMatches = 0, truncated = false;
  for (let i = 0; i < files.length && totalMatches < 2000; i++) {
    if (i > 0 && i % 30 === 0) await new Promise(r => setTimeout(r, 0));
    let text;
    try { ({ text } = await vfsReadFile(proj, files[i])); } catch { continue; }
    const matches = [], lines = text.split(/\r?\n/);
    for (let ln = 0; ln < lines.length && totalMatches < 2000; ln++) {
      const line = lines[ln];
      rx.lastIndex = 0;
      let m;
      while ((m = rx.exec(line)) && totalMatches < 2000) {
        if (m[0].length === 0) { rx.lastIndex++; continue; }
        const off = Math.max(0, m.index - 40);
        matches.push({ line: ln + 1, col: m.index + 1, len: m[0].length, off, text: line.slice(off, off + 240) });
        totalMatches++;
      }
    }
    if (matches.length) results.push({ file: files[i], matches });
  }
  if (totalMatches >= 2000) truncated = true;
  return { results, truncated };
}

const SKIP_IMPORT_DIRS = new Set(['node_modules', '.venv', 'venv', '__pycache__', '.next']);
async function importFileListAsProject(rawFiles, defaultName = 'local-folder') {
  if (!rawFiles.length) return null;
  let folderName = defaultName;
  const parsed = [];
  for (const item of rawFiles) {
    const f = item.file || item;
    const rawRel = String(item.relPath ?? (f.webkitRelativePath || f.name || '')).replace(/\\/g, '/').replace(/^\/+/, '');
    if (!rawRel) continue;
    const segs = rawRel.split('/').filter(Boolean);
    if (!segs.length) continue;
    let rel;
    if (item.relPath != null) {
      rel = segs.join('/');
    } else if (segs.length > 1) {
      folderName = segs[0] || defaultName;
      rel = segs.slice(1).join('/');
    } else {
      folderName = 'local-files';
      rel = segs[0];
    }
    const relSegs = rel.split('/');
    if (!rel || f.size > 15 * 1024 * 1024 || relSegs.some(s => HIDDEN.has(s) || SKIP_IMPORT_DIRS.has(s))) continue;
    parsed.push({ rel, f });
  }
  const id = 'idb:' + folderName + ':' + safeUid(6);
  const fileMeta = {}, records = [];
  if (parsed.length > 80) toast(`Importing ${folderName} (${parsed.length} files)…`);
  for (let i = 0; i < parsed.length; i += 24) {
    const chunk = parsed.slice(i, i + 24);
    const results = await Promise.allSettled(chunk.map(x => x.f.arrayBuffer()));
    for (let j = 0; j < chunk.length; j++) {
      if (results[j].status !== 'fulfilled') continue; // skip broken macOS symlinks / unreadable files cleanly
      const u8 = new Uint8Array(results[j].value), etag = bytesEtag(u8), rel = chunk[j].rel;
      fileMeta[rel] = etag;
      records.push({ key: fKey(id, rel), projectId: id, path: rel, content: u8, etag, mtime: chunk[j].f.lastModified || Date.now() });
    }
  }
  for (let i = 0; i < records.length; i += 100) {
    await dbPutMany('files', records.slice(i, i + 100));
  }
  const proj = { id, name: folderName, kind: 'idb', folders: [], fileMeta, snapMeta: {}, staged: [], commits: [], createdAt: Date.now() };
  await dbPut('projects', serializeProjMeta(proj));
  return proj;
}

function pickLocalFolderViaInput() {
  return new Promise((resolve, reject) => {
    const inp = $('#dir-pick');
    let settled = false;
    const cleanup = () => {
      inp.onchange = null;
      inp.oncancel = null;
      removeEventListener('focus', onWinFocus);
    };
    const finish = (ok, val) => {
      if (settled) return;
      settled = true; cleanup();
      ok ? resolve(val) : reject(val);
    };
    const onWinFocus = () => setTimeout(() => {
      if (!settled && !(inp.files?.length)) finish(true, null);
    }, 450);
    inp.onchange = async () => {
      try {
        const list = [...(inp.files || [])];
        if (!list.length) return finish(true, null);
        finish(true, await importFileListAsProject(list));
      } catch (err) { finish(false, err); }
    };
    inp.oncancel = () => finish(true, null);
    addEventListener('focus', onWinFocus, { once: true });
    try { inp.value = ''; } catch {}
    inp.click();
  });
}

async function readDroppedDirEntry(dirEntry, prefix = '') {
  const reader = dirEntry.createReader();
  const entries = [];
  for (;;) {
    const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
    if (!batch.length) break;
    entries.push(...batch);
  }
  const out = [];
  for (const en of entries) {
    if (HIDDEN.has(en.name) || SKIP_IMPORT_DIRS.has(en.name)) continue;
    const rel = prefix ? prefix + '/' + en.name : en.name;
    if (en.isDirectory) {
      out.push(...await readDroppedDirEntry(en, rel));
    } else if (en.isFile) {
      const f = await new Promise((res, rej) => en.file(res, rej)).catch(() => null);
      if (f) out.push({ relPath: rel, file: f });
    }
  }
  return out;
}

async function openDroppedFolder(e) {
  const dt = e.dataTransfer;
  if (!dt?.items?.length || dt.types?.includes(DRAG_PATH) || dt.types?.includes(DRAG_TAB)) return false;
  const items = [...dt.items].filter(it => it.kind === 'file');
  if (!items.length) return false;
  e.preventDefault();
  const prev = root;
  // Prefer persistent FileSystemDirectoryHandle in Chromium if supported
  if (typeof items[0].getAsFileSystemHandle === 'function') {
    try {
      const handle = await items[0].getAsFileSystemHandle();
      if (handle?.kind === 'directory') {
        for (const p of projects.values()) {
          if (p.kind === 'fsa' && p.handle && (await p.handle.isSameEntry?.(handle))) {
            return switchProject(p.id);
          }
        }
        const id = 'fsa:' + handle.name + ':' + safeUid(6);
        const proj = emptyProj(id, { name: handle.name, kind: 'fsa', handle });
        projects.set(id, proj);
        await dbPut('projects', serializeProjMeta(proj));
        if (prev) hibernateCurrent(prev);
        root = id;
        await restoreProject(root);
        return true;
      }
    } catch {}
  }
  // Universal Safari / Firefox / Chrome fallback via webkitGetAsEntry
  const entry = items[0].webkitGetAsEntry?.();
  if (entry?.isDirectory) {
    const collected = await readDroppedDirEntry(entry);
    const rec = await importFileListAsProject(collected, entry.name);
    if (rec) {
      const proj = emptyProj(rec.id, rec);
      projects.set(proj.id, proj);
      if (prev) hibernateCurrent(prev);
      root = proj.id;
      await restoreProject(root);
      return true;
    }
  }
  return false;
}

for (const zone of [$('#home'), $('#empty'), $('#view-explorer')]) {
  if (!zone) continue;
  zone.addEventListener('dragover', e => {
    if (e.dataTransfer?.types?.includes('Files') && !e.dataTransfer.types.includes(DRAG_PATH) && !e.dataTransfer.types.includes(DRAG_TAB)) {
      e.preventDefault(); zone.classList.add('drop-folder-hover');
    }
  });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drop-folder-hover'); });
  zone.addEventListener('drop', e => { zone.classList.remove('drop-folder-hover'); openDroppedFolder(e).catch(fail); });
}

function pickRoot() {
  if (typeof window.showDirectoryPicker === 'function') {
    return (async () => {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        for (const p of projects.values()) {
          if (p.kind === 'fsa' && p.handle && (await p.handle.isSameEntry?.(handle))) return p.id;
        }
        const id = 'fsa:' + handle.name + ':' + safeUid(6);
        const proj = emptyProj(id, { name: handle.name, kind: 'fsa', handle });
        projects.set(id, proj);
        await dbPut('projects', serializeProjMeta(proj));
        return id;
      } catch (e) {
        if (e?.name === 'AbortError') return false;
        const projRec = await pickLocalFolderViaInput();
        if (!projRec) return false;
        const proj = emptyProj(projRec.id, projRec);
        projects.set(proj.id, proj);
        return proj.id;
      }
    })();
  }
  // Synchronous call path so Apple Safari preserves transient user activation on inp.click()
  return pickLocalFolderViaInput().then(projRec => {
    if (!projRec) return false;
    const proj = emptyProj(projRec.id, projRec);
    projects.set(proj.id, proj);
    return proj.id;
  });
}

// ---------- workspace + multi-project taskbar & resource hibernation ----------
const expanded = new Set();
let selected = null; // { rel, dir } last clicked row in the explorer
const serializeProjMeta = p => ({
  id: p.id || p.root, root: p.root, name: p.name, kind: p.kind || 'idb',
  handle: p.handle || null, remote: p.remote || null, branch: p.branch || 'main', branches: p.branches || ['main'],
  isRepo: !!p.isRepo, folders: p.folders || [], fileMeta: p.fileMeta || null, snapMeta: p.snapMeta || null,
  staged: p.staged || [], commits: p.commits || [],
});
const emptyProj = (id, extra = {}) => ({
  id, root: id, name: extra.name || base(id), kind: extra.kind || 'idb', handle: extra.handle || null,
  remote: extra.remote || null, branch: extra.branch || 'main', branches: extra.branches || [extra.branch || 'main'],
  isRepo: !!extra.isRepo, folders: extra.folders || [], fileMeta: extra.fileMeta || null, snapMeta: extra.snapMeta || null,
  staged: extra.staged || [], commits: extra.commits || [],
  active: null, tabs: [], expanded: [], selected: null, recent: [],
  terms: [], termOnId: null, panelOpen: false, _fileCache: null, _fsaMeta: null,
});
const activeProj = () => projects.get(root) || null;
const persistProjectOrder = async () => {
  await dbPut('meta', { key: 'projects', value: [...projects.keys()] });
  await dbPut('meta', { key: 'activeProject', value: root });
};
const projDirty = p => (p.root === root ? [...tabs.values()].some(isDirty) : p.tabs.some(t => t.dirty));
function renderProjectBar() {
  const bar = $('#ws-tasks');
  if (!bar) return;
  bar.replaceChildren(...[...projects.values()].map(p => {
    const on = p.root === root && !homeOn;
    const item = el('div', 'ws-task' + (on ? ' on' : ''));
    item.setAttribute('role', 'tab');
    item.setAttribute('aria-selected', String(on));
    item.title = `${p.name} (${p.kind === 'gh' ? 'GitHub · IndexedDB' : t(p.kind === 'fsa' ? 'Local folder handle' : 'Browser IndexedDB')})${t(p.root !== root ? ' — hibernated, click to wake' : ' — running')}`;
    const dot = el('span', 'ws-dot');
    const name = el('span', 'ws-name', p.name);
    const nodes = [dot, name];
    if (projDirty(p)) nodes.push(el('span', 'ws-dirty'));
    if (p.root !== root) nodes.push(el('span', 'ws-sleep', 'Sleeping'));
    const x = el('button', 'ws-x'); x.title = 'Close Project'; x.append(icon('close'));
    x.onclick = e => { e.stopPropagation(); closeProject(p.root).catch(fail); };
    nodes.push(x);
    item.append(...nodes);
    item.onclick = () => (p.root === root ? showHome(false) : switchProject(p.root).catch(fail));
    return item;
  }));
  $('#ws-tasks .ws-task.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  layout();
}
$('#ws-bar')?.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { $('#ws-tasks').scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
$('#ws-add-local').onclick = () => openFolder().catch(fail);
$('#ws-add-gh').onclick = () => openGitDialog('clone');

function fileIcon(name) {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  const color = { js: '#cbcb41', mjs: '#cbcb41', cjs: '#cbcb41', jsx: '#61dafb', ts: '#3178c6', tsx: '#61dafb', py: '#4b8bbe', go: '#00add8', rs: '#dea584', java: '#e76f00', kt: '#a97bff', c: '#a8b9cc', h: '#a8b9cc', cpp: '#f34b7d', cs: '#9b4f96', rb: '#cc342d', php: '#8892bf', swift: '#f05138', html: '#e44d26', css: '#42a5f5', scss: '#cd6799', json: '#cbcb41', md: '#519aba', yml: '#a074c4', yaml: '#a074c4', toml: '#9c4221', sh: '#89e051', sql: '#e38c00', vue: '#41b883', svelte: '#ff3e00' }[ext] || 'var(--dim)';
  const name_ = ext === 'md' ? 'markdown' : ext === 'json' ? 'json' : /^(png|jpe?g|gif|svg|webp|ico)$/.test(ext) ? 'file-media' : color !== 'var(--dim)' ? 'file-code' : 'file';
  const i = icon(name_); i.style.color = color; return i;
}

async function renderDir(dir, ul, depth) {
  let items;
  try { items = await vfsListDir(activeProj(), dir); }
  catch (e) { expanded.delete(dir); if (!dir) toast(e.message, 'warn'); return; }
  const lis = [];
  for (const it of items) {
    const rel = dir ? dir + '/' + it.name : it.name;
    const li = el('li'), row = el('div', 'row');
    row.dataset.rel = rel; row.dataset.dir = it.dir ? '1' : ''; row.title = rel; row.setAttribute('role', 'treeitem');
    row.style.paddingLeft = depth * 8 + 8 + 'px';
    row.draggable = true;
    row.ondragstart = e => { e.dataTransfer.setData(DRAG_PATH, rel); e.dataTransfer.effectAllowed = 'move'; dragDir = it.dir; };
    if (it.dir) {
      const tw = icon(expanded.has(rel) ? 'chevron-down' : 'chevron-right', 'tw');
      const sub = el('ul'); sub.setAttribute('role', 'group');
      row.append(tw, el('span', 'name', it.name));
      li.append(row, sub);
      row.onclick = () => treeQueue(async () => {
        select(rel, true);
        const open = !expanded.has(rel);
        open ? expanded.add(rel) : expanded.delete(rel);
        tw.className = `codicon codicon-${open ? 'chevron-down' : 'chevron-right'} tw`;
        sub.hidden = !open;
        if (open) await renderDir(rel, sub, depth + 1);
      });
      if (expanded.has(rel)) await renderDir(rel, sub, depth + 1); else sub.hidden = true;
    } else {
      row.append(el('span', 'tw'), fileIcon(it.name), el('span', 'name', it.name));
      li.append(row);
      row.onclick = () => { select(rel, false); openFile(rel, { preview: true }).catch(fail); };
      row.ondblclick = () => openFile(rel).catch(fail); // double-click keeps it open (pins the preview)
    }
    lis.push(li);
  }
  ul.replaceChildren(...lis);
}
function select(rel, isDir) {
  selected = rel == null ? null : { rel, dir: isDir };
  $$('#tree .row.sel').forEach(r => r.classList.remove('sel'));
  if (rel != null) $(`#tree .row[data-rel="${CSS.escape(rel)}"]`)?.classList.add('sel');
}
// Every tree mutation goes through one queue, so a slow re-render can never overwrite a newer DOM change
// (e.g. the inline "new file" input, or a folder the user just expanded).
let treeJob = Promise.resolve();
const treeQueue = fn => (treeJob = treeJob.then(fn).catch(fail));
async function drawTree() { // only call from inside a queued job
  if (!root) return;
  await renderDir('', $('#tree'), 0);
  select(selected?.rel ?? active, selected?.dir ?? false);
}
const renderTree = () => treeQueue(drawTree);

// New file / folder: inline input row inside the selected folder (or the root), like VS Code.
// Both steps (showing the input, then creating + redrawing) are queued tree jobs, so they run strictly in click order.
function newEntry(kind) {
  if (!root) return Promise.resolve();
  showView('explorer');
  $('#tree').hidden = false; $('#ws-tw').className = 'codicon codicon-chevron-down';
  return treeQueue(async () => {
    let parent = !selected ? '' : selected.dir ? selected.rel : selected.rel.split('/').slice(0, -1).join('/');
    let ul = $('#tree'), depth = 0;
    if (parent) {
      if (!expanded.has(parent)) { expanded.add(parent); await drawTree(); }
      const pRow = $(`#tree .row[data-rel="${CSS.escape(parent)}"]`);
      if (pRow?.nextElementSibling) { ul = pRow.nextElementSibling; ul.hidden = false; depth = parent.split('/').length; }
      else parent = '';
    }
    $$('#tree .row.edit input').forEach(i => { i.onblur = null; i.closest('li').remove(); });
    const li = el('li'), row = el('div', 'row edit'), input = el('input');
    input.setAttribute('aria-label', kind === 'file' ? 'New file name' : 'New folder name');
    row.style.paddingLeft = depth * 8 + 8 + 'px';
    row.append(el('span', 'tw'), icon(kind === 'file' ? 'file' : 'folder'), input);
    li.append(row); ul.prepend(li);
    li.scrollIntoView({ block: 'nearest' });
    input.focus();
    let busy = false;
    const cancel = () => { if (!busy && li.isConnected) { input.onblur = null; li.remove(); } };
    // Removing a focused input fires blur synchronously; defer, and keep the row if focus came back to it.
    input.onblur = () => setTimeout(() => { if (document.activeElement !== input) cancel(); });
    input.oninput = () => row.classList.remove('bad');
    input.onkeydown = e => {
      e.stopPropagation();
      if (composing(e)) return;
      if (e.key === 'Escape') { e.preventDefault(); return cancel(); }
      if (e.key !== 'Enter' || busy) return;
      e.preventDefault();
      const name = normName(input.value);
      if (!name) return cancel();
      const bad = badName(name);
      if (bad) { row.classList.add('bad'); return toast(bad, 'warn'); }
      const rel = parent ? parent + '/' + name : name;
      busy = true;
      treeQueue(async () => {
        try {
          if (kind === 'file') await vfsWriteFile(activeProj(), rel, '', { create: true });
          else await vfsMkdir(activeProj(), rel);
        } catch (err) {
          busy = false; row.classList.add('bad'); input.focus();
          return toast(err.status === 409 ? `"${name}" already exists. Choose a different name.` : err.message, 'error');
        }
        input.onblur = null; li.remove();
        rel.split('/').slice(0, -1).reduce((acc, seg) => { const p = acc ? acc + '/' + seg : seg; expanded.add(p); return p; }, '');
        if (kind === 'folder') expanded.add(rel);
        selected = { rel, dir: kind === 'folder' };
        await drawTree();
        if (kind === 'file') await openFile(rel);
      });
    };
  });
}

function hibernateCurrent(projRoot = root) {
  if (!projRoot) return;
  const curProj = projects.get(projRoot) || emptyProj(projRoot);
  const prevActive = active;
  if (active && tabs.has(active)) {
    const cur = tabs.get(active);
    if (cur.model) cur.view = editor.saveViewState();
  }
  closeCompare();
  clearTimeout(gitTimer); gitSeq++;
  const tabSnaps = [];
  for (const [rel, t] of tabs) {
    const dirty = isDirty(t);
    tabSnaps.push({
      rel, preview: t.preview, etag: t.etag, bom: t.bom, dirty,
      text: dirty ? (t.model ? fileText(t) : t.text) : undefined, view: t.view,
    });
    t.model?.dispose();
  }
  tabs.clear();
  active = null;
  editor?.setModel(blankModel);
  const termSnaps = terms.map(x => {
    if (x.attached) { x.term.dispose(); x.box.remove(); }
    return { id: x.id, name: x.name, cwd: x.cwd || '', line: x.line || '', hist: x.hist || [] };
  });
  const termOnId = termOn?.id || null;
  const panelOpen = !$('#panel').hidden;
  terms.length = 0; termOn = null;
  $('#terms').replaceChildren();
  showPanel(false);
  $('#tree').replaceChildren();
  $('#sr-res').replaceChildren(); $('#sr-msg').textContent = ''; sr.last = null;
  $('#git-list').replaceChildren(); gitState = null; gitCommits = [];
  qo.files = []; qo.truncated = false; qo.loaded = false;
  curProj._fileCache = null; // drop in-memory file cache so hibernated projects consume zero RAM
  curProj._fsaMeta = null;
  Object.assign(curProj, {
    root: projRoot, active: prevActive, tabs: tabSnaps, expanded: [...expanded], selected,
    recent: [...recent], terms: termSnaps, termOnId, panelOpen,
  });
  projects.set(projRoot, curProj);
}

async function restoreProject(projRoot) {
  let snap = projects.get(projRoot);
  if (!snap) { snap = emptyProj(projRoot); projects.set(projRoot, snap); }
  expanded.clear(); snap.expanded.forEach(p => expanded.add(p));
  selected = snap.selected || null;
  recent.splice(0, recent.length, ...(snap.recent || []));
  qo.files = []; qo.truncated = false; qo.loaded = false;
  tabs.clear();
  for (const ts of snap.tabs) {
    tabs.set(ts.rel, {
      model: null, saved: ts.dirty ? -1 : 0, etag: ts.etag, bom: !!ts.bom,
      preview: !!ts.preview, reloading: false, dirty: !!ts.dirty, text: ts.text, view: ts.view || null,
    });
  }
  active = null;
  terms.length = 0;
  for (const ts of snap.terms) terms.push({ ...ts, attached: false });
  termOn = terms.find(x => x.id === snap.termOnId) || terms[0] || null;
  renderTerms();
  if (snap.panelOpen && terms.length) showPanel(true); else showPanel(false);
  $('#ws').hidden = !root; $('#welcome').hidden = !!root;
  $('#ws-name').textContent = snap.name;
  $('#ws-head').title = `${snap.name} (Browser-Local)`;
  document.title = root ? `${snap.name} — WebIDE` : HOME_TITLE;
  sr.last = null; $('#sr-res').replaceChildren(); $('#sr-msg').textContent = '';
  if (isMobileUI()) { mobDrawer = !snap.tabs.length; if (mobDrawer) prefs.view = 'explorer'; }
  showHome(false);
  renderProjectBar();
  persistProjectOrder().catch(() => {});
  await Promise.all([activate(snap.active), renderTree()]);
  scheduleGitRefresh(120);
}

async function switchProject(targetRoot) {
  if (!targetRoot) return;
  if (targetRoot === root) return showHome(false);
  if (root) hibernateCurrent(root);
  root = targetRoot;
  await restoreProject(root);
}

async function closeProject(projRoot) {
  const p = projects.get(projRoot);
  if (!p) return false;
  if (projRoot === root) {
    const dirty = [...tabs].filter(([, t]) => isDirty(t)).map(([r]) => r);
    if (dirty.length) {
      const r = await modal(`Do you want to save the changes to ${dirty.length === 1 ? base(dirty[0]) : dirty.length + ' files'} before closing ${p.name}?`,
        "Your changes will be lost if you don't save them.",
        [{ label: dirty.length === 1 ? 'Save' : 'Save All', value: 'save', primary: true }, { label: "Don't Save", value: 'discard' }, { label: 'Cancel', value: 'cancel' }]);
      if (r === 'cancel') return false;
      if (r === 'save' && !(await saveAll())) return false;
    }
    terms.slice().forEach(killTerm);
    closeAll(true);
    clearTimeout(gitTimer); gitSeq++;
  } else if (p.tabs.some(t => t.dirty)) {
    await switchProject(projRoot);
    return closeProject(projRoot);
  }
  projects.delete(projRoot);
  await dbDel('projects', projRoot);
  if (p.kind !== 'fsa') await dbDelByProj('files', projRoot);
  await dbDelByProj('snapshots', projRoot);
  gcBlobs();
  if (projRoot === root) {
    const next = [...projects.keys()].pop() || null;
    if (next) {
      root = next;
      await restoreProject(root);
    } else {
      root = null;
      await persistProjectOrder();
      expanded.clear(); selected = null; recent.length = 0;
      $('#ws').hidden = true; $('#welcome').hidden = false;
      $('#ws-name').textContent = ''; $('#ws-head').title = '';
      document.title = HOME_TITLE;
      updateStatus();
      sr.last = null; $('#sr-res').replaceChildren(); $('#sr-msg').textContent = '';
      $('#git-list').replaceChildren(); gitState = null; gitCommits = [];
      showHome(true);
      renderProjectBar();
      scheduleGitRefresh(0);
    }
  } else {
    await persistProjectOrder();
    renderProjectBar();
  }
  return true;
}

async function loadRoot(prefetched = null) {
  const [savedProjs, orderMeta, activeMeta] = prefetched || await Promise.all([
    dbAll('projects').catch(() => []),
    dbGet('meta', 'projects').catch(() => null),
    dbGet('meta', 'activeProject').catch(() => null),
  ]);
  projects.clear();
  const byId = new Map(savedProjs.map(p => [p.id, p]));
  const ids = orderMeta?.value?.length ? orderMeta.value.filter(id => byId.has(id)) : [...byId.keys()];
  for (const id of byId.keys()) if (!ids.includes(id)) ids.push(id);
  for (const id of ids) projects.set(id, emptyProj(id, byId.get(id)));
  root = (activeMeta?.value && projects.has(activeMeta.value)) ? activeMeta.value : (ids[ids.length - 1] || null);
  if (root) {
    await restoreProject(root);
  } else {
    closeAll(true);
    expanded.clear(); selected = null; recent.length = 0;
    $('#ws').hidden = true; $('#welcome').hidden = false;
    $('#ws-name').textContent = ''; $('#ws-head').title = '';
    document.title = HOME_TITLE;
    updateStatus();
    showHome(true);
    renderProjectBar();
    scheduleGitRefresh(0);
  }
}
async function openFolder() {
  const prev = root;
  const next = await pickRoot();
  if (!next) return;
  if (next === prev) { showHome(false); return; }
  if (prev) hibernateCurrent(prev);
  root = next;
  await restoreProject(root);
}
$('#open-folder').onclick = () => openFolder().catch(fail);
$('#welcome-open').onclick = () => openFolder().catch(fail);
$('#st-root').onclick = () => openFolder().catch(fail);
$('#refresh').onclick = e => { e.stopPropagation(); renderTree().catch(fail); };
$('#collapse').onclick = e => { e.stopPropagation(); expanded.clear(); renderTree().catch(fail); };
$('#new-file').onclick = e => { e.stopPropagation(); newEntry('file').catch(fail); };
$('#new-folder').onclick = e => { e.stopPropagation(); newEntry('folder').catch(fail); };
$('#ws-head').onclick = () => { const t = $('#tree'); t.hidden = !t.hidden; $('#ws-tw').className = `codicon codicon-${t.hidden ? 'chevron-right' : 'chevron-down'}`; };
$('#tree').addEventListener('click', e => { if (e.target === $('#tree')) select(null); }); // click empty space: new items go to the root

// ---------- editors / tabs ----------
const tabs = new Map(); // rel -> { model, saved, view, bom }
let active = null, blankModel = null;
const recent = []; // most recently opened files, for Go to File
const DRAG_PATH = 'text/x-webide-path', DRAG_TAB = 'text/x-webide-tab'; // drag payload types (lowercase: browsers normalise them)
let dragDir = false;
const isDirty = t => (t.model ? t.model.getAlternativeVersionId() !== t.saved : !!t.dirty);

// Response.text() silently drops a UTF-8 BOM; keep it (common in Windows files) so saving doesn't rewrite the file.
// etag = the disk version this text came from; Save sends it back so the bridge can refuse to clobber someone else's change.
async function readFile(rel) {
  const d = await vfsReadFile(activeProj(), rel);
  return { text: d.text, etag: d.etag };
}
const fileText = t => (t.model ? t.model.getValue(monaco.editor.EndOfLinePreference.TextDefined, true) : (t.text ?? '')); // keeps the file's own EOL + BOM

function modelChangeHandler(rel, t, e) {
  if (!t.reloading) { t.preview = false; scheduleAutoSave(rel); }
  renderTabs();
  renderProjectBar();
  if (t.model && typeof extBus !== 'undefined') extBus.fire('changeDoc', { rel, model: t.model, e });
}
// Monaco may already hold a model at this URI that no tab owns (TS go-to-definition / peek of an unopened file): replace it.
function createFileModel(text, rel) {
  const uri = monaco.Uri.file('/' + rel);
  monaco.editor.getModel(uri)?.dispose();
  return monaco.editor.createModel(text, undefined, uri);
}
function newModel(rel, text, etag = null) {
  if (!editor) return { model: null, text, saved: 0, etag, view: null, bom: text.charCodeAt(0) === 0xfeff, preview: false, reloading: false, dirty: false };
  const model = createFileModel(text, rel);
  const t = { model, saved: model.getAlternativeVersionId(), etag, view: null, bom: text.charCodeAt(0) === 0xfeff, preview: false, reloading: false, dirty: false };
  model.onDidChangeContent(e => modelChangeHandler(rel, t, e)); // typing pins a preview tab
  if (typeof extBus !== 'undefined') extBus.fire('openDoc', { rel, model });
  return t;
}
async function ensureTabModel(rel, t) {
  if (t.model || !editor) return t.model;
  let text = t.text;
  if (!t.dirty && text == null) {
    const d = await readFile(rel);
    text = d.text; t.etag = d.etag; t.bom = text.charCodeAt(0) === 0xfeff;
  }
  if (t.model) return t.model;
  const model = createFileModel(text ?? '', rel);
  t.model = model;
  t.saved = t.dirty ? -1 : model.getAlternativeVersionId();
  delete t.text;
  model.onDidChangeContent(e => modelChangeHandler(rel, t, e));
  if (typeof extBus !== 'undefined') extBus.fire('openDoc', { rel, model });
  return model;
}
// preview: single-click style open. At most one preview tab exists; the next preview open replaces it in place.
let openSeq = 0;
async function openFile(rel, { preview = false } = {}) {
  const seq = ++openSeq, openRoot = root;
  let replaced = null;
  if (!tabs.has(rel)) {
    let text, etag;
    try { ({ text, etag } = await readFile(rel)); }
    catch (e) {
      if (e.status === 415) throw new Error(`${base(rel)} is a binary file and can't be opened in the text editor.`);
      if (e.status === 413) throw new Error(`${base(rel)} is larger than 5 MB and can't be opened.`);
      throw e;
    }
    if (root !== openRoot || seq !== openSeq) return;
    if (!tabs.has(rel)) { // (opened twice quickly: keep the first)
      const t = newModel(rel, text, etag);
      t.preview = preview;
      const old = preview && [...tabs].find(([, x]) => x.preview && !isDirty(x));
      if (old) {
        const entries = [...tabs].map(([k, v]) => (k === old[0] ? [rel, t] : [k, v]));
        tabs.clear(); entries.forEach(([k, v]) => tabs.set(k, v));
        if (active === old[0]) active = null;
        replaced = old[1].model;
      } else tabs.set(rel, t);
    }
  } else if (!preview) tabs.get(rel).preview = false; // opened "for real": pin it
  recent.splice(0, recent.length, rel, ...recent.filter(r => r !== rel).slice(0, 19));
  if (isMobileUI() && mobDrawer) { mobDrawer = false; layout(); }
  await activate(rel);
  replaced?.dispose(); // after the editor switched away from it
}
async function activate(rel, { noReveal = false } = {}) {
  if (active && tabs.has(active)) {
    const cur = tabs.get(active);
    if (cur.model && editor) cur.view = editor.saveViewState();
  }
  active = rel && tabs.has(rel) ? rel : null;
  if (diff && diff.rel !== active) closeCompare();
  const t = active && tabs.get(active);
  if (t) {
    showHome(false);
    if (editor && !t.model) {
      const seq = ++openSeq, openRoot = root;
      try { await ensureTabModel(active, t); } catch (e) { fail(e); return; }
      if (root !== openRoot || active !== rel || seq !== openSeq) return;
    }
  }
  if (editor) {
    // Never setModel(null): Monaco then rebuilds its view and, in 0.52, clicks on the rebuilt view stop focusing it.
    editor.setModel(t ? t.model : blankModel);
    applyEdMode();
    if (t?.view) editor.restoreViewState(t.view);
  }
  $('#empty').hidden = !!t;
  $('#tabs').hidden = $('#crumbs').hidden = !tabs.size;
  renderTabs(); renderCrumbs(); updateStatus();
  if (t) { if (!noReveal) reveal(active); if (!isMobileUI()) editor?.focus(); }
  if (typeof extBus !== 'undefined') extBus.fire('activeEditor', { rel: active, model: t?.model || null });
}
// Returns false if the user cancelled. force = drop without asking (only where the content is already safe).
async function closeTab(rel, force = false) {
  const t = tabs.get(rel);
  if (!t) return true;
  if (!force && isDirty(t)) {
    if (active !== rel) await activate(rel);
    const r = await modal(`Do you want to save the changes you made to ${base(rel)}?`, "Your changes will be lost if you don't save them.",
      [{ label: 'Save', value: 'save', primary: true }, { label: "Don't Save", value: 'discard' }, { label: 'Cancel', value: 'cancel' }]);
    if (r === 'cancel') return false;
    if (r === 'save') { try { if (!(await saveTab(rel))) return false; } catch (e) { fail(e); return false; } } // conflict: keep the tab
  }
  if (!tabs.has(rel)) return true;
  const keys = [...tabs.keys()], i = keys.indexOf(rel);
  tabs.delete(rel);
  if (active === rel) { active = null; await activate(keys[i + 1] ?? keys[i - 1] ?? null); } else renderTabs();
  if (t.model && typeof extBus !== 'undefined') extBus.fire('closeDoc', { rel, model: t.model });
  t.model?.dispose();
  renderProjectBar();
  return true;
}
async function closeMany(rels) { for (const r of rels) if (!(await closeTab(r))) return false; return true; }
function closeAll(force) {
  if (!force) return closeMany([...tabs.keys()]);
  closeCompare();
  active = null;
  for (const [, t] of tabs) t.model?.dispose();
  tabs.clear();
  activate(null);
}
function renderTabs() {
  $('#tabs').replaceChildren(...[...tabs].map(([rel, t]) => {
    const tab = el('div', 'tab' + (rel === active ? ' on' : '') + (isDirty(t) ? ' dirty' : '') + (t.preview ? ' preview' : ''));
    tab.title = rel + (t.preview ? ' (preview)' : ''); tab.setAttribute('role', 'tab');
    const x = el('button', 'ibtn x'); x.title = 'Close'; x.append(icon('close', 'c'), icon('circle-filled', 'd'));
    x.onclick = e => { e.stopPropagation(); closeTab(rel); };
    tab.append(fileIcon(base(rel)), el('span', 'tl', base(rel)), x);
    tab.onclick = () => activate(rel);
    tab.ondblclick = () => { t.preview = false; renderTabs(); };
    // drag to reorder
    tab.draggable = true;
    tab.ondragstart = e => { e.dataTransfer.setData(DRAG_TAB, rel); e.dataTransfer.effectAllowed = 'move'; };
    tab.ondragover = e => {
      if (!e.dataTransfer.types.includes(DRAG_TAB)) return;
      e.preventDefault();
      const r = tab.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
      tab.classList.toggle('drop-before', !after); tab.classList.toggle('drop-after', after);
    };
    tab.ondragleave = e => { if (!tab.contains(e.relatedTarget)) tab.classList.remove('drop-before', 'drop-after'); };
    tab.ondragend = () => $$('#tabs .tab').forEach(x => x.classList.remove('drop-before', 'drop-after'));
    tab.ondrop = e => {
      const from = e.dataTransfer.getData(DRAG_TAB), after = tab.classList.contains('drop-after');
      tab.classList.remove('drop-before', 'drop-after');
      if (!from) return;
      e.preventDefault();
      if (from === rel) return;
      const keys = [...tabs.keys()].filter(k => k !== from);
      keys.splice(keys.indexOf(rel) + (after ? 1 : 0), 0, from);
      const entries = keys.map(k => [k, tabs.get(k)]);
      tabs.clear(); entries.forEach(([k, v]) => tabs.set(k, v));
      tabs.get(from).preview = false; // dragging pins, as in VS Code
      renderTabs();
    };
    tab.onauxclick = e => { if (e.button === 1) { e.preventDefault(); closeTab(rel); } };
    tab.oncontextmenu = e => {
      e.preventDefault();
      const keys = [...tabs.keys()], i = keys.indexOf(rel);
      menu(e.clientX, e.clientY, [
        { label: 'Close', key: K.close, run: () => closeTab(rel) },
        { label: 'Close Others', disabled: keys.length < 2, run: () => closeMany(keys.filter(k => k !== rel)) },
        { label: 'Close to the Right', disabled: i === keys.length - 1, run: () => closeMany(keys.slice(i + 1)) },
        { label: 'Close Saved', run: () => closeMany(keys.filter(k => !isDirty(tabs.get(k)))) },
        { label: 'Close All', run: () => closeMany(keys) },
        '-',
        ...mdMenu(rel),
        { label: 'Open Local History…', run: () => openLocalHistory(rel) },
        { label: 'Copy Path', run: () => copy(absPath(rel)) },
        { label: 'Copy Relative Path', run: () => copy(rel) },
        { label: 'Reveal in Explorer View', run: () => { showView('explorer'); reveal(rel); } },
      ]);
    };
    return tab;
  }));
  $('#tabs .tab.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
// Mouse wheel scrolls the tab strip sideways, as in VS Code.
$('#tabs').addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { $('#tabs').scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
function renderCrumbs() {
  const c = $('#crumbs');
  if (!active) return c.replaceChildren();
  const parts = active.split('/'), mob = isMobileUI(), md = mdActive();
  const path = el('span', 'cr-path'), acts = el('span', 'cr-acts');
  path.append(...parts.flatMap((p, i) => {
    const last = i === parts.length - 1;
    const seg = el('span'); if (last) seg.append(fileIcon(p), ' '); seg.append(p);
    return i ? [icon('chevron-right'), seg] : [seg];
  }));
  const act = (cls, ic, label, title, run) => {
    const b = el('button', 'ibtn ' + cls); b.title = title; b.append(icon(ic));
    if (label) { const l = el('span', 'cr-lbl'); l.textContent = label; b.append(l); }
    b.onclick = run; acts.append(b); return b;
  };
  if (mob) {
    // Phone toolbar: Markdown reads as rendered text by default; code reads wrapped and read-only until "Edit".
    if (!(md && mdOn)) {
      act('cr-icon' + (wrapOn() ? ' on' : ''), 'word-wrap', '', `Toggle Word Wrap (${wrapOn() ? 'on' : 'off'})`, toggleWrap);
      act(mobEdit ? 'on' : '', mobEdit ? 'check' : 'edit', mobEdit ? 'Done' : 'Edit', mobEdit ? 'Done editing (read-only)' : 'Edit this file', () => { mobEdit = !mobEdit; applyEdMode(); renderCrumbs(); if (mobEdit) editor?.focus(); });
    }
    if (md) act(mdOn ? '' : 'on', mdOn ? 'code' : 'open-preview', mdOn ? 'Source' : 'Preview', mdOn ? 'Show Markdown source' : 'Show rendered Markdown', () => toggleMdPreview());
  } else if (md) {
    act('md-pv-btn' + (mdOn ? ' on' : ''), mdOn ? 'close' : 'open-preview', '', `${mdOn ? 'Close' : 'Open'} Preview to the Side (${K.mdpv})`, () => toggleMdPreview());
  }
  c.replaceChildren(path, acts);
  if (mob) path.scrollLeft = path.scrollWidth; // keep the file name, not the root folder, in view
}
// Returns true once written. force = overwrite whatever is on disk.
async function saveTab(rel, force = false) {
  const t = tabs.get(rel);
  if (!t) return false;
  if (!isDirty(t) && !force) return true; // nothing to write (and nothing to conflict over)
  if (!t.model) await ensureTabModel(rel, t);
  const version = t.model.getAlternativeVersionId();
  await historyBaseline(rel).catch(() => {});
  try {
    t.etag = await vfsWriteFile(activeProj(), rel, fileText(t), { force, expectedEtag: force ? null : t.etag });
  } catch (e) {
    if (e.status !== 412) throw e;
    return saveConflict(rel);
  }
  t.saved = version; t.dirty = false; renderTabs(); renderProjectBar();
  recordHistory(rel, fileText(t)).catch(() => {});
  scheduleGitRefresh();
  if (t.model && typeof extBus !== 'undefined') extBus.fire('saveDoc', { rel, model: t.model });
  return true;
}
const save = () => (diff?.kind === 'conflict' && diff.rel === active ? keepMine() : active ? saveTab(active) : Promise.resolve());
async function saveAll() { for (const [rel, t] of [...tabs]) if (isDirty(t) && !(await saveTab(rel))) return false; return true; }
// Someone else (agent, git, another editor) changed the file after we loaded it. Never overwrite silently.
async function saveConflict(rel) {
  if (active !== rel) activate(rel);
  const r = await modal(`Failed to save '${base(rel)}': The content of the file is newer.`,
    'Compare your version with the file on disk, or overwrite the file with your changes.',
    [{ label: 'Compare', value: 'compare', primary: true }, { label: 'Overwrite', value: 'overwrite' }, { label: 'Cancel', value: 'cancel' }]);
  if (r === 'overwrite') return saveTab(rel, true);
  if (r === 'compare') await openCompare(rel);
  return false;
}

// ---------- compare with disk & git diff (side-by-side diff) ----------
let diff = null; // { kind, rel, de, orig, mod?, etag?, box }
async function openCompare(rel) {
  const { text, etag } = await readFile(rel);
  const t = tabs.get(rel);
  if (!t) return;
  closeCompare();
  const orig = monaco.editor.createModel(text, t.model.getLanguageId());
  const box = el('div'); box.id = 'diff';
  const keep = el('button', 'btn', 'Overwrite with Mine'), take = el('button', 'btn sec', 'Use Disk Version'), x = el('button', 'ibtn');
  keep.title = `Save your version over the file (${K.save})`; take.title = 'Discard your changes and load the file from disk';
  x.title = 'Close'; x.append(icon('close'));
  keep.onclick = () => keepMine().catch(fail); take.onclick = () => takeDisk(); x.onclick = () => closeCompare();
  const bar = el('div', 'dbar');
  bar.append(icon('diff'), el('span', 'dt', `${base(rel)} (on disk) ↔ ${base(rel)} (yours)`), el('span', 'dh', 'Edit the right side to merge, then save.'), el('span', 'sp'), take, keep, x);
  const host = el('div', 'dhost');
  box.append(bar, host); $('#edwrap').append(box);
  const de = monaco.editor.createDiffEditor(host, { ...diffLayoutOpts(), automaticLayout: true, originalEditable: false, fontFamily: editor.getRawOptions().fontFamily });
  de.setModel({ original: orig, modified: t.model });
  diff = { kind: 'conflict', rel, de, orig, etag, box };
  de.getModifiedEditor().focus();
}
function closeCompare() {
  if (!diff) return;
  const d = diff; diff = null;
  d.de.dispose(); d.orig?.dispose(); d.mod?.dispose(); d.box.remove();
  if (active === d.rel) editor.focus();
}
// Save against the disk version shown on the left; if it changed again meanwhile, the bridge refuses and we ask again.
async function keepMine() {
  if (!diff || diff.kind !== 'conflict') return;
  const { rel, etag } = diff, t = tabs.get(rel);
  t.etag = etag;
  if (await saveTab(rel)) closeCompare();
}
function takeDisk() {
  if (!diff || diff.kind !== 'conflict') return;
  const { rel, etag, orig } = diff, t = tabs.get(rel), text = orig.getValue(monaco.editor.EndOfLinePreference.TextDefined, true);
  closeCompare(); // first: a live diff view re-rendering the swapped model throws "Illegal value for lineNumber"
  t.reloading = true; t.model.setValue(text); t.reloading = false;
  t.saved = t.model.getAlternativeVersionId(); t.etag = etag; t.bom = text.charCodeAt(0) === 0xfeff;
  renderTabs(); updateStatus();
}
// Re-read an open file that changed on disk (agent, git, another editor). Unsaved buffers are never touched.
async function reloadFile(rel) {
  const t = tabs.get(rel);
  if (!t || !t.model || isDirty(t)) return;
  let text, etag;
  try { ({ text, etag } = await readFile(rel)); } catch { return; } // deleted or unreadable: keep the buffer
  if (!tabs.has(rel) || isDirty(t)) return; // edited meanwhile
  t.etag = etag;
  if (text === fileText(t)) return; // our own save
  const view = rel === active ? editor.saveViewState() : null;
  t.reloading = true; t.model.setValue(text); t.reloading = false;
  t.saved = t.model.getAlternativeVersionId(); t.bom = text.charCodeAt(0) === 0xfeff;
  if (view) editor.restoreViewState(view); // keep cursor and scroll position
  renderTabs();
  if (rel === active) updateStatus();
}
async function reloadClean() { for (const rel of [...tabs.keys()]) await reloadFile(rel); }
const langName = id => monaco.languages.getLanguages().find(l => l.id === id)?.aliases?.[0] ?? id;
function updateStatus() {
  const cur = activeProj();
  $('#st-root').replaceChildren(icon(cur ? 'folder' : 'folder-opened'), el('span', '', cur ? cur.name : 'Open Folder'));
  const m = active && editor?.getModel();
  $('#st-pos').hidden = $('#st-lang').hidden = $('#st-eol').hidden = $('#st-enc').hidden = $('#st-indent').hidden = !m;
  if (!m) return;
  const o = m.getOptions(); // Monaco detects indentation per file
  $('#st-indent').textContent = o.insertSpaces ? `Spaces: ${o.indentSize}` : `Tab Size: ${o.tabSize}`;
  const p = editor.getPosition();
  $('#st-pos').textContent = p ? `Ln ${p.lineNumber}, Col ${p.column}` : '';
  $('#st-lang').textContent = langName(m.getLanguageId());
  $('#st-eol').textContent = m.getEOL() === '\r\n' ? 'CRLF' : 'LF';
  $('#st-enc').textContent = tabs.get(active)?.bom ? 'UTF-8 with BOM' : 'UTF-8';
}
const gotoLine = () => { const ed = diff?.rel === active ? diff.de.getModifiedEditor() : editor; ed.focus(); ed.getAction('editor.action.gotoLine')?.run(); };
$('#st-pos').onclick = gotoLine;
// Switch LF <-> CRLF (an undoable edit, so the tab turns dirty and Save writes it).
function toggleEol() {
  const m = active && editor.getModel();
  if (!m) return;
  m.pushEOL(m.getEOL() === '\r\n' ? monaco.editor.EndOfLineSequence.LF : monaco.editor.EndOfLineSequence.CRLF);
  updateStatus(); renderTabs();
}
$('#st-eol').onclick = toggleEol;
$('#st-indent').onclick = () => quickOpen('>Indent');
function setIndent(spaces, size) {
  const m = active && editor.getModel();
  if (!m) return;
  m.updateOptions(spaces ? { insertSpaces: true, indentSize: size, tabSize: size } : { insertSpaces: false, tabSize: size });
  updateStatus();
}
function toggleWrap() {
  if (isMobileUI()) prefs.wrapMob = !wrapOn(true); else prefs.wrap = !prefs.wrap;
  const wordWrap = wrapOn() ? 'on' : 'off';
  renderCrumbs();
  editor.updateOptions({ wordWrap });
  diff?.de.updateOptions({ wordWrap });
  layout(); // saves prefs
}

// Global shortcuts; capture phase so they work inside Monaco and inputs too.
addEventListener('keydown', e => {
  if (!editor) return;
  if ($('#menu') && e.key === 'Escape') { e.preventDefault(); return closeMenu(); }
  const mod = isMac ? e.metaKey : e.ctrlKey, k = e.key.toLowerCase(), code = e.code;
  const inTerm = !!document.activeElement?.closest('#panel'); // the shell owns ⌃W, Alt+letters etc. there
  const action =
    e.ctrlKey && !e.metaKey && !e.altKey && (code === 'Backquote' || e.key === '`' || e.key === '~') ? () => (e.shiftKey ? newTerminal().catch(fail) : toggleTerminal())
    // In the terminal, Ctrl/Alt keys belong to the shell, except the few VS Code also keeps (save, quick open, palette, side bar, search).
    : inTerm && (e.ctrlKey || e.altKey) && !(mod && (k === 's' || k === 'p' || k === 'b' || (e.shiftKey && k === 'f'))) ? null
    : mod && e.altKey && code === 'KeyS' ? () => saveAll().catch(fail)
    : mod && !e.shiftKey && !e.altKey && k === 's' ? () => save().catch(fail)
    : mod && !e.shiftKey && k === 'o' ? () => openFolder().catch(fail)
    : mod && !e.shiftKey && k === 'b' ? () => toggle('side')
    : mod && !e.shiftKey && k === 'p' ? () => quickOpen('')
    : (mod && e.shiftKey && k === 'p') || e.key === 'F1' ? () => quickOpen('>')
    : mod && e.shiftKey && k === 'f' ? () => openSearch()
    : mod && e.shiftKey && k === 'e' ? () => { showView('explorer'); $('#tree').focus(); }
    : mod && e.shiftKey && k === 'x' ? () => openExtView()
    : mod && e.shiftKey && k === 'v' && !inTerm && mdActive() ? () => toggleMdPreview()
    : mod && e.shiftKey && k === 'm' ? () => toggleProblems()
    : e.ctrlKey && e.shiftKey && !e.metaKey && k === 'g' ? () => openGitView()
    : e.altKey && !mod && !e.shiftKey && code === 'KeyZ' ? () => toggleWrap()
    : ((isMac && e.ctrlKey && !e.metaKey) || (!isMac && e.altKey && !e.ctrlKey)) && code === 'KeyW' ? () => { if (active) closeTab(active); }
    : null;
  if (!action) return;
  e.preventDefault(); e.stopPropagation(); // also keeps the browser's print / save-page / open-file dialogs away
  if ($('#qo').open || $('#modal').open || $('#gitdlg').open || $('#extdlg').open) return; // but don't act underneath an open dialog
  action();
}, true);
addEventListener('beforeunload', e => {
  if ([...tabs.values()].some(isDirty) || [...projects.values()].some(p => p.root !== root && p.tabs.some(t => t.dirty))) e.preventDefault();
});

// ---------- optional local companion (step 3: real shell / git / fs on the user's OWN machine) ----------
// bridge.mjs never executes anything. The companion (companion/companion.mjs) is a separate
// program the user runs locally; it binds loopback only, serves one folder chosen at launch,
// and requires a pairing token. The token is kept in sessionStorage only (like the GitHub
// token) and is only ever sent to the loopback companion URL the user entered.
let comp = null; // { base, token, pty, agent }
try {
  const u = sessionStorage.getItem('webideCompUrl'), tk = sessionStorage.getItem('webideCompToken');
  if (u && tk) comp = { base: u, token: tk };
} catch {}
const COMP_URL_RE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?\/?$/;
async function compFetch(pathname, opts = {}) {
  if (!comp) throw new Error('Companion is not connected.');
  const r = await fetch(comp.base + pathname, { ...opts, headers: { authorization: 'Bearer ' + comp.token, ...(opts.headers || {}) } });
  if (!r.ok) { let msg = `Companion HTTP ${r.status}`; try { msg = (await r.json()).error || msg; } catch {} throw new Error(msg); }
  return r;
}
const compApi = async (pathname, opts) => (await compFetch(pathname, opts)).json();
async function compConnect() {
  const urlIn = window.prompt('Companion URL (run `node companion/companion.mjs --root <folder>` locally first):', comp?.base || 'http://127.0.0.1:47399');
  if (!urlIn) return;
  const base = urlIn.trim().replace(/\/$/, '');
  if (!COMP_URL_RE.test(base)) return toast('Companion URL must be a loopback address (127.0.0.1 or localhost).', 'warn');
  const token = window.prompt('Companion pairing token (printed by the companion at startup):', comp?.token || '');
  if (!token) return;
  const prev = comp;
  comp = { base, token: token.trim() };
  try {
    const health = await (await fetch(base + '/health')).json();
    if (!health?.ok) throw new Error('Unexpected companion health response.');
    await compApi('/fs/list?path=');
    comp.pty = !!health.pty; comp.agent = !!health.agent;
    try { sessionStorage.setItem('webideCompUrl', base); sessionStorage.setItem('webideCompToken', comp.token); } catch {}
    toast(`Companion connected at ${base}${comp.pty ? ' (PTY)' : ' (pipe mode)'}.`);
  } catch (e) {
    comp = prev;
    toast(`Companion connection failed: ${e.message}`, 'warn');
  }
}
function compDisconnect() {
  for (const x of [...terms]) if (x.kind === 'comp') dropTerm(x);
  comp = null;
  try { sessionStorage.removeItem('webideCompUrl'); sessionStorage.removeItem('webideCompToken'); } catch {}
  toast('Companion disconnected.');
}
const compExec = (cmd, argv = [], cwd = '') => compApi('/exec', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cmd, args: argv, cwd }) });
const compGit = (argv = [], cwd = '') => compApi('/git', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ args: argv, cwd }) });

// ---------- terminal panel (xterm.js browser-local shell over IndexedDB/FSA; zero server shell execution) ----------
const terms = []; // { id, name, cwd, line, hist, attached, term?, fit?, box? }
let termOn = null, termSeq = 0;
const TERM_THEME = { // OpenIDE Obsidian
  background: '#0d0d12', foreground: '#d4d4e0', cursor: '#38bdf8', selectionBackground: '#6366f144',
  black: '#000000', red: '#f87171', green: '#34d399', yellow: '#fbbf24', blue: '#60a5fa', magenta: '#c084fc', cyan: '#22d3ee', white: '#e5e5e5',
  brightBlack: '#66667a', brightRed: '#fca5a5', brightGreen: '#6ee7b7', brightYellow: '#fde68a', brightBlue: '#93c5fd', brightMagenta: '#d8b4fe', brightCyan: '#67e8f9', brightWhite: '#ffffff',
};
function showPanel(on) {
  $('#panel').hidden = $('#sash-panel').hidden = !on;
  if (on) {
    setPanelTab('term');
    layout();
    if (termOn && !termOn.attached) attachTerm(termOn);
    requestAnimationFrame(() => { termOn?.fit?.fit(); termOn?.term?.focus(); });
  } else if (active) editor.focus();
}
function toggleTerminal() {
  if ($('#panel').hidden) { if (terms.length) showPanel(true); else newTerminal().catch(fail); } else showPanel(false);
}
function renderTerms() {
  const many = terms.length > 1;
  $('#terms').replaceChildren(...(many ? terms.map(x => {
    const b = el('div', 'tt' + (x === termOn ? ' on' : '')); b.setAttribute('role', 'tab');
    b.append(icon('terminal'), el('span', '', x.name));
    b.onclick = () => focusTerm(x);
    return b;
  }) : []));
}
const termPrompt = x => {
  const p = activeProj();
  const baseName = p ? p.name : 'webide';
  const loc = x.cwd ? `${baseName}/${x.cwd}` : baseName;
  return `\r\n\x1b[38;5;75m${loc}\x1b[0m \x1b[38;5;141m❯\x1b[0m `;
};
function normRelJoin(cwd, arg = '') {
  const parts = (arg.startsWith('/') ? arg.slice(1) : (cwd ? cwd + '/' + arg : arg)).split('/');
  const out = [];
  for (const s of parts) {
    if (!s || s === '.') continue;
    if (s === '..') out.pop();
    else out.push(s);
  }
  return out.join('/');
}
async function runBrowserTermCmd(x, rawLine) {
  const line = rawLine.trim();
  const out = s => x.term?.write(s.replace(/\r?\n/g, '\r\n'));
  if (!line) return;
  const parts = line.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(s => s.replace(/^['"]|['"]$/g, '')) || [];
  const cmd = parts[0], arg = parts[1] || '';
  const proj = activeProj();
  try {
    if (cmd === 'clear') { x.term?.clear(); return; }
    if (cmd === 'help') {
      out('Browser-Local Shell (zero server execution)\nCommands: help, pwd, ls [dir], cd [dir], cat <file>, head <file>, touch <file>, mkdir <dir>, rm <path>, find [substr], git status|log, ext list, clear\n');
    } else if (cmd === 'pwd') {
      out('/' + (proj ? (x.cwd ? proj.name + '/' + x.cwd : proj.name) : '') + '\n');
    } else if (cmd === 'whoami') {
      out('browser-local (isolated IndexedDB/FSA workspace)\n');
    } else if (!proj) {
      out('No workspace open.\n');
    } else if (cmd === 'ls') {
      const target = normRelJoin(x.cwd, arg);
      const list = await vfsListDir(proj, target);
      out(list.map(i => i.dir ? `\x1b[34m${i.name}/\x1b[0m` : i.name).join('  ') + (list.length ? '\n' : ''));
    } else if (cmd === 'cd') {
      const target = normRelJoin(x.cwd, arg);
      if (target) await vfsListDir(proj, target);
      x.cwd = target;
    } else if (cmd === 'cat' || cmd === 'head') {
      if (!arg) { out(`Usage: ${cmd} <file>\n`); return; }
      const { text } = await vfsReadFile(proj, normRelJoin(x.cwd, arg));
      const lines = text.split(/\r?\n/);
      out((cmd === 'head' ? lines.slice(0, 20) : lines).join('\n') + '\n');
    } else if (cmd === 'touch') {
      if (!arg) { out('Usage: touch <file>\n'); return; }
      await vfsWriteFile(proj, normRelJoin(x.cwd, arg), '', { create: true });
      await renderTree();
    } else if (cmd === 'mkdir') {
      if (!arg) { out('Usage: mkdir <dir>\n'); return; }
      await vfsMkdir(proj, normRelJoin(x.cwd, arg));
      await renderTree();
    } else if (cmd === 'rm') {
      if (!arg) { out('Usage: rm <path>\n'); return; }
      await vfsDelete(proj, normRelJoin(x.cwd, arg));
      await renderTree();
    } else if (cmd === 'find') {
      const { files } = await vfsAllFiles(proj);
      const filtered = arg ? files.filter(f => f.toLowerCase().includes(arg.toLowerCase())) : files;
      out(filtered.slice(0, 200).join('\n') + (filtered.length ? '\n' : ''));
    } else if (cmd === 'ext' && arg === 'list') {
      out(installedExts.map(e => `${e.id} v${e.version} [${e.enabled ? 'enabled' : 'disabled'}]`).join('\n') + (installedExts.length ? '\n' : 'No extensions installed.\n'));
    } else if (cmd === 'git') {
      await refreshGit();
      if (arg === 'log') out((gitCommits || []).map(c => `${c.shortHash} ${c.subject} (${c.date})`).join('\n') + '\n');
      else if (gitState?.isRepo) out(`On branch ${gitState.branch}\nStaged: ${gitState.staged.length}, Changes: ${gitState.unstaged.length}\n`);
      else out('Not an initialized repository snapshot.\n');
    } else {
      out(`Unknown command: ${cmd}. Type 'help' for available browser-local commands.\n`);
    }
  } catch (e) { out(`\x1b[31m${e.message}\x1b[0m\n`); }
}
// Classic <script> load that hides Monaco's AMD `define` so UMD bundles attach to window instead.
// Ref-counted: `define.amd` comes back only after the last concurrent load finishes.
let amdHidden = 0, amdSaved;
function loadJs(src) {
  return new Promise((res, rej) => {
    if (!amdHidden++ && window.define) { amdSaved = window.define.amd; window.define.amd = undefined; }
    const done = () => { if (!--amdHidden && window.define && amdSaved !== undefined) window.define.amd = amdSaved; };
    const s = document.createElement('script'); s.src = src; s.async = false;
    s.onload = () => { done(); res(); };
    s.onerror = e => { done(); rej(e); };
    document.head.append(s);
  });
}
let xtermReady = null;
function ensureXterm() {
  if (window.Terminal && window.FitAddon) return Promise.resolve();
  if (xtermReady) return xtermReady;
  const loadCss = href => new Promise(res => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href;
    l.onload = l.onerror = res; document.head.append(l);
  });
  xtermReady = (async () => {
    await Promise.all([
      loadCss('/vendor/xterm/xterm.css'),
      loadJs('/vendor/xterm/xterm.js'),
    ]);
    await loadJs('/vendor/xterm/addon-fit.js');
  })();
  return xtermReady;
}
async function attachTerm(x) {
  if (x.attached || x.attaching) return;
  x.attaching = true;
  try { await ensureXterm(); } catch (e) { x.attaching = false; fail(e); return; }
  x.attaching = false;
  if (x.attached || !terms.includes(x)) return;
  const box = el('div'); box.style.visibility = 'hidden'; $('#termbody').append(box);
  const fontFamily = editor ? editor.getRawOptions().fontFamily : 'ui-monospace, "SF Mono", Menlo, monospace';
  const term = new Terminal({ fontFamily, fontSize: 12, lineHeight: 1.2, cursorBlink: true, scrollback: 5000, theme: TERM_THEME });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit); term.open(box); fit.fit();
  Object.assign(x, { term, fit, box, attached: true, busy: false });
  for (const t of terms) if (t.attached) { t.box.hidden = t !== x; if (t === x) t.box.style.visibility = ''; }
  requestAnimationFrame(() => { fit.fit(); term.focus(); });
  if (x.kind === 'comp') {
    // Real shell on the user's machine, streamed from the local companion over WebSocket.
    term.write('\x1b[38;5;245mWebIDE Companion Terminal — real shell on your machine (via the local companion).\x1b[0m\r\n');
    if (!comp) { term.write('\x1b[31mCompanion is not connected. Run "Companion: Connect…" from the Command Palette.\x1b[0m\r\n'); return; }
    const ws = new WebSocket(comp.base.replace(/^http/, 'ws') + '/term?token=' + encodeURIComponent(comp.token));
    x.ws = ws;
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'r', c: term.cols, r: term.rows })); term.focus(); };
    ws.onmessage = ev => {
      try {
        const m = JSON.parse(ev.data);
        if (m.t === 'o') term.write(m.d);
        else if (m.t === 'x') term.write(`\r\n\x1b[38;5;245m[process exited: ${m.code}]\x1b[0m\r\n`);
      } catch {}
    };
    ws.onclose = () => { if (terms.includes(x) && x.attached) term.write('\r\n\x1b[38;5;245m[companion connection closed]\x1b[0m\r\n'); };
    ws.onerror = () => { if (x.attached) term.write('\r\n\x1b[31m[companion connection error — is it still running?]\x1b[0m\r\n'); };
    term.onData(d => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'i', d })); });
    term.onResize(({ cols, rows }) => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'r', c: cols, r: rows })); });
    term.attachCustomKeyEventHandler(e => {
      if (e.type !== 'keydown') return true;
      if (!isMac && e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (e.key === 'c' && term.hasSelection()) { navigator.clipboard.writeText(term.getSelection()); term.clearSelection(); return false; }
        if (e.key === 'v') return false;
      }
      return true;
    });
    return;
  }
  term.write('\x1b[38;5;245mWebIDE Browser-Local Shell — all commands stay inside this browser.\x1b[0m\r\nType \x1b[36mhelp\x1b[0m for commands.');
  term.write(termPrompt(x));
  let hIdx = -1;
  term.onData(async d => {
    if (x.busy) return;
    if (d === '\x1b[A') { // up history
      if (!x.hist.length) return;
      hIdx = hIdx < 0 ? x.hist.length - 1 : Math.max(0, hIdx - 1);
      const n = [...x.line].length;
      if (n) term.write(`\x1b[${n}D\x1b[K`);
      x.line = x.hist[hIdx]; term.write(x.line); return;
    }
    if (d === '\x1b[B') {
      if (hIdx < 0) return;
      const n = [...x.line].length;
      if (n) term.write(`\x1b[${n}D\x1b[K`);
      hIdx = hIdx + 1 < x.hist.length ? hIdx + 1 : -1;
      x.line = hIdx < 0 ? '' : x.hist[hIdx]; term.write(x.line); return;
    }
    if (d.startsWith('\x1b')) return;
    for (const ch of d.replace(/\r\n|\n/g, '\r')) {
      if (ch === '\r') {
        const cmdLine = x.line;
        if (cmdLine.trim()) x.hist.push(cmdLine);
        hIdx = -1; x.line = '';
        term.write('\r\n');
        x.busy = true;
        await runBrowserTermCmd(x, cmdLine);
        x.busy = false;
        if (x.attached) term.write(termPrompt(x));
      } else if (ch === '\x7f') {
        if (x.line) { x.line = [...x.line].slice(0, -1).join(''); term.write('\b \b'); }
      } else if (ch === '\x03') {
        term.write('^C'); x.line = ''; term.write(termPrompt(x));
      } else if (ch >= ' ') {
        x.line += ch; term.write(ch);
      }
    }
  });
  term.attachCustomKeyEventHandler(e => {
    if (e.type !== 'keydown') return true;
    if (isMac && e.metaKey && e.key === 'k') { term.clear(); term.write(termPrompt(x)); return false; }
    if (!isMac && e.ctrlKey && !e.altKey && !e.shiftKey) {
      if (e.key === 'c' && term.hasSelection()) { navigator.clipboard.writeText(term.getSelection()); term.clearSelection(); return false; }
      if (e.key === 'v') return false;
    }
    return true;
  });
}
function focusTerm(x) {
  termOn = x;
  if (!x.attached && !$('#panel').hidden) attachTerm(x);
  for (const t of terms) if (t.attached) { t.box.hidden = t !== x; if (t === x) t.box.style.visibility = ''; }
  renderTerms();
  if (x.attached) requestAnimationFrame(() => { x.fit.fit(); x.term.focus(); });
}
function spawnTerm(kind) {
  showPanel(true);
  const baseName = kind === 'comp' ? 'companion' : 'local';
  const used = new Set(terms.map(t => t.name));
  let name = baseName, k = 2;
  while (used.has(name)) name = `${baseName} (${k++})`;
  const x = { id: 't' + (++termSeq), name, kind, cwd: '', line: '', hist: [], attached: false };
  terms.push(x);
  focusTerm(x);
}
async function newTerminal() {
  if (!root) throw new Error('Open a folder or GitHub repository first.');
  spawnTerm('local');
}
async function newCompTerminal() {
  if (!comp) await compConnect();
  if (!comp) return;
  spawnTerm('comp');
}
function killTerm(x = termOn) { if (x) dropTerm(x); }
function dropTerm(x) {
  const i = terms.indexOf(x);
  if (i < 0) return;
  terms.splice(i, 1);
  try { x.ws?.close(); } catch {}
  if (x.attached) { x.term.dispose(); x.box.remove(); }
  if (termOn === x) termOn = null;
  if (terms.length) { if (!termOn) focusTerm(terms[Math.min(i, terms.length - 1)]); else renderTerms(); } else showPanel(false);
}
new ResizeObserver(() => { if (!$('#panel').hidden) termOn?.fit?.fit(); }).observe($('#termbody'));
$('#term-new').onclick = () => newTerminal().catch(fail);
$('#term-kill').onclick = () => killTerm();
$('#panel-close').onclick = () => showPanel(false);
$('#term-new').title = `New Terminal (${K.newTerm})`; $('#panel-close').title = `Hide Panel (${K.term})`;

// ---------- modal dialog ----------
// Buttons are listed in Windows order (primary first); macOS puts the primary button on the right.
function modal(title, detail, buttons) {
  const d = $('#modal');
  if (d.open) return Promise.resolve('cancel');
  $('#md-title').textContent = title;
  $('#md-detail').textContent = detail || ''; $('#md-detail').hidden = !detail;
  return new Promise(ok => {
    const done = v => { d.oncancel = null; if (d.open) d.close(); ok(v); };
    const btns = buttons.map(b => { const x = el('button', b.primary ? 'btn' : 'btn sec', b.label); x.onclick = () => done(b.value); return x; });
    $('#md-buttons').replaceChildren(...(isMac ? btns.reverse() : btns));
    d.oncancel = e => { e.preventDefault(); done('cancel'); }; // Esc
    d.showModal();
    $('#md-buttons .btn:not(.sec)')?.focus();
  });
}

// ---------- context menu ----------
function closeMenu() { $('#menu')?.remove(); }
function menu(x, y, items) {
  closeMenu();
  const m = el('div'); m.id = 'menu'; m.setAttribute('role', 'menu'); m.tabIndex = -1;
  for (const it of items) {
    if (it === '-') { m.append(el('div', 'ms')); continue; }
    const b = el('button', 'mi'); b.setAttribute('role', 'menuitem'); b.disabled = !!it.disabled;
    b.append(el('span', '', it.label), el('span', 'mk', it.key || ''));
    b.onclick = () => { closeMenu(); Promise.resolve().then(it.run).catch(fail); };
    m.append(b);
  }
  document.body.append(m);
  const r = m.getBoundingClientRect(); // keep it on screen
  m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px';
  m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
  const btns = [...m.querySelectorAll('.mi:not(:disabled)')];
  m.focus();
  m.onkeydown = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return closeMenu(); }
    if (e.key === 'Tab') return closeMenu();
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = btns.indexOf(document.activeElement);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1
      : i < 0 ? (e.key === 'ArrowDown' ? 0 : btns.length - 1) : (i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
    btns[j]?.focus();
  };
}
addEventListener('pointerdown', e => { if (!e.target.closest?.('#menu')) closeMenu(); }, true);
addEventListener('blur', closeMenu);
addEventListener('resize', closeMenu);

const absPath = rel => (activeProj()?.name || 'workspace') + '/' + rel;
async function copy(text) {
  try { await navigator.clipboard.writeText(text); } catch { toast('Could not access the clipboard.', 'warn'); }
}

// ---------- explorer: reveal, rename, delete, keyboard, context menu ----------
// Expand the folders above a file and select it (VS Code's explorer.autoReveal).
function reveal(rel) {
  if (!root || !rel) return Promise.resolve();
  return treeQueue(async () => {
    const parts = rel.split('/');
    let changed = false;
    for (let i = 1; i < parts.length; i++) { const p = parts.slice(0, i).join('/'); if (!expanded.has(p)) { expanded.add(p); changed = true; } }
    if (changed || !$(`#tree .row[data-rel="${CSS.escape(rel)}"]`)) await drawTree();
    select(rel, false);
    $(`#tree .row[data-rel="${CSS.escape(rel)}"]`)?.scrollIntoView({ block: 'nearest' });
  });
}

// Windows treats "\" as a separator too; elsewhere it is a legal filename character.
const normName = v => (isWin ? v.replace(/\\/g, '/') : v).trim().replace(/^\/+|\/+$/g, '');
function badName(name) {
  if (/(^|\/)\.\.?($|\/)/.test(name)) return 'A name cannot contain "." or ".." segments.';
  if (isWin && /[<>:"|?*]/.test(name)) return 'A name cannot contain any of these characters: < > : " | ? *';
  if (isWin && /(^|\/)(con|prn|aux|nul|com\d|lpt\d)(\.[^/]*)?($|\/)/i.test(name)) return `"${name}" is a reserved name on Windows.`;
  if (isWin && /[ .]($|\/)/.test(name)) return 'On Windows a name cannot end with a space or a dot.';
  return '';
}

// After a rename, carry open editors (and their unsaved edits), expanded folders and history over to the new paths.
function moved(from, to) {
  const re = k => (k === from ? to : k.startsWith(from + '/') ? to + k.slice(from.length) : k);
  if (active && tabs.has(active)) tabs.get(active).view = editor.saveViewState();
  const entries = [...tabs], old = [], wasActive = active;
  tabs.clear();
  for (const [k, t] of entries) {
    const nk = re(k);
    if (nk === k) { tabs.set(k, t); continue; }
    if (!t.model) { tabs.set(nk, t); continue; }
    const n = newModel(nk, fileText(t)); // new URI, so the language follows a changed extension
    n.view = t.view; n.bom = t.bom; n.preview = t.preview; n.etag = t.etag;
    if (isDirty(t)) n.saved = -1; // still unsaved
    tabs.set(nk, n); old.push(t.model);
  }
  for (const k of [...expanded]) { const nk = re(k); if (nk !== k) { expanded.delete(k); expanded.add(nk); } }
  recent.forEach((r, i) => { recent[i] = re(r); });
  active = null;
  activate(wasActive ? re(wasActive) : null, { noReveal: true }); // the explorer keeps the renamed item selected
  old.forEach(m => m.dispose()); // only after the editor has switched away from them
}

function renameEntry(rel) {
  return treeQueue(async () => {
    const row = $(`#tree .row[data-rel="${CSS.escape(rel)}"]`);
    const label = row?.querySelector('.name');
    if (!label) return;
    const old = base(rel), parent = rel.split('/').slice(0, -1).join('/'), isDir = !!row.dataset.dir;
    const input = el('input'); input.value = old; input.setAttribute('aria-label', 'New name');
    label.replaceWith(input); row.classList.add('renaming');
    input.focus();
    const dot = old.lastIndexOf('.');
    input.setSelectionRange(0, isDir || dot <= 0 ? old.length : dot); // select the name without its extension
    let busy = false;
    const restore = () => { if (!busy && input.isConnected) { input.onblur = null; input.replaceWith(label); row.classList.remove('renaming', 'bad'); } };
    input.onblur = () => setTimeout(() => { if (document.activeElement !== input) restore(); });
    input.onclick = input.onmousedown = e => e.stopPropagation(); // don't open/toggle the row underneath
    input.oninput = () => row.classList.remove('bad');
    input.onkeydown = e => {
      e.stopPropagation(); // keep explorer keyboard navigation out of the text box
      if (composing(e)) return;
      if (e.key === 'Escape') { e.preventDefault(); return restore(); }
      if (e.key !== 'Enter' || busy) return;
      e.preventDefault();
      const name = normName(input.value);
      if (!name || name === old) return restore();
      const bad = badName(name);
      if (bad) { row.classList.add('bad'); return toast(bad, 'warn'); }
      const to = parent ? parent + '/' + name : name;
      busy = true;
      treeQueue(async () => {
        try { await vfsRename(activeProj(), rel, to); }
        catch (err) {
          busy = false; row.classList.add('bad'); input.focus();
          return toast(err.status === 409 ? `A file or folder named "${name}" already exists here. Choose a different name.` : err.message, 'error');
        }
        input.onblur = null;
        to.split('/').slice(0, -1).reduce((acc, seg) => { const p = acc ? acc + '/' + seg : seg; expanded.add(p); return p; }, '');
        selected = { rel: to, dir: isDir };
        moved(rel, to);
        await drawTree();
        scheduleGitRefresh();
        $('#tree').focus();
      });
    };
  });
}

async function deleteEntry(rel, isDir) {
  const r = await modal(`Are you sure you want to delete '${base(rel)}'${isDir ? ' and its contents' : ''}?`, 'This removes it from your browser workspace.',
    [{ label: 'Delete', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel' }]);
  if (r !== 'ok') return;
  await vfsDelete(activeProj(), rel);
  const gone = k => k === rel || k.startsWith(rel + '/');
  // Unsaved editors stay open (Save recreates the file); clean ones close.
  for (const k of [...tabs.keys()]) if (gone(k) && !isDirty(tabs.get(k))) closeTab(k, true);
  for (const k of [...expanded]) if (gone(k)) expanded.delete(k);
  if (selected && gone(selected.rel)) selected = null;
  await renderTree();
  scheduleGitRefresh();
  $('#tree').focus();
}

const rowInfo = row => (row ? { rel: row.dataset.rel, dir: !!row.dataset.dir } : null);
$('#tree').addEventListener('contextmenu', e => {
  const row = e.target.closest('.row');
  if (row?.classList.contains('edit') || row?.classList.contains('renaming')) return; // native menu inside text boxes
  e.preventDefault();
  const it = rowInfo(row);
  select(it?.rel ?? null, it?.dir ?? false);
  menu(e.clientX, e.clientY, [
    { label: 'New File…', run: () => newEntry('file') },
    { label: 'New Folder…', run: () => newEntry('folder') },
    '-',
    ...(it ? [
      ...(it.dir ? [] : [{ label: 'Open', run: () => openFile(it.rel) }, ...mdMenu(it.rel), { label: 'Open Local History…', run: () => openLocalHistory(it.rel) }]),
      { label: 'Copy Path', run: () => copy(absPath(it.rel)) },
      { label: 'Copy Relative Path', run: () => copy(it.rel) },
      '-',
      { label: 'Rename…', key: K.rename, run: () => renameEntry(it.rel) },
      { label: 'Delete', key: K.del, run: () => deleteEntry(it.rel, it.dir) },
    ] : [
      { label: 'Refresh', run: renderTree },
      { label: 'Collapse Folders', run: () => { expanded.clear(); return renderTree(); } },
    ]),
  ]);
});
// Keyboard: ↑↓ move, → expand / ← collapse or go to parent, Enter/Space open, F2 rename, Delete (⌘⌫ on macOS).
$('#tree').addEventListener('keydown', e => {
  if (e.target !== $('#tree')) return; // inline inputs handle their own keys
  const rows = $$('#tree .row').filter(r => !r.classList.contains('edit') && r.offsetParent);
  const i = rows.findIndex(r => r.classList.contains('sel')), row = rows[i], it = rowInfo(row);
  const go = j => { const r = rows[Math.max(0, Math.min(rows.length - 1, j))]; if (r) { select(r.dataset.rel, !!r.dataset.dir); r.scrollIntoView({ block: 'nearest' }); } };
  const take = fn => { e.preventDefault(); fn(); };
  if (e.key === 'ArrowDown') take(() => go(i + 1));
  else if (e.key === 'ArrowUp') take(() => go(i < 0 ? 0 : i - 1));
  else if (e.key === 'Home') take(() => go(0));
  else if (e.key === 'End') take(() => go(rows.length - 1));
  else if (!it) return;
  else if (e.key === 'ArrowRight') take(() => { if (it.dir) expanded.has(it.rel) ? go(i + 1) : row.click(); });
  else if (e.key === 'ArrowLeft') take(() => {
    if (it.dir && expanded.has(it.rel)) return row.click();
    const parent = it.rel.split('/').slice(0, -1).join('/');
    if (parent) go(rows.findIndex(r => r.dataset.rel === parent));
  });
  else if (e.key === 'Enter' || e.key === ' ') take(() => (it.dir ? row.click() : openFile(it.rel).catch(fail)));
  else if (e.key === 'F2') take(() => renameEntry(it.rel));
  else if (e.key === 'Delete' || (isMac && e.metaKey && e.key === 'Backspace')) take(() => deleteEntry(it.rel, it.dir).catch(fail));
});

// ---------- explorer drag & drop: move files and folders ----------
let dragHover = null, dragTimer = null;
// Drop target folder for the row under the pointer ('' = workspace root); a file row means its folder.
const dropTarget = e => {
  const t = e.target.nodeType === 3 ? e.target.parentElement : e.target;
  const row = t?.closest?.('#tree .row');
  if (!row) return '';
  return row.dataset.dir ? row.dataset.rel : row.dataset.rel.split('/').slice(0, -1).join('/');
};
function markDrop(target) {
  $$('#tree .drop').forEach(x => x.classList.remove('drop'));
  dragHover = target;
  if (target == null) return;
  (target ? $(`#tree .row[data-rel="${CSS.escape(target)}"]`)?.parentElement : $('#tree'))?.classList.add('drop');
}
$('#tree').addEventListener('dragover', e => {
  if (!e.dataTransfer.types.includes(DRAG_PATH)) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  const target = dropTarget(e);
  if (target === dragHover) return;
  markDrop(target);
  clearTimeout(dragTimer);
  const row = target && $(`#tree .row[data-rel="${CSS.escape(target)}"]`);
  if (row && !expanded.has(target)) dragTimer = setTimeout(() => row.click(), 700); // hovering opens a folder
});
$('#tree').addEventListener('dragleave', e => { if (!$('#tree').contains(e.relatedTarget)) { clearTimeout(dragTimer); markDrop(null); } });
$('#tree').addEventListener('dragend', () => { clearTimeout(dragTimer); markDrop(null); });
$('#tree').addEventListener('drop', async e => {
  const from = e.dataTransfer.getData(DRAG_PATH);
  if (!from) return;
  e.preventDefault();
  const target = dropTarget(e), isDir = dragDir;
  clearTimeout(dragTimer); markDrop(null);
  const to = target ? target + '/' + base(from) : base(from);
  if (to === from || target === from || target.startsWith(from + '/')) return; // same folder, or into itself
  const ok = await modal(`Are you sure you want to move '${base(from)}' into '${target ? base(target) : (activeProj()?.name || 'workspace')}'?`, '',
    [{ label: 'Move', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel' }]);
  if (ok !== 'ok') return;
  treeQueue(async () => {
    try { await vfsRename(activeProj(), from, to); }
    catch (err) { return toast(err.status === 409 ? `'${base(from)}' already exists here.` : err.message, 'error'); }
    if (target) expanded.add(target);
    selected = { rel: to, dir: isDir };
    moved(from, to);
    await drawTree();
    scheduleGitRefresh();
  });
});

// ---------- Search view (Find in Files strictly in browser memory) ----------
const sr = { case: false, word: false, regex: false, seq: 0, timer: null, collapsed: new Set(), last: null };
function openSearch() {
  showView('search');
  const inp = $('#sr-q');
  const s = active && editor.getModel()?.getValueInRange(editor.getSelection()); // seed with the editor selection
  if (s && !s.includes('\n')) { inp.value = s; runSearch(); }
  inp.focus(); inp.select();
}
async function runSearch() {
  clearTimeout(sr.timer);
  const q = $('#sr-q').value, n = ++sr.seq;
  if (!q) { sr.last = null; $('#sr-res').replaceChildren(); $('#sr-msg').textContent = ''; return; }
  if (!root) { $('#sr-msg').textContent = 'Open a folder or GitHub repo to search its files.'; return; }
  $('#sr-msg').textContent = 'Searching…';
  let r;
  try { r = await vfsSearch(activeProj(), q, { case: sr.case, word: sr.word, regex: sr.regex }); }
  catch (e) { if (n === sr.seq) { sr.last = null; $('#sr-res').replaceChildren(); $('#sr-msg').textContent = e.message; } return; }
  if (n !== sr.seq) return; // a newer search is on its way
  sr.last = r; sr.collapsed.clear();
  renderResults();
}
function renderResults() {
  const r = sr.last;
  if (!r) return;
  const count = r.results.reduce((a, f) => a + f.matches.length, 0), files = r.results.length;
  $('#sr-msg').textContent = !count ? 'No results found.' :
    `${count} result${count > 1 ? 's' : ''} in ${files} file${files > 1 ? 's' : ''}${r.truncated ? ' (only the first 2,000 are shown)' : ''}`;
  $('#sr-res').replaceChildren(...r.results.flatMap(({ file, matches }) => {
    const open = !sr.collapsed.has(file);
    const fr = el('div', 'row sr-file'); fr.title = file;
    fr.append(icon(open ? 'chevron-down' : 'chevron-right', 'tw'), fileIcon(base(file)), el('span', 'name', base(file)),
      el('span', 'qdesc', file.split('/').slice(0, -1).join('/')), el('span', 'badge', matches.length));
    fr.onclick = () => { open ? sr.collapsed.add(file) : sr.collapsed.delete(file); renderResults(); };
    if (!open) return [fr];
    return [fr, ...matches.map(m => {
      const row = el('div', 'row sr-match'), start = m.col - 1 - m.off; // match position inside the preview text
      const lead = Math.min(m.text.match(/^\s*/)[0].length, start); // drop indentation, like VS Code
      let pre = m.text.slice(lead, start);
      if (pre.length > 40) pre = '…' + pre.slice(-30); // keep the hit visible in a narrow side bar
      const pv = el('span', 'pv');
      pv.append(pre, el('mark', '', m.text.slice(start, start + m.len)), m.text.slice(start + m.len));
      row.append(pv); row.title = `${file}:${m.line}:${m.col}`;
      row.onclick = () => {
        $$('#sr-res .row.sel').forEach(x => x.classList.remove('sel')); row.classList.add('sel');
        openAt(file, m).catch(fail);
      };
      return row;
    })];
  }));
}
async function openAt(file, m) {
  await openFile(file, { preview: true });
  if (active !== file) return;
  const range = new monaco.Range(m.line, m.col, m.line, m.col + m.len);
  editor.setSelection(range);
  editor.revealRangeInCenterIfOutsideViewport(range);
}
$('#sr-q').oninput = () => { clearTimeout(sr.timer); sr.timer = setTimeout(runSearch, 300); }; // search as you type
$('#sr-q').onkeydown = e => { if (e.key === 'Enter' && !composing(e)) { e.preventDefault(); runSearch(); } };
for (const k of ['case', 'word', 'regex']) {
  $('#sr-' + k).onclick = () => {
    sr[k] = !sr[k];
    $('#sr-' + k).classList.toggle('on', sr[k]); $('#sr-' + k).setAttribute('aria-pressed', sr[k]);
    $('#sr-q').focus(); runSearch();
  };
}
$('#sr-refresh').onclick = runSearch;
$('#sr-clear').onclick = () => { $('#sr-q').value = ''; runSearch(); $('#sr-q').focus(); };
$('#sr-collapse').onclick = () => { (sr.last?.results || []).forEach(f => sr.collapsed.add(f.file)); renderResults(); };

// ---------- Go to File / Command Palette (one quick input; a leading ">" switches to commands) ----------
const qo = { files: [], truncated: false, items: [], active: 0, loaded: false, loading: false };
// Subsequence match: consecutive letters and word starts score higher.
function fuzzy(q, s) {
  const t = s.toLowerCase(), pos = [];
  let i = 0, score = 0, last = -2;
  for (let j = 0; j < t.length && i < q.length; j++) {
    if (t[j] !== q[i]) continue;
    score += j === last + 1 ? 5 : 1;
    if (j === 0 || '/._- '.includes(s[j - 1])) score += 3;
    pos.push(j); last = j; i++;
  }
  return i === q.length ? { score, pos } : null;
}
function hl(text, pos) {
  const s = el('span'), set = new Set(pos);
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    if (!set.has(i)) { buf += text[i]; continue; }
    if (buf) s.append(buf);
    buf = ''; s.append(el('mark', '', text[i]));
  }
  if (buf) s.append(buf);
  return s;
}
const COMMANDS = () => [
  { label: 'View: Show Home', run: () => showHome(true) },
  { label: 'File: Open Folder…', key: K.open, run: openFolder },
  { label: 'Go to File…', key: K.quick, run: () => quickOpen('') },
  { label: 'File: New File…', run: () => newEntry('file') },
  { label: 'File: New Folder…', run: () => newEntry('folder') },
  { label: 'File: Save', key: K.save, run: save },
  { label: 'File: Save All', key: K.saveAll, run: saveAll },
  { label: 'View: Close Editor', key: K.close, run: () => active && closeTab(active) },
  { label: 'View: Close All Editors', run: () => closeMany([...tabs.keys()]) },
  { label: 'View: Toggle Primary Side Bar Visibility', key: K.side, run: () => toggle('side') },
  ...(isMobileUI() ? [] : [{ label: 'View: Toggle Chat', run: () => toggle('chat') }]),
  { label: 'File: Reveal Active File in Explorer View', run: () => { showView('explorer'); return reveal(active); } },
  { label: 'Explorer: Refresh', run: renderTree },
  { label: 'Explorer: Collapse Folders', run: () => { expanded.clear(); return renderTree(); } },
  { label: 'Go to Line/Column…', key: K.line, run: gotoLine },
  { label: 'View: Toggle Problems', key: K.prob, run: toggleProblems },
  { label: `File: Toggle Auto Save (now ${prefs.autoSave ? 'on' : 'off'})`, run: toggleAutoSave },
  ...(active ? [
    { label: 'Local History: Find Entry to Restore…', run: () => openLocalHistory(active) },
    { label: 'Format Document', run: () => editor.getAction('editor.action.formatDocument')?.run() },
    { label: 'Go to Symbol in Editor…', run: () => editor.getAction('editor.action.quickOutline')?.run() },
  ] : []),
  ...(mdActive() ? [{ label: 'Markdown: Open Preview to the Side', key: K.mdpv, run: () => toggleMdPreview(true) }] : []),
  { label: 'Change End of Line Sequence (LF / CRLF)', run: toggleEol },
  { label: 'Search: Find in Files', key: K.find, run: () => openSearch() },
  { label: 'View: Show Explorer', key: K.explorer, run: () => showView('explorer') },
  { label: 'View: Show Source Control', key: K.git, run: openGitView },
  ...(isMobileUI() ? [] : [
    { label: 'View: Show Extensions', key: K.ext, run: openExtView },
    { label: 'Preferences: Color Theme', run: () => quickOpen('', 'theme') },
    ...getExtCommands(),
  ]),
  { label: 'Git: Clone from GitHub…', run: () => openGitDialog('clone') },
  { label: 'Git: Connect GitHub Remote…', run: () => openGitDialog('remote') },
  { label: 'View: Switch Language (中文 / English)', run: () => setLang(LANG === 'zh' ? 'en' : 'zh') },
  { label: 'GitHub: Set Access Token (Private Repositories)…', run: () => { openGitDialog('clone'); $('#gd-auth').open = true; } },
  ...(ghToken ? [{ label: 'GitHub: Forget Access Token', run: () => { setGhToken(''); toast('GitHub token removed from this browser.'); } }] : []),
  { label: 'Git: Checkout / Create Branch…', run: gitBranchPicker },
  { label: 'Git: Pull Updates from GitHub', run: () => gitPullFromGithub().catch(fail) },
  { label: 'Workspace: Export Project as ZIP…', run: () => exportProjectZip().catch(fail) },
  { label: 'Git: Initialize Local Snapshot Repository', run: () => gitInitRepo().catch(fail) },
  { label: 'View: Toggle Word Wrap', key: K.wrap, run: toggleWrap },
  { label: 'View: Toggle Terminal', key: K.term, run: toggleTerminal },
  { label: 'Terminal: Create New Terminal', key: K.newTerm, run: newTerminal },
  { label: 'Terminal: Kill the Active Terminal Instance', run: () => killTerm() },
  { label: 'Terminal: Clear', run: () => termOn?.term.clear() },
  { label: 'Terminal: New Companion Terminal', run: () => newCompTerminal().catch(fail) },
  { label: 'Companion: Connect…', run: () => compConnect().catch(fail) },
  { label: 'Companion: Disconnect', run: compDisconnect },
  ...[2, 4, 8].map(n => ({ label: `Indent Using Spaces: ${n}`, run: () => setIndent(true, n) })),
  ...[2, 4, 8].map(n => ({ label: `Indent Using Tabs: Tab Size ${n}`, run: () => setIndent(false, n) })),
  { label: 'Convert Indentation to Spaces', run: () => editor.getAction('editor.action.indentationToSpaces')?.run().then(updateStatus) },
  { label: 'Convert Indentation to Tabs', run: () => editor.getAction('editor.action.indentationToTabs')?.run().then(updateStatus) },
];
async function ensureQoFiles() {
  if (!root || qo.loaded || qo.loading) return;
  qo.loading = true;
  const openRoot = root;
  try {
    const d = await vfsAllFiles(activeProj());
    if (root === openRoot) { Object.assign(qo, d); qo.loaded = true; }
  } catch (e) { fail(e); }
  qo.loading = false;
  if ($('#qo').open && !$('#qoin').value.startsWith('>')) qoRender();
}
async function quickOpen(prefix, mode = 'default') {
  const d = $('#qo'), inp = $('#qoin');
  qo.loaded = false; qo.mode = mode;
  // Blur any focused trigger button so close() focus restoration never re-activates it.
  if (!d.open) { document.activeElement?.blur?.(); d.showModal(); }
  inp.value = prefix; inp.focus();
  qoRender();
  if (mode === 'default' && root && !prefix.startsWith('>')) await ensureQoFiles();
}
function qoRender() {
  const v = $('#qoin').value;
  let rows = [], msg = '';
  if (qo.mode === 'branch') {
    const q = v.trim(), ql = q.toLowerCase();
    const remote = !!(gitState?.remote?.slug && ghHist.slug === gitState.remote.slug && ghHist.branches);
    const list = remote ? ghHist.branches.map(b => b.name) : gitState?.branches || [];
    rows = list.filter(b => b.toLowerCase().includes(ql)).map(b => ({
      label: b === gitState.branch ? t(`${b} (current)`) : b,
      pos: [],
      run: () => (remote ? gitSwitchBranch(b).catch(fail) : gitCheckoutLocal(b)),
    }));
    if (q && !remote && !list.includes(q)) rows.push({ label: `+ Create branch "${q}"`, pos: [], run: () => gitCheckoutLocal(q) });
    if (!rows.length) msg = 'Type a branch name to create one.';
  } else if (qo.mode === 'theme') {
    const q = v.trim().toLowerCase();
    const list = [{ key: 'default', label: 'OpenIDE Obsidian (Default)' }, ...listAvailableThemes()];
    rows = list.filter(t => !q || t.label.toLowerCase().includes(q)).map(t => ({
      label: activeThemeKey === t.key ? `${t.label} (current)` : t.label,
      pos: [],
      run: () => (t.key === 'default' ? restoreDefaultTheme(true) : applyThemeByKey(t.key, true)),
    }));
    if (!rows.length) msg = 'No matching color themes installed.';
  } else if (qo.mode === 'list') {
    const q = v.trim().toLowerCase();
    rows = (qo.listItems || []).filter(r => !q || r.label.toLowerCase().includes(q)).map(r => ({ ...r, pos: [] }));
    if (!rows.length) msg = 'No matching entries';
  } else if (v.startsWith('>')) {
    const q = v.slice(1).trim().toLowerCase();
    rows = COMMANDS().map(c => { const label = t(c.label); return { ...c, label, m: !q ? { score: 0, pos: [] } : fuzzy(q, label) || (label !== c.label && fuzzy(q, c.label) ? { score: 0, pos: [] } : null) }; }).filter(c => c.m)
      .sort((a, b) => b.m.score - a.m.score).map(c => ({ ...c, pos: c.m.pos }));
    if (!rows.length) msg = 'No matching commands';
  } else if (!root) msg = 'Open a folder to search its files.';
  else {
    if (!qo.loaded) ensureQoFiles();
    const q = v.trim().toLowerCase().replace(/\\/g, '/');
    if (!q) {
      const rec = recent.filter(r => tabs.has(r) || qo.files.includes(r));
      rows = [...new Set([...rec, ...qo.files])].slice(0, 50).map((file, i) => ({ file, pos: [], sep: i === 0 && rec.length ? 'recently opened' : i === rec.length && rec.length ? 'files' : '' }));
    } else {
      for (const file of qo.files) {
        const off = file.length - base(file).length;
        let m = fuzzy(q, base(file));
        if (m) { m.score += 20; m.pos = m.pos.map(p => p + off); } else m = fuzzy(q, file); // prefer hits in the file name
        if (m) rows.push({ file, pos: m.pos, score: m.score - file.length * 0.01 });
      }
      rows = rows.sort((a, b) => b.score - a.score).slice(0, 50);
      if (!rows.length) msg = qo.loading ? 'Loading files…' : 'No matching results';
    }
    if (qo.truncated && !msg) msg = 'Only the first 20,000 files are searched.';
  }
  qo.items = rows;
  $('#qolist').replaceChildren(...rows.flatMap((r, k) => {
    const row = el('div', 'qi'); row.setAttribute('role', 'option');
    if (r.file) {
      const name = base(r.file), off = r.file.length - name.length;
      row.append(fileIcon(name), hl(name, r.pos.filter(p => p >= off).map(p => p - off)), el('span', 'qdesc', r.file.slice(0, Math.max(0, off - 1))));
    } else {
      row.append(hl(r.label, r.pos));
      if (r.key) { const kk = el('span', 'qk'); kk.append(...keyCaps(r.key)); row.append(kk); }
    }
    row.onclick = () => qoPick(k);
    row.onmousemove = () => { if (qo.active !== k) qoSetActive(k); };
    return r.sep ? [el('div', 'qsep', r.sep), row] : [row];
  }));
  qoSetActive(0);
  $('#qomsg').textContent = msg; $('#qomsg').hidden = !msg;
}
function qoSetActive(k) {
  qo.active = k;
  const rows = $$('#qolist .qi');
  rows.forEach((r, i) => r.classList.toggle('on', i === k));
  rows[k]?.scrollIntoView({ block: 'nearest' });
}
function qoClose() { if ($('#qo').open) $('#qo').close(); }
function qoPick(k) {
  const it = qo.items[k];
  if (!it) return;
  qoClose();
  if (it.file) openFile(it.file).catch(fail);
  else Promise.resolve().then(it.run).catch(fail);
}
$('#qoin').oninput = qoRender;
$('#qo').addEventListener('keydown', e => {
  if (composing(e)) return;
  const n = qo.items.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (n) qoSetActive((qo.active + (e.key === 'ArrowDown' ? 1 : -1) + n) % n); }
  else if (e.key === 'Enter') {
    e.preventDefault(); e.stopPropagation();
    const idx = qo.active;
    // Defer closing until after the current key event finishes so restored focus never triggers an opener button.
    setTimeout(() => qoPick(idx), 0);
  }
});
$('#qo').addEventListener('cancel', e => { e.preventDefault(); qoClose(); });
lightDismiss($('#qo'), qoClose);

// ---------- Source Control & GitHub (100% browser IndexedDB snapshots/commits; zero code uploaded to server) ----------
let gitState = null, gitCommits = [], gitSeq = 0, gitTimer = null;
const gitCollapsed = new Set();
function scheduleGitRefresh(delay = 150) {
  clearTimeout(gitTimer);
  gitTimer = setTimeout(() => refreshGit().catch(() => {}), delay);
}
function openGitView() { showView('git'); refreshGit(true).catch(fail); }
function parseGithubInput(raw) {
  const s = String(raw || '').trim().replace(/\/+$/, '').replace(/\.git$/i, '');
  let m = s.match(/^([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)$/);
  if (m) return `${m[1]}/${m[2]}`;
  m = s.match(/^https?:\/\/github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)(?:\/.*)?$/i)
    || s.match(/^git@github\.com:([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)$/i);
  if (m) return `${m[1]}/${m[2]}`;
  throw new Error('Enter a valid GitHub repository (owner/repo or https://github.com/owner/repo).');
}
async function refreshGit(forceFsa = false) {
  const seq = ++gitSeq, proj = activeProj();
  if (!proj) { gitState = null; gitCommits = []; renderGit(); return; }
  if (!proj.isRepo) {
    gitState = { isRepo: false, staged: [], unstaged: [], remote: proj.remote || null, branch: proj.branch || 'main', branches: proj.branches || [proj.branch || 'main'] };
    gitCommits = [];
    renderGit();
    return;
  }
  const stagedSet = new Set(proj.staged || []), staged = [], unstaged = [];
  if (proj.kind !== 'fsa') {
    const fileMeta = await ensureProjIndex(proj);
    const snapMeta = proj.snapMeta || {};
    for (const [rel, curEtag] of Object.entries(fileMeta)) {
      const baseEtag = snapMeta[rel];
      if (!baseEtag) (stagedSet.has(rel) ? staged : unstaged).push({ path: rel, status: 'A', untracked: true });
      else if (curEtag !== baseEtag) (stagedSet.has(rel) ? staged : unstaged).push({ path: rel, status: 'M', untracked: false });
    }
    for (const rel of Object.keys(snapMeta)) {
      if (!(rel in fileMeta)) (stagedSet.has(rel) ? staged : unstaged).push({ path: rel, status: 'D', untracked: false });
    }
  } else {
    // Avoid expensive host-disk FSA traversal unless Source Control is visible or explicitly refreshed
    const gitVisible = !homeOn && shown.side && prefs.view === 'git';
    if (!forceFsa && !gitVisible) {
      gitState = { isRepo: true, branch: proj.branch || 'main', branches: proj.branches || [proj.branch || 'main'], remote: proj.remote || null, staged: [], unstaged: [], ahead: 0, behind: 0 };
      gitCommits = proj.commits || [];
      renderGit();
      return;
    }
    const snapMeta = proj.snapMeta || {};
    const { files } = await vfsAllFiles(proj, { skipHeavy: true, limit: 15000 });
    proj._fsaMeta ??= new Map();
    const seen = new Set();
    for (let i = 0; i < files.length; i++) {
      if (i > 0 && i % 25 === 0) await new Promise(r => setTimeout(r, 0));
      const rel = files[i];
      seen.add(rel);
      try {
        await ensureFsaPerm(proj.handle, false);
        const { parent, name } = await fsaResolveParent(proj.handle, rel, false);
        const f = await (await parent.getFileHandle(name)).getFile();
        let entry = proj._fsaMeta.get(rel);
        if (!entry || entry.size !== f.size || entry.mtime !== f.lastModified) {
          const u8 = new Uint8Array(await f.arrayBuffer());
          entry = { size: f.size, mtime: f.lastModified, etag: bytesEtag(u8) };
          proj._fsaMeta.set(rel, entry);
        }
        const baseEtag = snapMeta[rel];
        if (!baseEtag) (stagedSet.has(rel) ? staged : unstaged).push({ path: rel, status: 'A', untracked: true });
        else if (entry.etag !== baseEtag) (stagedSet.has(rel) ? staged : unstaged).push({ path: rel, status: 'M', untracked: false });
      } catch {}
    }
    for (const rel of Object.keys(snapMeta)) {
      if (!seen.has(rel)) (stagedSet.has(rel) ? staged : unstaged).push({ path: rel, status: 'D', untracked: false });
    }
  }
  if (seq !== gitSeq) return;
  gitState = {
    isRepo: true, branch: proj.branch || 'main', branches: [...new Set([proj.branch || 'main', ...(proj.branches || [])])],
    remote: proj.remote || null, staged, unstaged, ahead: 0, behind: 0,
  };
  gitCommits = proj.commits || [];
  renderGit();
}
function renderGit() {
  const st = gitState;
  const total = st?.isRepo ? st.staged.length + st.unstaged.length : 0;
  $('#git-badge').textContent = total > 99 ? '99+' : String(total);
  $('#git-badge').hidden = !total;
  $('#st-git').hidden = !(st?.isRepo);
  $('#st-sync').hidden = !root;
  if (st?.isRepo) $('#st-git').replaceChildren(icon('source-control'), el('span', '', st.branch || 'main'));
  if (root) {
    $('#st-sync').replaceChildren(icon('desktop-download'), el('span', '', 'Export ZIP'));
    $('#st-sync').title = 'Download browser workspace as ZIP (zero server upload)';
  }
  const isRepo = !!st?.isRepo;
  $('#git-empty').hidden = isRepo;
  $('#git-repo').hidden = !isRepo;
  $('#git-init-btn').hidden = !root || isRepo;
  $('#git-empty-msg').textContent = root ? 'Initialize a browser-local snapshot repository to track changes and diffs.' : 'Open a folder locally or clone a repository directly from GitHub into your browser.';
  if (!isRepo) return;

  const rem = $('#git-remote');
  if (st.remote) {
    const label = st.remote.slug || st.remote.url;
    const link = st.remote.githubUrl ? el('a', '', label) : el('span', '', label);
    if (st.remote.githubUrl) { link.href = st.remote.githubUrl; link.target = '_blank'; link.rel = 'noopener'; link.title = 'Open on GitHub'; }
    const edBtn = el('button', 'ibtn'); edBtn.title = 'Change GitHub Remote…'; edBtn.append(icon('edit'));
    edBtn.onclick = () => openGitDialog('remote');
    rem.replaceChildren(icon(st.remote.githubUrl ? 'github' : 'cloud'), link, el('span', 'sp'), edBtn);
  } else {
    const conn = el('button', 'btn sec'); conn.style.height = '22px'; conn.style.fontSize = '12px'; conn.textContent = 'Connect GitHub Remote…';
    conn.onclick = () => openGitDialog('remote');
    rem.replaceChildren(icon('github'), el('span', 'sp'), conn);
  }

  const list = $('#git-list');
  const sec = (id, title, count, actions, body) => {
    const open = !gitCollapsed.has(id);
    const head = el('div', 'section git-sec');
    head.append(icon(open ? 'chevron-down' : 'chevron-right'), typeof title === 'string' ? el('span', '', title) : title, ...(count == null ? [] : [el('span', 'badge', String(count))]));
    if (actions.length) {
      const box = el('span', 'actions');
      for (const a of actions) {
        const b = el('button', 'ibtn'); b.title = a.title; b.append(icon(a.icon));
        b.onclick = e => { e.stopPropagation(); a.run(); };
        box.append(b);
      }
      head.append(box);
    }
    head.onclick = () => { open ? gitCollapsed.add(id) : gitCollapsed.delete(id); renderGit(); };
    return open ? [head, ...body] : [head];
  };
  const itemRow = (it, staged) => {
    const row = el('div', 'row git-row');
    row.title = it.path;
    const dir = it.path.includes('/') ? it.path.split('/').slice(0, -1).join('/') : '';
    const act = el('span', 'actions');
    const mk = (ic, title, fn) => {
      const b = el('button', 'ibtn'); b.title = title; b.append(icon(ic));
      b.onclick = e => { e.stopPropagation(); fn(); };
      act.append(b);
    };
    if (it.status !== 'D') mk('go-to-file', 'Open File', () => openFile(it.path).catch(fail));
    if (staged) mk('remove', 'Unstage Changes', () => gitStagePaths([it.path], false));
    else {
      mk('discard', 'Discard Changes', () => gitDiscard(it));
      mk('add', 'Stage Changes', () => gitStagePaths([it.path], true));
    }
    const stTag = el('span', `git-st ${it.status}`, it.status);
    row.append(fileIcon(base(it.path)), el('span', 'name', base(it.path)), ...(dir ? [el('span', 'qdesc', dir)] : []), act, stTag);
    row.onclick = () => openGitDiff(it.path, staged).catch(fail);
    return row;
  };
  const nodes = [];
  if (st.staged.length) {
    nodes.push(...sec('staged', 'Staged Changes', st.staged.length, [
      { icon: 'remove', title: 'Unstage All Changes', run: () => gitStagePaths(null, false) },
    ], st.staged.map(it => itemRow(it, true))));
  }
  nodes.push(...sec('changes', 'Changes', st.unstaged.length, st.unstaged.length ? [
    { icon: 'add', title: 'Stage All Changes', run: () => gitStagePaths(null, true) },
  ] : [], st.unstaged.length ? st.unstaged.map(it => itemRow(it, false)) : [el('div', 'sr-msg', 'No uncommitted changes.')]));
  if (st.remote?.slug) nodes.push(...ghHistorySections(st, sec));
  if (gitCommits.length) {
    nodes.push(...sec('commits', 'Local Snapshot History', gitCommits.length, [], gitCommits.map(c => {
      const r = el('div', 'row git-commit');
      r.title = `${c.hash}\n${c.author} · ${c.date}\n${c.subject}`;
      const info = el('div', 'git-cinfo');
      info.append(el('div', 'git-cmsg', c.subject), el('div', 'git-cmeta', `${c.author} · ${c.date}`));
      r.append(el('span', 'git-hash', c.shortHash), info);
      return r;
    })));
  }
  list.replaceChildren(...nodes);
  // Branches/commits come from the GitHub API: fetch once the Source Control view is actually on screen
  if (st.remote?.slug && ghHist.slug !== st.remote.slug && !$('#view-git').hidden) ghLoadBranches().catch(() => {});
}

// ---------- GitHub branches & commit history (read-only, straight from api.github.com) ----------
// Public repos work without a token (60 requests/hour per IP); private ones use the browser-held token.
const ghHist = { slug: '', defaultBranch: '', branches: null, branchErr: '', needsToken: false, loadingB: false, viewBranch: '', commits: [], page: 0, more: false, loadingC: false, commitErr: '', cseq: 0 };
const ghRepoPath = slug => { const [o, n] = slug.split('/'); return `/repos/${enc(o)}/${enc(n)}`; };
function relTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  try {
    const rtf = new Intl.RelativeTimeFormat(LANG === 'zh' ? 'zh-CN' : 'en', { numeric: 'auto' });
    let v = (Date.now() - d) / 1000;
    for (const [k, u] of [[60, 'second'], [60, 'minute'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year']]) {
      if (Math.abs(v) < k) return rtf.format(-Math.round(v), u);
      v /= k;
    }
  } catch { /* old browser */ }
  return d.toLocaleString();
}
async function ghLoadBranches(force = false) {
  const slug = gitState?.remote?.slug;
  if (!slug || (ghHist.loadingB && ghHist.slug === slug)) return;
  if (ghHist.slug !== slug) Object.assign(ghHist, { slug, defaultBranch: '', branches: null, branchErr: '', needsToken: false, viewBranch: '', commits: [], page: 0, more: false, commitErr: '' });
  else if (ghHist.branches && !force) return;
  ghHist.loadingB = true; ghHist.branchErr = ''; renderGit();
  try {
    const repo = await (await ghFetch(ghRepoPath(slug))).json();
    const list = [];
    for (let page = 1; page <= 5; page++) {
      const arr = await (await ghFetch(`${ghRepoPath(slug)}/branches?per_page=100&page=${page}`)).json();
      list.push(...arr.map(b => ({ name: b.name, sha: b.commit?.sha || '', protected: !!b.protected })));
      if (arr.length < 100) break;
    }
    if (ghHist.slug !== slug) return;
    ghHist.defaultBranch = repo.default_branch || '';
    const cur = gitState?.branch, rank = b => b.name === ghHist.defaultBranch ? 0 : b.name === cur ? 1 : 2;
    ghHist.branches = list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    if (!ghHist.viewBranch || !list.some(b => b.name === ghHist.viewBranch)) ghHist.viewBranch = list.some(b => b.name === cur) ? cur : ghHist.defaultBranch || list[0]?.name || '';
  } catch (e) {
    if (ghHist.slug !== slug) return;
    ghHist.needsToken = !ghToken && (e.status === 404 || e.status === 401);
    ghHist.branchErr = ghHist.needsToken ? 'Private repository: add a GitHub access token to see its branches and commits.' : e.message;
  } finally {
    if (ghHist.slug === slug) ghHist.loadingB = false;
  }
  renderGit();
  if (ghHist.viewBranch) await ghLoadCommits(true);
}
async function ghLoadCommits(reset = false) {
  const { slug, viewBranch } = ghHist;
  if (!slug || !viewBranch) return;
  if (reset) Object.assign(ghHist, { commits: [], page: 0, more: false });
  const seq = ++ghHist.cseq;
  ghHist.loadingC = true; ghHist.commitErr = ''; renderGit();
  try {
    const arr = await (await ghFetch(`${ghRepoPath(slug)}/commits?sha=${enc(viewBranch)}&per_page=30&page=${ghHist.page + 1}`)).json();
    if (seq !== ghHist.cseq) return;
    ghHist.commits.push(...arr); ghHist.page++; ghHist.more = arr.length === 30;
  } catch (e) {
    if (seq === ghHist.cseq) ghHist.commitErr = e.message;
  }
  if (seq !== ghHist.cseq) return;
  ghHist.loadingC = false; renderGit();
}
function ghHistorySections(st, sec) {
  const h = ghHist, cur = st.branch, proj = activeProj();
  const note = (text, cls = '') => el('div', 'sr-msg gh-note ' + cls, text);
  const errBody = msg => {
    const box = el('div', 'gh-err'); box.append(note(msg, 'err'));
    if (h.needsToken || /token/i.test(msg)) {
      const b = el('button', 'btn sec', 'Add Access Token…');
      b.onclick = () => { openGitDialog('remote'); $('#gd-auth').open = true; $('#gd-tok').focus(); };
      box.append(b);
    }
    return [box];
  };
  let bBody;
  if (h.branchErr) bBody = errBody(h.branchErr);
  else if (!h.branches) bBody = [note('Loading branches…')];
  else bBody = h.branches.map(b => {
    const r = el('div', 'row git-row gh-branch' + (b.name === h.viewBranch ? ' sel' : ''));
    r.title = 'Show history of this branch';
    r.append(icon(b.name === cur ? 'check' : 'git-branch'), el('span', 'name', b.name));
    if (b.name === h.defaultBranch) r.append(el('span', 'gh-tag', 'default'));
    if (b.name === cur) r.append(el('span', 'gh-tag cur', 'current'));
    if (b.protected) r.append(icon('lock', 'gh-lock'));
    if (b.name !== cur && proj?.kind !== 'fsa') {
      const act = el('span', 'actions'), sw = el('button', 'ibtn'); sw.title = 'Switch to Branch'; sw.append(icon('arrow-swap'));
      sw.onclick = e => { e.stopPropagation(); gitSwitchBranch(b.name).catch(fail); };
      act.append(sw); r.append(act);
    }
    r.onclick = () => { if (h.viewBranch === b.name) return; h.viewBranch = b.name; gitCollapsed.delete('gh-commits'); ghLoadCommits(true).catch(() => {}); };
    return r;
  });
  const out = sec('gh-branches', 'Branches', h.branches ? h.branches.length : null,
    [{ icon: 'refresh', title: 'Refresh Branches & Commits', run: () => ghLoadBranches(true).catch(() => {}) }], bBody);
  if (h.branchErr || !h.branches) return out;
  const title = el('span', 'gh-ctitle'); title.append(el('span', '', 'Commits'), el('span', 'gh-tag cur gh-user', h.viewBranch));
  const cBody = h.commits.map(c => {
    const r = el('div', 'row git-commit gh-commit');
    const [subject] = (c.commit?.message || '').split('\n');
    const who = c.author?.login || c.commit?.author?.name || '';
    r.title = 'View commit details';
    const info = el('div', 'git-cinfo'), meta = el('div', 'git-cmeta gh-user');
    meta.textContent = `${who} · ${relTime(c.commit?.author?.date || c.commit?.committer?.date)}`;
    info.append(el('div', 'git-cmsg gh-user', subject), meta);
    r.append(el('span', 'git-hash', c.sha.slice(0, 7)), info, icon('chevron-right', 'gh-go'));
    r.onclick = () => openCommitView(h.slug, c.sha).catch(fail);
    return r;
  });
  if (h.commitErr) cBody.push(...errBody(h.commitErr));
  else if (h.loadingC) cBody.push(note('Loading commits…'));
  else if (!h.commits.length) cBody.push(note('No commits on this branch.'));
  else if (h.more) { const b = el('button', 'btn sec gh-more', 'Load more commits'); b.onclick = () => ghLoadCommits().catch(() => {}); cBody.push(b); }
  return [...out, ...sec('gh-commits', title, null, [], cBody)];
}
// Full-screen commit details in the editor area: message, author, parents, stats and a colored diff per file.
async function openCommitView(slug, sha) {
  showHome(false);
  if (isMobileUI() && mobDrawer) { mobDrawer = false; layout(); }
  closeCompare();
  const box = el('div', 'commit-view'); box.id = 'diff';
  const x = el('button', 'ibtn'); x.title = 'Close'; x.append(icon('close')); x.onclick = () => closeCompare();
  const gh = el('a', 'btn sec cv-gh'); gh.href = `https://github.com/${slug}/commit/${sha}`; gh.target = '_blank'; gh.rel = 'noopener'; gh.append(icon('github'), el('span', '', 'Open on GitHub'));
  const bar = el('div', 'dbar');
  bar.append(icon('git-commit'), el('span', 'dt', `Commit ${sha.slice(0, 7)}`), el('span', 'sp'), gh, x);
  const body = el('div', 'cv-body');
  body.append(el('div', 'sr-msg', 'Loading commit…'));
  box.append(bar, body); $('#edwrap').append(box);
  diff = { kind: 'commit', rel: null, de: { dispose() {} }, box };
  try {
    const c = await (await ghFetch(`${ghRepoPath(slug)}/commits/${enc(sha)}`)).json();
    if (diff?.box === box) renderCommitDetail(body, c, slug);
  } catch (e) {
    if (diff?.box === box) body.replaceChildren(el('div', 'sr-msg err', e.message));
  }
}
function renderCommitDetail(body, c, slug) {
  const [subject, ...rest] = (c.commit?.message || '').split('\n');
  const msgRest = rest.join('\n').trim();
  const head = el('div', 'cv-head');
  head.append(el('h2', 'cv-subj gh-user', subject));
  if (msgRest) head.append(el('pre', 'cv-msg', msgRest));
  const who = el('div', 'cv-who gh-user');
  if (c.author?.avatar_url) { const img = el('img', 'cv-av'); img.src = c.author.avatar_url + '&s=48'; img.alt = ''; img.referrerPolicy = 'no-referrer'; who.append(img); }
  const date = c.commit?.author?.date || c.commit?.committer?.date;
  const when = el('span', 'cv-when', relTime(date)); when.title = new Date(date).toLocaleString();
  who.append(el('b', '', c.commit?.author?.name || c.author?.login || ''), ...(c.author?.login && c.author.login !== c.commit?.author?.name ? [el('span', 'cv-dim', '@' + c.author.login)] : []), when);
  head.append(who);
  const shaRow = el('div', 'cv-sha');
  const cp = el('button', 'ibtn'); cp.title = 'Copy SHA'; cp.append(icon('copy')); cp.onclick = () => copy(c.sha);
  shaRow.append(el('code', '', c.sha), cp);
  if (c.parents?.length) {
    const par = el('span', 'cv-parents'); par.append(el('span', 'cv-dim', 'Parents'));
    for (const p of c.parents) { const a = el('button', 'cv-link', p.sha.slice(0, 7)); a.onclick = () => openCommitView(slug, p.sha).catch(fail); par.append(a); }
    shaRow.append(par);
  }
  head.append(shaRow);
  const files = c.files || [];
  const stats = el('div', 'cv-stats');
  stats.append(el('span', '', `${files.length} ${files.length === 1 ? 'file' : 'files'} changed`), el('span', 'cv-add', '+' + (c.stats?.additions ?? 0)), el('span', 'cv-del', '−' + (c.stats?.deletions ?? 0)));
  head.append(stats);
  const ST = { added: 'A', removed: 'D', modified: 'M', renamed: 'R', copied: 'C', changed: 'M', unchanged: 'U' };
  const fileNodes = files.map((f, i) => {
    const d = el('details', 'cv-file');
    const lines = f.patch ? f.patch.split('\n') : [];
    d.open = i < 8 && lines.length < 400;
    const sum = el('summary');
    const name = el('span', 'cv-fname gh-user'), slash = f.filename.lastIndexOf('/');
    if (slash > 0) name.append(el('span', 'cv-dim', f.filename.slice(0, slash + 1)));
    name.append(f.filename.slice(slash + 1));
    const st = ST[f.status] || 'M';
    sum.append(icon('chevron-right', 'cv-tw'), el('span', `git-st ${st}`, st), name, el('span', 'cv-add', '+' + f.additions), el('span', 'cv-del', '−' + f.deletions));
    d.append(sum);
    if (f.previous_filename) d.append(el('div', 'cv-ren cv-dim gh-user', `${f.previous_filename} → ${f.filename}`));
    if (!f.patch) { d.append(el('div', 'sr-msg', 'Binary file or diff too large to display.')); return d; }
    const pre = el('div', 'cv-patch'), MAX = 3000;
    // Render lazily on first open so commits touching hundreds of files stay fast
    const fill = () => {
      if (pre.childElementCount) return;
      const frag = document.createDocumentFragment();
      for (const ln of lines.slice(0, MAX)) frag.append(el('div', ln.startsWith('@@') ? 'h' : ln[0] === '+' ? 'a' : ln[0] === '-' ? 'd' : '', ln || ' '));
      pre.append(frag);
      if (lines.length > MAX) d.append(el('div', 'sr-msg', 'Diff truncated (too many lines).'));
    };
    d.addEventListener('toggle', () => { if (d.open) fill(); });
    if (d.open) fill();
    d.append(pre);
    return d;
  });
  body.replaceChildren(head, ...fileNodes);
}
async function gitSwitchBranch(branch) {
  const proj = activeProj();
  if (!proj?.remote?.slug) return toast('Connect a GitHub remote first.', 'warn');
  if (proj.kind === 'fsa') return toast("Switching branches would overwrite files in your local folder. Use git in that folder instead; you can still browse this branch's commits here.", 'warn');
  const dirty = (gitState?.staged.length || 0) + (gitState?.unstaged.length || 0) + [...tabs.values()].filter(isDirty).length;
  if (dirty) {
    const v = await modal(t(`Switch to branch "${branch}"?`), t('Uncommitted changes in this browser workspace will be replaced by the files of that branch.'),
      [{ label: t('Cancel'), value: 'cancel' }, { label: t('Switch Branch'), value: 'ok', primary: true }]);
    if (v !== 'ok') return;
  }
  const old = proj.branch;
  proj.branch = branch;
  try { await gitPullFromGithub({ quiet: true }); } catch (e) { proj.branch = old; throw e; }
  proj.branches = [...new Set([branch, ...(proj.branches || [])])];
  await dbPut('projects', serializeProjMeta(proj));
  ghHist.viewBranch = branch;
  await refreshGit(true);
  ghLoadCommits(true).catch(() => {});
  toast(`Switched to branch ${branch}.`);
}
async function openGitDiff(rel, staged) {
  showHome(false);
  if (isMobileUI() && mobDrawer) { mobDrawer = false; layout(); }
  const proj = activeProj();
  if (!proj) return;
  const snap = await dbGet('snapshots', fKey(proj.id, rel));
  let original = '', modified = '';
  try { const sb = await snapshotBytes(snap); if (sb) original = textDec.decode(sb); } catch {}
  try { modified = (await vfsReadFile(proj, rel)).text; } catch {}
  closeCompare();
  const u0 = monaco.Uri.file('/__git_orig__/' + rel), u1 = monaco.Uri.file('/__git_mod__/' + rel);
  monaco.editor.getModel(u0)?.dispose(); monaco.editor.getModel(u1)?.dispose();
  const orig = monaco.editor.createModel(original, undefined, u0);
  const mod = monaco.editor.createModel(modified, undefined, u1);
  const box = el('div'); box.id = 'diff';
  const openBtn = el('button', 'btn sec', 'Open File');
  openBtn.onclick = () => { closeCompare(); openFile(rel).catch(fail); };
  const stageBtn = el('button', 'btn', staged ? 'Unstage' : 'Stage');
  stageBtn.onclick = async () => { await gitStagePaths([rel], !staged); closeCompare(); };
  const x = el('button', 'ibtn'); x.title = 'Close'; x.append(icon('close')); x.onclick = () => closeCompare();
  const bar = el('div', 'dbar');
  bar.append(icon('git-compare'), el('span', 'dt', `${rel} (Browser Snapshot ↔ Working Tree)`), el('span', 'sp'), openBtn, stageBtn, x);
  const host = el('div', 'dhost');
  box.append(bar, host); $('#edwrap').append(box);
  const de = monaco.editor.createDiffEditor(host, { ...diffLayoutOpts(), automaticLayout: true, readOnly: true, originalEditable: false, fontFamily: editor.getRawOptions().fontFamily });
  de.setModel({ original: orig, modified: mod });
  diff = { kind: 'git', rel, staged, de, orig, mod, box };
}
async function gitStagePaths(paths, add = true) {
  const proj = activeProj();
  if (!proj || !gitState) return;
  const set = new Set(proj.staged || []);
  const targets = paths || (add ? gitState.unstaged.map(x => x.path) : gitState.staged.map(x => x.path));
  for (const p of targets) add ? set.add(p) : set.delete(p);
  proj.staged = [...set];
  await dbPut('projects', serializeProjMeta(proj));
  await refreshGit();
}
async function gitInitRepo() {
  const proj = activeProj();
  if (!proj) return toast('Open a folder first.', 'warn');
  const { files } = await vfsAllFiles(proj, { skipHeavy: true, limit: 15000 });
  const snapMeta = {};
  await dbDelByProj('snapshots', proj.id);
  for (let i = 0; i < files.length; i += 24) {
    const batch = files.slice(i, i + 24);
    await Promise.all(batch.map(async rel => {
      try {
        const content = await vfsReadBytes(proj, rel);
        snapMeta[rel] = bytesEtag(content);
        await snapshotPut(proj.id, rel, content); // manifest entry -> shared blob
      } catch {}
    }));
  }
  gcBlobs();
  proj.isRepo = true; proj.branch = proj.branch || 'main'; proj.staged = []; proj.commits = proj.commits || []; proj.snapMeta = snapMeta;
  await dbPut('projects', serializeProjMeta(proj));
  toast('Initialized browser-local snapshot repository.');
  await refreshGit(true);
}
async function gitDiscard(it) {
  const proj = activeProj();
  if (!proj) return;
  const msg = it.untracked ? `Delete untracked file '${base(it.path)}'?` : `Discard changes in '${base(it.path)}'?`;
  const r = await modal(msg, 'This reverts it to your browser snapshot baseline.',
    [{ label: it.untracked ? 'Delete' : 'Discard Changes', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel' }]);
  if (r !== 'ok') return;
  if (it.untracked) await vfsDelete(proj, it.path);
  else {
    const snap = await dbGet('snapshots', fKey(proj.id, it.path));
    const sb = await snapshotBytes(snap);
    if (sb) await vfsWriteFile(proj, it.path, sb, { force: true });
  }
  await renderTree().catch(() => {});
  await reloadClean();
  await refreshGit();
}
async function gitCommit() {
  const proj = activeProj();
  if (!proj?.isRepo) return;
  const message = $('#git-msg').value.trim();
  if (!message) { $('#git-msg').focus(); return toast('Enter a commit message first.', 'warn'); }
  const targets = (proj.staged?.length ? proj.staged : gitState.unstaged.map(x => x.path));
  if (!targets.length) return toast('No changes to commit.', 'warn');
  proj.snapMeta ??= {};
  for (const rel of targets) {
    try {
      const b = await vfsReadBytes(proj, rel), etag = bytesEtag(b);
      proj.snapMeta[rel] = etag;
      await snapshotPut(proj.id, rel, b); // unchanged files reuse their blob: incremental
    } catch {
      delete proj.snapMeta[rel];
      await dbDel('snapshots', fKey(proj.id, rel));
    }
  }
  const hash = safeUid(12);
  proj.staged = [];
  proj.commits = [{ hash, shortHash: hash.slice(0, 7), subject: message, author: 'Browser-Local', date: new Date().toLocaleString() }, ...(proj.commits || [])].slice(0, 50);
  await dbPut('projects', serializeProjMeta(proj));
  $('#git-msg').value = '';
  toast('Committed snapshot locally in browser IndexedDB.');
  await refreshGit(true);
}
async function gitCheckoutLocal(branch) {
  const proj = activeProj();
  if (!proj) return;
  proj.branch = branch;
  proj.branches = [...new Set([...(proj.branches || ['main']), branch])];
  await dbPut('projects', serializeProjMeta(proj));
  toast(`Switched local branch label to ${branch}.`);
  await refreshGit();
}
async function exportProjectZip() {
  const proj = activeProj();
  if (!proj) return toast('Open a project first.', 'warn');
  const { files } = await vfsAllFiles(proj, { skipHeavy: true, limit: 20000 });
  const entries = [];
  for (const rel of files) {
    try { entries.push([rel, await vfsReadBytes(proj, rel)]); } catch {}
  }
  const blob = buildZipBlob(entries);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${proj.name || 'workspace'}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(`Exported ${entries.length} files to ${proj.name}.zip.`);
}
// ---------- GitHub access token: private repositories ----------
// Private repos are read straight from the GitHub API by this browser with the user's own token. The token is
// kept ONLY in sessionStorage (cleared when the tab closes) and is sent only to api.github.com, never to the
// WebIDE server. It is deliberately never written to localStorage: persistent storage would outlive the
// session and stay readable for the whole origin lifetime, while sessionStorage bounds the exposure window.
// Any legacy localStorage copy from older versions is deleted on sight below.
const GH_API = 'https://api.github.com';
let ghToken = '';
try { localStorage.removeItem('webideGhToken'); ghToken = sessionStorage.webideGhToken || ''; } catch { /* storage unavailable */ }
function setGhToken(tok) {
  ghToken = String(tok || '').trim();
  try {
    localStorage.removeItem('webideGhToken'); sessionStorage.removeItem('webideGhToken');
    if (ghToken) sessionStorage.webideGhToken = ghToken;
  } catch { /* storage unavailable: token lives in memory for this page only */ }
}
const ghTokenHint = () => ghToken ? '••••' + ghToken.slice(-4) : '';
async function ghFetch(path, { accept = 'application/vnd.github+json', method = 'GET', body } = {}) {
  let r;
  try {
    r = await fetch(GH_API + path, { method, body, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { accept, ...(ghToken && { authorization: 'Bearer ' + ghToken }), ...(body && { 'content-type': 'application/json' }) } });
  } catch { throw new Error('Could not reach api.github.com from this browser (offline, or blocked by a network filter).'); }
  if (r.ok) return r;
  let msg = '';
  try { msg = (await r.json()).message || ''; } catch { /* non-JSON error body */ }
  const rate = r.headers.get('x-ratelimit-remaining') === '0';
  throw Object.assign(new Error(
    r.status === 401 ? 'GitHub rejected the access token (401: invalid or expired). Enter a new token in the GitHub dialog.'
    : r.status === 404 ? 'Repository or branch not found on GitHub (404). Check the name, and that the token has read access to this repository (fine-grained token: Contents + Metadata, read-only).'
    : rate ? (ghToken ? 'GitHub API rate limit reached for this token. Try again later.' : 'GitHub API rate limit reached (60 requests/hour without a token). Add an access token to raise it.')
    : r.status === 403 ? `GitHub refused the request (403): ${msg || 'missing permission'}${/SAML|SSO/i.test(msg) ? ' — authorize the token for your organization (SAML SSO) on GitHub.' : ''}`
    : `GitHub API error ${r.status}${msg ? ': ' + msg : ''}`), { status: r.status });
}
// Runs fn over items with at most n in flight.
async function runPool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}
// Branch snapshot via the API: 3 small calls (repo, branch, recursive tree), then file contents in GraphQL batches
// (~1 request per 80 files instead of one per file). Binary or oversized blobs, or tokens without GraphQL access,
// fall back to the REST raw-blob endpoint.
async function ghApiSnapshot(slug, branch, progress = () => {}) {
  const [owner, name] = slug.split('/');
  const repoPath = `/repos/${enc(owner)}/${enc(name)}`;
  const repo = await (await ghFetch(repoPath)).json();
  const ref = branch || repo.default_branch || 'main';
  const br = await (await ghFetch(`${repoPath}/branches/${ref.split('/').map(enc).join('/')}`)).json();
  const tree = await (await ghFetch(`${repoPath}/git/trees/${br.commit.commit.tree.sha}?recursive=1`)).json();
  const MAX_FILE = 5 * 1024 * 1024, MAX_TOTAL = 80 * 1024 * 1024, MAX_FILES = 20000;
  const files = [];
  let total = 0, skipped = 0;
  for (const t of tree.tree || []) {
    if (t.type !== 'blob' || t.path.split('/').some(seg => HIDDEN.has(seg))) continue;
    if (t.size > MAX_FILE || total + t.size > MAX_TOTAL || files.length >= MAX_FILES) { skipped++; continue; }
    total += t.size; files.push(t);
  }
  const uniq = [...new Map(files.map(f => [f.sha, f])).values()], content = new Map(), rest = [];
  const batches = [];
  for (let cur = [], bytes = 0, k = 0; k <= uniq.length; k++) {
    const f = uniq[k];
    if (cur.length && (!f || cur.length >= 80 || bytes + f.size > 3e6)) { batches.push(cur); cur = []; bytes = 0; }
    if (f) { cur.push(f); bytes += f.size; }
  }
  let useGql = true, done = 0;
  const tick = n => { done += n; progress(done, uniq.length); };
  await runPool(batches, 3, async batch => {
    if (useGql) {
      try {
        const query = `query($o:String!,$n:String!){repository(owner:$o,name:$n){${batch.map((f, i) => `b${i}:object(oid:"${f.sha}"){...on Blob{text isBinary}}`).join(' ')}}}`;
        const d = await (await ghFetch('/graphql', { method: 'POST', body: JSON.stringify({ query, variables: { o: owner, n: name } }) })).json();
        const data = d.data?.repository;
        if (!data) throw new Error(d.errors?.[0]?.message || 'GraphQL returned no data');
        batch.forEach((f, i) => { const b = data['b' + i]; if (b && !b.isBinary && typeof b.text === 'string') content.set(f.sha, textEnc.encode(b.text)); else rest.push(f); });
        return tick(batch.filter(f => content.has(f.sha)).length);
      } catch (e) {
        if (e.status === 401) throw e;
        useGql = false; // e.g. a token GraphQL won't accept: REST still works
      }
    }
    rest.push(...batch.filter(f => !content.has(f.sha)));
  });
  await runPool(rest, 8, async f => {
    const r = await ghFetch(`${repoPath}/git/blobs/${f.sha}`, { accept: 'application/vnd.github.raw+json' });
    content.set(f.sha, new Uint8Array(await r.arrayBuffer()));
    tick(1);
  });
  return {
    meta: { slug: repo.full_name || slug, defaultBranch: repo.default_branch || 'main', htmlUrl: repo.html_url || `https://github.com/${slug}`, private: !!repo.private },
    branch: ref, entries: files.map(f => [f.path, content.get(f.sha)]), skipped: skipped + (tree.truncated ? 1 : 0), truncated: !!tree.truncated,
  };
}
// Public repos without a token keep using the server's stateless ZIP pass-through; with a token everything goes
// browser → api.github.com directly.
async function fetchGithubSnapshot(slug, branch = '', progress) {
  if (ghToken) return ghApiSnapshot(slug, branch, progress);
  const metaP = getJSON('/proxy/github/meta?repo=' + enc(slug)).catch(e => { if (e.status === 404) throw e; return { slug, defaultBranch: branch || 'main', htmlUrl: `https://github.com/${slug}` }; });
  const zipP = api(`/proxy/github/archive?repo=${enc(slug)}&branch=${enc(branch)}`);
  let meta, r;
  try { [meta, r] = await Promise.all([metaP, zipP]); } catch (e) {
    if (e.status === 404 || /Upstream returned 404/.test(e.message)) throw Object.assign(new Error(`${slug}${branch ? ' @ ' + branch : ''} was not found as a public repository. If it is private, add a GitHub access token in this dialog.`), { status: 404, needsToken: true });
    throw e;
  }
  const zipEntries = await unzipBytes(await r.arrayBuffer(), {
    filter: name => {
      const slash = name.indexOf('/'), rel = slash >= 0 ? name.slice(slash + 1) : name;
      return !!rel && !rel.split('/').some(s => HIDDEN.has(s));
    },
  });
  const entries = [];
  for (const [rawPath, bytes] of zipEntries) {
    const slash = rawPath.indexOf('/'), rel = slash >= 0 ? rawPath.slice(slash + 1) : rawPath;
    if (rel) entries.push([rel, bytes]);
  }
  return { meta, branch: branch || meta.defaultBranch || 'main', entries, skipped: 0 };
}
async function cloneGithubIntoBrowser(slug, branch = '', progress) {
  const { meta, branch: ref, entries, skipped } = await fetchGithubSnapshot(slug, branch, progress);
  const id = 'gh:' + slug + ':' + safeUid(6);
  const repoName = slug.split('/').pop();
  const fileRecs = [], fileMeta = {}, snapMeta = {}, now = Date.now();
  for (const [rel, bytes] of entries) {
    const etag = bytesEtag(bytes);
    fileMeta[rel] = etag; snapMeta[rel] = etag;
    fileRecs.push({ key: fKey(id, rel), projectId: id, path: rel, content: bytes, etag, mtime: now });
  }
  const proj = emptyProj(id, {
    name: repoName, kind: 'gh', isRepo: true, branch: ref,
    remote: { slug, url: `https://github.com/${slug}.git`, githubUrl: meta.htmlUrl || `https://github.com/${slug}`, private: !!meta.private },
    fileMeta, snapMeta,
  });
  await Promise.all([dbPutMany('files', fileRecs), dbPut('projects', serializeProjMeta(proj))]);
  // Snapshots as manifest entries over shared blobs (identical files stored once).
  for (let i = 0; i < entries.length; i += 24) {
    await Promise.all(entries.slice(i, i + 24).map(([rel, bytes]) => snapshotPut(id, rel, bytes)));
  }
  if (root) hibernateCurrent(root);
  projects.set(id, proj);
  root = id;
  await restoreProject(root);
  showView('explorer');
  toast(`Cloned ${meta.private ? 'private repo ' : ''}${slug} (${fileRecs.length} files) strictly into browser IndexedDB.${skipped ? ` ${skipped} oversized file(s) skipped.` : ''}`);
}
async function gitPullFromGithub({ quiet = false } = {}) {
  const proj = activeProj();
  if (!proj?.remote?.slug) return toast('Connect a GitHub remote first.', 'warn');
  const slug = proj.remote.slug;
  if (proj.remote.private && !ghToken) { openGitDialog('remote'); throw new Error(`${slug} is private: add a GitHub access token to pull.`); }
  const { entries } = await fetchGithubSnapshot(slug, proj.branch || '');
  const fileRecs = [], fileMeta = {}, snapMeta = {}, now = Date.now();
  for (const [rel, bytes] of entries) {
    const etag = bytesEtag(bytes);
    snapMeta[rel] = etag;
    if (proj.kind === 'fsa') {
      await vfsWriteFile(proj, rel, bytes, { force: true });
    } else {
      fileMeta[rel] = etag;
      fileRecs.push({ key: fKey(proj.id, rel), projectId: proj.id, path: rel, content: bytes, etag, mtime: now });
    }
  }
  if (proj.kind !== 'fsa') {
    proj.fileMeta = fileMeta; proj._fileCache = null;
    await dbDelByProj('files', proj.id);
    await dbPutMany('files', fileRecs);
  }
  proj.snapMeta = snapMeta;
  await Promise.all([dbDelByProj('snapshots', proj.id), dbPut('projects', serializeProjMeta(proj))]);
  // Manifest snapshots over shared blobs: files unchanged since last pull reuse their blob.
  for (let i = 0; i < entries.length; i += 24) {
    await Promise.all(entries.slice(i, i + 24).map(([rel, bytes]) => snapshotPut(proj.id, rel, bytes)));
  }
  gcBlobs();
  await renderTree().catch(() => {});
  await reloadClean();
  await refreshGit(true);
  if (!quiet) toast(`Pulled latest snapshot from ${slug} into browser storage.`);
}
async function gitBranchPicker() {
  if (!gitState?.isRepo) return toast('Initialize a repository snapshot first.', 'warn');
  if (gitState.remote?.slug && (ghHist.slug !== gitState.remote.slug || !ghHist.branches)) await ghLoadBranches().catch(() => {});
  quickOpen('', 'branch');
}
let gdMode = 'clone';
function openGitDialog(mode = 'clone') {
  gdMode = mode;
  const d = $('#gitdlg');
  $('#gd-err').hidden = true; $('#gd-err').textContent = '';
  $('#gd-title').textContent = mode === 'clone' ? 'Clone from GitHub (Browser-Local)' : 'Connect GitHub Remote';
  $('#gd-ok').textContent = mode === 'clone' ? 'Clone' : 'Save Remote';
  $('#gd-dir-wrap').hidden = mode !== 'clone';
  $('#gd-url').value = mode === 'remote' ? (gitState?.remote?.url || '') : '';
  if (mode === 'clone') $('#gd-dir').value = '';
  syncGhTokenUi();
  $('#gd-auth').open = mode === 'remote' && !!gitState?.remote?.private && !ghToken;
  d.showModal();
  $('#gd-url').focus();
}
function syncGhTokenUi() {
  $('#gd-tok').value = '';
  $('#gd-tok').placeholder = ghToken ? `Saved token ${ghTokenHint()} in use — paste a new one to replace` : 'github_pat_… / ghp_…';
  $('#gd-tok-st').textContent = ghToken ? `Token ${ghTokenHint()}` : 'Public repos need no token';
  $('#gd-tok-st').classList.toggle('on', !!ghToken);
  $('#gd-forget').hidden = !ghToken;
}
$('#gd-forget').onclick = () => { setGhToken(''); syncGhTokenUi(); toast('GitHub token removed from this browser.'); };
$('#gd-cancel').onclick = () => $('#gitdlg').close();
lightDismiss($('#gitdlg'), () => $('#gitdlg').close());
$('#gd-form').onsubmit = async e => {
  e.preventDefault();
  const rawUrl = $('#gd-url').value.trim(), branch = $('#gd-dir').value.trim();
  if (!rawUrl) return;
  $('#gd-err').hidden = true; $('#gd-ok').disabled = true;
  $('#gd-ok').textContent = gdMode === 'clone' ? (ghToken || $('#gd-tok').value.trim() ? 'Connecting to GitHub…' : 'Downloading ZIP…') : 'Saving…';
  try {
    const slug = parseGithubInput(rawUrl), newTok = $('#gd-tok').value.trim();
    if (newTok) {
      if (!/^[A-Za-z0-9_]{20,255}$/.test(newTok)) throw new Error('That does not look like a GitHub token (expected github_pat_… or ghp_…).');
      setGhToken(newTok);
      syncGhTokenUi();
    }
    if (gdMode === 'clone') {
      await cloneGithubIntoBrowser(slug, branch, (n, total) => { $('#gd-ok').textContent = `Downloading ${n}/${total}…`; });
      $('#gitdlg').close();
    } else {
      const proj = activeProj();
      if (!proj) throw new Error('Open a project first.');
      proj.remote = { slug, url: `https://github.com/${slug}.git`, githubUrl: `https://github.com/${slug}` };
      await dbPut('projects', serializeProjMeta(proj));
      $('#gitdlg').close();
      await refreshGit();
      toast('Connected GitHub remote.');
    }
  } catch (err) {
    $('#gd-err').textContent = err.message; $('#gd-err').hidden = false;
    if (err.needsToken || err.status === 401) { $('#gd-auth').open = true; $('#gd-tok').focus(); }
  } finally {
    $('#gd-ok').disabled = false;
    $('#gd-ok').textContent = gdMode === 'clone' ? 'Clone' : 'Save Remote';
  }
};
$('#git-msg').onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !composing(e)) { e.preventDefault(); gitCommit(); } };
$('#git-commit').onclick = () => gitCommit();
$('#git-commit-export').onclick = async () => { if ($('#git-msg').value.trim()) await gitCommit(); await exportProjectZip(); };
$('#git-init-btn').onclick = () => gitInitRepo().catch(fail);
$('#git-clone-btn').onclick = $('#git-empty-clone').onclick = $('#welcome-clone').onclick = () => openGitDialog('clone');
$('#git-pull-btn').onclick = () => gitPullFromGithub().catch(fail);
$('#git-export-btn').onclick = () => exportProjectZip().catch(fail);
$('#git-refresh-btn').onclick = () => refreshGit().catch(fail);
$('#st-git').onclick = gitBranchPicker;
$('#st-sync').onclick = () => exportProjectZip().catch(fail);

// ---------- privacy mode status for Chat panel (no server process / filesystem access) ----------
$('#power').disabled = true;
$('#agent').replaceChildren(new Option('Browser-Local Only', 'local'));
$('#agent').disabled = true;
$('#in').disabled = true;
$('#in').placeholder = 'Browser-Local Privacy Mode: server-side agent execution is disabled.';
$('#send').disabled = true;
$('#st-agent').replaceChildren(icon('shield'), el('span', '', 'Isolated'));
{
  const e = el('div', 'chat-empty'); e.id = 'chat-empty';
  e.append(icon('shield', 'big'), el('h3', '', 'Zero Server Storage'), el('p', '', 'Workspaces, files, snapshots, and VS Code extensions stay 100% inside this browser profile. Server-side shell/agent execution is disabled to prevent cross-client directory access.'));
  $('#log').replaceChildren(e);
}

// ---------- VS Code Marketplace & Extension Host ----------
let installedExts = [], marketExts = [], extSearchSeq = 0, extSearchTimer = null, marketLoaded = false;
let activeThemeKey = 'default';
try { activeThemeKey = localStorage.webideTheme || 'default'; } catch {}
const extActive = new Map();    // extDir -> { disposables, commands: Map<id, fn>, exports }
let extBuiltins = new Set(), extsLoaded = false;

const DEFAULT_CSS_VARS = (() => {
  const s = getComputedStyle(document.documentElement);
  const keys = ['--bg','--side','--card','--border','--fg','--strong','--dim','--faint','--accent','--accent-h','--hover','--sel','--sel-focus','--input','--input-border','--widget','--widget-border'];
  const o = {}; for (const k of keys) o[k] = s.getPropertyValue(k).trim();
  return o;
})();
const DEFAULT_TERM_THEME = { ...TERM_THEME };


function cleanHex(c, withHash = true) {
  if (typeof c !== 'string') return '';
  let s = c.trim();
  if (!s) return '';
  if (s.startsWith('#')) s = s.slice(1);
  if (/^[0-9a-fA-F]{3,4}$/.test(s)) s = [...s].map(ch => ch + ch).join('');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(s)) return '';
  return (withHash ? '#' : '') + s.toLowerCase();
}

function applyTerminalThemeColors(colors = {}, isLight = false) {
  const next = { ...DEFAULT_TERM_THEME };
  const map = {
    background: colors['terminal.background'] || colors['panel.background'] || colors['editor.background'],
    foreground: colors['terminal.foreground'] || colors['editor.foreground'] || colors.foreground,
    cursor: colors['terminalCursor.foreground'] || colors['editorCursor.foreground'],
    selectionBackground: colors['terminal.selectionBackground'] || colors['editor.selectionBackground'],
    black: colors['terminal.ansiBlack'], red: colors['terminal.ansiRed'], green: colors['terminal.ansiGreen'],
    yellow: colors['terminal.ansiYellow'], blue: colors['terminal.ansiBlue'], magenta: colors['terminal.ansiMagenta'],
    cyan: colors['terminal.ansiCyan'], white: colors['terminal.ansiWhite'],
    brightBlack: colors['terminal.ansiBrightBlack'], brightRed: colors['terminal.ansiBrightRed'],
    brightGreen: colors['terminal.ansiBrightGreen'], brightYellow: colors['terminal.ansiBrightYellow'],
    brightBlue: colors['terminal.ansiBrightBlue'], brightMagenta: colors['terminal.ansiBrightMagenta'],
    brightCyan: colors['terminal.ansiBrightCyan'], brightWhite: colors['terminal.ansiBrightWhite'],
  };
  for (const [k, v] of Object.entries(map)) { const h = cleanHex(v); if (h) next[k] = h; }
  if (isLight && !colors['terminal.background'] && !colors['editor.background']) next.background = '#f8fafc';
  Object.assign(TERM_THEME, next);
  for (const t of terms) if (t.term) try { t.term.options.theme = { ...TERM_THEME }; } catch {}
}

function restoreDefaultTheme(persist = false) {
  activeThemeKey = 'default';
  if (persist) try { localStorage.webideTheme = 'default'; } catch {}
  document.documentElement.style.colorScheme = 'dark';
  for (const [k, v] of Object.entries(DEFAULT_CSS_VARS)) document.documentElement.style.setProperty(k, v);
  if (editor) monaco.editor.setTheme('dark-modern');
  applyTerminalThemeColors({}, false);
}

function listAvailableThemes() {
  const out = [];
  for (const ext of installedExts) {
    if (!ext.enabled) continue;
    for (const t of ext.themes || []) out.push({ key: `${ext.dir}::${t.label}`, ext, theme: t, label: `${t.label} — ${ext.displayName}` });
  }
  return out;
}

function applyThemeByKey(themeKey, persist = false) {
  if (!themeKey || themeKey === 'default') return restoreDefaultTheme(persist);
  const found = listAvailableThemes().find(x => x.key === themeKey);
  if (!found || !editor) return false;
  const { theme } = found;
  const base = theme.uiTheme === 'vs' || theme.uiTheme === 'hc-light' ? 'vs' : theme.uiTheme === 'hc-black' ? 'hc-black' : 'vs-dark';
  const isLight = base === 'vs';
  const rules = [];
  for (const r of theme.tokenColors || []) {
    if (!r || !r.settings) continue;
    const fg = cleanHex(r.settings.foreground, false);
    const bg = cleanHex(r.settings.background, false);
    const fs = typeof r.settings.fontStyle === 'string' ? r.settings.fontStyle.trim().replace(/\bnormal\b/gi, '').trim() : '';
    if (!fg && !bg && !fs) continue;
    const scopes = Array.isArray(r.scope) ? r.scope : typeof r.scope === 'string' ? r.scope.split(',') : [''];
    for (const sc of scopes) {
      const token = String(sc || '').trim();
      const rule = { token };
      if (fg) rule.foreground = fg;
      if (bg) rule.background = bg;
      if (fs) rule.fontStyle = fs;
      rules.push(rule);
    }
  }
  const mColors = {};
  for (const [k, v] of Object.entries(theme.colors || {})) { const h = cleanHex(v); if (h) mColors[k] = h; }
  // Monaco requires theme identifiers matching /^[0-9a-zA-Z\-]+$/ (underscores fail).
  const mId = 'ext-' + (themeKey.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'theme');
  try {
    monaco.editor.defineTheme(mId, { base, inherit: true, rules, colors: mColors });
    monaco.editor.setTheme(mId);
  } catch (e) { console.warn('Theme define failed:', mId, e); return false; }

  document.documentElement.style.colorScheme = isLight ? 'light' : 'dark';
  const setVar = (k, val) => document.documentElement.style.setProperty(k, val);
  const pick = (...keys) => keys.map(k => mColors[k]).find(Boolean);
  setVar('--bg', pick('editor.background') || (isLight ? '#ffffff' : DEFAULT_CSS_VARS['--bg']));
  setVar('--side', pick('sideBar.background', 'editor.background') || (isLight ? '#f3f4f6' : DEFAULT_CSS_VARS['--side']));
  setVar('--card', pick('editorWidget.background', 'sideBar.background', 'editor.background') || (isLight ? '#f8fafc' : DEFAULT_CSS_VARS['--card']));
  setVar('--fg', pick('sideBar.foreground', 'foreground', 'editor.foreground') || (isLight ? '#1e293b' : DEFAULT_CSS_VARS['--fg']));
  setVar('--strong', pick('editor.foreground', 'foreground') || (isLight ? '#0f172a' : DEFAULT_CSS_VARS['--strong']));
  setVar('--dim', pick('descriptionForeground', 'tab.inactiveForeground') || (isLight ? '#475569' : DEFAULT_CSS_VARS['--dim']));
  setVar('--faint', pick('editorLineNumber.foreground') || (isLight ? '#64748b' : DEFAULT_CSS_VARS['--faint']));
  setVar('--border', pick('sideBar.border', 'panel.border', 'editorGroup.border') || (isLight ? '#0000001a' : DEFAULT_CSS_VARS['--border']));
  setVar('--accent', pick('button.background', 'focusBorder', 'activityBarBadge.background') || DEFAULT_CSS_VARS['--accent']);
  setVar('--hover', pick('list.hoverBackground') || (isLight ? '#0000000a' : DEFAULT_CSS_VARS['--hover']));
  setVar('--sel', pick('list.inactiveSelectionBackground') || (isLight ? '#00000012' : DEFAULT_CSS_VARS['--sel']));
  setVar('--sel-focus', pick('list.activeSelectionBackground') || DEFAULT_CSS_VARS['--sel-focus']);
  setVar('--input', pick('input.background') || (isLight ? '#ffffff' : DEFAULT_CSS_VARS['--input']));
  setVar('--input-border', pick('input.border', 'contrastBorder') || (isLight ? '#00000024' : DEFAULT_CSS_VARS['--input-border']));
  setVar('--widget', pick('editorWidget.background') || (isLight ? '#ffffff' : DEFAULT_CSS_VARS['--widget']));
  setVar('--widget-border', pick('editorWidget.border') || (isLight ? '#0000001f' : DEFAULT_CSS_VARS['--widget-border']));
  applyTerminalThemeColors(mColors, isLight);
  activeThemeKey = themeKey;
  if (persist) try { localStorage.webideTheme = themeKey; } catch {}
  return true;
}

function tmScopeToToken(scope) {
  const s = String(scope || '').toLowerCase();
  if (!s) return '';
  if (s.includes('comment')) return 'comment';
  if (s.includes('string')) return 'string';
  if (s.includes('constant.numeric')) return 'number';
  if (s.includes('constant.language') || s.includes('constant')) return 'constant';
  if (s.includes('keyword.operator') || s.includes('operator')) return 'operator';
  if (s.includes('keyword')) return 'keyword';
  if (s.includes('storage')) return 'type';
  if (s.includes('entity.name.tag')) return 'tag';
  if (s.includes('entity.other.attribute-name')) return 'attribute.name';
  if (s.includes('entity.name.type') || s.includes('support.type') || s.includes('support.class')) return 'type';
  if (s.includes('entity.name.function') || s.includes('support.function')) return 'identifier';
  if (s.includes('variable')) return 'variable';
  if (s.includes('punctuation')) return 'delimiter';
  return 'source';
}

function safeRegex(pat) {
  if (typeof pat !== 'string' || !pat) return null;
  // Strip common Oniguruma-only flags that JS RegExp rejects at start of string
  const cleaned = pat.replace(/^\(\?[imsx-]+\)/, '');
  try { return new RegExp(cleaned); } catch { return null; }
}

function registerTmGrammar(grammar, disposables) {
  const langId = grammar?.language;
  if (!langId || !grammar.grammar || extBuiltins.has(langId)) return;
  const tm = grammar.grammar;
  const tokenizer = { root: [] };
  let stateSeq = 0;
  const visitedRepo = new Set();
  const convertList = (list, target, depth = 0) => {
    if (!Array.isArray(list) || depth > 8) return;
    for (const p of list) {
      if (!p || typeof p !== 'object') continue;
      if (p.include) {
        if (p.include === '$self' || p.include === '$base') target.push({ include: '@root' });
        else if (p.include.startsWith('#')) {
          const key = p.include.slice(1);
          const repoKey = 'repo_' + key.replace(/[^a-zA-Z0-9_]/g, '_');
          if (tm.repository?.[key]) {
            if (!visitedRepo.has(key)) {
              visitedRepo.add(key);
              tokenizer[repoKey] = [];
              const r = tm.repository[key];
              if (Array.isArray(r.patterns)) convertList(r.patterns, tokenizer[repoKey], depth + 1);
              else convertList([r], tokenizer[repoKey], depth + 1);
            }
            target.push({ include: '@' + repoKey });
          }
        }
        continue;
      }
      if (p.match) {
        const rx = safeRegex(p.match);
        if (rx) target.push([rx, tmScopeToToken(p.name) || 'source']);
      } else if (p.begin && p.end) {
        const bRx = safeRegex(p.begin), eRx = safeRegex(p.end);
        if (bRx && eRx) {
          const stName = 'st_' + (++stateSeq);
          const tok = tmScopeToToken(p.name || p.contentName) || 'string';
          tokenizer[stName] = [[eRx, tok, '@pop']];
          if (Array.isArray(p.patterns)) convertList(p.patterns, tokenizer[stName], depth + 1);
          tokenizer[stName].push([/./, tok]);
          target.push([bRx, tok, '@' + stName]);
        }
      } else if (Array.isArray(p.patterns)) convertList(p.patterns, target, depth + 1);
    }
  };
  convertList(tm.patterns, tokenizer.root);
  if (!tokenizer.root.length) return;
  try {
    const d = monaco.languages.setMonarchTokensProvider(langId, { tokenizer });
    if (d) disposables.push(d);
  } catch (e) { console.warn('Grammar register failed:', langId, e); }
}

function registerLangContributions(ext, disposables) {
  const known = new Set(monaco.languages.getLanguages().map(l => l.id));
  for (const lang of ext.languages || []) {
    if (!lang?.id) continue;
    if (!known.has(lang.id)) {
      monaco.languages.register({
        id: lang.id,
        extensions: lang.extensions || [],
        aliases: lang.aliases || [lang.id],
        filenames: lang.filenames || [],
        mimetypes: lang.mimetypes || [],
      });
      known.add(lang.id);
    }
    if (lang.configuration) {
      const c = lang.configuration, mc = {};
      if (c.comments) mc.comments = c.comments;
      if (c.brackets) mc.brackets = c.brackets;
      if (c.autoClosingPairs) {
        mc.autoClosingPairs = c.autoClosingPairs.map(p => Array.isArray(p) ? { open: p[0], close: p[1] } : p);
      }
      if (c.surroundingPairs) {
        mc.surroundingPairs = c.surroundingPairs.map(p => Array.isArray(p) ? { open: p[0], close: p[1] } : p);
      }
      const rx = safeRegex(c.wordPattern);
      if (rx) mc.wordPattern = rx;
      try {
        const d = monaco.languages.setLanguageConfiguration(lang.id, mc);
        if (d) disposables.push(d);
      } catch {}
    }
  }
  for (const g of ext.grammars || []) registerTmGrammar(g, disposables);
  for (const s of ext.snippets || []) {
    const lang = s?.language, defs = s?.snippets;
    if (!lang || !defs || typeof defs !== 'object') continue;
    const d = monaco.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        const suggestions = Object.entries(defs).map(([name, item]) => ({
          label: Array.isArray(item.prefix) ? item.prefix[0] : (item.prefix || name),
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: item.description || name,
          detail: `${ext.displayName} snippet`,
          insertText: Array.isArray(item.body) ? item.body.join('\n') : String(item.body || ''),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        }));
        return { suggestions };
      },
    });
    disposables.push(d);
  }
  // Re-detect language for currently open plaintext models whose filename now matches a registered extension
  for (const [rel, t] of tabs) {
    if (t.model?.getLanguageId() === 'plaintext') {
      const m = monaco.languages.getLanguages().find(l => (l.extensions || []).some(e => rel.endsWith(e)) || (l.filenames || []).includes(base(rel)));
      if (m && m.id !== 'plaintext') monaco.editor.setModelLanguage(t.model, m.id);
    }
  }
}

const extBus = {
  _map: new Map(), // channel -> Set<{ extDir, fn }>
  on(ch, extDir, fn, disposables) {
    if (!this._map.has(ch)) this._map.set(ch, new Set());
    const rec = { extDir, fn };
    this._map.get(ch).add(rec);
    const d = { dispose: () => this._map.get(ch)?.delete(rec) };
    if (Array.isArray(disposables)) disposables.push(d);
    return d;
  },
  fire(ch, payload, onlyExtDir = null) {
    const ls = this._map.get(ch);
    if (!ls?.size) return;
    for (const rec of [...ls]) {
      if (onlyExtDir && rec.extDir !== onlyExtDir) continue;
      try { rec.fn(payload); } catch (e) { console.warn('extBus listener error:', ch, e); }
    }
  },
};
const extDiagRegistry = new Map(); // owner -> Map<normPath, { raw: Diagnostic[], markers: IMarkerData[] }>
const extTaskProviders = [];

function refreshProblemsStatus() {
  const btn = $('#st-prob');
  if (!btn || !window.monaco || !editor) return;
  const markers = problemList();
  const badge = $('#ptab-prob .badge');
  badge.hidden = !markers.length; badge.textContent = markers.length;
  renderProblems();
  btn.hidden = false;
  if (!markers.length) { btn.replaceChildren(icon('check'), el('span', '', '0')); return; }
  let errs = 0, warns = 0;
  for (const m of markers) {
    if (m.severity >= monaco.MarkerSeverity.Error) errs++;
    else if (m.severity >= monaco.MarkerSeverity.Warning) warns++;
  }
  const infos = markers.length - errs - warns;
  btn.hidden = false;
  const parts = [];
  if (errs) parts.push(`${errs}E`);
  if (warns || !errs) parts.push(`${warns + (warns || errs ? 0 : infos)}W`);
  btn.replaceChildren(icon('warning', errs ? 'err' : 'warn'), el('span', '', parts.join(' ')));
}
$('#st-prob').onclick = () => toggleProblems();
$('#st-prob').title = `Toggle Problems (${K.prob})`;
// Problems panel: markers of this workspace's open editors (Monaco language services + extension diagnostics)
const relOfUri = u => u.path.replace(/^\/+/, '');
function problemList() { return monaco.editor.getModelMarkers({}).filter(m => m.resource.scheme === 'file' && tabs.has(relOfUri(m.resource))); }
function setPanelTab(tab) {
  $('#panel').classList.toggle('prob', tab === 'prob');
  for (const b of $$('#panel .ptab')) b.classList.toggle('on', b.dataset.tab === tab);
  renderProblems();
}
function toggleProblems() {
  if (!$('#panel').hidden && $('#panel').classList.contains('prob')) return showPanel(false);
  $('#panel').hidden = $('#sash-panel').hidden = false;
  setPanelTab('prob'); layout();
}
$('#ptab-prob').onclick = () => setPanelTab('prob');
$('#ptab-term').onclick = () => (terms.length ? showPanel(true) : newTerminal().catch(fail));
function renderProblems() {
  if ($('#panel').hidden || !$('#panel').classList.contains('prob') || !window.monaco) return;
  const byFile = new Map();
  for (const m of problemList()) { const rel = relOfUri(m.resource); if (!byFile.has(rel)) byFile.set(rel, []); byFile.get(rel).push(m); }
  const rows = [];
  for (const [rel, ms] of [...byFile].sort((a, b) => a[0].localeCompare(b[0]))) {
    ms.sort((a, b) => b.severity - a.severity || a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn);
    const name = base(rel), f = el('div', 'pf');
    f.append(icon('chevron-down'), fileIcon(name), el('span', '', name), el('span', 'pdir', rel.slice(0, -name.length).replace(/\/$/, '')), el('span', 'badge', String(ms.length)));
    f.onclick = () => openFile(rel).catch(fail);
    rows.push(f);
    for (const m of ms) {
      const [ic, cls] = m.severity >= 8 ? ['error', 'err'] : m.severity >= 4 ? ['warning', 'warn'] : ['info', ''];
      const code = m.code && typeof m.code === 'object' ? m.code.value : m.code;
      const r = el('div', 'pi'); r.title = m.message;
      r.append(icon(ic, cls), el('span', 'pmsg', m.message), el('span', 'psrc', `${m.source || m.owner}${code ? `(${code})` : ''} [Ln ${m.startLineNumber}, Col ${m.startColumn}]`));
      r.onclick = () => gotoPosition(rel, m.startLineNumber, m.startColumn).catch(fail);
      rows.push(r);
    }
  }
  if (!rows.length) rows.push(el('div', 'pempty', 'No problems have been detected in the open editors.'));
  $('#probbody').replaceChildren(...rows);
}
async function gotoPosition(rel, line, col) {
  if (active !== rel) await openFile(rel);
  if (active !== rel) return;
  editor.setSelection({ startLineNumber: line, startColumn: col, endLineNumber: line, endColumn: col });
  editor.revealLineInCenter(line); editor.focus();
}



function parseJsonc(str) {
  try { return JSON.parse(str); } catch {}
  let out = '', inStr = false, esc = false, lineC = false, blkC = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i], n = str[i + 1];
    if (lineC) { if (c === '\n') { lineC = false; out += c; } continue; }
    if (blkC) { if (c === '*' && n === '/') { blkC = false; i++; } continue; }
    if (inStr) { out += c; if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && n === '/') { lineC = true; i++; continue; }
    if (c === '/' && n === '*') { blkC = true; i++; continue; }
    out += c;
  }
  out = out.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(out);
}
function vsixResolve(baseRel, relPath) {
  const parts = (baseRel ? baseRel.split('/') : []).concat(String(relPath || '').replace(/\\/g, '/').split('/'));
  const stack = [];
  for (const s of parts) {
    if (!s || s === '.') continue;
    if (s === '..') stack.pop(); else stack.push(s);
  }
  return stack.join('/');
}
function bytesToDataUrl(u8, name = '') {
  const ext = name.split('.').pop().toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
  let bin = '';
  for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode(...u8.subarray(i, i + 8192));
  return `data:${mime};base64,${btoa(bin)}`;
}
async function unzipVsixToManifest(buf, fallbackMeta = {}) {
  // Pass 1: inflate ONLY package.json and package.nls*.json (~1-2 files) before inspecting assets
  const metaFiles = await unzipBytes(buf, {
    maxBytes: 120 * 1024 * 1024, maxFiles: 5000,
    filter: name => /^(extension\/)?package(\.nls)?\.json$/i.test(name),
  });
  const prefix = metaFiles.has('extension/package.json') ? 'extension' : metaFiles.has('package.json') ? '' : null;
  if (prefix === null) throw new Error('Invalid VSIX: missing package.json');
  const getRel = r => (prefix ? `${prefix}/${r.replace(/^\.?\//, '').replace(/^\/+/, '')}` : r.replace(/^\.?\//, '').replace(/^\/+/, ''));
  const readMetaJson = r => { const u8 = metaFiles.get(getRel(r)); try { return u8 ? parseJsonc(textDec.decode(u8)) : null; } catch { return null; } };
  const pkg = readMetaJson('package.json');
  if (!pkg) throw new Error('Invalid VSIX: malformed package.json');
  const nls = readMetaJson('package.nls.json') || {};
  const tr = s => (typeof s === 'string' && s.startsWith('%') && s.endsWith('%') ? (nls[s.slice(1, -1)] ?? s) : s);
  const fullId = `${pkg.publisher || fallbackMeta.publisher || 'local'}.${pkg.name || 'ext'}`;
  const dir = (fallbackMeta.id || fullId).toLowerCase();

  // Pass 2: inflate ONLY needed contribution assets (themes, language configs, grammars, snippets, icon, browser bundle)
  const contribs = pkg.contributes || {};
  const needed = new Set();
  const addRef = p => { if (p) needed.add(getRel(p).toLowerCase()); };
  if (pkg.icon) addRef(pkg.icon);
  if (pkg.browser) addRef(pkg.browser);
  const themeDirs = new Set();
  for (const t of contribs.themes || []) if (t.path) { addRef(t.path); themeDirs.add(getRel(t.path).split('/').slice(0, -1).join('/').toLowerCase()); }
  for (const l of contribs.languages || []) addRef(l.configuration);
  for (const g of contribs.grammars || []) addRef(g.path);
  for (const s of contribs.snippets || []) addRef(s.path);

  const files = needed.size ? await unzipBytes(buf, {
    maxBytes: 120 * 1024 * 1024, maxFiles: 5000,
    filter: name => {
      const nl = name.toLowerCase();
      if (needed.has(nl)) return true;
      // Include sibling theme JSONs so theme `include` inheritance works seamlessly
      if (nl.endsWith('.json')) for (const td of themeDirs) if (td && nl.startsWith(td + '/')) return true;
      return false;
    },
  }) : new Map();

  const readTxt = r => {
    const u8 = files.get(getRel(r)) || metaFiles.get(getRel(r));
    return u8 ? textDec.decode(u8) : '';
  };
  const readJson = r => { try { const t = readTxt(r); return t ? parseJsonc(t) : null; } catch { return null; } };

  const loadTheme = (rel, seen = new Set()) => {
    const clean = rel.replace(/^\.?\//, '');
    if (seen.has(clean)) return null;
    seen.add(clean);
    const data = readJson(clean);
    if (!data || typeof data !== 'object') return null;
    let colors = {}, tokenColors = [];
    if (typeof data.include === 'string') {
      const baseRel = clean.split('/').slice(0, -1).join('/');
      const parent = loadTheme(vsixResolve(baseRel, data.include), seen);
      if (parent) { colors = { ...parent.colors }; tokenColors = [...parent.tokenColors]; }
    }
    if (data.colors && typeof data.colors === 'object') colors = { ...colors, ...data.colors };
    if (Array.isArray(data.tokenColors)) tokenColors = [...tokenColors, ...data.tokenColors];
    return { type: data.type || '', colors, tokenColors };
  };

  const themes = (contribs.themes || []).map(t => {
    const th = t.path ? loadTheme(t.path) : null;
    return th ? { id: t.id || tr(t.label), label: tr(t.label || 'Theme'), uiTheme: t.uiTheme || 'vs-dark', colors: th.colors, tokenColors: th.tokenColors } : null;
  }).filter(Boolean);
  const languages = (contribs.languages || []).map(l => ({
    id: l.id, extensions: l.extensions || [], aliases: l.aliases || [], filenames: l.filenames || [], mimetypes: l.mimetypes || [],
    configuration: l.configuration ? readJson(l.configuration) : null,
  }));
  const grammars = (contribs.grammars || []).map(g => {
    const data = g.path ? readJson(g.path) : null;
    return data && g.language ? { language: g.language, scopeName: g.scopeName, grammar: data } : null;
  }).filter(Boolean);
  const snippets = (contribs.snippets || []).map(s => {
    const data = s.path ? readJson(s.path) : null;
    return data && s.language ? { language: s.language, snippets: data } : null;
  }).filter(Boolean);
  const commands = (contribs.commands || []).map(c => ({ command: c.command, title: tr(c.title || c.command), category: tr(c.category || '') }));

  let iconUrl = fallbackMeta.iconUrl || '';
  if (pkg.icon) {
    const ic = files.get(getRel(pkg.icon));
    if (ic) iconUrl = bytesToDataUrl(ic, pkg.icon);
  }
  const browserCode = pkg.browser ? readTxt(pkg.browser) : '';
  const configDefaults = {};
  const cfgs = Array.isArray(contribs.configuration) ? contribs.configuration : (contribs.configuration ? [contribs.configuration] : []);
  for (const cfg of cfgs) {
    for (const [k, v] of Object.entries(cfg?.properties || {})) {
      if (v && 'default' in v) configDefaults[k] = v.default;
    }
  }
  return {
    id: fullId, dir,
    displayName: tr(pkg.displayName || fallbackMeta.displayName || pkg.name || fullId),
    description: tr(pkg.description || fallbackMeta.description || ''),
    version: pkg.version || fallbackMeta.version || '0.0.0',
    publisher: pkg.publisher || fallbackMeta.publisher || '',
    installs: fallbackMeta.installs || 0,
    enabled: true,
    iconUrl,
    hasBrowser: !!browserCode,
    browserCode,
    configDefaults,
    themes, languages, grammars, snippets, commands,
  };
}

// ---------- extension sandbox host (parent side) ----------
// Extension *code* no longer runs in this page. It runs in /ext-host.html inside an
// <iframe sandbox="allow-scripts"> (opaque origin: no access to this page's DOM,
// localStorage/sessionStorage, cookies or IndexedDB), and talks to the IDE only
// through the postMessage RPC below. Data contributions (themes, grammars, snippets,
// languages) are still applied in-page by registerLangContributions — they are data,
// not code. The parent exposes exactly the capabilities in extHostCall() and nothing
// else; notably the GitHub token and workspace storage are never passed to the sandbox.
let extHostFrame = null, extHostReadyP = null, extRpcSeq = 0;
const extRpcPending = new Map();
function ensureExtHost() {
  if (extHostReadyP) return extHostReadyP;
  extHostReadyP = new Promise((resolve, reject) => {
    const fr = document.createElement('iframe');
    fr.id = 'ext-host-frame';
    fr.title = 'Extension sandbox';
    fr.setAttribute('sandbox', 'allow-scripts'); // deliberately NO allow-same-origin
    fr.hidden = true;
    fr.src = '/ext-host.html';
    document.body.append(fr);
    extHostFrame = fr;
    const to = setTimeout(() => reject(new Error('Extension sandbox did not start')), 15000);
    extHostReadyResolvers.push(() => { clearTimeout(to); resolve(); });
  }).catch(e => { extHostReadyP = null; throw e; });
  return extHostReadyP;
}
const extHostReadyResolvers = [];
function extHostRpc(method, params) {
  return ensureExtHost().then(() => new Promise((resolve, reject) => {
    const id = ++extRpcSeq;
    extRpcPending.set(id, { resolve, reject });
    extHostFrame.contentWindow.postMessage({ __extHost: 1, kind: 'rpc', id, method, params }, '*');
    setTimeout(() => { if (extRpcPending.delete(id)) reject(new Error('Extension sandbox call timed out: ' + method)); }, 20000);
  }));
}
const extDocSnapshot = (rel, model) => (rel && model ? {
  rel, uriPath: model.uri.path, languageId: model.getLanguageId(),
  text: model.getValue(), version: model.getVersionId(), isDirty: !!tabs.get(rel)?.dirty,
} : null);
const extAllDocSnapshots = () => [...tabs.entries()].filter(([, t]) => t.model).map(([rel, t]) => extDocSnapshot(rel, t.model)).filter(Boolean);
function extConfigSnapshot() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('webideCfg:')) { try { out[k.slice(10)] = JSON.parse(localStorage.getItem(k) || '{}'); } catch {} }
    }
  } catch {}
  return out;
}
function extMementoRead(prefix) {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix + ':')) { try { out[k.slice(prefix.length + 1)] = JSON.parse(localStorage.getItem(k)); } catch {} }
    }
  } catch {}
  return out;
}
const extB64Encode = u8 => { let bin = ''; for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(bin); };
const extB64Decode = b64 => { const bin = atob(String(b64 || '')); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const extNormPath = p => String(p || '').replace(/^file:\/\//, '').replace(/^\/+/, '');
function extDiagApply(dir, name, entries) {
  const owner = `ext-diag:${dir}:${name}`;
  let store = extDiagRegistry.get(owner);
  if (!store) { store = new Map(); extDiagRegistry.set(owner, store); }
  const sevMap = s => (s === 0 ? monaco.MarkerSeverity.Error : s === 1 ? monaco.MarkerSeverity.Warning : s === 2 ? monaco.MarkerSeverity.Info : monaco.MarkerSeverity.Hint);
  for (const { path: rawPath, diags } of entries || []) {
    const targetPath = '/' + extNormPath(rawPath);
    const raw = Array.isArray(diags) ? diags : [];
    const markers = raw.map(d => ({
      severity: sevMap(d.severity ?? 1),
      startLineNumber: (d.range?.start?.line ?? 0) + 1,
      startColumn: (d.range?.start?.character ?? 0) + 1,
      endLineNumber: (d.range?.end?.line ?? 0) + 1,
      endColumn: Math.max((d.range?.start?.character ?? 0) + 2, (d.range?.end?.character ?? 0) + 1),
      message: String(d.message || ''), source: d.source || undefined,
      code: d.code != null && d.code !== '' ? String(d.code) : undefined,
    }));
    if (markers.length) store.set(targetPath, { raw, markers }); else store.delete(targetPath);
    for (const m of monaco.editor.getModels()) if (m.uri.path === targetPath) monaco.editor.setModelMarkers(m, owner, markers);
  }
  refreshProblemsStatus();
}
function extDiagClear(dir, name) {
  const owner = `ext-diag:${dir}:${name}`;
  extDiagRegistry.delete(owner);
  for (const m of monaco.editor.getModels()) monaco.editor.setModelMarkers(m, owner, []);
  refreshProblemsStatus();
}
// Capabilities the sandbox may call. Everything is scoped to the *active* project and
// mediated here — the sandbox never sees storage handles, tokens or other extensions' data.
async function extHostCall(method, p) {
  switch (method) {
    case 'toast': toast(String(p.msg || ''), p.kind === 'error' ? 'error' : p.kind === 'warn' ? 'warn' : undefined); return null;
    case 'log': if (typeof p.msg === 'string' && /ERROR:/i.test(p.msg)) console.warn(`[${p.name || 'ext'}]`, p.msg); return null;
    case 'quickPick': return (p.items || [])[0] ?? null;
    case 'inputBox': return window.prompt(p.prompt || '', p.value || '') ?? undefined;
    case 'showDoc': case 'openDoc': {
      const rel = extNormPath(p.path);
      if (rel) await openFile(rel);
      const t = tabs.get(rel);
      return t?.model ? extDocSnapshot(rel, t.model) : null;
    }
    case 'saveDoc': await saveTab(extNormPath(p.rel)); return true;
    case 'findFiles': {
      const proj = activeProj();
      if (!proj) return [];
      const { files } = await vfsAllFiles(proj, { skipHeavy: true, limit: 5000 });
      return files;
    }
    case 'fsRead': return extB64Encode(await vfsReadBytes(activeProj(), extNormPath(p.path)));
    case 'fsWrite': await vfsWriteFile(activeProj(), extNormPath(p.path), extB64Decode(p.b64), { force: true }); renderTree().catch(() => {}); return null;
    case 'fsStat': {
      const proj = activeProj(), rel = extNormPath(p.path);
      if (!proj) throw Object.assign(new Error('ENOENT: no workspace'), { code: 'ENOENT' });
      if (!rel) return { type: 2, ctime: 0, mtime: 0, size: 0 };
      try { const b = await vfsReadBytes(proj, rel); return { type: 1, ctime: 0, mtime: 0, size: b.length }; }
      catch { try { await vfsListDir(proj, rel); return { type: 2, ctime: 0, mtime: 0, size: 0 }; } catch { throw Object.assign(new Error('ENOENT: ' + rel), { code: 'ENOENT' }); } }
    }
    case 'fsList': {
      const proj = activeProj();
      if (!proj) return [];
      try { return (await vfsListDir(proj, extNormPath(p.path))).map(it => [it.name, it.dir ? 2 : 1]); } catch { return []; }
    }
    case 'applyEdit': {
      const grouped = new Map();
      for (const x of p.edits || []) {
        const path = '/' + extNormPath(x.path || (active ? '/' + active : ''));
        if (!grouped.has(path)) grouped.set(path, []);
        grouped.get(path).push({
          range: { startLineNumber: (x.range.start.line ?? 0) + 1, startColumn: (x.range.start.character ?? 0) + 1, endLineNumber: (x.range.end.line ?? 0) + 1, endColumn: (x.range.end.character ?? 0) + 1 },
          text: x.text,
        });
      }
      for (const [path, ops] of grouped) {
        const model = monaco.editor.getModels().find(m => m.uri.path === path);
        if (!model) continue;
        if (editor?.getModel() === model) editor.executeEdits(p.dir, ops);
        else model.pushEditOperations([], ops, () => null);
      }
      return true;
    }
    case 'configUpdate': {
      const key = 'webideCfg:' + (p.section || '');
      let store = {}; try { store = JSON.parse(localStorage[key] || '{}'); } catch {}
      if (p.value === undefined) delete store[p.key]; else store[p.key] = p.value;
      try { localStorage[key] = JSON.stringify(store); } catch {}
      for (const rt of extActive.values()) {
        if (rt.sandbox) extHostRpc('event', { dir: rt.ext.dir, channel: 'configChanged', section: p.section || '', config: extConfigSnapshot() }).catch(() => {});
      }
      return null;
    }
    case 'mementoUpdate': {
      const prefix = (p.which === 'workspace' ? 'extW:' : 'extG:') + p.dir;
      try { if (p.value === undefined) localStorage.removeItem(prefix + ':' + p.key); else localStorage.setItem(prefix + ':' + p.key, JSON.stringify(p.value)); } catch {}
      return null;
    }
    case 'relayCommand': {
      for (const rt of extActive.values()) {
        if (rt.ext.dir === p.fromDir) continue;
        if (rt.commands.has(p.id)) return rt.commands.get(p.id)(...(p.args || []));
      }
      return undefined;
    }
    case 'diagSet': extDiagApply(p.dir, p.name || 'default', p.entries); return null;
    case 'diagClear': extDiagClear(p.dir, p.name || 'default'); return null;
    default: throw new Error('Capability not available to extensions: ' + method);
  }
}
addEventListener('message', async e => {
  const m = e.data;
  if (!m || m.__extHost !== 1 || !extHostFrame || e.source !== extHostFrame.contentWindow) return;
  if (m.kind === 'ready') { for (const r of extHostReadyResolvers.splice(0)) r(); return; }
  if (m.kind === 'rpc-reply') {
    const pend = extRpcPending.get(m.id);
    if (pend) { extRpcPending.delete(m.id); if (m.ok) pend.resolve(m.result); else pend.reject(new Error(m.error || 'Extension sandbox error')); }
    return;
  }
  if (m.kind === 'note') {
    if (m.method === 'providersChanged') {
      const rt = [...extActive.values()].find(x => x.ext.dir === m.params?.dir);
      if (rt?.sandbox) refreshSandboxProviders(rt).catch(() => {});
    } else if (m.method === 'log') extHostCall('log', m.params || {}).catch(() => {});
    return;
  }
  if (m.kind === 'call') {
    try {
      const result = await extHostCall(m.method, m.params || {});
      extHostFrame.contentWindow.postMessage({ __extHost: 1, kind: 'call-reply', id: m.id, ok: true, result: result === undefined ? null : result }, '*');
    } catch (err) {
      extHostFrame.contentWindow.postMessage({ __extHost: 1, kind: 'call-reply', id: m.id, ok: false, error: String(err?.message || err) }, '*');
    }
  }
});
// (Re)register Monaco provider proxies after the sandbox reports new providers.
async function refreshSandboxProviders(rt) {
  const { providers } = await extHostRpc('providersOf', { dir: rt.ext.dir });
  for (const d of rt.providerDisposables || []) try { d.dispose?.(); } catch {}
  rt.providerDisposables = registerSandboxProviders(rt.ext, providers || [], rt.commands);
  for (const d of rt.providerDisposables) rt.disposables.push(d);
}
function registerSandboxProviders(ext, providers, cmdMap) {
  const disposables = [];
  const toRange = r => r ? { startLineNumber: (r.start?.line ?? 0) + 1, startColumn: (r.start?.character ?? 0) + 1, endLineNumber: (r.end?.line ?? 0) + 1, endColumn: (r.end?.character ?? 0) + 1 } : undefined;
  const fromRange = r => ({ start: { line: (r.startLineNumber ?? 1) - 1, character: (r.startColumn ?? 1) - 1 }, end: { line: (r.endLineNumber ?? 1) - 1, character: (r.endColumn ?? 1) - 1 } });
  const fromPos = p => ({ line: (p?.lineNumber ?? 1) - 1, character: (p?.column ?? 1) - 1 });
  const relOf = model => [...tabs.entries()].find(([, t]) => t.model === model)?.[0] || model.uri.path.replace(/^\/+/, '');
  const snapOf = model => extDocSnapshot(relOf(model), model);
  for (const prov of providers) {
    for (const lang of prov.langs || []) {
      if (prov.kind === 'completion') {
        disposables.push(monaco.languages.registerCompletionItemProvider(lang, {
          triggerCharacters: prov.triggers || [],
          async provideCompletionItems(model, position) {
            const res = await extHostRpc('provider', { dir: ext.dir, kind: 'completion', lang, doc: snapOf(model), position: fromPos(position) }).catch(() => null);
            if (!res) return { suggestions: [] };
            const word = model.getWordUntilPosition(position);
            const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
            return {
              incomplete: !!res.incomplete,
              suggestions: (res.items || []).map(it => ({
                label: it.label, kind: it.kind ?? monaco.languages.CompletionItemKind.Text,
                detail: it.detail, documentation: it.documentation,
                insertText: it.insertText?.snippet ?? it.insertText ?? it.label,
                insertTextRules: it.insertText?.snippet != null ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                filterText: it.filterText, sortText: it.sortText, range,
              })),
            };
          },
        }));
      } else if (prov.kind === 'hover') {
        disposables.push(monaco.languages.registerHoverProvider(lang, {
          async provideHover(model, position) {
            const h = await extHostRpc('provider', { dir: ext.dir, kind: 'hover', lang, doc: snapOf(model), position: fromPos(position) }).catch(() => null);
            if (!h) return null;
            return { contents: (h.contents || []).map(v => ({ value: v })), range: toRange(h.range) };
          },
        }));
      } else if (prov.kind === 'format') {
        disposables.push(monaco.languages.registerDocumentFormattingEditProvider(lang, {
          async provideDocumentFormattingEdits(model, opts) {
            const res = await extHostRpc('provider', { dir: ext.dir, kind: 'format', lang, doc: snapOf(model), options: { tabSize: opts.tabSize, insertSpaces: opts.insertSpaces } }).catch(() => null);
            return (res || []).map(ed => ({ range: toRange(ed.range), text: ed.newText }));
          },
        }));
      } else if (prov.kind === 'rangeFormat') {
        disposables.push(monaco.languages.registerDocumentRangeFormattingEditProvider(lang, {
          async provideDocumentRangeFormattingEdits(model, mRange, opts) {
            const res = await extHostRpc('provider', { dir: ext.dir, kind: 'rangeFormat', lang, doc: snapOf(model), range: fromRange(mRange), options: { tabSize: opts.tabSize, insertSpaces: opts.insertSpaces } }).catch(() => null);
            return (res || []).map(ed => ({ range: toRange(ed.range), text: ed.newText }));
          },
        }));
      } else if (prov.kind === 'codeActions') {
        disposables.push(monaco.languages.registerCodeActionProvider(lang, {
          async provideCodeActions(model, mRange) {
            const vsRange = fromRange(mRange);
            const diags = [];
            for (const store of extDiagRegistry.values()) {
              const rec = store.get(model.uri.path);
              if (!rec) continue;
              for (const d of rec.raw) {
                const dr = d.range && { start: { line: d.range.start?.line ?? 0, character: d.range.start?.character ?? 0 }, end: { line: d.range.end?.line ?? 0, character: d.range.end?.character ?? 0 } };
                if (dr && dr.start.line <= vsRange.end.line && dr.end.line >= vsRange.start.line) diags.push({ ...d, range: dr });
              }
            }
            const res = await extHostRpc('provider', { dir: ext.dir, kind: 'codeActions', lang, doc: snapOf(model), range: vsRange, diagnostics: diags }).catch(() => null);
            const actions = (res || []).map(a => {
              const ma = { title: a.title, kind: a.kind || 'quickfix', isPreferred: !!a.isPreferred };
              if (a.edit?.edits?.length) {
                ma.edit = { edits: a.edit.edits.map(x => ({ resource: model.uri, versionId: model.getVersionId(), textEdit: { range: toRange(x.range), text: x.text } })) };
              } else if (a.command?.command) {
                const cmdId = a.command.command, args = a.command.arguments || [];
                if (typeof monaco.editor.registerCommand === 'function') {
                  disposables.push(monaco.editor.registerCommand(cmdId, (_, ...a2) => extHostRpc('invokeCommand', { dir: ext.dir, id: cmdId, args: a2.length ? a2 : args })));
                }
                ma.command = { id: cmdId, title: a.command.title || a.title, arguments: args };
              }
              return ma;
            });
            return { actions, dispose() {} };
          },
        }));
      }
    }
  }
  return disposables;
}

async function activateExtension(ext) {
  deactivateExtension(ext.dir);
  if (!ext.enabled || !editor) return;
  const disposables = [], cmdMap = new Map();
  registerLangContributions(ext, disposables);
  let exps = {};
  if (ext.hasBrowser && ext.browserCode) {
    try {
      const loaded = await extHostRpc('load', {
        dir: ext.dir, id: ext.id, code: ext.browserCode,
        config: extConfigSnapshot(), configDefaults: ext.configDefaults || {},
        memento: { global: extMementoRead('extG:' + ext.dir), workspace: extMementoRead('extW:' + ext.dir) },
        workspaceFolder: root ? { name: activeProj()?.name || 'workspace' } : null,
        docs: extAllDocSnapshots(), activeRel: active,
      });
      for (const cid of loaded.commands || []) {
        cmdMap.set(cid, (...args) => extHostRpc('invokeCommand', { dir: ext.dir, id: cid, args }));
      }
      const providerDisposables = registerSandboxProviders(ext, loaded.providers || [], cmdMap);
      disposables.push(...providerDisposables);
      // Forward document lifecycle events to the sandbox as plain snapshots.
      const fwd = (channel, mk) => extBus.on(channel, ext.dir, p => { extHostRpc('event', { dir: ext.dir, channel, ...mk(p) }).catch(() => {}); }, disposables);
      fwd('openDoc', p => ({ doc: extDocSnapshot(p.rel, p.model) }));
      fwd('saveDoc', p => ({ doc: extDocSnapshot(p.rel, p.model) }));
      fwd('closeDoc', p => ({ rel: p.rel }));
      fwd('changeDoc', p => ({ doc: extDocSnapshot(p.rel, p.model), contentChanges: (p.e?.changes || []).map(c => ({ range: { start: { line: (c.range?.startLineNumber ?? 1) - 1, character: (c.range?.startColumn ?? 1) - 1 }, end: { line: (c.range?.endLineNumber ?? 1) - 1, character: (c.range?.endColumn ?? 1) - 1 } }, rangeOffset: c.rangeOffset, rangeLength: c.rangeLength, text: c.text })) }));
      fwd('activeEditor', p => ({ doc: p.model ? extDocSnapshot(p.rel, p.model) : null }));
      fwd('selection', () => ({ doc: active && tabs.get(active)?.model ? extDocSnapshot(active, tabs.get(active).model) : null }));
      exps = { deactivate: () => { if (extHostFrame) extHostRpc('unload', { dir: ext.dir }).catch(() => {}); } };
      extActive.set(ext.dir, { ext, disposables, commands: cmdMap, exports: exps, sandbox: true, providerDisposables });
      return;
    } catch (e) {
      console.error(`Extension ${ext.id} sandbox error:`, e);
      toast(`Extension ${ext.displayName || ext.id} error: ${e?.message || e}`, 'error');
    }
  }
  extActive.set(ext.dir, { ext, disposables, commands: cmdMap, exports: exps });
}


function deactivateExtension(extDir) {
  const rt = extActive.get(extDir);
  if (!rt) return;
  try { rt.exports?.deactivate?.(); } catch {}
  for (const d of rt.disposables) try { d.dispose?.(); } catch {}
  extActive.delete(extDir);
  if (activeThemeKey.startsWith(extDir + '::')) restoreDefaultTheme(true);
}

function getExtCommands() {
  const out = [];
  for (const ext of installedExts) {
    if (!ext.enabled) continue;
    const rt = extActive.get(ext.dir);
    for (const c of ext.commands || []) {
      if (rt?.commands.has(c.command)) {
        out.push({ label: `${c.category ? c.category + ': ' : ''}${c.title || c.command}`, run: () => rt.commands.get(c.command)() });
      }
    }
    for (const [cid, fn] of rt?.commands || []) {
      if (!(ext.commands || []).some(c => c.command === cid)) out.push({ label: `Extension (${ext.displayName}): ${cid}`, run: () => fn() });
    }
  }
  return out;
}

async function loadExtensions(prefetched = null) {
  installedExts = prefetched || await dbAll('extensions').catch(() => []);
  renderExtensions();
  if (!editor) return;
  extsLoaded = true;
  if (!extBuiltins.size) extBuiltins = new Set(monaco.languages.getLanguages().map(l => l.id));
  if (activeThemeKey !== 'default') {
    if (!applyThemeByKey(activeThemeKey, false)) restoreDefaultTheme(false);
  }
  await Promise.all(installedExts.map(ext => (ext.enabled ? activateExtension(ext) : Promise.resolve(deactivateExtension(ext.dir)))));
}

const fmtInstalls = n => !n ? '' : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);
function makeExtIcon(item) {
  if (item.iconUrl) {
    const img = el('img', 'ext-icon');
    img.src = item.iconUrl; img.alt = ''; img.loading = 'lazy';
    img.onerror = () => { const ph = el('div', 'ext-icon-ph'); ph.append(icon('extensions')); img.replaceWith(ph); };
    return img;
  }
  const ph = el('div', 'ext-icon-ph'); ph.append(icon('extensions')); return ph;
}
function extCapabilityTags(item) {
  const tags = [];
  if (item.themes?.length) tags.push(`${item.themes.length} Theme${item.themes.length > 1 ? 's' : ''}`);
  if (item.languages?.length) tags.push('Lang');
  if (item.grammars?.length) tags.push('Grammar');
  if (item.snippets?.length) tags.push('Snippets');
  if (item.hasBrowser) tags.push('Web');
  return tags;
}

function renderExtCard(item, installedMap) {
  const inst = installedMap.get(item.id.toLowerCase()) || installedMap.get((item.dir || '').toLowerCase());
  const row = el('div', 'ext-item');
  row.append(makeExtIcon(inst || item));
  const body = el('div', 'ext-body');
  const top = el('div', 'ext-top');
  top.append(el('span', 'ext-name', item.displayName || item.id));
  if (item.version) top.append(el('span', 'ext-ver', 'v' + item.version));
  body.append(top, el('div', 'ext-desc', item.description || ''));
  const meta = el('div', 'ext-meta');
  meta.append(el('span', '', item.publisher || item.id.split('.')[0] || ''));
  if (item.installs) meta.append(el('span', '', '· ' + fmtInstalls(item.installs)));
  if (inst) {
    meta.append(el('span', inst.enabled ? 'ext-badge' : 'ext-badge off', inst.enabled ? 'Enabled' : 'Disabled'));
    for (const tg of extCapabilityTags(inst)) meta.append(el('span', 'ext-badge', tg));
  }
  const acts = el('div', 'ext-acts');
  if (!inst) {
    const btn = el('button', 'ext-btn', 'Install');
    btn.onclick = async e => { e.stopPropagation(); await installExtFromUI(item, btn); };
    acts.append(btn);
  } else {
    if (inst.enabled && inst.themes?.length) {
      const tb = el('button', 'ext-btn', inst.themes.length === 1 && activeThemeKey === `${inst.dir}::${inst.themes[0].label}` ? 'Active Theme' : 'Apply Theme');
      tb.onclick = e => {
        e.stopPropagation();
        if (inst.themes.length === 1) {
          applyThemeByKey(`${inst.dir}::${inst.themes[0].label}`, true);
          toast(`Applied theme "${inst.themes[0].label}".`);
          renderExtensions();
        } else openExtDialog(inst);
      };
      acts.append(tb);
    }
    const tg = el('button', 'ext-btn sec', inst.enabled ? 'Disable' : 'Enable');
    tg.onclick = async e => { e.stopPropagation(); await toggleExtFromUI(inst); };
    const un = el('button', 'ext-btn sec', 'Uninstall');
    un.onclick = async e => { e.stopPropagation(); await uninstallExtFromUI(inst); };
    acts.append(tg, un);
  }
  body.append(meta, acts);
  row.append(body);
  row.onclick = () => openExtDialog(inst || item);
  return row;
}

function renderExtensions() {
  const listEl = $('#ext-list');
  if (!listEl) return;
  const q = ($('#ext-q').value || '').trim().toLowerCase();
  const instMap = new Map();
  for (const e of installedExts) { instMap.set(e.id.toLowerCase(), e); instMap.set(e.dir.toLowerCase(), e); }
  const filteredInst = q ? installedExts.filter(e => `${e.displayName} ${e.id} ${e.description} ${e.publisher}`.toLowerCase().includes(q)) : installedExts;
  const out = [];
  if (filteredInst.length) {
    const sec = el('div', 'ext-sec'); sec.append(el('span', '', 'Installed'), el('span', 'ext-cnt', String(filteredInst.length)));
    out.push(sec, ...filteredInst.map(it => renderExtCard(it, instMap)));
  }
  const mktOnly = marketExts.filter(m => !instMap.has(m.id.toLowerCase()));
  if (mktOnly.length) {
    const sec = el('div', 'ext-sec'); sec.append(el('span', '', 'VS Code Marketplace'), el('span', 'ext-cnt', String(mktOnly.length)));
    out.push(sec, ...mktOnly.map(it => renderExtCard(it, instMap)));
  }
  if (!out.length && $('#ext-msg').hidden) out.push(el('div', 'sr-msg', 'No extensions found.'));
  listEl.replaceChildren(...out);
}

async function searchMarketplace(q = '') {
  const seq = ++extSearchSeq;
  $('#ext-msg').hidden = false;
  $('#ext-msg').textContent = q ? `Searching Marketplace for "${q}"…` : 'Loading VS Code Marketplace…';
  try {
    const res = await getJSON('/proxy/ext/search?q=' + enc(q));
    if (seq !== extSearchSeq) return;
    marketExts = res;
    marketLoaded = true;
    $('#ext-msg').hidden = true;
    renderExtensions();
  } catch (e) {
    if (seq !== extSearchSeq) return;
    marketExts = [];
    $('#ext-msg').hidden = false;
    $('#ext-msg').textContent = 'Marketplace unavailable: ' + e.message;
    renderExtensions();
  }
}

function notifyExtOpenDocs(extDir) {
  for (const [rel, t] of tabs) if (t.model) extBus.fire('openDoc', { rel, model: t.model }, extDir);
  if (active && tabs.get(active)?.model) extBus.fire('activeEditor', { rel: active, model: tabs.get(active).model }, extDir);
}

async function installExtFromUI(item, btn) {
  if (btn) { btn.disabled = true; btn.replaceChildren(icon('loading', 'spin'), el('span', '', 'Installing…')); }
  try {
    const vsixUrl = item.vsixUrl;
    if (!vsixUrl) throw new Error('Extension VSIX URL not available');
    const r = await api('/proxy/ext/vsix?url=' + enc(vsixUrl));
    const manifest = await unzipVsixToManifest(await r.arrayBuffer(), item);
    // Extension code runs in this page with full access to every workspace in browser storage.
    if (manifest.hasBrowser && await modal(`Trust ${manifest.publisher || 'this publisher'} and run '${manifest.displayName}'?`,
      'This extension contains code that runs in a sandboxed frame, isolated from your projects, storage and tokens; it can only use the IDE capabilities it is granted (commands, providers, workspace file access for the active project). Only install extensions from publishers you trust.',
      [{ label: 'Trust & Install', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel' }]) !== 'ok') {
      if (btn) { btn.disabled = false; btn.textContent = 'Install'; }
      return;
    }
    await dbPut('extensions', manifest);
    installedExts = await dbAll('extensions');
    const live = installedExts.find(e => e.dir === manifest.dir) || manifest;
    await activateExtension(live);
    notifyExtOpenDocs(live.dir);
    let msg = `Installed ${live.displayName} v${live.version} in browser IndexedDB.`;
    if (live.themes?.length) {
      applyThemeByKey(`${live.dir}::${live.themes[0].label}`, true);
      msg += ` Applied theme "${live.themes[0].label}".`;
    }
    toast(msg);
    renderExtensions();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Install'; }
    toast(e.message, 'error');
  }
}

async function toggleExtFromUI(inst) {
  try {
    const next = !inst.enabled;
    const rec = await dbGet('extensions', inst.dir);
    if (rec) { rec.enabled = next; await dbPut('extensions', rec); }
    installedExts = await dbAll('extensions');
    const live = installedExts.find(e => e.dir === inst.dir);
    if (next && live) { await activateExtension(live); notifyExtOpenDocs(live.dir); }
    else deactivateExtension(inst.dir);
    renderExtensions();
  } catch (e) { fail(e); }
}

async function uninstallExtFromUI(inst) {
  try {
    deactivateExtension(inst.dir);
    await dbDel('extensions', inst.dir);
    installedExts = await dbAll('extensions');
    toast(`Uninstalled ${inst.displayName}.`);
    renderExtensions();
  } catch (e) { fail(e); }
}

function closeExtDialog() { if ($('#extdlg').open) $('#extdlg').close(); }
function openExtDialog(item) {
  const inst = installedExts.find(e => e.id.toLowerCase() === item.id.toLowerCase()) || (item.dir ? item : null);
  const src = inst || item;
  $('#edlg-icon').replaceChildren(makeExtIcon(src));
  $('#edlg-title').textContent = `${src.displayName || src.id} ${src.version ? 'v' + src.version : ''}`;
  $('#edlg-sub').textContent = `${src.id}${src.publisher ? ' · ' + src.publisher : ''}${src.installs ? ' · ' + fmtInstalls(src.installs) + ' installs' : ''}`;
  $('#edlg-desc').textContent = src.description || '';

  const thBox = $('#edlg-themes');
  if (inst?.enabled && inst.themes?.length) {
    thBox.hidden = false;
    const lbl = el('div', '', 'Click a color theme to apply in WebIDE:');
    lbl.style.cssText = 'font-size:11.5px;color:var(--dim);margin-bottom:6px';
    const chips = el('div', 'edlg-chips');
    for (const t of inst.themes) {
      const k = `${inst.dir}::${t.label}`;
      const c = el('button', 'edlg-chip' + (activeThemeKey === k ? ' on' : ''), t.label);
      c.onclick = () => { applyThemeByKey(k, true); openExtDialog(inst); renderExtensions(); toast(`Applied theme "${t.label}".`); };
      chips.append(c);
    }
    thBox.replaceChildren(lbl, chips);
  } else { thBox.hidden = true; thBox.replaceChildren(); }

  const tags = extCapabilityTags(inst || src).map(tg => el('span', 'ext-badge', tg));
  for (const cmd of (inst?.commands || []).slice(0, 8)) tags.push(el('span', 'ext-badge off', cmd.title || cmd.command));
  $('#edlg-contribs').replaceChildren(...tags);

  const acts = [];
  if (!inst) {
    const b = el('button', 'btn', 'Install');
    b.onclick = async () => { await installExtFromUI(src, b); closeExtDialog(); };
    acts.push(b);
  } else {
    const tg = el('button', 'btn sec', inst.enabled ? 'Disable' : 'Enable');
    tg.onclick = async () => { await toggleExtFromUI(inst); closeExtDialog(); };
    const un = el('button', 'btn sec', 'Uninstall');
    un.onclick = async () => { await uninstallExtFromUI(inst); closeExtDialog(); };
    acts.push(tg, un);
  }
  const cl = el('button', 'btn sec', 'Close'); cl.onclick = closeExtDialog;
  acts.push(cl);
  $('#edlg-acts').replaceChildren(...acts);
  if (!$('#extdlg').open) $('#extdlg').showModal();
}

$('#edlg-x').onclick = closeExtDialog;
$('#extdlg').addEventListener('cancel', e => { e.preventDefault(); closeExtDialog(); });
lightDismiss($('#extdlg'), closeExtDialog);

function openExtView() {
  if (isMobileUI()) return;
  showView('ext');
  dbAll('extensions').then(list => { installedExts = list; renderExtensions(); }).catch(() => {});
  if (!marketLoaded) searchMarketplace($('#ext-q').value.trim());
  $('#ext-q').focus();
}
$('#ext-q').oninput = () => {
  const v = $('#ext-q').value;
  $('#ext-clear').hidden = !v;
  renderExtensions();
  clearTimeout(extSearchTimer);
  extSearchTimer = setTimeout(() => searchMarketplace(v.trim()), 320);
};
$('#ext-q').onkeydown = e => { if (e.key === 'Enter' && !composing(e)) { clearTimeout(extSearchTimer); searchMarketplace($('#ext-q').value.trim()); } };
$('#ext-clear').onclick = () => { $('#ext-q').value = ''; $('#ext-clear').hidden = true; searchMarketplace(''); $('#ext-q').focus(); };
$('#ext-refresh').onclick = () => { dbAll('extensions').then(list => { installedExts = list; }).catch(() => {}); searchMarketplace($('#ext-q').value.trim()); };
$('#ext-themes').onclick = () => quickOpen('', 'theme');

// ---------- Markdown preview (built-in, like VS Code's "Open Preview to the Side") ----------
// markdown-it renders into an iframe sandboxed WITHOUT allow-scripts: raw HTML in untrusted .md files can't run code in the IDE origin.
var mdOn = isMobileUI(), mdIt = null, mdFrame = null, mdTimer = 0;
function mdActive() { return tabs.get(active)?.model?.getLanguageId() === 'markdown'; }
const MD_CSS = `html{color-scheme:dark light;-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;padding:16px 26px 50vh;font:14px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:var(--fg);background:var(--bg);overflow-wrap:break-word}
h1,h2,h3,h4,h5,h6{color:var(--strong);margin:1.3em 0 .6em;line-height:1.3;scroll-margin-top:12px} h1,h2{border-bottom:1px solid var(--border);padding-bottom:.3em}
a{color:var(--accent)} img,video{max-width:100%;height:auto} hr{border:0;border-top:1px solid var(--border);margin:1.5em 0}
p,li{overflow-wrap:anywhere}
code{font:12.5px ui-monospace,"SF Mono",Menlo,Consolas,monospace;background:#8882;padding:.15em .35em;border-radius:4px}
pre{background:#8881;padding:12px 14px;border-radius:6px;overflow:auto;-webkit-overflow-scrolling:touch} pre code{background:none;padding:0;white-space:pre}
blockquote{margin:0 0 1em;padding:0 1em;color:var(--dim);border-left:4px solid var(--border)}
table{border-collapse:collapse;margin:0 0 1em;display:block;max-width:100%;width:max-content;overflow-x:auto;-webkit-overflow-scrolling:touch}
th,td{border:1px solid var(--border);padding:6px 12px;vertical-align:top;overflow-wrap:normal;word-break:normal} th{background:#8881;text-align:left}
td code,th code{white-space:nowrap}
@media (max-width:600px){
 body{padding:14px 16px 40vh;font-size:15px;line-height:1.7}
 h1{font-size:1.55em} h2{font-size:1.3em} h3{font-size:1.12em} h4,h5,h6{font-size:1em}
 ul,ol{padding-left:1.35em} li+li{margin-top:.2em}
 code{font-size:12.5px} pre{margin:0 -16px 1em;padding:12px 16px;border-radius:0} pre code{font-size:12px;line-height:1.55}
 blockquote{padding:0 .8em}
 table{font-size:13.5px;line-height:1.5} th,td{padding:6px 10px;min-width:4.5em} td code,th code{white-space:normal;overflow-wrap:anywhere}
}`;
const mdSlug = s => s.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-');
async function ensureMdIt() {
  if (mdIt) return mdIt;
  if (!window.markdownit) await loadJs('/vendor/markdown-it/markdown-it.min.js');
  mdIt = window.markdownit({ html: true, linkify: true });
  // Tag blocks with their source line (scroll sync) and headings with VS Code-style ids (#anchor links).
  mdIt.core.ruler.push('webide_src', st => st.tokens.forEach((t, i) => {
    if (t.map && (t.nesting === 1 || t.type === 'fence' || t.type === 'code_block' || t.type === 'hr')) t.attrSet('data-line', String(t.map[0]));
    if (t.type === 'heading_open') t.attrSet('id', mdSlug(st.tokens[i + 1]?.content || ''));
  }));
  return mdIt;
}
const mdResolve = href => vsixResolve(href.startsWith('/') ? '' : active.split('/').slice(0, -1).join('/'), decodeURIComponent(href.split(/[?#]/)[0]));
const isExternalRef = href => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
function mdClick(e) {
  const a = e.target.closest?.('a[href]');
  if (!a) return;
  e.preventDefault();
  const href = a.getAttribute('href');
  if (href.startsWith('#')) return mdFrame.contentDocument.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView();
  if (isExternalRef(href)) { if (/^https?:/i.test(href)) window.open(href, '_blank', 'noopener'); return; }
  openFile(mdResolve(href)).catch(fail);
}
function mdFrameEl() {
  if (mdFrame) return mdFrame;
  mdFrame = el('iframe'); mdFrame.id = 'mdpv'; mdFrame.title = 'Markdown Preview';
  mdFrame.setAttribute('sandbox', 'allow-same-origin'); // DOM access for rendering/scroll sync; no scripts, forms or popups
  mdFrame.srcdoc = `<!doctype html><meta charset="utf-8"><style>${MD_CSS}</style><body></body>`;
  mdFrame.onload = () => { mdFrame.contentDocument.addEventListener('click', mdClick); renderMd().catch(() => {}); };
  $('#edwrap').append(mdFrame);
  editor.onDidScrollChange(() => { if (mdOn) syncMdScroll(); });
  return mdFrame;
}
async function renderMd() {
  const t = tabs.get(active), doc = mdFrame?.contentDocument, rel = active;
  if (!mdOn || !doc?.body || !t?.model) return;
  const md = await ensureMdIt();
  if (rel !== active) return;
  const css = getComputedStyle(document.documentElement);
  for (const k of ['--bg', '--fg', '--strong', '--dim', '--border', '--accent']) doc.documentElement.style.setProperty(k, css.getPropertyValue(k));
  doc.body.innerHTML = md.render(t.model.getValue());
  // Workspace-relative images: inline from the browser-local VFS as data: URLs (CSP img-src allows data:)
  for (const img of doc.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src');
    if (isExternalRef(src)) continue;
    img.removeAttribute('src');
    const p = mdResolve(src);
    vfsReadBytes(activeProj(), p).then(u8 => { img.src = bytesToDataUrl(u8, p); }).catch(() => {});
  }
  syncMdScroll();
}
// ponytail: snaps to the block at the editor's top line (no intra-block interpolation, no preview→editor sync)
function syncMdScroll() {
  const doc = mdFrame?.contentDocument;
  if (!doc?.body || !editor) return;
  const top = (editor.getVisibleRanges()[0]?.startLineNumber ?? 1) - 1;
  let best = null;
  for (const e of doc.querySelectorAll('[data-line]')) { if (+e.dataset.line <= top) best = e; else break; }
  doc.scrollingElement.scrollTop = top && best ? best.getBoundingClientRect().top + doc.scrollingElement.scrollTop - 12 : 0;
}
function updateMdPreview() {
  const show = mdOn && mdActive();
  $('#edwrap').classList.toggle('mdpv', show);
  if (show) { mdFrameEl(); renderMd().catch(() => {}); }
  renderCrumbs();
}
function toggleMdPreview(on = !mdOn) { mdOn = on; updateMdPreview(); }
// Context-menu entry (explorer + tabs) for markdown files: open the file and its side preview in one click
function mdMenu(rel) {
  return /\.(md|markdown|mdown|mkd)$/i.test(rel) ? [{ label: 'Open Preview to the Side', key: K.mdpv, run: () => openFile(rel).then(() => toggleMdPreview(true)) }] : [];
}
extBus.on('activeEditor', 'builtin:mdpv', updateMdPreview);
extBus.on('changeDoc', 'builtin:mdpv', p => {
  if (!mdOn || p.rel !== active) return;
  clearTimeout(mdTimer); mdTimer = setTimeout(() => renderMd().catch(() => {}), 120);
});

// ---------- auto save (afterDelay, 1s) ----------
const autoSaveTimers = new Map();
function toggleAutoSave() { prefs.autoSave = !prefs.autoSave; layout(); toast(`Auto Save ${prefs.autoSave ? 'on — files save 1s after you stop typing' : 'off'}`); }
function scheduleAutoSave(rel) {
  if (!prefs.autoSave) return;
  clearTimeout(autoSaveTimers.get(rel));
  autoSaveTimers.set(rel, setTimeout(() => {
    autoSaveTimers.delete(rel);
    const t = tabs.get(rel);
    if (t && isDirty(t)) saveTab(rel).catch(() => {});
  }, 1000));
}

// ---------- local history: saved versions per file, browser-local (IndexedDB `meta`) ----------
// ponytail: whole-text copies, 30 per file, saves within 30s merged; entries of deleted workspaces are never pruned.
const HIST_MAX = 30, HIST_MERGE_MS = 30e3, HIST_MAX_CHARS = 512 * 1024;
const histKey = rel => `hist:${root}:${rel}`;
async function historyBaseline(rel) { // first save: remember the on-disk version we are about to overwrite
  if (!root || await dbGet('meta', histKey(rel))) return;
  const { text } = await vfsReadFile(activeProj(), rel);
  if (text.length <= HIST_MAX_CHARS) await dbPut('meta', { key: histKey(rel), entries: [{ t: Date.now(), text, src: 'original' }] });
}
async function recordHistory(rel, text) {
  if (!root || text.length > HIST_MAX_CHARS) return;
  const key = histKey(rel), rec = (await dbGet('meta', key)) || { key, entries: [] }, last = rec.entries[0], now = Date.now();
  if (last?.text === text) return;
  if (last?.src === 'save' && now - last.t < HIST_MERGE_MS) rec.entries[0] = { t: now, text, src: 'save' };
  else rec.entries.unshift({ t: now, text, src: 'save' });
  rec.entries.length = Math.min(rec.entries.length, HIST_MAX);
  await dbPut('meta', rec);
}
async function openLocalHistory(rel) {
  const entries = (await dbGet('meta', histKey(rel)).catch(() => null))?.entries || [];
  if (!entries.length) return toast(`No local history for ${base(rel)} yet — versions are recorded when you save.`);
  qo.listItems = entries.map(e => ({ label: `${new Date(e.t).toLocaleString()}${e.src === 'original' ? '  ·  before first save' : ''}`, run: () => openHistoryDiff(rel, e) }));
  quickOpen('', 'list');
}
async function openHistoryDiff(rel, entry) {
  await openFile(rel);
  const t = tabs.get(rel);
  if (active !== rel || !t?.model) return;
  closeCompare();
  const when = new Date(entry.t).toLocaleString();
  const orig = monaco.editor.createModel(entry.text, t.model.getLanguageId());
  const box = el('div'); box.id = 'diff';
  const restore = el('button', 'btn', 'Restore This Version'), x = el('button', 'ibtn');
  restore.title = 'Replace the editor contents with this version (undoable; save to keep it)';
  x.title = 'Close'; x.append(icon('close'));
  restore.onclick = () => {
    t.model.pushEditOperations([], [{ range: t.model.getFullModelRange(), text: entry.text }], () => null);
    closeCompare(); toast(`Restored ${base(rel)} to ${when}. Save to keep it.`);
  };
  x.onclick = () => closeCompare();
  const bar = el('div', 'dbar');
  bar.append(icon('history'), el('span', 'dt', `${base(rel)} (${when}) ↔ ${base(rel)} (current)`), el('span', 'sp'), restore, x);
  const host = el('div', 'dhost');
  box.append(bar, host); $('#edwrap').append(box);
  const de = monaco.editor.createDiffEditor(host, { ...diffLayoutOpts(), automaticLayout: true, readOnly: true, originalEditable: false, fontFamily: editor.getRawOptions().fontFamily });
  de.setModel({ original: orig, modified: t.model });
  diff = { kind: 'history', rel, de, orig, box };
}

// ---------- cross-file TS/JS IntelliSense: unopened workspace sources become TS extraLibs at their real file:// URIs ----------
const TS_SRC = /\.(tsx?|jsx?|mjs|cjs|mts|cts)$/i, TS_LANGS = new Set(['typescript', 'javascript']);
let tsIndexedRoot = null;
const tsDefaults = () => [monaco.languages.typescript.typescriptDefaults, monaco.languages.typescript.javascriptDefaults];
async function indexTsWorkspace() {
  const proj = activeProj(), r = root;
  if (!proj || tsIndexedRoot === r) return;
  tsIndexedRoot = r;
  const { files } = await vfsAllFiles(proj, { skipHeavy: true, limit: 20000 });
  // ponytail: first 2000 sources, read once per workspace; new/renamed files join on the next workspace switch
  const srcs = files.filter(f => TS_SRC.test(f) && !/(^|\/)node_modules\//.test(f)).slice(0, 2000), libs = [];
  for (let i = 0; i < srcs.length; i += 32) {
    const res = await Promise.allSettled(srcs.slice(i, i + 32).map(f => vfsReadFile(proj, f)));
    if (root !== r) return;
    res.forEach((x, j) => { if (x.status === 'fulfilled' && x.value.text.length < 1e6) libs.push({ content: x.value.text, filePath: monaco.Uri.file('/' + srcs[i + j]).toString() }); });
  }
  for (const d of tsDefaults()) d.setExtraLibs(libs);
}
extBus.on('activeEditor', 'builtin:ts', p => { if (p?.model && TS_LANGS.has(p.model.getLanguageId())) indexTsWorkspace().catch(() => {}); });
extBus.on('closeDoc', 'builtin:ts', p => { // a closed file falls back to its extraLib: keep that copy current
  if (tsIndexedRoot === root && TS_SRC.test(p.rel)) for (const d of tsDefaults()) d.addExtraLib(p.model.getValue(), p.model.uri.toString());
});

// ---------- language-feature taps: built-in Monaco modes and extensions register through these ----------
// (a) Prettier stays the newest, i.e. preferred, formatter; the built-in one is its offline fallback. (b) the Outline can query symbol providers.
const PRETTIER = '/vendor/prettier/';
const PRETTIER_LANGS = {
  javascript: ['babel', ['babel', 'estree']], typescript: ['typescript', ['typescript', 'estree']], json: ['json', ['babel', 'estree']],
  css: ['css', ['postcss']], scss: ['scss', ['postcss']], less: ['less', ['postcss']], html: ['html', ['html', 'postcss', 'babel', 'estree']],
  markdown: ['markdown', ['markdown']], yaml: ['yaml', ['yaml']], graphql: ['graphql', ['graphql']],
};
const jsLoads = new Map();
const loadJsOnce = url => jsLoads.get(url) || (jsLoads.set(url, loadJs(url).catch(e => { jsLoads.delete(url); throw e; })), jsLoads.get(url));
async function prettierFormat(model, opts) {
  const [parser, plugins] = PRETTIER_LANGS[model.getLanguageId()];
  await loadJsOnce(PRETTIER + 'standalone.js');
  await Promise.all(plugins.map(n => loadJsOnce(`${PRETTIER}plugins/${n}.js`)));
  let rc = {};
  try { rc = parseJsonc((await vfsReadFile(activeProj(), '.prettierrc')).text) || {}; } catch {} // ponytail: JSON .prettierrc only
  return window.prettier.format(model.getValue(), { tabWidth: opts.tabSize, useTabs: !opts.insertSpaces, ...rc, parser, filepath: relOfUri(model.uri), plugins: plugins.map(n => window.prettierPlugins[n]) });
}
const fmtFallback = new Map(), prettierRegs = new Map(), symProviders = [];
function tapLanguageFeatures() {
  const L = monaco.languages, regFmt = L.registerDocumentFormattingEditProvider.bind(L), regSym = L.registerDocumentSymbolProvider.bind(L);
  const langsOf = sel => (Array.isArray(sel) ? sel : [sel]).map(x => (typeof x === 'string' ? x : x?.language)).filter(Boolean);
  const regPrettier = lang => {
    prettierRegs.get(lang)?.dispose();
    prettierRegs.set(lang, regFmt(lang, { displayName: 'Prettier', async provideDocumentFormattingEdits(model, opts, token) {
      try {
        const text = await prettierFormat(model, opts);
        return text === model.getValue() ? [] : [{ range: model.getFullModelRange(), text }];
      } catch (e) {
        if (e instanceof Error) { toast(`Prettier: ${String(e.message).split('\n')[0]}`, 'error'); return []; } // syntax error in the file
        const fb = fmtFallback.get(lang); // script load failed (offline): built-in formatter
        if (fb?.provideDocumentFormattingEdits) return fb.provideDocumentFormattingEdits(model, opts, token);
        if (fb) return fb.provideDocumentRangeFormattingEdits(model, model.getFullModelRange(), opts, token); // TS/JS only ship a range formatter
        toast('Prettier could not be loaded (offline?)', 'error'); return [];
      }
    } }));
  };
  L.registerDocumentFormattingEditProvider = (sel, prov) => {
    const d = regFmt(sel, prov);
    for (const l of langsOf(sel)) if (PRETTIER_LANGS[l]) { fmtFallback.set(l, prov); regPrettier(l); }
    return d;
  };
  const regRange = L.registerDocumentRangeFormattingEditProvider.bind(L);
  L.registerDocumentRangeFormattingEditProvider = (sel, prov) => {
    for (const l of langsOf(sel)) if (PRETTIER_LANGS[l] && !fmtFallback.has(l)) fmtFallback.set(l, prov);
    return regRange(sel, prov);
  };
  L.registerDocumentSymbolProvider = (sel, prov) => {
    const rec = { langs: langsOf(sel), prov };
    symProviders.push(rec);
    const d = regSym(sel, prov);
    return { dispose() { d.dispose(); const i = symProviders.indexOf(rec); if (i >= 0) symProviders.splice(i, 1); } };
  };
  for (const l of Object.keys(PRETTIER_LANGS)) regPrettier(l);
  // Markdown headings as symbols: feeds the Outline and Go to Symbol (⇧⌘O)
  L.registerDocumentSymbolProvider('markdown', { provideDocumentSymbols(model) {
    const out = [], stack = [];
    let fence = null;
    model.getLinesContent().forEach((line, i) => {
      const f = line.match(/^\s{0,3}(`{3,}|~{3,})/);
      if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = null; return; }
      const m = !fence && line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (!m) return;
      const range = { startLineNumber: i + 1, startColumn: 1, endLineNumber: i + 1, endColumn: line.length + 1 };
      const sym = { name: m[2] || ' ', detail: '', kind: L.SymbolKind.String, tags: [], range, selectionRange: range, children: [] };
      while (stack.length && stack.at(-1).level >= m[1].length) stack.pop();
      (stack.at(-1)?.sym.children || out).push(sym);
      stack.push({ level: m[1].length, sym });
    });
    return out;
  } });
}

// ---------- Outline (bottom section of the Explorer) ----------
let olTimer = 0, olSeq = 0;
const SYM_ICON = { Constructor: 'method', Module: 'namespace', Object: 'namespace', TypeParameter: 'type-parameter', EnumMember: 'enum-member' };
const symIcon = kind => { const n = monaco.languages.SymbolKind[kind] || 'Misc'; return 'symbol-' + (SYM_ICON[n] || n.toLowerCase()); };
async function renderOutline() {
  const ul = $('#outline');
  if (!ul || ul.hidden || !window.monaco) return;
  const seq = ++olSeq, model = active && tabs.get(active)?.model;
  if (!model) return ul.replaceChildren(el('li', 'ol-empty', 'No editor is active.'));
  const lang = model.getLanguageId(), token = new monaco.CancellationTokenSource().token;
  let syms = null;
  for (const p of symProviders) {
    if (!p.langs.includes(lang) && !p.langs.includes('*')) continue;
    try { syms = await p.prov.provideDocumentSymbols(model, token); } catch {}
    if (syms?.length) break;
  }
  if (seq !== olSeq) return;
  if (!syms?.length) return ul.replaceChildren(el('li', 'ol-empty', 'No symbols found in document.'));
  const rows = [];
  const walk = (list, depth) => {
    for (const s of [...list].sort((a, b) => a.range.startLineNumber - b.range.startLineNumber || a.range.startColumn - b.range.startColumn)) {
      const li = el('li'), r = s.selectionRange || s.range;
      li.style.paddingLeft = 12 + depth * 14 + 'px'; li.title = s.name;
      li.append(icon(symIcon(s.kind)), el('span', '', s.name));
      if (s.detail) li.append(el('span', 'ol-detail', s.detail));
      li.onclick = () => gotoPosition(active, r.startLineNumber, r.startColumn).catch(fail);
      rows.push(li);
      if (s.children?.length) walk(s.children, depth + 1);
    }
  };
  walk(syms, 0);
  ul.replaceChildren(...rows);
}
function scheduleOutline() { clearTimeout(olTimer); olTimer = setTimeout(() => renderOutline().catch(() => {}), 300); }
extBus.on('activeEditor', 'builtin:outline', scheduleOutline);
extBus.on('changeDoc', 'builtin:outline', p => { if (p.rel === active) scheduleOutline(); });
function syncOutlineHead() {
  const open = prefs.outline !== false;
  $('#outline').hidden = !open;
  $('#ol-tw').className = `codicon codicon-chevron-${open ? 'down' : 'right'}`;
}
$('#ol-head').onclick = () => { prefs.outline = prefs.outline === false; syncOutlineHead(); layout(); renderOutline().catch(() => {}); };
syncOutlineHead();

// ---------- parallel boot (UI/Home/Tree render immediately; Monaco hydrates asynchronously) ----------
const earlyBoot = (async () => {
  ensureToken();
  try {
    const mob = isMobileUI();
    const [savedProjs, orderMeta, activeMeta, exts] = await Promise.all([
      dbAll('projects').catch(() => []),
      dbGet('meta', 'projects').catch(() => null),
      dbGet('meta', 'activeProject').catch(() => null),
      mob ? Promise.resolve([]) : dbAll('extensions').catch(() => []),
    ]);
    installedExts = exts || [];
    if (!mob) renderExtensions();
    await loadRoot([savedProjs, orderMeta, activeMeta]);
  } catch (e) { fail(e); }
})();

function startMonaco() {
  if (!window.require) return;
  require.config({ paths: { vs: MONACO + '/vs' } });
  window.MonacoEnvironment = { getWorkerUrl: () => URL.createObjectURL(new Blob([`self.MonacoEnvironment={baseUrl:'${location.origin}${MONACO}/'};importScripts('${location.origin}${MONACO}/vs/base/worker/workerMain.js')`], { type: 'text/javascript' })) };
  require(['vs/editor/editor.main'], async () => {
    monaco.editor.defineTheme('dark-modern', { base: 'vs-dark', inherit: true, rules: [], colors: {
      'editor.background': '#060608', 'editorGutter.background': '#060608', 'minimap.background': '#060608',
      'editorLineNumber.foreground': '#525266', 'editorLineNumber.activeForeground': '#e2e8f0', 'editor.lineHighlightBackground': '#ffffff05', 'editor.lineHighlightBorder': '#ffffff0a', 'editor.selectionBackground': '#6366f138',
    } });
    tapLanguageFeatures();
    for (const d of tsDefaults()) {
      d.setCompilerOptions({ ...d.getCompilerOptions(), target: monaco.languages.typescript.ScriptTarget.ESNext, module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs, jsx: monaco.languages.typescript.JsxEmit.React, allowJs: true, esModuleInterop: true, allowNonTsExtensions: true });
    }
    // Go to Definition / references into another workspace file: open it as a tab
    monaco.editor.registerEditorOpener({ openCodeEditor(_src, resource, sel) {
      if (resource.scheme !== 'file' || !root) return false;
      const rel = relOfUri(resource);
      openFile(rel).then(() => {
        if (active !== rel || !sel) return;
        if ('startLineNumber' in sel) { editor.setSelection(sel); editor.revealRangeInCenter(sel); } else { editor.setPosition(sel); editor.revealPositionInCenter(sel); }
        editor.focus();
      }).catch(fail);
      return true;
    } });
    blankModel = monaco.editor.createModel('', 'plaintext');
    const mob = isMobileUI();
    lastMob = mob;
    editor = monaco.editor.create($('#ed'), {
      ...edLayoutOpts(mob), model: blankModel, readOnly: true, theme: 'dark-modern', automaticLayout: true, fontFamily: 'ui-monospace, "SF Mono", Menlo, "Cascadia Mono", Consolas, monospace',
      padding: { top: 6 }, smoothScrolling: true, cursorSmoothCaretAnimation: 'on', scrollBeyondLastLine: false, renderLineHighlight: 'all',
    });
    editor.onDidChangeCursorPosition(updateStatus);
    editor.addAction({ id: 'webide.markdown.preview', label: 'Markdown: Open Preview to the Side', precondition: 'editorLangId == markdown', contextMenuGroupId: 'navigation', contextMenuOrder: 0, run: () => toggleMdPreview(true) });
    const syncUnicode = () => { const l = editor.getModel()?.getLanguageId(); editor.updateOptions({ unicodeHighlight: { ambiguousCharacters: l !== 'markdown' && l !== 'plaintext' } }); };
    editor.onDidChangeModel(syncUnicode); editor.onDidChangeModelLanguage(syncUnicode);
    editor.onDidChangeCursorSelection(() => extBus.fire('selection', {}));
    monaco.editor.onDidChangeMarkers(refreshProblemsStatus);
    $('#loading')?.remove();
    await earlyBoot;
    if (!isMobileUI()) await loadExtensions(installedExts).catch(e => console.warn('Extensions init:', e));
    if (active && tabs.has(active)) await activate(active, { noReveal: true });
  }, err => { $('#loading').textContent = 'Could not load the editor (Monaco): ' + err.message; });
}
if (window.require) startMonaco(); else addEventListener('DOMContentLoaded', startMonaco, { once: true });
