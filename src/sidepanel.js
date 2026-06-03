// i18n 使用全局 i18n.js 中的 t() / formatMessage()，无需内联定义

const { prepareCapturedRequest, prepareSearchableEvent, stripDerivedFields, visibleRecentItems } = globalThis.captureUtils;
const VISIBLE_REQUEST_LIMIT = 200;

const state = {
  tabId: null,
  targetTab: null,
  status: "stopped",
  language: "en",
  requests: [],
  hooks: [],
  snapshots: [],
  models: [],
  chat: [],
  selectedRequestId: null,
  search: "",
  statusFilter: "",
  typeFilter: "",
  settings: {
    provider: "openai",
    baseUrl: "api.openai.com",
    apiKey: "",
    model: "gpt-4.1-mini",
    bodyLimit: 10000,
    anthropicVersion: "2023-06-01"
  }
};

const port = chrome.runtime.connect({ name: "analyzer-sidepanel" });
const pending = new Map();
let requestSeq = 0;
let controlBusy = false;
let renderScheduled = false;
let aiRequestTimer = null;
const AI_ANALYSIS_TIMEOUT_MS = 10 * 60 * 1000;

const $ = (id) => document.getElementById(id);
// t() / formatMessage() / applyI18n() 由 i18n.js 在同一全局作用域中定义，直接调用即可。
// 切勿在本文件再声明同名函数，否则会覆盖全局版本并导致无限递归（Maximum call stack size exceeded）。

const el = {
  targetLabel: $("targetLabel"),
  languageSelect: $("languageSelect"),
  startBtn: $("startBtn"),
  pauseBtn: $("pauseBtn"),
  stopBtn: $("stopBtn"),
  reloadBtn: $("reloadBtn"),
  clearBtn: $("clearBtn"),
  exportDataBtn: $("exportDataBtn"),
  importDataBtn: $("importDataBtn"),
  importDataInput: $("importDataInput"),
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
  typeFilter: $("typeFilter"),
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
  saveSettingsBtn: $("saveSettingsBtn"),
  settingsStatus: $("settingsStatus")
};

function formatAiRequestStatus(data) {
  if (globalThis.requestTimer?.formatAiRequestStatus) {
    return globalThis.requestTimer.formatAiRequestStatus(data);
  }
  const elapsedSeconds = Math.floor(Math.max(0, data.elapsedMs) / 1000);
  if (data.phase === "done") return `${t("analysisComplete")} ${elapsedSeconds}s`;
  return `${formatMessage(t("analysisSending"), data)}\n${t("elapsed")}: ${elapsedSeconds}s`;
}

function startAiRequestTimer(context) {
  const startedAt = Date.now();
  const renderElapsed = () => {
    el.analysisOutput.textContent = formatAiRequestStatus({
      phase: "running",
      elapsedMs: Date.now() - startedAt,
      ...context
    });
  };
  renderElapsed();
  aiRequestTimer = { startedAt, intervalId: setInterval(renderElapsed, 1000) };
}

function stopAiRequestTimer(phase = "done") {
  if (!aiRequestTimer) return 0;
  clearInterval(aiRequestTimer.intervalId);
  const elapsedMs = Date.now() - aiRequestTimer.startedAt;
  aiRequestTimer = null;
  if (phase === "done") el.analysisOutput.textContent = formatAiRequestStatus({ phase, elapsedMs });
  return elapsedMs;
}

