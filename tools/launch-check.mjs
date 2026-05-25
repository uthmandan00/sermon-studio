import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const requiredFiles = [
  "index.html",
  "server.mjs",
  "manifest.webmanifest",
  "service-worker.js",
  "assets/js/app.js",
  "assets/js/storage.js",
  "assets/css/style.css"
];

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`Missing required file: ${file}`);
}

for (const file of walk(root).filter((item) => extname(item) === ".js" || extname(item) === ".mjs")) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) failures.push(result.stderr.trim() || `Syntax check failed: ${file}`);
}

for (const file of walk(root).filter((item) => extname(item) === ".html")) {
  const html = readFileSync(file, "utf8");
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const reference = match[1];
    if (reference.startsWith("http") || reference.startsWith("#") || reference.startsWith("mailto:")) continue;
    const target = reference.split("#")[0].split("?")[0];
    if (!target) continue;
    if (!existsSync(resolve(file, "..", target))) failures.push(`Broken local reference in ${file}: ${reference}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Launch check passed.");
