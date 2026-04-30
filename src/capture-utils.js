(function () {
  const DEFAULT_BODY_LIMIT = 64 * 1024;
  const DEFAULT_INDEX_BODY_LIMIT = 512;
  const DEFAULT_VISIBLE_LIMIT = 200;
  const BINARY_MIME_RE = /^(image|audio|video|font)\//i;

  function createCaptureGate(initialStatus = "stopped") {
    let status = initialStatus;
    let version = 0;

    function move(nextStatus) {
      status = nextStatus;
      version += 1;
      return status;
    }

    return {
      start: () => move("running"),
      pause: () => move(status === "stopped" ? "stopped" : "paused"),
      stop: () => move("stopped"),
      clear: () => move(status),
      token: () => version,
      status: () => status,
      isCurrentRunning: (token) => status === "running" && token === version
    };
  }

  function isBinaryMime(mimeType = "") {
    const value = String(mimeType).toLowerCase();
    return BINARY_MIME_RE.test(value)
      || value.includes("application/octet-stream")
      || value.includes("application/pdf")
      || value.includes("application/zip")
      || value.includes("wasm");
  }

  function normalizeCapturedBody(body, options = {}) {
    const limit = Number.isFinite(options.limit) ? Math.max(0, options.limit) : DEFAULT_BODY_LIMIT;
    const mimeType = options.mimeType || "";
    const encoding = options.encoding || "";

    if (isBinaryMime(mimeType)) {
      return {
        body: `[binary body omitted:${mimeType || "unknown"}]`,
        truncated: false,
        encoding: "",
        omitted: true
      };
    }

    const value = String(body ?? "");
    return {
      body: value.length > limit ? value.slice(0, limit) : value,
      truncated: value.length > limit,
      encoding,
      omitted: false
    };
  }

  function parseDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  }

  function compactForIndex(value, limit) {
    if (!value) return "";
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.slice(0, limit);
  }

  function redactHeaders(headers = {}) {
    const output = {};
    for (const [name, value] of Object.entries(headers || {})) {
      output[name] = /^(authorization|cookie|set-cookie|x-api-key|x-auth-token|proxy-authorization)$/i.test(name)
        ? "[REDACTED]"
        : value;
    }
    return output;
  }

  function prepareSearchableEvent(item, options = {}) {
    const indexBodyLimit = Number.isFinite(options.indexBodyLimit) ? options.indexBodyLimit : DEFAULT_INDEX_BODY_LIMIT;
    const domain = item.domain || parseDomain(item.url || item.href);
    const searchText = [
      item.kind,
      item.reason,
      item.method,
      item.url,
      item.href,
      domain,
      item.capturedAt,
      compactForIndex(item.error, indexBodyLimit)
    ].filter((value) => value !== undefined && value !== null && value !== "").join("\n").toLowerCase();

    return { ...item, domain, searchText };
  }

  function prepareCapturedRequest(item, options = {}) {
    const indexBodyLimit = Number.isFinite(options.indexBodyLimit) ? options.indexBodyLimit : DEFAULT_INDEX_BODY_LIMIT;
    const domain = item.domain || parseDomain(item.url);
    const status = Number.isFinite(item.status) ? item.status : Number(item.status);
    const isError = status >= 400 || status === 0;
    const searchText = [
      item.url,
      domain,
      item.method,
      item.status,
      item.statusText,
      item.mimeType,
      compactForIndex(redactHeaders(item.requestHeaders), indexBodyLimit),
      compactForIndex(redactHeaders(item.responseHeaders), indexBodyLimit)
    ].filter((value) => value !== undefined && value !== null && value !== "").join("\n").toLowerCase();

    return {
      ...item,
      domain,
      isError,
      displaySize: item.bodySize || String(item.responseBody || "").length || 0,
      searchText
    };
  }

  function stripDerivedFields(item) {
    const { searchText, domain, isError, displaySize, ...rest } = item;
    return rest;
  }

  function visibleRecentItems(items, limit = DEFAULT_VISIBLE_LIMIT) {
    return items.slice(Math.max(0, items.length - limit)).reverse();
  }

  globalThis.captureUtils = {
    createCaptureGate,
    normalizeCapturedBody,
    prepareCapturedRequest,
    prepareSearchableEvent,
    stripDerivedFields,
    visibleRecentItems
  };
}());