// 注意：本函数不能命名为 applyI18n，否则会覆盖 i18n.js 的全局 applyI18n 并造成无限递归。
function refreshI18n() {
  applyI18n();
  el.languageSelect.value = state.language;
  if (!state.requests.length && !state.hooks.length) el.analysisOutput.textContent = t("analysisEmpty");
  scheduleRender();
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
    if (message.type === "error") {
      waiter.reject(new Error(message.error));
    } else {
      if (message.status) state.status = message.status;
      waiter.resolve(message);
    }
    scheduleRender();
    return;
  }

  if (message?.type === "background:ready") {
    updateTargetTab(message.tab, message.tabId);
    state.status = message.status || "stopped";
    scheduleRender();
    return;
  }

  if (message?.type === "tab:updated" && message.tab?.id === state.tabId) {
    updateTargetTab(message.tab, message.tab.id);
    scheduleRender();
    return;
  }

  if (message?.type === "capture:status") {
    state.status = message.status;
    scheduleRender();
    return;
  }

  if (message?.type === "capture:cleared") {
    clearLocalSession();
    return;
  }

  if (message?.type === "network:request") {
    if (state.status !== "running") return;
    state.requests.push(normalizeRequest(message.payload));
    trim(state.requests, 3000);
    scheduleRender();
    return;
  }

  if (message?.type === "hook:event") {
    state.hooks.unshift(prepareSearchableEvent({ id: `h-${state.hooks.length + 1}`, url: message.url, frameId: message.frameId, ...message.payload }));
    trim(state.hooks, 1000);
    scheduleRender();
    return;
  }

  if (message?.type === "storage:snapshot") {
    state.snapshots.unshift(prepareSearchableEvent({ id: `s-${state.snapshots.length + 1}`, url: message.url, frameId: message.frameId, ...message.payload }));
    trim(state.snapshots, 300);
    scheduleRender();
  }
});

function trim(items, limit) {
  if (items.length > limit) items.splice(0, items.length - limit);
}

function normalizeRequest(item) {
  return prepareCapturedRequest({
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
  });
}

function parseDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function formatTargetLabel() {
  const title = state.targetTab?.title?.trim();
  if (title) return title;

  const url = state.targetTab?.url?.trim();
  if (url) {
    try {
      return new URL(url).hostname || url;
    } catch {
      return url;
    }
  }

  return state.tabId ? `Tab ${state.tabId}` : "Tab";
}

function updateTargetTab(tab, tabId = tab?.id) {
  state.tabId = Number.isInteger(tabId) ? tabId : null;
  state.targetTab = tab && typeof tab === "object"
    ? {
        id: tab.id,
        title: tab.title || "",
        url: tab.url || ""
      }
    : null;
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
  return (!state.search || (item.searchText || "").includes(state.search.toLowerCase())) && matchesStatus(item);
}

// 请求类型过滤（基于 Chrome DevTools resourceType）。仅用于请求列表，不影响 Hook/存储。
function matchesType(item) {
  const filter = state.typeFilter;
  if (!filter) return true;
  const type = item.type || "";
  if (filter === "fetch-xhr") return type === "XHR" || type === "Fetch";
  if (filter === "other") {
    return !["Document", "Stylesheet", "Script", "Font", "Image", "Media", "Manifest", "WebSocket", "XHR", "Fetch"].includes(type);
  }
  return type === filter;
}

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    render();
  });
}

function render() {
  const targetLabel = formatTargetLabel();
  el.targetLabel.textContent = targetLabel;
  el.targetLabel.title = state.targetTab?.url || targetLabel;
  el.statusText.textContent = state.status === "running" ? t("captureStarted") : state.status === "paused" ? t("capturePaused") : t("captureStopped");
  el.requestCount.textContent = state.requests.length;
  el.hookCount.textContent = state.hooks.length;
  el.storageCount.textContent = state.snapshots.length;
  el.startBtn.disabled = controlBusy || !state.tabId || state.status === "running";
  el.pauseBtn.disabled = controlBusy || !state.tabId || state.status !== "running";
  el.stopBtn.disabled = controlBusy || !state.tabId || state.status === "stopped";
  el.reloadBtn.disabled = !state.tabId;
  renderRequests();
  renderHooks();
  renderStorage();
  renderChat();
  renderSettings();
}

