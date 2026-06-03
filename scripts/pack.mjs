// 打包扩展为可上架 Chrome 网上应用店的 ZIP。
// 仅包含运行所需文件，排除 README/test/node_modules/.git 等。
// 用法：node scripts/pack.mjs
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const version = manifest.version;

// 进入打包包内的运行文件清单（目录会整体递归复制）
const includeFiles = ["manifest.json"];
const includeDirs = ["_locales", "src", "assets/icons"];

const distDir = path.join(root, "dist");
fs.mkdirSync(distDir, { recursive: true });

// 唯一名 staging，避免清理已存在目录
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "reqpkg-"));

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

for (const f of includeFiles) copyRecursive(path.join(root, f), path.join(stage, f));
for (const d of includeDirs) copyRecursive(path.join(root, d), path.join(stage, d));

const zipPath = path.join(distDir, `req-analyzer-v${version}.zip`);
if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

if (process.platform === "win32") {
  // 用 .NET ZipFile 打包（避免 Compress-Archive 在受限环境下的删除拦截）
  const ps = [
    "Add-Type -AssemblyName System.IO.Compression.FileSystem;",
    `[System.IO.Compression.ZipFile]::CreateFromDirectory('${stage}','${zipPath}')`
  ].join(" ");
  execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { stdio: "inherit" });
} else {
  // macOS/Linux 用系统 zip
  execFileSync("zip", ["-r", "-q", zipPath, "."], { cwd: stage, stdio: "inherit" });
}

const sizeKb = (fs.statSync(zipPath).size / 1024).toFixed(1);
console.log(`打包完成: ${zipPath} (${sizeKb} KB)`);
