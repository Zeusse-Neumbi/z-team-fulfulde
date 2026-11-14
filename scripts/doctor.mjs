#!/usr/bin/env node
/**
 * First command on a new machine.
 *
 * Prints the OS, the toolchain, the Chrome path, the GPU vendor, the local
 * models, the extension ZIP and the local API state. It never installs
 * anything and never sends data anywhere.
 */
import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { APP_VERSION } from "./version.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const verify = process.argv.includes("--verify");
const manifest = JSON.parse(await readFile(join(root, "models/manifest.json"), "utf8"));

function run(command, args = []) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 20_000,
  });
  if (result.error || result.status !== 0) return null;
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
}

function firstLine(text) {
  return text ? text.split(/\r?\n/).find((line) => line.trim()) ?? "" : "";
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

async function sha256(path) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

function chromePath() {
  const candidates = {
    win32: [
      join(process.env.ProgramFiles ?? "C:\\Program Files", "Google/Chrome/Application/chrome.exe"),
      join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Google/Chrome/Application/chrome.exe"),
      join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
      join(process.env.ProgramFiles ?? "C:\\Program Files", "Microsoft/Edge/Application/msedge.exe"),
    ],
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ],
    linux: ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
  };
  return (candidates[process.platform] ?? []).find((path) => path && existsSync(path)) ?? null;
}

function gpuLine() {
  if (process.platform === "win32") {
    const output = run("powershell", [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,AdapterRAM | ConvertTo-Json -Compress",
    ]);
    return output || "unknown (PowerShell query failed)";
  }
  if (process.platform === "darwin") {
    return firstLine(run("system_profiler", ["SPDisplaysDataType"]) ?? "unknown");
  }
  const nvidia = run("nvidia-smi", [
    "--query-gpu=name,driver_version,memory.total",
    "--format=csv,noheader",
  ]);
  if (nvidia) return nvidia;
  const lspci = run("sh", ["-c", "lspci 2>/dev/null | grep -i 'vga\\|3d\\|display'"]);
  return lspci || "unknown (no nvidia-smi, no lspci)";
}

const checks = [];
function check(label, value, ok = true) {
  checks.push({ label, value, ok });
}

check("OS", `${process.platform} ${process.arch} ${process.getuid?.() === 0 ? "(root)" : ""}`.trim());
check("Node", process.version);
check("pnpm", run("pnpm", ["--version"]) ?? "missing");
check("uv", run("uv", ["--version"]) ?? "missing");
check("Python (uv)", firstLine(run("uv", ["run", "--project", "apps/server", "python", "--version"]) ?? "missing"));
check("Git", firstLine(run("git", ["--version"]) ?? "missing"));
check("Chrome/Edge", chromePath() ?? "not found in the usual locations");

let modelsOk = true;
for (const [name, model] of Object.entries(manifest.models)) {
  for (const file of model.files) {
    const path = join(root, "models", model.dir, file.name);
    if (!existsSync(path)) {
      check(`${name}/${file.name}`, "missing", false);
      modelsOk = false;
      continue;
    }
    const size = statSync(path).size;
    if (size !== file.size) {
      check(`${name}/${file.name}`, `size ${formatBytes(size)} != ${formatBytes(file.size)}`, false);
      modelsOk = false;
      continue;
    }
    if (verify) {
      const digest = await sha256(path);
      if (digest !== file.sha256) {
        check(`${name}/${file.name}`, "sha256 mismatch", false);
        modelsOk = false;
        continue;
      }
    }
    check(`${name}/${file.name}`, formatBytes(size));
  }
}

const zip = join(root, `dist/zteam-lingua-extension-v${APP_VERSION}.zip`);
check("Extension ZIP", existsSync(zip) ? formatBytes(statSync(zip).size) : "missing (run pnpm package)");

const port = process.env.ZTEAM_PORT ?? "8000";
let apiState = "not running";
try {
  const response = await fetch(`http://127.0.0.1:${port}/health`, {
    signal: AbortSignal.timeout(2_000),
  });
  if (response.ok) {
    const data = await response.json();
    apiState = `${data.status} tts=${data.backends?.tts} mt=${data.backends?.mt} ready=${JSON.stringify(data.ready)}`;
  } else {
    apiState = `HTTP ${response.status}`;
  }
} catch {
  apiState = "not running";
}

console.log("\nZ-Team Lingua — doctor\n");
for (const item of checks) {
  console.log(`  ${item.ok ? "ok  " : "warn"} ${item.label.padEnd(26)} ${item.value}`);
}
console.log(`  ok   ${"Local API".padEnd(26)} ${apiState}`);
console.log(`\nGPU: ${gpuLine()}`);
if (!modelsOk) {
  console.log("\nModels are incomplete. Run: pnpm models:download mms nllb-ct2");
}
if (!existsSync(join(root, "apps/extension/.output/chrome-mv3"))) {
  console.log("Extension build missing. Run: pnpm build");
}
console.log("\nNext:");
console.log("  pnpm bootstrap                 # install JS + Python dependencies");
console.log("  pnpm models:download mms nllb-ct2");
console.log("  pnpm setup:e2e                 # Chromium for Playwright");
console.log("  pnpm build                     # then load apps/extension/.output/chrome-mv3");
console.log("  pnpm e2e                       # extension smoke tests");
console.log(`  uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port ${port}`);