function renderRequests() {
  const items = visibleRecentItems(state.requests.filter((item) => matchesFilter(item) && matchesType(item)), VISIBLE_REQUEST_LIMIT);
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

function renderSettings() {}

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
    scheduleRender();
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

function clearLocalSession() {
  stopAiRequestTimer("cancel");
  state.requests = [];
  state.hooks = [];
  state.snapshots = [];
  state.selectedRequestId = null;
  state.chat = [];
  scheduleRender();
}

async function runCaptureControl(type, payload = {}, optimisticStatus = null) {
  if (!state.tabId) return;
  const previousStatus = state.status;
  if (optimisticStatus) state.status = optimisticStatus;
  controlBusy = true;
  scheduleRender();
  try {
    const message = await requestBackground(type, { tabId: state.tabId, ...payload });
    if (message.status) state.status = message.status;
  } catch (error) {
    state.status = previousStatus;
    el.analysisOutput.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    controlBusy = false;
    scheduleRender();
  }
}

async function loadSettings() {
  const message = await requestBackground("storage:get", { keys: ["aiSettings", "language"] });
  state.settings = { ...state.settings, ...(message.data.aiSettings || {}), provider: "openai" };
  // 已保存过则用保存值；首次打开（无存储值）跟随浏览器语言，之后用户可自由切换
  const storedLang = message.data.language || globalThis.detectNavigatorLocale();
  globalThis.__i18nStore.setLang(storedLang, { persist: false });
  state.language = globalThis.__i18nStore.lang;
  syncSettingsForm();
  refreshI18n();
}

function syncSettingsForm() {
  el.providerSelect.value = "openai";
  el.baseUrlInput.value = state.settings.baseUrl;
  el.apiKeyInput.value = state.settings.apiKey;
  el.modelInput.value = state.settings.model;
  el.bodyLimitInput.value = state.settings.bodyLimit;
}

async function saveSettings() {
  state.settings = {
    provider: el.providerSelect.value,
    baseUrl: normalizeBaseUrl(el.baseUrlInput.value, el.providerSelect.value),
    apiKey: el.apiKeyInput.value.trim(),
    model: el.modelInput.value.trim(),
    bodyLimit: Number(el.bodyLimitInput.value) || 10000,
    anthropicVersion: state.settings.anthropicVersion || "2023-06-01"
  };
  el.baseUrlInput.value = state.settings.baseUrl;
  await requestBackground("storage:set", { data: { aiSettings: state.settings, language: state.language } });
  el.settingsStatus.textContent = t("saved");
  scheduleRender();
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
    replay: "请为关键请求生成可复现的 Python 代码，优先使用 requests 库；包含 URL、method、headers、cookies、params/body，并说明需要替换的 token、cookie 或动态参数。不要输出 curl 或 JavaScript fetch，除非 Python 无法表达。"
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
  if (aiRequestTimer) return;
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
  startAiRequestTimer({
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
    const elapsedMs = stopAiRequestTimer("done");
    state.chat.push({ role: "assistant", content: result });
    renderChat();
    el.analysisOutput.textContent = `${formatAiRequestStatus({ phase: "done", elapsedMs })}\n\n${result}`;
  } catch (error) {
    stopAiRequestTimer("error");
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
  }, AI_ANALYSIS_TIMEOUT_MS);
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
  }, AI_ANALYSIS_TIMEOUT_MS);
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

function buildSessionExport() {
  return {
    app: "anything-analyzer",
    version: 1,
    exportedAt: new Date().toISOString(),
    tabId: state.tabId,
    status: state.status,
    requests: state.requests.map(stripDerivedFields),
    hooks: state.hooks,
    snapshots: state.snapshots,
    selectedRequestId: state.selectedRequestId,
    search: state.search,
    statusFilter: state.statusFilter,
    chat: state.chat,
    analysisOutput: el.analysisOutput.textContent || ""
  };
}

function exportCapturedData() {
  exportText(
    `anything-analyzer-capture-${Date.now()}.json`,
    JSON.stringify(buildSessionExport(), null, 2),
    "application/json"
  );
}

function normalizeImportedItems(value) {
  return Array.isArray(value) ? value : [];
}

