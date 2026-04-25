const uiPorts = new Map();
const captures = new Map();

function tabKey(tabId) {
  return String(tabId);
}

function getCapture(tabId) {
  const key = tabKey(tabId);
  if (!captures.has(key)) {
    captures.set(key, {
      tabId,
      status: "stopped",
      requests: new Map(),
      sequence: 0,
      options: {
        captureNetwork: true,
        captureHooks: true,
        captureStorage: true,
        captureCookies: true
      }
    });
  }
  return captures.get(key);
}

function addPort(tabId, port) {
  const key = tabKey(tabId);
  const ports = uiPorts.get(key) ?? new Set();
  ports.add(port);
  uiPorts.set(key, ports);
}

function removePort(tabId, port) {
  const key = tabKey(tabId);
  const ports = uiPorts.get(key);
  if (!ports) return;
  ports.delete(port);
  if (ports.size === 0) uiPorts.delete(key);
}

function postToUis(tabId, message) {
  const ports = uiPorts.get(tabKey(tabId));
  if (!ports) return;
  for (const port of ports) {
    try {
      port.postMessage(message);
    } catch {
      ports.delete(port);
    }
  }
}

function postError(port, requestId, error) {
  port.postMessage({
    type: "error",
    requestId,
    error: error instanceof Error ? error.message : String(error)
  });
}

function debuggee(tabId) {
  return { tabId };
}

async function sendDebugger(tabId, method, params = {}) {
  return chrome.debugger.sendCommand(debuggee(tabId), method, params);
}

async function startCapture(tabId, options = {}) {
  const capture = getCapture(tabId);
  capture.options = { ...capture.options, ...options };
  capture.status = "running";

  if (!capture.attached) {
    await chrome.debugger.attach(debuggee(tabId), "1.3");
    capture.attached = true;
    await sendDebugger(tabId, "Network.enable", {
      maxTotalBufferSize: 100_000_000,
      maxResourceBufferSize: 20_000_000
    });
    await sendDebugger(tabId, "Page.enable").catch(() => {});
  }

  postToUis(tabId, { type: "capture:status", status: capture.status });
}

async function pauseCapture(tabId) {
  const capture = getCapture(tabId);
  if (capture.status !== "stopped") capture.status = "paused";
  postToUis(tabId, { type: "capture:status", status: capture.status });
}

async function stopCapture(tabId) {
  const capture = getCapture(tabId);
  capture.status = "stopped";
  capture.requests.clear();

  if (capture.attached) {
    await chrome.debugger.detach(debuggee(tabId)).catch(() => {});
    capture.attached = false;
  }

  postToUis(tabId, { type: "capture:status", status: capture.status });
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function getCookies(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || !/^https?:\/\//i.test(tab.url)) return [];
  const cookies = await chrome.cookies.getAll({ url: tab.url });
  return cookies.map((cookie) => ({
    name: cookie.name,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    expirationDate: cookie.expirationDate,
    value: cookie.httpOnly ? "[HttpOnly]" : cookie.value
  }));
}

async function fetchModels(settings) {
  const provider = settings.provider || "openai";
  const baseUrl = normalizeBaseUrl(settings.baseUrl || "", provider);
  const apiKey = settings.apiKey || "";
  if (!baseUrl || !apiKey) throw new Error("Missing Base URL or API key.");

  if (provider === "anthropic") {
    const modelsUrl = `${baseUrl}/models`;
    const response = await fetchWithTimeout(modelsUrl, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": settings.anthropicVersion || "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      }
    });
    const data = await readJsonResponse(response, "Anthropic /models", modelsUrl);
    const models = extractModels(data);
    return { models, baseUrl };
  }

  const modelsUrl = `${baseUrl}/models`;
  const response = await fetchWithTimeout(modelsUrl, {
    headers: {
      "authorization": `Bearer ${apiKey}`
    }
  });
  const data = await readJsonResponse(response, "OpenAI-compatible /models", modelsUrl);
  const models = extractModels(data);
  return { models, baseUrl };
}

