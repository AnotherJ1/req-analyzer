const defaults = {
  baseUrl: "api.openai.com",
  apiKey: "",
  model: "gpt-4.1-mini",
  bodyLimit: 4096
};

const el = {
  baseUrlInput: document.getElementById("baseUrlInput"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  modelInput: document.getElementById("modelInput"),
  bodyLimitInput: document.getElementById("bodyLimitInput"),
  saveBtn: document.getElementById("saveBtn"),
  statusText: document.getElementById("statusText")
};

async function loadSettings() {
  const data = await chrome.storage.local.get(["aiSettings"]);
  const settings = { ...defaults, ...(data.aiSettings || {}) };
  el.baseUrlInput.value = settings.baseUrl;
  el.apiKeyInput.value = settings.apiKey;
  el.modelInput.value = settings.model;
  el.bodyLimitInput.value = settings.bodyLimit;
}

async function saveSettings() {
  const baseUrl = normalizeBaseUrl(el.baseUrlInput.value);
  await chrome.storage.local.set({
    aiSettings: {
      baseUrl,
      apiKey: el.apiKeyInput.value.trim(),
      model: el.modelInput.value.trim() || defaults.model,
      bodyLimit: Number(el.bodyLimitInput.value) || defaults.bodyLimit
    }
  });
  el.baseUrlInput.value = baseUrl;
  el.statusText.textContent = "Settings saved.";
  setTimeout(() => {
    el.statusText.textContent = "";
  }, 1600);
}

function normalizeBaseUrl(input) {
  let value = String(input || "").trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  value = value.replace(/\/+$/, "");
  return /\/v\d+$/i.test(value) ? value : `${value}/v1`;
}

el.saveBtn.addEventListener("click", saveSettings);
loadSettings().catch((error) => {
  el.statusText.textContent = error instanceof Error ? error.message : String(error);
});
