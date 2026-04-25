const i18n = {
  "zh-CN": {
    appTitle: "Anything Analyzer",
    start: "开始",
    pause: "暂停",
    stop: "停止",
    reload: "刷新",
    clear: "清空",
    network: "网络",
    hooks: "JS Hook",
    storage: "存储快照",
    cookies: "Cookie API",
    requests: "请求",
    hookEvents: "Hook",
    snapshots: "快照",
    state: "状态",
    searchPlaceholder: "搜索 URL、状态、字段",
    allStatus: "全部状态",
    errors: "错误",
    tabRequests: "请求",
    tabHooks: "Hook",
    tabStorage: "存储",
    tabAi: "AI 分析",
    tabSettings: "设置",
    manualSnapshot: "手动 Cookie 快照",
    analysisMode: "分析模式",
    analysisScope: "分析范围",
    modeAuto: "自动识别",
    modeApi: "API 逆向",
    modeSecurity: "安全审计",
    modePerformance: "性能分析",
    modeCrypto: "加密分析",
    scopeAll: "全部数据",
    scopeFiltered: "过滤后数据",
    scopeSelected: "选中请求",
    analyze: "开始分析",
    copy: "复制",
    exportMd: "导出 MD",
    analysisEmpty: "配置 AI 后，捕获流量并点击开始分析。",
    promptApi: "梳理接口和鉴权流程",
    promptRisk: "检查安全风险",
    promptCrypto: "分析加密/签名逻辑",
    promptReplay: "生成复现代码",
    chatPlaceholder: "输入你想追问的问题",
    send: "发送",
    userRole: "你",
    assistantRole: "AI",
    provider: "协议",
    baseUrl: "Base URL",
    apiKey: "API Key",
    model: "Model",
    fetchModels: "获取",
    testModel: "测试模型",
    bodyLimit: "Body 字符数",
    anthropicVersion: "Anthropic Version",
    saveSettings: "保存设置",
    noRequests: "暂无请求，点击开始后刷新或操作页面。",
    noHooks: "暂无 Hook 事件。",
    noStorage: "暂无存储快照。",
    selected: "已选择",
    copied: "已复制。",
    saved: "已保存。",
    analyzing: "正在分析...",
    needAi: "请先在设置里填写 API Key。",
    needData: "请先捕获一些数据。",
    needSelected: "请先选择一个请求。",
    modelLoaded: "模型列表已获取。",
    modelLoading: "正在获取模型列表...",
    modelEmpty: "没有获取到模型。",
    modelTesting: "正在测试模型...",
    modelOk: "模型测试通过。",
    analysisSending: "正在分析...\n协议：{provider}\n接口：{url}\n模型：{model}",
    captureStarted: "运行中",
    capturePaused: "已暂停",
    captureStopped: "已停止"
  },
  en: {
    appTitle: "Anything Analyzer",
    start: "Start",
    pause: "Pause",
    stop: "Stop",
    reload: "Reload",
    clear: "Clear",
    network: "Network",
    hooks: "JS Hooks",
    storage: "Storage",
    cookies: "Cookie API",
    requests: "Requests",
    hookEvents: "Hooks",
    snapshots: "Snapshots",
    state: "State",
    searchPlaceholder: "Search URL, status, fields",
    allStatus: "All status",
    errors: "Errors",
    tabRequests: "Requests",
    tabHooks: "Hooks",
    tabStorage: "Storage",
    tabAi: "AI",
    tabSettings: "Settings",
    manualSnapshot: "Cookie Snapshot",
    analysisMode: "Analysis mode",
    analysisScope: "Scope",
    modeAuto: "Auto detect",
    modeApi: "API reverse engineering",
    modeSecurity: "Security audit",
    modePerformance: "Performance",
    modeCrypto: "Crypto analysis",
    scopeAll: "All data",
    scopeFiltered: "Filtered data",
    scopeSelected: "Selected request",
    analyze: "Analyze",
    copy: "Copy",
    exportMd: "Export MD",
    analysisEmpty: "Configure AI, capture traffic, then run analysis.",
    promptApi: "Map APIs and auth",
    promptRisk: "Check security risks",
    promptCrypto: "Analyze crypto/signing",
    promptReplay: "Generate replay code",
    chatPlaceholder: "Ask a follow-up question",
    send: "Send",
    userRole: "You",
    assistantRole: "AI",
    provider: "Protocol",
    baseUrl: "Base URL",
    apiKey: "API Key",
    model: "Model",
    fetchModels: "Fetch",
    testModel: "Test Model",
    bodyLimit: "Body chars",
    anthropicVersion: "Anthropic Version",
    saveSettings: "Save Settings",
    noRequests: "No requests yet. Start capture, then reload or use the page.",
    noHooks: "No hook events yet.",
    noStorage: "No storage snapshots yet.",
    selected: "Selected",
    copied: "Copied.",
    saved: "Saved.",
    analyzing: "Analyzing...",
    needAi: "Add an API key in Settings first.",
    needData: "Capture some data first.",
    needSelected: "Select a request first.",
    modelLoaded: "Model list loaded.",
    modelLoading: "Fetching model list...",
    modelEmpty: "No models were returned.",
    modelTesting: "Testing model...",
    modelOk: "Model test passed.",
    analysisSending: "Analyzing...\nProvider: {provider}\nEndpoint: {url}\nModel: {model}",
    captureStarted: "Running",
    capturePaused: "Paused",
    captureStopped: "Stopped"
  }
};