async function readJsonResponse(response, label, url) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${response.statusText}; URL=${url}; body=${text.slice(0, 800)}`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} did not return JSON; URL=${url}; body=${text.slice(0, 800)}`);
  }
}

function extractModels(data) {
  const source = Array.isArray(data)
    ? data
    : Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.models)
        ? data.models
        : Array.isArray(data.result)
          ? data.result
          : Array.isArray(data.items)
            ? data.items
            : [];

  return source
    .map((model) => {
      if (typeof model === "string") return { id: model, label: model };
      const id = model?.id || model?.name || model?.model || model?.value;
      if (!id) return null;
      const label = model.display_name || model.label || model.name || id;
      return { id, label: label === id ? id : `${label} (${id})` };
    })
    .filter(Boolean);
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

async function testModel(settings) {
  const provider = settings.provider || "openai";
  const baseUrl = normalizeBaseUrl(settings.baseUrl || "", provider);
  const apiKey = settings.apiKey || "";
  const model = settings.model || "";
  if (!baseUrl || !apiKey || !model) throw new Error("Missing Base URL, API key, or model.");

  if (provider === "anthropic") {
    const url = `${baseUrl}/messages`;
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": settings.anthropicVersion || "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply ok." }]
      })
    }, 60000);
    if (!response.ok) throw new Error(`Anthropic model test failed: ${response.status} ${await response.text()}`);
    return { ok: true, baseUrl };
  }

  const url = `${baseUrl}/chat/completions`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply ok." }]
    })
  }, 60000);
  if (!response.ok) throw new Error(`OpenAI-compatible model test failed: ${response.status} ${await response.text()}`);
  return { ok: true, baseUrl };
}

