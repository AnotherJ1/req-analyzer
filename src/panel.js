const tabId = chrome.devtools.inspectedWindow.tabId;
const port = chrome.runtime.connect({ name: "analyzer-panel" });
const { normalizeCapturedBody, prepareCapturedRequest, prepareSearchableEvent, stripDerivedFields, visibleRecentItems } = globalThis.captureUtils;
const VISIBLE_REQUEST_LIMIT = 200;

const state = {
  targetTab: null,
  captureStatus: "stopped",
  requests: [],
  hooks: [],
  snapshots: [],
  selectedRequestId: null,
  view: "requests",
  search: "",
  domain: "",
  statusFilter: "",
  options: {
    captureNetwork: true,
    captureHooks: true,
    captureStorage: true,
    captureCookies: true
  },
  settings: {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1-mini",
    bodyLimit: 4096
  }
};

const pending = new Map();
let nextRequestId = 0;
let controlBusy = false;
let captureVersion = 0;
let renderScheduled = false;

const el = {
  targetLabel: document.getElementById("targetLabel"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  stopBtn: document.getElementById("stopBtn"),
  reloadBtn: document.getElementById("reloadBtn"),
  snapshotBtn: document.getElementById("snapshotBtn"),
  clearBtn: document.getElementById("clearBtn"),
  exportFormat: document.getElementById("exportFormat"),
  exportBtn: document.getElementById("exportBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  captureNetworkInput: document.getElementById("captureNetworkInput"),
  captureHooksInput: document.getElementById("captureHooksInput"),
  captureStorageInput: document.getElementById("captureStorageInput"),
  captureCookiesInput: document.getElementById("captureCookiesInput"),
  statusFilter: document.getElementById("statusFilter"),
  requestCount: document.getElementById("requestCount"),
  hookCount: document.getElementById("hookCount"),
  storageCount: document.getElementById("storageCount"),
  errorCount: document.getElementById("errorCount"),
  statusText: document.getElementById("statusText"),
  searchInput: document.getElementById("searchInput"),
  domainFilter: document.getElementById("domainFilter"),
  requestsTable: document.getElementById("requestsTable"),
  requestDetail: document.getElementById("requestDetail"),
  hooksList: document.getElementById("hooksList"),
  storageList: document.getElementById("storageList"),
  analysisMode: document.getElementById("analysisMode"),
  analysisScope: document.getElementById("analysisScope"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  copyAnalysisBtn: document.getElementById("copyAnalysisBtn"),
  clearAnalysisBtn: document.getElementById("clearAnalysisBtn"),
  analysisOutput: document.getElementById("analysisOutput"),
  settingsDialog: document.getElementById("settingsDialog"),
  baseUrlInput: document.getElementById("baseUrlInput"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  modelInput: document.getElementById("modelInput"),
  bodyLimitInput: document.getElementById("bodyLimitInput"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn")
};

function requestBackground(type, payload = {}) {
  const requestId = `req-${++nextRequestId}`;
  port.postMessage({ type, requestId, ...payload });
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    setTimeout(() => {
      if (!pending.has(requestId)) return;
      pending.delete(requestId);
      reject(new Error(`Timed out waiting for ${type}`));
    }, 8000);
  });
}

port.onMessage.addListener((message) => {
  if (message?.requestId && pending.has(message.requestId)) {
    const waiter = pending.get(message.requestId);
    pending.delete(message.requestId);
    if (message.type === "error") {
      waiter.reject(new Error(message.error));
    } else {
      if (message.status) {
        if (message.status !== state.captureStatus) captureVersion += 1;
        state.captureStatus = message.status;
      }
      waiter.resolve(message);
    }
    scheduleRender();
    return;
  }

  if (message?.type === "background:ready") {
    if ((message.status || "stopped") !== state.captureStatus) captureVersion += 1;
    updateTargetTab(message.tab, message.tabId);
    state.captureStatus = message.status || "stopped";
    scheduleRender();
    return;
  }

  if (message?.type === "tab:updated" && message.tab?.id === tabId) {
    updateTargetTab(message.tab, message.tab.id);
    scheduleRender();
    return;
  }

  if (message?.type === "capture:status") {
    if (message.status !== state.captureStatus) captureVersion += 1;
    state.captureStatus = message.status;
    scheduleRender();
    return;
  }

  if (message?.type === "capture:cleared") {
    clearLocalSession();
    return;
  }

  if (message?.type === "hook:event" && state.captureStatus === "running" && state.options.captureHooks) {
    state.hooks.unshift(prepareSearchableEvent({
      id: `h-${state.hooks.length + 1}`,
      frameId: message.frameId,
      url: message.url,
      ...message.payload
    }));
    trimArray(state.hooks, 1000);
    scheduleRender();
  }

  if (message?.type === "storage:snapshot" && state.captureStatus === "running" && state.options.captureStorage) {
    state.snapshots.unshift(prepareSearchableEvent({
      id: `s-${state.snapshots.length + 1}`,
      frameId: message.frameId,
      url: message.url,
      ...message.payload
    }));
    trimArray(state.snapshots, 200);
    scheduleRender();
  }
});

port.postMessage({ type: "panel:init", tabId });

function trimArray(items, limit) {
  if (items.length > limit) items.length = limit;
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(startedDateTime) {
  if (!startedDateTime) return "-";
  return new Date(startedDateTime).toLocaleTimeString();
}

function statusClass(status) {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  if (status >= 200) return "ok";
  return "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

  return `DevTools tab ${tabId}`;
}

function updateTargetTab(tab, fallbackTabId = tab?.id) {
  state.targetTab = tab && typeof tab === "object"
    ? {
        id: tab.id ?? fallbackTabId,
        title: tab.title || "",
        url: tab.url || ""
      }
    : null;
}

function matchesFilter(item) {
  const searchOk = !state.search || (item.searchText || "").includes(state.search.toLowerCase());
  const domainOk = !state.domain || item.domain === state.domain;
  const statusOk = matchesStatus(item);
  return searchOk && domainOk && statusOk;
}

function matchesStatus(item) {
  if (!state.statusFilter || !Number.isFinite(item.status)) return !state.statusFilter || state.statusFilter !== "error";
  if (state.statusFilter === "error") return item.isError || item.status >= 400 || item.status === 0;
  const firstDigit = Number(state.statusFilter[0]);
  return Math.floor(item.status / 100) === firstDigit;
}

function harEntryToRequest(entry, content, encoding) {
  const request = entry.request;
  const response = entry.response;
  const url = request.url;
  return {
    id: `r-${state.requests.length + 1}`,
    seq: state.requests.length + 1,
    url,
    domain: parseDomain(url),
    method: request.method,
    status: response.status,
    statusText: response.statusText,
    startedDateTime: entry.startedDateTime,
    time: Math.round(entry.time ?? 0),
    requestHeaders: objectFromNameValue(request.headers),
    responseHeaders: objectFromNameValue(response.headers),
    requestBody: request.postData?.text || "",
    responseBody: content || "",
    responseEncoding: encoding || "",
    mimeType: response.content?.mimeType || "",
    responseTruncated: false,
    responseBodyOmitted: false,
    bodySize: response.bodySize,
    transferSize: response._transferSize,
    fromCache: response._fromCache,
    initiator: entry._initiator,
    raw: entry
  };
}

function objectFromNameValue(items = []) {
  const output = {};
  for (const item of items) output[item.name] = item.value;
  return output;
}

function captureNetworkRequest(request) {
  if (state.captureStatus !== "running" || !state.options.captureNetwork) return;
  const version = captureVersion;
  request.getContent((content, encoding) => {
    if (state.captureStatus !== "running" || version !== captureVersion) return;
    const item = harEntryToRequest(request, content, encoding);
    const normalized = normalizeCapturedBody(item.responseBody, {
      mimeType: item.mimeType,
      encoding: item.responseEncoding
    });
    item.responseBody = normalized.body;
    item.responseEncoding = normalized.encoding;
    item.responseTruncated = normalized.truncated;
    item.responseBodyOmitted = normalized.omitted;
    state.requests.push(prepareCapturedRequest(item));
    trimArray(state.requests, 3000);
    scheduleRender();
  });
}

chrome.devtools.network.onRequestFinished.addListener(captureNetworkRequest);

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
  renderSummary();
  renderDomains();
  renderRequests();
  renderHooks();
  renderStorage();
}

function renderSummary() {
  el.startBtn.disabled = controlBusy || state.captureStatus === "running";
  el.pauseBtn.disabled = controlBusy || state.captureStatus !== "running";
  el.stopBtn.disabled = controlBusy || state.captureStatus === "stopped";
  el.requestCount.textContent = state.requests.length;
  el.hookCount.textContent = state.hooks.length;
  el.storageCount.textContent = state.snapshots.length;
  el.errorCount.textContent = state.requests.filter((item) => item.isError).length;
  el.statusText.textContent = state.captureStatus === "running" ? "Running" : state.captureStatus === "paused" ? "Paused" : "Stopped";
  el.snapshotBtn.disabled = !state.options.captureCookies;
}

function renderDomains() {
  const domains = Array.from(new Set(state.requests.map((item) => item.domain).filter(Boolean))).sort();
  const current = el.domainFilter.value;
  el.domainFilter.innerHTML = `<option value="">All domains</option>${domains
    .map((domain) => `<option value="${escapeHtml(domain)}">${escapeHtml(domain)}</option>`)
    .join("")}`;
  el.domainFilter.value = domains.includes(current) ? current : "";
  state.domain = el.domainFilter.value;
}

function renderRequests() {
  const rows = visibleRecentItems(state.requests.filter(matchesFilter), VISIBLE_REQUEST_LIMIT);
  el.requestsTable.innerHTML = rows.map((item) => `
    <tr data-id="${item.id}" class="${state.selectedRequestId === item.id ? "selected" : ""}">
      <td class="seq">${item.seq}</td>
      <td class="method">${escapeHtml(item.method)}</td>
      <td class="status ${statusClass(item.status)}">${item.status || "-"}</td>
      <td title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</td>
      <td class="size">${formatBytes(item.bodySize || item.responseBody.length)}</td>
      <td class="time">${item.time ? `${item.time} ms` : formatTime(item.startedDateTime)}</td>
    </tr>
  `).join("");

  renderRequestDetail();
}

function renderRequestDetail() {
  const item = state.requests.find((request) => request.id === state.selectedRequestId);
  if (!item) {
    el.requestDetail.innerHTML = `<div class="empty">Select a request</div>`;
    return;
  }

  el.requestDetail.innerHTML = `
    <h3>${escapeHtml(item.method)} ${escapeHtml(item.url)}</h3>
    <div class="detailActions">
      <button data-action="copy-fetch">Copy fetch</button>
      <button data-action="copy-curl">Copy cURL</button>
      <button data-action="analyze-request">Analyze this</button>
    </div>
    <dl class="kv">
      <dt>Status</dt><dd>${escapeHtml(item.status)} ${escapeHtml(item.statusText)}</dd>
      <dt>MIME</dt><dd>${escapeHtml(item.mimeType || "-")}</dd>
      <dt>Time</dt><dd>${escapeHtml(item.time)} ms</dd>
      <dt>Size</dt><dd>${escapeHtml(formatBytes(item.bodySize || item.responseBody.length))}</dd>
    </dl>
    <h3>Request Headers</h3>
    <pre class="codeBlock">${escapeHtml(JSON.stringify(item.requestHeaders, null, 2))}</pre>
    ${item.requestBody ? `<h3>Request Body</h3><pre class="codeBlock">${escapeHtml(item.requestBody.slice(0, 12000))}</pre>` : ""}
    <h3>Response Headers</h3>
    <pre class="codeBlock">${escapeHtml(JSON.stringify(item.responseHeaders, null, 2))}</pre>
    ${item.responseBody ? `<h3>Response Body</h3><pre class="codeBlock">${escapeHtml(item.responseBody.slice(0, 12000))}</pre>` : ""}
  `;

  for (const button of el.requestDetail.querySelectorAll("button[data-action]")) {
    button.addEventListener("click", () => handleRequestAction(button.dataset.action, item));
  }
}

function renderHooks() {
  const items = state.hooks.filter(matchesFilter);
  el.hooksList.innerHTML = items.length ? items.map((item) => `
    <article class="event">
      <div class="eventMeta">
        <span class="pill">${escapeHtml(item.kind)}</span>
        <span>${escapeHtml(item.capturedAt)}</span>
      </div>
      <h3>${escapeHtml(item.method || item.url || item.href || item.kind)}</h3>
      <pre class="codeBlock">${escapeHtml(JSON.stringify(item, null, 2))}</pre>
    </article>
  `).join("") : `<div class="empty">No hook events captured</div>`;
}

function renderStorage() {
  const items = state.snapshots.filter(matchesFilter);
  el.storageList.innerHTML = items.length ? items.map((item) => `
    <article class="event">
      <div class="eventMeta">
        <span class="pill">${escapeHtml(item.reason)}</span>
        <span>${escapeHtml(item.capturedAt)}</span>
      </div>
      <h3>${escapeHtml(item.href)}</h3>
      <pre class="codeBlock">${escapeHtml(JSON.stringify(item, null, 2))}</pre>
    </article>
  `).join("") : `<div class="empty">No storage snapshots captured</div>`;
}

async function loadSettings() {
  const message = await requestBackground("storage:get", { keys: ["aiSettings"] });
  state.settings = { ...state.settings, ...(message.data?.aiSettings || {}) };
  syncSettingsForm();
}

function syncSettingsForm() {
  el.baseUrlInput.value = state.settings.baseUrl;
  el.apiKeyInput.value = state.settings.apiKey;
  el.modelInput.value = state.settings.model;
  el.bodyLimitInput.value = state.settings.bodyLimit;
}

async function saveSettings() {
  state.settings = {
    baseUrl: el.baseUrlInput.value.trim().replace(/\/+$/, ""),
    apiKey: el.apiKeyInput.value.trim(),
    model: el.modelInput.value.trim() || "gpt-4.1-mini",
    bodyLimit: Number(el.bodyLimitInput.value) || 4096
  };
  await requestBackground("storage:set", { data: { aiSettings: state.settings } });
}

function buildAnalysisPayload() {
  const bodyLimit = state.settings.bodyLimit;
  const source = getAnalysisRequests();
  const requests = source.slice(-120).map((item) => ({
    seq: item.seq,
    method: item.method,
    url: item.url,
    status: item.status,
    mimeType: item.mimeType,
    time: item.time,
    requestHeaders: item.requestHeaders,
    responseHeaders: item.responseHeaders,
    requestBody: item.requestBody.slice(0, bodyLimit),
    responseBody: item.responseBody.slice(0, bodyLimit)
  }));
  const hooks = getAnalysisHooks().slice(0, 120);
  const snapshots = getAnalysisSnapshots().slice(0, 20);
  return { requests, hooks, snapshots };
}

function getAnalysisRequests() {
  if (el.analysisScope.value === "selected") {
    const selected = state.requests.find((request) => request.id === state.selectedRequestId);
    return selected ? [selected] : [];
  }
  if (el.analysisScope.value === "filtered") return state.requests.filter(matchesFilter);
  return state.requests;
}

function getAnalysisHooks() {
  if (el.analysisScope.value === "selected") return [];
  if (el.analysisScope.value === "filtered") return state.hooks.filter(matchesFilter);
  return state.hooks;
}

function getAnalysisSnapshots() {
  if (el.analysisScope.value === "selected") return [];
  if (el.analysisScope.value === "filtered") return state.snapshots.filter(matchesFilter);
  return state.snapshots;
}

function modeInstruction(mode) {
  const instructions = {
    auto: "Identify the important API flows, authentication, state changes, suspicious behavior, and likely next debugging steps.",
    api: "Reverse engineer the web API. Produce endpoint docs, auth flow, parameter meaning, and runnable reproduction examples.",
    security: "Audit for token leaks, insecure headers, CSRF/XSS-relevant patterns, sensitive data exposure, and risky client-side crypto.",
    performance: "Find slow, duplicated, large, blocking, or cache-inefficient requests and propose concrete frontend/backend fixes.",
    crypto: "Analyze JavaScript crypto/signature behavior from hooks and requests. Infer signing inputs, algorithms, key material handling, and reproduction strategy."
  };
  return instructions[mode] || instructions.auto;
}

async function runAnalysis() {
  if (!state.settings.apiKey) {
    el.settingsDialog.showModal();
    el.analysisOutput.textContent = "Add an API key before running analysis.";
    return;
  }

  const payload = buildAnalysisPayload();
  if (el.analysisScope.value === "selected" && payload.requests.length === 0) {
    el.analysisOutput.textContent = "Select a request before analyzing the selected-request scope.";
    return;
  }
  if (payload.requests.length === 0 && payload.hooks.length === 0) {
    el.analysisOutput.textContent = "Capture some traffic before running analysis.";
    return;
  }

  el.analysisOutput.textContent = "Analyzing...\n";
  el.analyzeBtn.disabled = true;

  const messages = [
    {
      role: "system",
      content: "You are a senior browser protocol analyst. Be precise, cite request sequence numbers, and avoid claiming evidence that is not in the capture."
    },
    {
      role: "user",
      content: `${modeInstruction(el.analysisMode.value)}\n\nCaptured session JSON:\n${JSON.stringify(payload, null, 2)}`
    }
  ];

  try {
    const response = await fetch(`${state.settings.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${state.settings.apiKey}`
      },
      body: JSON.stringify({
        model: state.settings.model,
        messages,
        temperature: 0.2,
        stream: false
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${response.statusText}\n${text.slice(0, 2000)}`);
    }

    const data = await response.json();
    el.analysisOutput.textContent = data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
  } catch (error) {
    el.analysisOutput.textContent = `Analysis failed:\n${error instanceof Error ? error.message : String(error)}`;
  } finally {
    el.analyzeBtn.disabled = false;
  }
}

function buildSessionExport() {
  return {
    exportedAt: new Date().toISOString(),
    tabId,
    requests: state.requests.map(stripDerivedFields),
    hooks: state.hooks,
    snapshots: state.snapshots
  };
}

function buildHarExport() {
  return {
    log: {
      version: "1.2",
      creator: {
        name: "Anything Analyzer Browser",
        version: "0.1.0"
      },
      entries: state.requests.map((item) => item.raw)
    }
  };
}

function exportSession() {
  const format = el.exportFormat.value;
  const exportMap = {
    session: {
      filename: `anything-analyzer-session-${Date.now()}.json`,
      type: "application/json",
      content: JSON.stringify(buildSessionExport(), null, 2)
    },
    har: {
      filename: `anything-analyzer-${Date.now()}.har`,
      type: "application/json",
      content: JSON.stringify(buildHarExport(), null, 2)
    },
    requests: {
      filename: `anything-analyzer-requests-${Date.now()}.json`,
      type: "application/json",
      content: JSON.stringify(state.requests.map(stripDerivedFields), null, 2)
    },
    hooks: {
      filename: `anything-analyzer-hooks-${Date.now()}.json`,
      type: "application/json",
      content: JSON.stringify(state.hooks, null, 2)
    },
    storage: {
      filename: `anything-analyzer-storage-${Date.now()}.json`,
      type: "application/json",
      content: JSON.stringify(state.snapshots, null, 2)
    },
    analysis: {
      filename: `anything-analyzer-analysis-${Date.now()}.md`,
      type: "text/markdown",
      content: el.analysisOutput.textContent || ""
    }
  };
  const selected = exportMap[format] || exportMap.session;
  const blob = new Blob([selected.content], { type: selected.type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = selected.filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function captureCookieSnapshot() {
  if (!state.options.captureCookies) return;
  const message = await requestBackground("cookies:get", { tabId });
  state.snapshots.unshift(prepareSearchableEvent({
    id: `s-${state.snapshots.length + 1}`,
    reason: "cookies-api",
    href: "inspected-tab",
    capturedAt: new Date().toISOString(),
    cookies: message.cookies || [],
    error: message.error
  }));
  scheduleRender();
}

function headerLines(headers) {
  return Object.entries(headers || {})
    .filter(([name]) => !/^content-length$/i.test(name))
    .map(([name, value]) => `  -H ${JSON.stringify(`${name}: ${value}`)}`)
    .join(" \\\n");
}

function buildCurl(item) {
  const parts = [`curl ${JSON.stringify(item.url)}`, `  -X ${JSON.stringify(item.method || "GET")}`];
  const headers = headerLines(item.requestHeaders);
  if (headers) parts.push(headers);
  if (item.requestBody) parts.push(`  --data-raw ${JSON.stringify(item.requestBody)}`);
  return parts.join(" \\\n");
}

function buildFetchSnippet(item) {
  const init = {
    method: item.method || "GET",
    headers: item.requestHeaders || {}
  };
  if (item.requestBody) init.body = item.requestBody;
  return `const response = await fetch(${JSON.stringify(item.url)}, ${JSON.stringify(init, null, 2)});\nconst text = await response.text();\nconsole.log(response.status, text);`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function handleRequestAction(action, item) {
  if (action === "copy-fetch") {
    copyText(buildFetchSnippet(item));
    return;
  }
  if (action === "copy-curl") {
    copyText(buildCurl(item));
    return;
  }
  if (action === "analyze-request") {
    state.selectedRequestId = item.id;
    el.analysisScope.value = "selected";
    document.querySelector('.tab[data-view="analysis"]').click();
    runAnalysis();
  }
}

function clearSession() {
  clearLocalSession();
  requestBackground("capture:clear", { tabId }).catch(() => {});
}

function clearLocalSession() {
  captureVersion += 1;
  state.requests = [];
  state.hooks = [];
  state.snapshots = [];
  state.selectedRequestId = null;
  el.analysisOutput.textContent = "Session cleared.";
  scheduleRender();
}

async function runCaptureControl(type, payload = {}, optimisticStatus = null) {
  const previousStatus = state.captureStatus;
  if (optimisticStatus && optimisticStatus !== state.captureStatus) {
    captureVersion += 1;
    state.captureStatus = optimisticStatus;
  }
  controlBusy = true;
  scheduleRender();
  try {
    const message = await requestBackground(type, { tabId, ...payload });
    if (message.status && message.status !== state.captureStatus) {
      captureVersion += 1;
      state.captureStatus = message.status;
    }
  } catch (error) {
    state.captureStatus = previousStatus;
    el.analysisOutput.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    controlBusy = false;
    scheduleRender();
  }
}

function bindEvents() {
  el.startBtn.addEventListener("click", () => {
    state.options = {
      captureNetwork: el.captureNetworkInput.checked,
      captureHooks: el.captureHooksInput.checked,
      captureStorage: el.captureStorageInput.checked,
      captureCookies: el.captureCookiesInput.checked
    };
    runCaptureControl("capture:start", { options: state.options, attachDebugger: false }, "running");
  });

  el.pauseBtn.addEventListener("click", () => {
    runCaptureControl("capture:pause", {}, "paused");
  });

  el.stopBtn.addEventListener("click", () => {
    runCaptureControl("capture:stop", {}, "stopped");
  });

  el.requestsTable.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (!row) return;
    state.selectedRequestId = row.dataset.id;
    renderRequests();
  });

  el.reloadBtn.addEventListener("click", () => {
    chrome.devtools.inspectedWindow.reload();
  });

  el.snapshotBtn.addEventListener("click", () => {
    captureCookieSnapshot().catch((error) => {
      el.analysisOutput.textContent = `Cookie snapshot failed: ${error.message}`;
    });
  });

  el.clearBtn.addEventListener("click", clearSession);
  el.exportBtn.addEventListener("click", exportSession);
  el.settingsBtn.addEventListener("click", () => {
    syncSettingsForm();
    el.settingsDialog.showModal();
  });

  el.saveSettingsBtn.addEventListener("click", (event) => {
    event.preventDefault();
    saveSettings().then(() => el.settingsDialog.close());
  });

  el.searchInput.addEventListener("input", () => {
    state.search = el.searchInput.value;
    scheduleRender();
  });

  el.domainFilter.addEventListener("change", () => {
    state.domain = el.domainFilter.value;
    scheduleRender();
  });

  el.statusFilter.addEventListener("change", () => {
    state.statusFilter = el.statusFilter.value;
    scheduleRender();
  });

  for (const [input, key] of [
    [el.captureNetworkInput, "captureNetwork"],
    [el.captureHooksInput, "captureHooks"],
    [el.captureStorageInput, "captureStorage"],
    [el.captureCookiesInput, "captureCookies"]
  ]) {
    input.addEventListener("change", () => {
      state.options[key] = input.checked;
      scheduleRender();
    });
  }

  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => {
      state.view = tab.dataset.view;
      document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab));
      document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `${state.view}View`));
    });
  }

  el.analyzeBtn.addEventListener("click", runAnalysis);
  el.copyAnalysisBtn.addEventListener("click", () => copyText(el.analysisOutput.textContent || ""));
  el.clearAnalysisBtn.addEventListener("click", () => {
    el.analysisOutput.textContent = "";
  });
}

function init() {
  bindEvents();
  loadSettings().catch(() => {});
  scheduleRender();
}

init();
