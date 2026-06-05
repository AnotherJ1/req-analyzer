// 打包扩展为 Chrome Web Store 上架 ZIP
// 用法：
//   node scripts/pack.mjs           → 仅打包运行文件（上传 CWS 用）
//   node scripts/pack.mjs --store   → 额外附带商店素材目录与上架文案
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const version = manifest.version;
const storeMode = process.argv.includes("--store");

// ========== 清单 ==========
// 运行必需文件（单文件）
const includeFiles = [
  "manifest.json",
  "README.md",
  "README.zh-CN.md",
  "PRIVACY.md",
];

// 运行必需目录（递归复制）
const includeDirs = [
  "_locales",
  "src",
  "assets/icons",
];

// 仅 --store 模式附带
const storeFiles = storeMode ? ["STORE_LISTING.md"] : [];
const storeDirs = storeMode ? ["store-assets"] : [];

// 递归复制期间自动跳过的文件/目录
const skipNames = new Set([
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
]);

// ========== 工具函数 ==========
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (skipNames.has(path.basename(src))) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    if (skipNames.has(path.basename(src))) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function walkFiles(dir, rootDir) {
  const base = rootDir ?? dir;
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(full, base));
    } else {
      result.push({ rel: path.relative(base, full), size: fs.statSync(full).size });
    }
  }
  return result;
}

// ========== 打包 ==========
const distDir = path.join(root, "dist");
fs.mkdirSync(distDir, { recursive: true });

const stage = fs.mkdtempSync(path.join(os.tmpdir(), "reqpkg-"));

function safeCopy(relPath) {
  const src = path.join(root, relPath);
  if (fs.existsSync(src)) copyRecursive(src, path.join(stage, relPath));
  else console.warn(`  ⚠ 跳过（不存在）: ${relPath}`);
}

for (const f of includeFiles) safeCopy(f);
for (const d of includeDirs) safeCopy(d);
for (const f of storeFiles) safeCopy(f);
for (const d of storeDirs) safeCopy(d);

// 生成 ZIP
const suffix = storeMode ? "-store" : "";
const zipName = `req-analyzer-v${version}${suffix}.zip`;
const zipPath = path.join(distDir, zipName);
if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

if (process.platform === "win32") {
  // .NET ZipFile：避免 Compress-Archive 在某些环境下的删除拦截
  const ps = [
    "Add-Type -AssemblyName System.IO.Compression.FileSystem;",
    `[System.IO.Compression.ZipFile]::CreateFromDirectory('${stage.replace(/\\/g, "\\\\")}','${zipPath.replace(/\\/g, "\\\\")}')`,
  ].join(" ");
  execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { stdio: "inherit" });
} else {
  execFileSync("zip", ["-r", "-q", zipPath, "."], { cwd: stage, stdio: "inherit" });
}

// ========== 输出 ==========
const fileList = walkFiles(stage).sort((a, b) => a.rel.localeCompare(b.rel));
const totalKb = (fs.statSync(zipPath).size / 1024).toFixed(1);

console.log(`\n📦 打包完成: ${zipPath}`);
console.log(`   大小: ${totalKb} KB`);
console.log(`   模式: ${storeMode ? "商店上架（含素材）" : "CWS 上架（仅运行文件）"}`);
console.log(`   文件数: ${fileList.length}`);
console.log("");

const maxShow = 60;
for (let i = 0; i < fileList.length && i < maxShow; i += 1) {
  const f = fileList[i];
  console.log(`  ${f.rel}  (${(f.size / 1024).toFixed(1)} KB)`);
}
if (fileList.length > maxShow) {
  console.log(`  ... 还有 ${fileList.length - maxShow} 个文件`);
}
console.log("");