async function fetchWithTimeout(url, options, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s: ${url}`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId !== undefined) {
    await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (!["analyzer-panel", "analyzer-sidepanel"].includes(port.name)) return;

  let attachedTabId = null;

  port.onMessage.addListener(async (message) => {
    try {
      if (message?.type === "panel:init") {
        attachedTabId = message.tabId;
        addPort(attachedTabId, port);
        port.postMessage({ type: "background:ready", tabId: attachedTabId, status: getCapture(attachedTabId).status });
        return;
      }

      if (message?.type === "sidepanel:init") {
        attachedTabId = message.tabId || await activeTabId();
        addPort(attachedTabId, port);
        port.postMessage({ type: "background:ready", tabId: attachedTabId, status: getCapture(attachedTabId).status });
        return;
      }

      if (message?.type === "tabs:active") {
        const tabId = await activeTabId();
        port.postMessage({ type: "tabs:active", requestId: message.requestId, tabId });
        return;
      }

      if (message?.type === "capture:start") {
        await startCapture(message.tabId, message.options);
        port.postMessage({ type: "capture:started", requestId: message.requestId });
        return;
      }

      if (message?.type === "capture:pause") {
        await pauseCapture(message.tabId);
        port.postMessage({ type: "capture:paused", requestId: message.requestId });
        return;
      }

      if (message?.type === "capture:stop") {
        await stopCapture(message.tabId);
        port.postMessage({ type: "capture:stopped", requestId: message.requestId });
        return;
      }

      if (message?.type === "storage:get") {
        const data = await chrome.storage.local.get(message.keys ?? null);
        port.postMessage({ type: "storage:value", requestId: message.requestId, data });
        return;
      }

      if (message?.type === "storage:set") {
        await chrome.storage.local.set(message.data ?? {});
        port.postMessage({ type: "storage:saved", requestId: message.requestId });
        return;
      }

      if (message?.type === "cookies:get" && Number.isInteger(message.tabId)) {
        const cookies = await getCookies(message.tabId);
        port.postMessage({ type: "cookies:value", requestId: message.requestId, cookies });
        return;
      }

      if (message?.type === "models:list") {
        const result = await fetchModels(message.settings || {});
        port.postMessage({ type: "models:value", requestId: message.requestId, ...result });
        return;
      }

      if (message?.type === "models:test") {
        const result = await testModel(message.settings || {});
        port.postMessage({ type: "models:test:value", requestId: message.requestId, ...result });
      }
    } catch (error) {
      postError(port, message?.requestId, error);
    }
  });

  port.onDisconnect.addListener(() => {
    if (attachedTabId !== null) removePort(attachedTabId, port);
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) return;
  const capture = getCapture(tabId);
  if (capture.status !== "running") return;

  if (message?.type === "hook:event" && capture.options.captureHooks) {
    postToUis(tabId, {
      type: "hook:event",
      frameId: sender.frameId,
      url: sender.url,
      payload: message.payload
    });
  }

  if (message?.type === "storage:snapshot" && capture.options.captureStorage) {
    postToUis(tabId, {
      type: "storage:snapshot",
      frameId: sender.frameId,
      url: sender.url,
      payload: message.payload
    });
  }
});

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  const tabId = source.tabId;
  if (!Number.isInteger(tabId)) return;
  const capture = getCapture(tabId);
  if (capture.status !== "running" || !capture.options.captureNetwork) return;

  if (method === "Network.requestWillBeSent") {
    capture.requests.set(params.requestId, {
      id: params.requestId,
      seq: ++capture.sequence,
      url: params.request.url,
      method: params.request.method,
      requestHeaders: params.request.headers || {},
      requestBody: params.request.postData || "",
      monotonicStart: params.timestamp,
      startedDateTime: params.wallTime ? new Date(params.wallTime * 1000).toISOString() : new Date().toISOString(),
      initiator: params.initiator,
      type: params.type
    });
  }

  if (method === "Network.responseReceived") {
    const item = capture.requests.get(params.requestId) || { id: params.requestId, seq: ++capture.sequence };
    item.url = item.url || params.response.url;
    item.status = params.response.status;
    item.statusText = params.response.statusText;
    item.responseHeaders = params.response.headers || {};
    item.mimeType = params.response.mimeType || "";
    item.fromCache = params.response.fromDiskCache || params.response.fromPrefetchCache || false;
    item.protocol = params.response.protocol;
    item.remoteIPAddress = params.response.remoteIPAddress;
    item.remotePort = params.response.remotePort;
    capture.requests.set(params.requestId, item);
  }

  if (method === "Network.loadingFinished") {
    const item = capture.requests.get(params.requestId);
    if (!item) return;
    item.time = item.monotonicStart ? Math.round((params.timestamp - item.monotonicStart) * 1000) : 0;
    item.bodySize = params.encodedDataLength || 0;
    try {
      const body = await sendDebugger(tabId, "Network.getResponseBody", { requestId: params.requestId });
      item.responseBody = body.base64Encoded ? `[base64:${body.body.length}]` : body.body;
      item.responseEncoding = body.base64Encoded ? "base64" : "";
    } catch {
      item.responseBody = "";
      item.responseEncoding = "";
    }
    postToUis(tabId, { type: "network:request", payload: item });
    capture.requests.delete(params.requestId);
  }

  if (method === "Network.loadingFailed") {
    const item = capture.requests.get(params.requestId);
    if (!item) return;
    item.errorText = params.errorText;
    item.canceled = params.canceled;
    item.status = 0;
    postToUis(tabId, { type: "network:request", payload: item });
    capture.requests.delete(params.requestId);
  }
});

chrome.debugger.onDetach.addListener((source) => {
  const tabId = source.tabId;
  if (!Number.isInteger(tabId)) return;
  const capture = getCapture(tabId);
  capture.status = "stopped";
  capture.attached = false;
  capture.requests.clear();
  postToUis(tabId, { type: "capture:status", status: "stopped" });
});