const state = {
  tabId: null,
  status: "stopped",
  language: "zh-CN",
  requests: [],
  hooks: [],
  snapshots: [],
  models: [],
  chat: [],
  selectedRequestId: null,
  search: "",
  statusFilter: "",
  settings: {
    provider: "openai",
    baseUrl: "api.openai.com",
    apiKey: "",
    model: "gpt-4.1-mini",
    bodyLimit: 4096,
    anthropicVersion: "2023-06-01"
  }
};

const port = chrome.runtime.connect({ name: "analyzer-sidepanel" });
const pending = new Map();
let requestSeq = 0;

const $ = (id) => document.getElementById(id);
const el = {
  targetLabel: $("targetLabel"),
  languageSelect: $("languageSelect"),
  startBtn: $("startBtn"),
  pauseBtn: $("pauseBtn"),
  stopBtn: $("stopBtn"),
  reloadBtn: $("reloadBtn"),
  clearBtn: $("clearBtn"),
  captureNetworkInput: $("captureNetworkInput"),
  captureHooksInput: $("captureHooksInput"),
  captureStorageInput: $("captureStorageInput"),
  captureCookiesInput: $("captureCookiesInput"),
  requestCount: $("requestCount"),
  hookCount: $("hookCount"),
  storageCount: $("storageCount"),
  statusText: $("statusText"),
  searchInput: $("searchInput"),
  statusFilter: $("statusFilter"),
  requestsList: $("requestsList"),
  hooksList: $("hooksList"),
  storageList: $("storageList"),
  snapshotBtn: $("snapshotBtn"),
  analysisMode: $("analysisMode"),
  analysisScope: $("analysisScope"),
  analyzeBtn: $("analyzeBtn"),
  copyAnalysisBtn: $("copyAnalysisBtn"),
  exportAnalysisBtn: $("exportAnalysisBtn"),
  chatList: $("chatList"),
  chatInput: $("chatInput"),
  sendChatBtn: $("sendChatBtn"),
  analysisOutput: $("analysisOutput"),
  providerSelect: $("providerSelect"),
  baseUrlInput: $("baseUrlInput"),
  apiKeyInput: $("apiKeyInput"),
  modelInput: $("modelInput"),
  modelMenuBtn: $("modelMenuBtn"),
  modelMenu: $("modelMenu"),
  fetchModelsBtn: $("fetchModelsBtn"),
  modelStatus: $("modelStatus"),
  testModelBtn: $("testModelBtn"),
  bodyLimitInput: $("bodyLimitInput"),
  anthropicVersionWrap: $("anthropicVersionWrap"),
  anthropicVersionInput: $("anthropicVersionInput"),
  saveSettingsBtn: $("saveSettingsBtn"),
  settingsStatus: $("settingsStatus")
};

