import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");
const utilsPath = path.join(rootDir, "src", "capture-utils.js");
const context = { globalThis: {}, URL };
vm.createContext(context);
vm.runInContext(fs.readFileSync(utilsPath, "utf8"), context, { filename: utilsPath });
const { createCaptureGate, normalizeCapturedBody, prepareCapturedRequest, prepareSearchableEvent, visibleRecentItems } = context.globalThis.captureUtils;

test("capture gate rejects async work after pause invalidates the token", () => {
  const gate = createCaptureGate();
  gate.start();
  const token = gate.token();

  gate.pause();

  assert.equal(gate.isCurrentRunning(token), false);
});

test("capture gate accepts async work while token is current and running", () => {
  const gate = createCaptureGate();
  gate.start();
  const token = gate.token();

  assert.equal(gate.isCurrentRunning(token), true);
});

test("normalizeCapturedBody truncates large text bodies", () => {
  const result = normalizeCapturedBody("abcdef", { limit: 4, mimeType: "application/json" });

  assert.equal(result.body, "abcd");
  assert.equal(result.truncated, true);
  assert.equal(result.encoding, "");
  assert.equal(result.omitted, false);
});

test("normalizeCapturedBody omits binary bodies", () => {
  const result = normalizeCapturedBody("binary-data", { limit: 100, mimeType: "image/png" });

  assert.equal(result.body, "[binary body omitted:image/png]");
  assert.equal(result.truncated, false);
  assert.equal(result.encoding, "");
  assert.equal(result.omitted, true);
});

test("prepareCapturedRequest creates lightweight search text without full response body", () => {
  const item = prepareCapturedRequest({
    id: "1",
    url: "https://api.example.com/users",
    method: "POST",
    status: 500,
    mimeType: "application/json",
    requestHeaders: { authorization: "Bearer secret" },
    responseHeaders: { "content-type": "application/json" },
    requestBody: "request-body",
    responseBody: "x".repeat(1000)
  }, { indexBodyLimit: 8 });

  assert.equal(item.domain, "api.example.com");
  assert.equal(item.isError, true);
  assert.equal(item.searchText.includes("https://api.example.com/users"), true);
  assert.equal(item.searchText.includes("application/json"), true);
  assert.equal(item.searchText.includes("request-body"), false);
  assert.equal(item.searchText.includes("x".repeat(100)), false);
});

test("prepareCapturedRequest redacts sensitive values from search text", () => {
  const item = prepareCapturedRequest({
    url: "https://api.example.com/secure",
    method: "GET",
    status: 200,
    requestHeaders: { authorization: "Bearer secret-token", cookie: "sid=secret-cookie", accept: "application/json" },
    responseHeaders: { "set-cookie": "sid=response-secret", "content-type": "application/json" },
    requestBody: "contains-secret-body",
    responseBody: "contains-secret-response"
  });

  assert.equal(item.searchText.includes("secret-token"), false);
  assert.equal(item.searchText.includes("secret-cookie"), false);
  assert.equal(item.searchText.includes("response-secret"), false);
  assert.equal(item.searchText.includes("contains-secret-body"), false);
  assert.equal(item.searchText.includes("contains-secret-response"), false);
  assert.equal(item.searchText.includes("application/json"), true);
});

test("prepareSearchableEvent creates search text and domain for hook or storage entries", () => {
  const item = prepareSearchableEvent({
    kind: "fetch:start",
    url: "https://api.example.com/users",
    reason: "interval"
  });

  assert.equal(item.domain, "api.example.com");
  assert.equal(item.searchText.includes("fetch:start"), true);
  assert.equal(item.searchText.includes("interval"), true);
});

test("visibleRecentItems returns the newest items in newest-first order", () => {
  const items = Array.from({ length: 5 }, (_, index) => ({ seq: index + 1 }));

  assert.deepEqual(visibleRecentItems(items, 3).map((item) => item.seq), [5, 4, 3]);
});