function importCapturedData(data) {
  if (!data || typeof data !== "object") throw new Error("Invalid JSON shape.");
  stopAiRequestTimer("cancel");

  state.requests = normalizeImportedItems(data.requests).map(normalizeRequest);
  state.hooks = normalizeImportedItems(data.hooks);
  state.snapshots = normalizeImportedItems(data.snapshots);
  state.chat = normalizeImportedItems(data.chat);
  state.selectedRequestId = data.selectedRequestId || null;
  state.search = typeof data.search === "string" ? data.search : "";
  state.statusFilter = typeof data.statusFilter === "string" ? data.statusFilter : "";
  state.typeFilter = "";

  el.searchInput.value = state.search;
  el.statusFilter.value = state.statusFilter;
  el.typeFilter.value = state.typeFilter;
  el.analysisOutput.textContent = typeof data.analysisOutput === "string" ? data.analysisOutput : t("analysisEmpty");
  scheduleRender();
}

async function importCapturedDataFile(file) {
  if (!file) return;
  try {
    importCapturedData(JSON.parse(await file.text()));
    el.settingsStatus.textContent = t("imported");
  } catch (error) {
    el.analysisOutput.textContent = formatMessage(t("importFailed"), {
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    el.importDataInput.value = "";
  }
}

function switchView(viewName) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
}

function bindEvents() {
  el.languageSelect.addEventListener("change", () => {
    state.language = el.languageSelect.value;
    // setLang 内部已写入 chrome.storage.local，无需再通过 background 重复持久化
    globalThis.__i18nStore.setLang(state.language);
    refreshI18n();
  });

  el.startBtn.addEventListener("click", () => runCaptureControl("capture:start", { options: currentOptions() }, "running"));
  el.pauseBtn.addEventListener("click", () => runCaptureControl("capture:pause", {}, "paused"));
  el.stopBtn.addEventListener("click", () => runCaptureControl("capture:stop", {}, "stopped"));
  el.reloadBtn.addEventListener("click", () => {
    if (state.tabId) chrome.tabs.reload(state.tabId);
  });
  el.clearBtn.addEventListener("click", () => {
    clearLocalSession();
    if (state.tabId) requestBackground("capture:clear", { tabId: state.tabId }).catch(() => {});
  });
  el.exportDataBtn.addEventListener("click", exportCapturedData);
  el.importDataBtn.addEventListener("click", () => el.importDataInput.click());
  el.importDataInput.addEventListener("change", () => importCapturedDataFile(el.importDataInput.files?.[0]));

  el.requestsList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    const article = event.target.closest(".item[data-id]");
    if (!button || !article) return;
    const item = state.requests.find((request) => request.id === article.dataset.id);
    handleRequestAction(button.dataset.action, item);
  });

  el.searchInput.addEventListener("input", () => {
    state.search = el.searchInput.value;
    scheduleRender();
  });
  el.statusFilter.addEventListener("change", () => {
    state.statusFilter = el.statusFilter.value;
    scheduleRender();
  });
  el.typeFilter.addEventListener("change", () => {
    state.typeFilter = el.typeFilter.value;
    scheduleRender();
  });

  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  }

  el.providerSelect.addEventListener("change", () => {
    state.settings.provider = "openai";
    el.providerSelect.value = "openai";
  });

  el.snapshotBtn.addEventListener("click", async () => {
    // tabId 可能为空（侧边栏未绑定标签页），此时由 background 回退到当前活动标签
    el.snapshotBtn.disabled = true;
    try {
      const message = await requestBackground("cookies:get", { tabId: state.tabId });
      state.snapshots.unshift(prepareSearchableEvent({
        id: `s-${state.snapshots.length + 1}`,
        reason: "cookies-api",
        href: state.targetTab?.url || "",
        capturedAt: new Date().toISOString(),
        cookies: message.cookies || []
      }));
      switchView("storage");
      scheduleRender();
    } catch (error) {
      el.analysisOutput.textContent = formatMessage(t("cookieSnapshotFailed"), {
        message: error instanceof Error ? error.message : String(error)
      });
      switchView("ai");
    } finally {
      el.snapshotBtn.disabled = false;
    }
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
  await loadSettings().catch(() => refreshI18n());
}

init();