function t(key) {
  return i18n[state.language]?.[key] || i18n["zh-CN"][key] || key;
}

function formatMessage(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

function applyI18n() {
  document.documentElement.lang = state.language;
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll("[data-i18n-placeholder]")) {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  }
  el.languageSelect.value = state.language;
  if (!state.requests.length && !state.hooks.length) el.analysisOutput.textContent = t("analysisEmpty");
  render();
}

function requestBackground(type, payload = {}) {
  const requestId = `side-${++requestSeq}`;
  port.postMessage({ type, requestId, ...payload });
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    setTimeout(() => {
      if (!pending.has(requestId)) return;
      pending.delete(requestId);
      reject(new Error(`Timeout: ${type}`));
    }, ["models:list", "models:test"].includes(type) ? 30000 : 15000);
  });
}

port.onMessage.addListener((message) => {
  if (message?.requestId && pending.has(message.requestId)) {
    const waiter = pending.get(message.requestId);
    pending.delete(message.requestId);
    if (message.type === "error") waiter.reject(new Error(message.error));
    else waiter.resolve(message);
    return;
  }

  if (message?.type === "background:ready") {
    state.tabId = message.tabId;
    state.status = message.status || "stopped";
    render();
    return;
  }

  if (message?.type === "capture:status") {
    state.status = message.status;
    render();
    return;
  }

  if (message?.type === "network:request") {
    state.requests.push(normalizeRequest(message.payload));
    trim(state.requests, 3000);
    render();
    return;
  }

  if (message?.type === "hook:event") {
    state.hooks.unshift({ id: `h-${state.hooks.length + 1}`, url: message.url, frameId: message.frameId, ...message.payload });
    trim(state.hooks, 1000);
    render();
    return;
  }

  if (message?.type === "storage:snapshot") {
    state.snapshots.unshift({ id: `s-${state.snapshots.length + 1}`, url: message.url, frameId: message.frameId, ...message.payload });
    trim(state.snapshots, 300);
    render();
  }
});

function trim(items, limit) {
  if (items.length > limit) items.splice(0, items.length - limit);
}

function normalizeRequest(item) {
  return {
    id: `r-${item.seq || state.requests.length + 1}`,
    seq: item.seq || state.requests.length + 1,
    domain: parseDomain(item.url),
    time: Number.isFinite(item.time) ? item.time : 0,
    bodySize: item.bodySize || item.responseBody?.length || 0,
    requestHeaders: item.requestHeaders || {},
    responseHeaders: item.responseHeaders || {},
    requestBody: item.requestBody || "",
    responseBody: item.responseBody || "",
    ...item
  };
}

function parseDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function statusClass(status) {
  if (status >= 500 || status === 0) return "error";
  if (status >= 400) return "warn";
  if (status >= 200) return "ok";
  return "";
}

function matchesStatus(item) {
  if (!state.statusFilter) return true;
  if (state.statusFilter === "error") return item.status >= 400 || item.status === 0;
  return Math.floor((item.status || 0) / 100) === Number(state.statusFilter[0]);
}

function matchesFilter(item) {
  const haystack = JSON.stringify(item).toLowerCase();
  return (!state.search || haystack.includes(state.search.toLowerCase())) && matchesStatus(item);
}

function render() {
  el.targetLabel.textContent = state.tabId ? `Tab ${state.tabId}` : "Tab";
  el.statusText.textContent = state.status === "running" ? t("captureStarted") : state.status === "paused" ? t("capturePaused") : t("captureStopped");
  el.requestCount.textContent = state.requests.length;
  el.hookCount.textContent = state.hooks.length;
  el.storageCount.textContent = state.snapshots.length;
  el.startBtn.disabled = state.status === "running";
  el.pauseBtn.disabled = state.status !== "running";
  el.stopBtn.disabled = state.status === "stopped";
  renderRequests();
  renderHooks();
  renderStorage();
  renderChat();
  renderSettings();
}

