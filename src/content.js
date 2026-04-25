(function bootstrapAnalyzerContent() {
  const MARK = "__anythingAnalyzerContentLoaded";
  if (window[MARK]) return;
  window[MARK] = true;

  function send(type, payload) {
    try {
      if (!chrome.runtime?.id) return;
      chrome.runtime.sendMessage({ type, payload }).catch(() => {});
    } catch {
      // The page can keep an old content script alive after the extension reloads.
      // In that state Chrome throws "Extension context invalidated"; ignore it.
    }
  }

  function injectMainWorldHooks() {
    if (!chrome.runtime?.id) return;
    const script = document.createElement("script");
    try {
      script.src = chrome.runtime.getURL("src/injected.js");
    } catch {
      return;
    }
    script.async = false;
    script.onload = () => script.remove();
    const target = document.documentElement || document.head || document.body;
    if (target) {
      target.appendChild(script);
      return;
    }
    document.addEventListener("DOMContentLoaded", () => {
      (document.documentElement || document.head || document.body)?.appendChild(script);
    }, { once: true });
  }

  function readStorageArea(area) {
    const output = {};
    try {
      const storage = window[area];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key !== null) output[key] = storage.getItem(key);
      }
    } catch (error) {
      output.__error = error instanceof Error ? error.message : String(error);
    }
    return output;
  }

  let lastSnapshot = "";

  function captureStorageSnapshot(reason) {
    const payload = {
      reason,
      href: location.href,
      origin: location.origin,
      capturedAt: new Date().toISOString(),
      cookie: (() => {
        try {
          return document.cookie || "";
        } catch {
          return "";
        }
      })(),
      localStorage: readStorageArea("localStorage"),
      sessionStorage: readStorageArea("sessionStorage")
    };

    const serialized = JSON.stringify(payload);
    if (serialized === lastSnapshot && reason === "interval") return;
    lastSnapshot = serialized;
    send("storage:snapshot", payload);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== "anything-analyzer-hook") return;
    send("hook:event", event.data.payload);
  });

  injectMainWorldHooks();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => captureStorageSnapshot("domcontentloaded"), { once: true });
  } else {
    captureStorageSnapshot("initial");
  }

  setInterval(() => captureStorageSnapshot("interval"), 5000);
  window.addEventListener("pagehide", () => captureStorageSnapshot("pagehide"));
})();
