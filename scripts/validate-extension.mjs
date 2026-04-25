import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const requiredFiles = [
  manifest.background.service_worker,
  manifest.devtools_page,
  "src/devtools.js",
  "src/panel.html",
  "src/panel.css",
  "src/panel.js",
  "src/popup.html",
  "src/popup.css",
  "src/popup.js",
  "src/sidepanel.html",
  "src/sidepanel.css",
  "src/sidepanel.js",
  "src/content.js",
  "src/injected.js",
  "_locales/zh_CN/messages.json",
  "_locales/en/messages.json"
];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

for (const file of requiredFiles.filter((item) => item.endsWith(".js"))) {
  const fullPath = path.join(root, file);
  const source = fs.readFileSync(fullPath, "utf8");
  new vm.Script(source, { filename: file });
}

console.log("Extension manifest and JavaScript syntax look good.");