function renderRequests() {
  const items = state.requests.filter(matchesFilter).slice().reverse();
  el.requestsList.innerHTML = items.length ? items.map((item) => `
    <article class="item ${state.selectedRequestId === item.id ? "selected" : ""}" data-id="${escapeHtml(item.id)}">
      <div class="meta">
        <span class="pill">#${item.seq}</span>
        <span>${escapeHtml(item.method || "-")}</span>
        <span class="${statusClass(item.status)}">${escapeHtml(item.status ?? "-")}</span>
        <span>${escapeHtml(formatBytes(item.bodySize))}</span>
      </div>
      <h3>${escapeHtml(item.url)}</h3>
      <div class="itemActions">
        <button data-action="select">${t("selected")}</button>
        <button data-action="fetch">fetch</button>
        <button data-action="curl">cURL</button>
        <button data-action="analyze">${t("analyze")}</button>
      </div>
      ${state.selectedRequestId === item.id ? `<pre class="code">${escapeHtml(JSON.stringify(compactRequest(item), null, 2))}</pre>` : ""}
    </article>
  `).join("") : `<div class="empty">${t("noRequests")}</div>`;

  for (const article of el.requestsList.querySelectorAll(".item")) {
    const item = state.requests.find((request) => request.id === article.dataset.id);
    for (const button of article.querySelectorAll("button[data-action]")) {
      button.addEventListener("click", () => handleRequestAction(button.dataset.action, item));
    }
  }
}

function renderHooks() {
  const items = state.hooks.filter(matchesFilter);
  el.hooksList.innerHTML = items.length ? items.map((item) => `
    <article class="item">
      <div class="meta"><span class="pill">${escapeHtml(item.kind)}</span><span>${escapeHtml(item.capturedAt)}</span></div>
      <h3>${escapeHtml(item.method || item.url || item.href || item.kind)}</h3>
      <pre class="code">${escapeHtml(JSON.stringify(item, null, 2))}</pre>
    </article>
  `).join("") : `<div class="empty">${t("noHooks")}</div>`;
}

function renderStorage() {
  const items = state.snapshots.filter(matchesFilter);
  el.storageList.innerHTML = items.length ? items.map((item) => `
    <article class="item">
      <div class="meta"><span class="pill">${escapeHtml(item.reason)}</span><span>${escapeHtml(item.capturedAt)}</span></div>
      <h3>${escapeHtml(item.href || item.url || "snapshot")}</h3>
      <pre class="code">${escapeHtml(JSON.stringify(item, null, 2))}</pre>
    </article>
  `).join("") : `<div class="empty">${t("noStorage")}</div>`;
}

function renderSettings() {
  el.anthropicVersionWrap.style.display = state.settings.provider === "anthropic" ? "grid" : "none";
}

function renderChat() {
  el.chatList.innerHTML = state.chat.map((message) => `
    <article class="chatMsg ${escapeHtml(message.role)}">
      <div class="chatRole">${message.role === "user" ? t("userRole") : t("assistantRole")}</div>
      <pre>${escapeHtml(message.content)}</pre>
    </article>
  `).join("");
}

function compactRequest(item) {
  return {
    seq: item.seq,
    method: item.method,
    url: item.url,
    status: item.status,
    mimeType: item.mimeType,
    time: item.time,
    requestHeaders: item.requestHeaders,
    responseHeaders: item.responseHeaders,
    requestBody: item.requestBody?.slice(0, state.settings.bodyLimit),
    responseBody: item.responseBody?.slice(0, state.settings.bodyLimit)
  };
}

function buildFetchSnippet(item) {
  const init = { method: item.method || "GET", headers: item.requestHeaders || {} };
  if (item.requestBody) init.body = item.requestBody;
  return `const response = await fetch(${JSON.stringify(item.url)}, ${JSON.stringify(init, null, 2)});\nconst text = await response.text();\nconsole.log(response.status, text);`;
}

