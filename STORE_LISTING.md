# Chrome Web Store 上架材料 — Req Analyzer

本文件汇总提交到 Chrome 网上应用店时需要填写的字段内容，方便复制粘贴。

---

## 1. 商品名称（Name）

```
Req Analyzer
```

## 2. 简短说明 / Summary（≤132 字符）

英文：
```
A developer tool to capture, inspect, and debug network traffic on your own websites, with optional AI-assisted analysis.
```

中文（若填中文区）：
```
面向网站开发者的网络请求抓取与调试工具，可检查请求/响应、Hook 与存储，并可选接入你自己的 AI 接口进行分析。
```

## 3. 详细说明（Description）

```
Req Analyzer is a network debugging tool built for web developers who need to
inspect and troubleshoot traffic on the websites and web apps they are building.

WHAT IT DOES
- Capture network requests and responses on the tab you are inspecting
- Inspect URL, method, status, headers, request/response bodies
- Hook fetch, XMLHttpRequest, crypto.subtle, and document.cookie at runtime
- Take storage snapshots of cookies, localStorage, and sessionStorage
- Optional Chrome cookies API snapshot (HttpOnly values are masked)
- Filter by search, status, request type (Fetch/XHR, Doc, JS, CSS, etc.)
- Generate ready-to-run fetch and cURL snippets from any request
- Export sessions as JSON or HAR
- Works in both a DevTools panel and a browser side panel
- Available in English, 简体中文, 日本語, and 한국어

AI ANALYSIS (BRING YOUR OWN ENDPOINT)
This extension does NOT include any AI service. If you want AI-assisted analysis,
you configure your own OpenAI-compatible API endpoint (base URL, API key, model).
Captured data is sent to that endpoint only when you click "Analyze", and only to
the endpoint you provide. The extension has no backend of its own and collects no
data for the developer.

WHO IT IS FOR
Front-end and back-end web developers debugging their own sites — reproducing
bugs, understanding API behavior, checking auth/headers, and verifying request
flows during development.

PRIVACY
All captured data stays local in your browser unless you explicitly send it to
your own configured AI endpoint. No telemetry, no analytics, no data sold or
shared. See the privacy policy for details.
```

## 4. 类别（Category）

```
开发者工具 / Developer Tools
```

## 5. 隐私权政策网址（Privacy policy URL）

把仓库里的 `PRIVACY.md` 发布为可访问的网页地址，例如：

- GitHub 直链：`https://github.com/AnotherJ1/req-analyzer/blob/main/PRIVACY.md`
- 或 GitHub Pages：`https://anotherj1.github.io/req-analyzer/privacy.html`

> 商店要求这是一个**公开可访问的 URL**。GitHub 上的 PRIVACY.md 直链通常即可被接受。

---

## 6. 权限正当性说明（Permission justifications）

提交时每个敏感权限都要填写「为什么需要」。逐项文案如下：

### `debugger`
```
Used to capture network requests and responses (including response bodies) on the
tab the developer is inspecting, via the Chrome DevTools Protocol. This is the core
debugging feature: it lets web developers see the full request/response detail of
their own site to reproduce and fix bugs. Capture only runs when the user clicks
"Start", and stops when they click "Stop". No traffic is sent to any server
operated by the extension.
```

### `<all_urls>` / host permissions
```
Web developers need to debug traffic on whatever site they are currently working
on, which can be any URL (localhost, staging, production they own). Broad host
access is required so the tool can attach to the inspected tab regardless of its
domain. The extension only captures the tab the user actively starts a session on.
```

### `cookies`
```
Powers the optional "Cookie snapshot" feature, which lists cookies for the
inspected site to help developers debug authentication/session issues. HttpOnly
cookie values are masked as [HttpOnly] and never exposed.
```

### `scripting`
```
Injects the runtime hooks (fetch / XMLHttpRequest / crypto.subtle / document.cookie)
into the inspected page so the developer can observe how their own site issues
requests and uses these APIs.
```

### `tabs`
```
Used to identify the currently inspected tab (title/URL) so capture is scoped to
the correct page and shown in the panel header.
```

### `sidePanel`
```
Provides the side panel workspace where capture results and analysis are shown.
```

### `storage`
```
Stores user settings locally (AI endpoint base URL, API key, model, language).
Nothing is sent off-device by this permission.
```

### Remote code
```
The extension does not execute remote code. All scripts are bundled in the package.
The only network calls are: (1) DevTools-protocol capture of the inspected tab, and
(2) requests to the user's own configured AI endpoint, sent only on explicit user
action.
```

### 数据用途声明（Data usage disclosures）
在「隐私权实务」表单中，按实际情况勾选：

- 是否收集用户数据：**否**（扩展自身不向开发者收集任何数据）
- 说明：捕获的数据仅保存在用户本地浏览器；仅当用户主动点击「分析」时，数据才发送到
  **用户自行配置的第三方 AI 接口**，该接口由用户选择并对其数据处理负责。
- 不出售/不转移数据给第三方（用户自选的 AI 接口除外，且由用户控制）。

---

## 7. 需要准备的图片素材

- 图标 128×128（已有 `assets/icons/icon-128.png`）
- 至少 1 张商店截图：**1280×800** 或 **640×400**（PNG/JPG）。
  建议截「请求列表 + 详情」「AI 分析」「设置」几张实际界面。
- （可选）小型宣传图 440×280。

---

## 8. 打包

上架包已生成：`dist/req-analyzer-v0.1.0.zip`
重新打包命令见 `scripts/`（或用项目的打包脚本）。
