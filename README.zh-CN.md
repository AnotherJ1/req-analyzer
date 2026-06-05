# Req Analyzer

[English](README.md)

Req Analyzer 是一个 Chrome/Edge DevTools 插件，灵感来自
[Mouseww/anything-analyzer](https://github.com/Mouseww/anything-analyzer)。

这一版专注于浏览器插件最适合做的部分：**分析当前正在调试的浏览器标签页**。它不会尝试替代桌面版的 MITM 代理、系统代理和证书管理能力，而是把“网页请求捕获 + JS Hook + 存储快照 + AI 分析”做成一个轻量可加载的插件 MVP。

## 功能

- DevTools 中新增 `Analyzer` 面板
- 浏览器右侧 Side Panel 操作台，点击插件图标即可打开
- 默认中文界面，支持中文/英文切换
- 捕获控制支持 `开始`、`暂停`、`停止`
- 通过 `chrome.devtools.network` 捕获当前页面请求
- 右侧 Side Panel 通过 `chrome.debugger` 捕获当前标签页请求
- 通过 `request.getContent()` 读取响应内容
- 注入页面主环境 Hook，捕获：
  - `fetch`
  - `XMLHttpRequest`
  - `crypto.subtle`
  - `document.cookie`
- 捕获 Cookie、`localStorage`、`sessionStorage` 快照
- 支持通过 Chrome cookies API 读取 Cookie 元信息，HttpOnly 值会显示为 `[HttpOnly]`
- 请求列表、请求详情、Hook 事件、存储快照四个视图
- 支持搜索和域名过滤
- 支持通过 UI 控制 Network、JS hooks、Storage snapshots、Cookie API snapshot
- 支持导出 Session JSON、HAR、Requests JSON、Hooks JSON、Storage JSON、Analysis Markdown
- 支持在请求详情里一键复制 `fetch` 复现代码和 `cURL` 命令
- 支持 OpenAI-compatible 接口做 AI 分析
- 支持通过浏览器右侧面板配置 AI 参数
- Model 输入框支持手输，也支持拉取模型列表后从输入提示中选择
- 支持测试当前模型是否可用
- AI 分析支持对话模式、预设问题和手动追问
- 可配置 Base URL、API Key、模型名和请求/响应 body 截断长度

## 本地安装

1. 打开 Chrome 或 Edge。
2. 进入 `chrome://extensions`。
3. 打开右上角 `开发者模式`。
4. 点击 `加载已解压的扩展程序`。
5. 选择当前项目目录：

```text
D:\work\cc\google-plagin
```

6. 打开任意网页。
7. 点击浏览器工具栏中的插件图标，右侧会打开 Req Analyzer 面板。
8. 点击 `开始`。
9. 刷新页面并正常操作网站。

也可以打开 DevTools 并切换到 `Analyzer` 面板使用开发者工具版本。

> 注意：DevTools 打开前已经发生的请求可能不会出现在捕获结果里。建议打开 `Analyzer` 后点击 `Start`，再刷新页面。

## AI 配置

在 `Analyzer` 面板右上角点击 `Settings`，填写：

- `Base URL`：只需要填写 OpenAI-compatible 服务域名即可，例如 `api.openai.com`。插件会自动补全 `https://` 和 `/v1`
- `API key`：你的模型服务密钥
- `Model`：模型名，例如 `gpt-4.1-mini`，也可以填写你的服务支持的其他模型
- `获取`：从 OpenAI-compatible `/models` 接口拉取模型列表，拉取成功后可在 `Model` 输入框中选择
- `测试模型`：用 Base URL、API Key 和 Model 发起一次 OpenAI-compatible 最小请求，验证模型是否可用
- `Max captured body chars per request`：每个请求/响应 body 发送给 AI 的最大字符数


插件只会在你点击 `Analyze` 时，把当前捕获到的请求摘要、部分 body、Hook 事件和存储快照发送到你配置的接口。

## 使用建议

典型流程：

1. 打开目标页面。
2. 打开 DevTools，进入 `Analyzer`。
3. 点击 `Start`。
4. 刷新页面。
5. 完成登录、搜索、下单、提交表单等你想分析的操作。
6. 在 `Requests` 查看关键接口。
7. 在顶部控制条选择要启用的捕获源：`Network`、`JS hooks`、`Storage snapshots`、`Cookie API snapshot`。
8. 在 `Requests` 的请求详情里复制 `fetch` 或 `cURL` 复现代码，也可以直接点击 `Analyze this` 分析单个请求。
9. 在 `Hooks` 查看前端发起请求、加密、签名、Cookie 写入等事件。
10. 在 `Storage` 查看 Cookie、localStorage、sessionStorage 变化。
11. 进入 `Analysis`，选择分析模式和分析范围，然后点击 `Analyze`。
12. 也可以点击预设问题，或在对话框中输入自定义问题继续追问。

分析范围：

- `All captured data`：分析全部捕获数据
- `Filtered data`：只分析当前搜索、域名、状态过滤后的数据
- `Selected request`：只分析当前选中的请求

导出格式：

- `Session JSON`：完整会话，包含请求、Hook、存储快照
- `HAR`：网络请求 HAR
- `Requests JSON`：仅请求
- `Hooks JSON`：仅 Hook 事件
- `Storage JSON`：仅存储快照
- `Analysis MD`：当前 AI 分析报告

支持的分析模式：

- `Auto detect`：自动识别关键 API、鉴权流程、状态变化和风险点
- `API reverse engineering`：生成接口文档、参数说明、鉴权流程和复现示例
- `Security audit`：检查 Token 泄露、敏感数据、风险 Header、CSRF/XSS 相关线索
- `Performance`：分析慢请求、大响应、重复请求、缓存问题
- `JS crypto analysis`：分析前端加密、签名、摘要、密钥处理和复现思路

AI 对话区内置预设问题：

- 梳理接口和鉴权流程
- 检查安全风险
- 分析加密/签名逻辑
- 生成复现代码

手动输入框支持自由追问，插件会带上当前捕获上下文和最近几轮对话历史继续分析。

## 当前边界

这一版是插件 MVP，刻意不包含以下桌面端能力：

- MITM HTTPS 代理
- CA 证书生成、安装、卸载
- 系统代理切换
- 抓取桌面应用、终端命令、手机 App 流量
- 本地 MCP stdio server
- SQLite 长期会话数据库

这些能力更适合放在后续的 Native Companion 本地伴随程序里，通过 Chrome Native Messaging 和插件通信。

## 项目结构

```text
manifest.json
src/
  background.js   # service worker，负责 panel/content 消息桥接和存储
  content.js      # content script，负责注入 hook 和采集存储快照
  injected.js     # 页面主环境 hook，捕获 fetch/XHR/crypto/cookie
  devtools.html   # DevTools 插件入口
  devtools.js     # 创建 Analyzer 面板
  panel.html      # 插件主界面
  panel.css       # 界面样式
  panel.js        # 捕获、展示、导出、AI 分析逻辑
  sidepanel.html  # 浏览器右侧主操作台
  sidepanel.css
  sidepanel.js
  popup.html      # 旧版弹窗入口，当前主入口为 side panel
  popup.css
  popup.js
scripts/
  validate-extension.mjs # 本地清单和 JS 语法校验脚本
  pack.mjs               # 打包上架 ZIP
STORE_LISTING.md          # CWS 上架材料汇总
PRIVACY.md                # 隐私政策
```

## 打包

```bash
node scripts/pack.mjs
```

成功后会输出文件清单，ZIP 位于 `dist/req-analyzer-v0.1.0.zip`。

## 本地校验

如果安装了 Node.js，可以运行：

```bash
node scripts/validate-extension.mjs
```

成功时会输出：

```text
Extension manifest and JavaScript syntax look good.
```

## 权限说明

插件使用了较宽的 host 权限：

```json
"host_permissions": ["<all_urls>"]
```

这是因为流量分析插件需要在不同网站上读取当前页面请求、注入 Hook、采集存储快照。正式发布到商店前，建议改成更保守的权限策略，例如：

- 使用可选 host permissions
- 只对用户主动启用的域名生效
- 增加域名 allowlist
- 增加敏感字段脱敏规则
- 在 UI 中明确显示当前是否正在捕获

## 隐私与合规

插件不会自动上传数据。只有当你点击 `Analyze` 时，它才会把当前会话中被截取后的请求、响应、Hook 事件和存储快照发送给你配置的 AI 接口。

不要在未授权的网站、账号或系统上使用本工具。不要把包含隐私、商业秘密、访问令牌或敏感业务数据的会话发送到不可信的模型服务。

## 已知限制

- DevTools 打开前发生的请求可能无法捕获，需要刷新页面。
- 大型响应、二进制响应或浏览器认为不可读取的响应可能无法完整获取。
- `document.cookie` 无法读取 HttpOnly Cookie 的值。
- 某些站点的 CSP、沙箱 iframe 或浏览器安全策略可能影响 Hook 注入。
- `chrome.devtools.network` 只适合分析浏览器页面，不适合抓取桌面应用、终端程序或手机 App。
- 右侧面板使用 `chrome.debugger` 捕获当前标签页，浏览器会显示调试权限提示，这是 Chrome 扩展的正常安全提示。