function buildCurl(item) {
  const parts = [`curl ${JSON.stringify(item.url)}`, `  -X ${JSON.stringify(item.method || "GET")}`];
  for (const [name, value] of Object.entries(item.requestHeaders || {})) {
    if (!/^content-length$/i.test(name)) parts.push(`  -H ${JSON.stringify(`${name}: ${value}`)}`);
  }
  if (item.requestBody) parts.push(`  --data-raw ${JSON.stringify(item.requestBody)}`);
  return parts.join(" \\\n");
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function handleRequestAction(action, item) {
  if (!item) return;
  if (action === "select") {
    state.selectedRequestId = item.id;
    render();
    return;
  }
  if (action === "fetch") copyText(buildFetchSnippet(item));
  if (action === "curl") copyText(buildCurl(item));
  if (action === "analyze") {
    state.selectedRequestId = item.id;
    el.analysisScope.value = "selected";
    switchView("ai");
    runAnalysis();
  }
}

function currentOptions() {
  return {
    captureNetwork: el.captureNetworkInput.checked,
    captureHooks: el.captureHooksInput.checked,
    captureStorage: el.captureStorageInput.checked,
    captureCookies: el.captureCookiesInput.checked
  };
}

async function loadSettings() {
  const message = await requestBackground("storage:get", { keys: ["aiSettings", "language"] });
  state.settings = { ...state.settings, ...(message.data.aiSettings || {}) };
  state.language = message.data.language || "zh-CN";
  syncSettingsForm();
  applyI18n();
}

function syncSettingsForm() {
  el.providerSelect.value = state.settings.provider;
  el.baseUrlInput.value = state.settings.baseUrl;
  el.apiKeyInput.value = state.settings.apiKey;
  el.modelInput.value = state.settings.model;
  el.bodyLimitInput.value = state.settings.bodyLimit;
  el.anthropicVersionInput.value = state.settings.anthropicVersion;
}

async function saveSettings() {
  state.settings = {
    provider: el.providerSelect.value,
    baseUrl: normalizeBaseUrl(el.baseUrlInput.value, el.providerSelect.value),
    apiKey: el.apiKeyInput.value.trim(),
    model: el.modelInput.value.trim(),
    bodyLimit: Number(el.bodyLimitInput.value) || 4096,
    anthropicVersion: el.anthropicVersionInput.value.trim() || "2023-06-01"
  };
  el.baseUrlInput.value = state.settings.baseUrl;
  await requestBackground("storage:set", { data: { aiSettings: state.settings, language: state.language } });
  el.settingsStatus.textContent = t("saved");
  render();
}

async function fetchModelList() {
  await saveSettings();
  el.fetchModelsBtn.disabled = true;
  setModelStatus(t("modelLoading"));
  try {
    const message = await requestBackground("models:list", { settings: state.settings });
    if (message.baseUrl) {
      state.settings.baseUrl = message.baseUrl;
      el.baseUrlInput.value = message.baseUrl;
    }
    const models = message.models || [];
    state.models = models;
    renderModelMenu({ filter: false });
    el.modelMenu.hidden = models.length === 0;
    setModelStatus(models.length ? `${t("modelLoaded")} (${models.length})` : t("modelEmpty"));
  } finally {
    el.fetchModelsBtn.disabled = false;
  }
}

function renderModelMenu(options = {}) {
  const shouldFilter = options.filter !== false;
  const query = el.modelInput.value.trim().toLowerCase();
  const models = (state.models || []).filter((model) => {
    const text = `${model.id} ${model.label}`.toLowerCase();
    return !shouldFilter || !query || text.includes(query);
  });

  el.modelMenu.innerHTML = models.length ? models.map((model) => `
    <button type="button" class="modelOption" data-model="${escapeHtml(model.id)}">
      ${escapeHtml(model.label || model.id)}
    </button>
  `).join("") : `<div class="empty">${t("modelEmpty")}</div>`;

  for (const option of el.modelMenu.querySelectorAll(".modelOption")) {
    option.addEventListener("click", () => {
      el.modelInput.value = option.dataset.model;
      state.settings.model = option.dataset.model;
      el.modelMenu.hidden = true;
    });
  }
}

function toggleModelMenu(forceOpen = null) {
  renderModelMenu({ filter: false });
  const shouldOpen = forceOpen === null ? el.modelMenu.hidden : forceOpen;
  el.modelMenu.hidden = !shouldOpen;
}

function setModelStatus(message) {
  el.modelStatus.textContent = message;
  el.settingsStatus.textContent = message;
}

function normalizeBaseUrl(input, provider = "openai") {
  let value = String(input || "").trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  value = value.replace(/\/+$/, "");
  if (/\/v\d+$/i.test(value)) return value;
  if (provider === "anthropic" || /anthropic\.com/i.test(value)) return `${value}/v1`;
  return `${value}/v1`;
}

async function testCurrentModel() {
  await saveSettings();
  el.testModelBtn.disabled = true;
  setModelStatus(t("modelTesting"));
  try {
    const message = await requestBackground("models:test", { settings: state.settings });
    if (message.baseUrl) {
      state.settings.baseUrl = message.baseUrl;
      el.baseUrlInput.value = message.baseUrl;
    }
    setModelStatus(t("modelOk"));
  } finally {
    el.testModelBtn.disabled = false;
  }
}

function modeInstruction(mode) {
  return {
    auto: "Identify important API flows, authentication, state changes, suspicious behavior, and next debugging steps.",
    api: "Reverse engineer the API. Produce endpoint docs, auth flow, parameter meanings, and reproduction examples.",
    security: "Audit token leaks, insecure headers, sensitive data exposure, CSRF/XSS-relevant patterns, and risky crypto.",
    performance: "Find slow, duplicated, large, blocking, or cache-inefficient requests and propose fixes.",
    crypto: "Analyze JavaScript crypto/signature behavior and infer reproduction strategy."
  }[mode] || "Analyze the capture.";
}

function presetPrompt(kind) {
  return {
    api: "请基于当前捕获内容，梳理主要接口、调用顺序、鉴权方式、关键参数含义，并指出哪些请求最值得继续分析。",
    risk: "请检查当前捕获内容中的安全风险，包括 Token 泄露、敏感数据、弱鉴权、危险响应头、CSRF/XSS 相关线索，并按风险等级输出。",
    crypto: "请分析当前捕获内容中的加密、签名、摘要、nonce、timestamp、crypto.subtle 调用和可复现思路。",
    replay: "请为关键请求生成可复现代码，优先给出 curl 和 JavaScript fetch，并说明需要替换的 token、cookie 或动态参数。"
  }[kind] || "";
}

function analysisPayload() {
  const requests = getAnalysisRequests().slice(-120).map(compactRequest);
  const hooks = el.analysisScope.value === "selected" ? [] : (el.analysisScope.value === "filtered" ? state.hooks.filter(matchesFilter) : state.hooks).slice(0, 120);
  const snapshots = el.analysisScope.value === "selected" ? [] : (el.analysisScope.value === "filtered" ? state.snapshots.filter(matchesFilter) : state.snapshots).slice(0, 20);
  return { requests, hooks, snapshots };
}

function getAnalysisRequests() {
  if (el.analysisScope.value === "selected") {
    const selected = state.requests.find((item) => item.id === state.selectedRequestId);
    return selected ? [selected] : [];
  }
  if (el.analysisScope.value === "filtered") return state.requests.filter(matchesFilter);
  return state.requests;
}

async function runAnalysis() {
  const question = modeInstruction(el.analysisMode.value);
  await sendAiMessage(question, { replaceOutput: true, addUserMessage: false });
}

async function sendChatMessage(content) {
  await sendAiMessage(content, { replaceOutput: false, addUserMessage: true });
}

async function sendAiMessage(content, options = {}) {
  if (!state.settings.apiKey) {
    switchView("settings");
    el.analysisOutput.textContent = t("needAi");
    return;
  }
  const payload = analysisPayload();
  if (el.analysisScope.value === "selected" && payload.requests.length === 0) {
    el.analysisOutput.textContent = t("needSelected");
    return;
  }
  if (!payload.requests.length && !payload.hooks.length) {
    el.analysisOutput.textContent = t("needData");
    return;
  }

  const baseUrl = normalizeBaseUrl(state.settings.baseUrl, state.settings.provider);
  const analysisUrl = state.settings.provider === "anthropic" ? `${baseUrl}/messages` : `${baseUrl}/chat/completions`;
  el.analysisOutput.textContent = formatMessage(t("analysisSending"), {
    provider: state.settings.provider,
    url: analysisUrl,
    model: state.settings.model
  });
  if (options.addUserMessage !== false) {
    state.chat.push({ role: "user", content });
    renderChat();
  }
  el.analyzeBtn.disabled = true;
  el.sendChatBtn.disabled = true;
  try {
    const requestContent = buildConversationPrompt(content, payload);
    const result = state.settings.provider === "anthropic" ? await callAnthropic(requestContent) : await callOpenAi(requestContent);
    state.chat.push({ role: "assistant", content: result });
    renderChat();
    el.analysisOutput.textContent = result;
  } catch (error) {
    el.analysisOutput.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    el.analyzeBtn.disabled = false;
    el.sendChatBtn.disabled = false;
  }
}

function buildConversationPrompt(userQuestion, payload) {
  const history = state.chat.slice(-8).map((message) => `${message.role === "user" ? "User" : "Assistant"}:\n${message.content}`).join("\n\n");
  return [
    "You are analyzing a browser capture. Use the captured evidence and cite request sequence numbers when possible.",
    history ? `Conversation so far:\n${history}` : "",
    `Current user question:\n${userQuestion}`,
    `Captured session JSON:\n${JSON.stringify(payload, null, 2)}`
  ].filter(Boolean).join("\n\n");
}

async function callOpenAi(content) {
  const baseUrl = normalizeBaseUrl(state.settings.baseUrl, state.settings.provider);
  const url = `${baseUrl}/chat/completions`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${state.settings.apiKey}`
    },
    body: JSON.stringify({
      model: state.settings.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a senior browser protocol analyst. Cite request sequence numbers and stay evidence-based." },
        { role: "user", content }
      ]
    })
  }, 60000);
  const data = await readJsonResponse(response, "OpenAI-compatible analysis", url);
  return extractOpenAiText(data);
}

async function callAnthropic(content) {
  const baseUrl = normalizeBaseUrl(state.settings.baseUrl, state.settings.provider);
  const url = `${baseUrl}/messages`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": state.settings.apiKey,
      "anthropic-version": state.settings.anthropicVersion || "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: state.settings.model,
      max_tokens: 4096,
      system: "You are a senior browser protocol analyst. Cite request sequence numbers and stay evidence-based.",
      messages: [{ role: "user", content }]
    })
  }, 60000);
  const data = await readJsonResponse(response, "Claude / Anthropic analysis", url);
  return extractAnthropicText(data);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonResponse(response, label, url) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${response.statusText}\nURL: ${url}\n${text.slice(0, 2000)}`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned non-JSON response.\nURL: ${url}\n${text.slice(0, 2000)}`);
  }
}

function extractOpenAiText(data) {
  return data.choices?.[0]?.message?.content
    || data.choices?.[0]?.text
    || data.output_text
    || data.response
    || JSON.stringify(data, null, 2);
}

function extractAnthropicText(data) {
  if (Array.isArray(data.content)) {
    const text = data.content.map((part) => typeof part === "string" ? part : part.text || "").filter(Boolean).join("\n");
    if (text) return text;
  }
  return data.completion || data.output_text || data.response || JSON.stringify(data, null, 2);
}

function exportText(filename, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function switchView(viewName) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
}

function bindEvents() {
  el.languageSelect.addEventListener("change", async () => {
    state.language = el.languageSelect.value;
    await requestBackground("storage:set", { data: { language: state.language } });
    applyI18n();
  });

  el.startBtn.addEventListener("click", async () => {
    if (!state.tabId) return;
    await requestBackground("capture:start", { tabId: state.tabId, options: currentOptions() });
  });
  el.pauseBtn.addEventListener("click", () => requestBackground("capture:pause", { tabId: state.tabId }));
  el.stopBtn.addEventListener("click", () => requestBackground("capture:stop", { tabId: state.tabId }));
  el.reloadBtn.addEventListener("click", () => chrome.tabs.reload(state.tabId));
  el.clearBtn.addEventListener("click", () => {
    state.requests = [];
    state.hooks = [];
    state.snapshots = [];
    state.selectedRequestId = null;
    state.chat = [];
    render();
  });

  el.searchInput.addEventListener("input", () => {
    state.search = el.searchInput.value;
    render();
  });
  el.statusFilter.addEventListener("change", () => {
    state.statusFilter = el.statusFilter.value;
    render();
  });

  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  }

  el.snapshotBtn.addEventListener("click", async () => {
    const message = await requestBackground("cookies:get", { tabId: state.tabId });
    state.snapshots.unshift({ id: `s-${state.snapshots.length + 1}`, reason: "cookies-api", capturedAt: new Date().toISOString(), cookies: message.cookies });
    render();
  });

  el.providerSelect.addEventListener("change", () => {
    state.settings.provider = el.providerSelect.value;
    const currentBase = el.baseUrlInput.value.trim();
    if (state.settings.provider === "anthropic" && (!currentBase || currentBase.includes("openai.com"))) {
      el.baseUrlInput.value = "api.anthropic.com";
    }
    if (state.settings.provider === "openai" && (!currentBase || currentBase.includes("anthropic.com"))) {
      el.baseUrlInput.value = "api.openai.com";
    }
    renderSettings();
  });
  el.saveSettingsBtn.addEventListener("click", saveSettings);
  el.fetchModelsBtn.addEventListener("click", () => fetchModelList().catch((error) => {
    setModelStatus(error instanceof Error ? error.message : String(error));
    el.fetchModelsBtn.disabled = false;
  }));
  el.modelMenuBtn.addEventListener("click", () => toggleModelMenu());
  el.modelInput.addEventListener("input", () => {
    state.settings.model = el.modelInput.value.trim();
    if (!el.modelMenu.hidden) renderModelMenu({ filter: true });
  });
  el.modelInput.addEventListener("focus", () => {
    if ((state.models || []).length) toggleModelMenu(true);
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".combo") && !event.target.closest("#modelMenu")) {
      el.modelMenu.hidden = true;
    }
  });
  el.testModelBtn.addEventListener("click", () => testCurrentModel().catch((error) => {
    setModelStatus(error instanceof Error ? error.message : String(error));
    el.testModelBtn.disabled = false;
  }));

  el.analyzeBtn.addEventListener("click", runAnalysis);
  for (const button of document.querySelectorAll(".promptBtn")) {
    button.addEventListener("click", () => {
      const content = presetPrompt(button.dataset.prompt);
      if (content) sendChatMessage(content);
    });
  }
  el.sendChatBtn.addEventListener("click", () => {
    const content = el.chatInput.value.trim();
    if (!content) return;
    el.chatInput.value = "";
    sendChatMessage(content);
  });
  el.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      el.sendChatBtn.click();
    }
  });
  el.copyAnalysisBtn.addEventListener("click", () => copyText(el.analysisOutput.textContent || ""));
  el.exportAnalysisBtn.addEventListener("click", () => exportText(`anything-analyzer-analysis-${Date.now()}.md`, el.analysisOutput.textContent || "", "text/markdown"));
}

async function init() {
  bindEvents();
  port.postMessage({ type: "sidepanel:init" });
  await loadSettings().catch(() => applyI18n());
}

init();
