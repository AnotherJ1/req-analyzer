import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");
const timerPath = path.join(rootDir, "src", "request-timer.js");
const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(timerPath, "utf8"), context, { filename: timerPath });
const { formatElapsedSeconds, formatAiRequestStatus } = context.globalThis.requestTimer;

test("formatElapsedSeconds uses seconds under one minute", () => {
  assert.equal(formatElapsedSeconds(0), "0 秒");
  assert.equal(formatElapsedSeconds(999), "0 秒");
  assert.equal(formatElapsedSeconds(1200), "1 秒");
});

test("formatElapsedSeconds uses minutes and seconds after one minute", () => {
  assert.equal(formatElapsedSeconds(61_000), "1 分 1 秒");
  assert.equal(formatElapsedSeconds(125_900), "2 分 5 秒");
});

test("formatAiRequestStatus uses zh-CN labels while requesting", () => {
  assert.equal(
    formatAiRequestStatus({ phase: "running", elapsedMs: 3200, provider: "openai", url: "https://api.example.com/v1/chat/completions", model: "gpt-4.1-mini" }),
    "正在分析...\n已请求：3 秒\n协议：openai\n接口：https://api.example.com/v1/chat/completions\n模型：gpt-4.1-mini"
  );
});

test("formatAiRequestStatus uses English labels while requesting", () => {
  assert.equal(
    formatAiRequestStatus({ phase: "running", elapsedMs: 3200, provider: "openai", url: "https://api.example.com/v1/chat/completions", model: "gpt-4.1-mini", language: "en" }),
    "Analyzing...\nElapsed: 3 sec\nProvider: openai\nEndpoint: https://api.example.com/v1/chat/completions\nModel: gpt-4.1-mini"
  );
});

test("formatAiRequestStatus preserves final elapsed time", () => {
  assert.equal(
    formatAiRequestStatus({ phase: "done", elapsedMs: 65_000 }),
    "分析完成，用时：1 分 5 秒"
  );
});

test("formatAiRequestStatus preserves English final elapsed time", () => {
  assert.equal(
    formatAiRequestStatus({ phase: "done", elapsedMs: 65_000, language: "en" }),
    "Analysis complete. Duration: 1 min 5 sec"
  );
});
