(function installAnythingAnalyzerHooks() {
  const MARK = "__anythingAnalyzerHooksInstalled";
  if (window[MARK]) return;
  Object.defineProperty(window, MARK, { value: true });

  let seq = 0;

  function nowIso() {
    return new Date().toISOString();
  }

  function stringifyValue(value) {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "string") return value;
    if (value instanceof URLSearchParams) return value.toString();
    if (value instanceof FormData) {
      const entries = {};
      for (const [key, item] of value.entries()) {
        entries[key] = typeof item === "string" ? item : `[File:${item.name || "blob"}]`;
      }
      return JSON.stringify(entries);
    }
    if (value instanceof Blob) return `[Blob:${value.type || "unknown"},${value.size}]`;
    if (value instanceof ArrayBuffer) return `[ArrayBuffer:${value.byteLength}]`;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function headersToObject(headers) {
    const output = {};
    try {
      if (!headers) return output;
      new Headers(headers).forEach((value, key) => {
        output[key] = value;
      });
    } catch {
      return output;
    }
    return output;
  }

  function emit(kind, data) {
    window.postMessage({
      source: "anything-analyzer-hook",
      payload: {
        id: ++seq,
        kind,
        href: location.href,
        capturedAt: nowIso(),
        ...data
      }
    }, "*");
  }

  function stackTrace() {
    try {
      return new Error().stack?.split("\n").slice(2, 8).join("\n") || "";
    } catch {
      return "";
    }
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = async function analyzerFetch(input, init) {
      const startedAt = performance.now();
      const request = input instanceof Request ? input : null;
      const url = request?.url || String(input);
      const method = init?.method || request?.method || "GET";
      const headers = { ...headersToObject(request?.headers), ...headersToObject(init?.headers) };
      const body = init?.body !== undefined ? stringifyValue(init.body) : "";
      const callId = ++seq;

      emit("fetch:start", {
        callId,
        url,
        method,
        headers,
        bodyPreview: body.slice(0, 4096),
        stack: stackTrace()
      });

      try {
        const response = await originalFetch.apply(this, arguments);
        emit("fetch:end", {
          callId,
          url: response.url || url,
          method,
          status: response.status,
          ok: response.ok,
          durationMs: Math.round(performance.now() - startedAt),
          responseHeaders: headersToObject(response.headers)
        });
        return response;
      } catch (error) {
        emit("fetch:error", {
          callId,
          url,
          method,
          durationMs: Math.round(performance.now() - startedAt),
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    };
  }

  const OriginalXHR = window.XMLHttpRequest;
  if (typeof OriginalXHR === "function") {
    const originalOpen = OriginalXHR.prototype.open;
    const originalSend = OriginalXHR.prototype.send;
    const originalSetRequestHeader = OriginalXHR.prototype.setRequestHeader;

    OriginalXHR.prototype.open = function analyzerOpen(method, url) {
      this.__aa = {
        callId: ++seq,
        method,
        url: String(url),
        headers: {},
        startedAt: 0
      };
      return originalOpen.apply(this, arguments);
    };

    OriginalXHR.prototype.setRequestHeader = function analyzerSetHeader(name, value) {
      if (this.__aa) this.__aa.headers[name] = value;
      return originalSetRequestHeader.apply(this, arguments);
    };

    OriginalXHR.prototype.send = function analyzerSend(body) {
      if (this.__aa) {
        this.__aa.startedAt = performance.now();
        emit("xhr:start", {
          callId: this.__aa.callId,
          url: this.__aa.url,
          method: this.__aa.method,
          headers: this.__aa.headers,
          bodyPreview: stringifyValue(body).slice(0, 4096),
          stack: stackTrace()
        });

        this.addEventListener("loadend", () => {
          emit("xhr:end", {
            callId: this.__aa.callId,
            url: this.responseURL || this.__aa.url,
            method: this.__aa.method,
            status: this.status,
            durationMs: Math.round(performance.now() - this.__aa.startedAt)
          });
        });
      }
      return originalSend.apply(this, arguments);
    };
  }

  if (window.crypto?.subtle) {
    for (const methodName of ["encrypt", "decrypt", "sign", "verify", "digest", "importKey", "deriveKey", "deriveBits"]) {
      const original = window.crypto.subtle[methodName];
      if (typeof original !== "function") continue;
      try {
        window.crypto.subtle[methodName] = function analyzerSubtle() {
          emit("crypto.subtle", {
            method: methodName,
            argumentsPreview: Array.from(arguments).map(stringifyValue).map((value) => value.slice(0, 1024)),
            stack: stackTrace()
          });
          return original.apply(this, arguments);
        };
      } catch {
        emit("hook:warning", {
          target: `crypto.subtle.${methodName}`,
          message: "Unable to wrap this method in the current browser context."
        });
      }
    }
  }

  try {
    const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    if (cookieDescriptor?.set && cookieDescriptor?.get) {
      Object.defineProperty(document, "cookie", {
        configurable: true,
        enumerable: true,
        get() {
          return cookieDescriptor.get.call(document);
        },
        set(value) {
          emit("cookie:set", {
            value: String(value).slice(0, 2048),
            stack: stackTrace()
          });
          return cookieDescriptor.set.call(document, value);
        }
      });
    }
  } catch {
    emit("hook:warning", {
      target: "document.cookie",
      message: "Unable to wrap document.cookie in the current browser context."
    });
  }

  emit("hooks:ready", {
    userAgent: navigator.userAgent
  });
})();
