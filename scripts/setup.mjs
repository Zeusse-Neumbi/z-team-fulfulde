#!/usr/bin/env node
/**
 * One-command bootstrap for Windows, macOS and Linux.
 *
 *   pnpm bootstrap
 *   pnpm bootstrap --speech
 *   pnpm bootstrap --speech --models
 *
 * It checks the toolchain, installs the JS and Python dependencies, optionally
 * downloads the local models, then builds the extension. It never installs
 * system tools: a missing tool is reported with its download link.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION } from "./version.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const withSpeech = args.includes("--speech");
const withModels = args.includes("--models");

function run(command, commandArgs, options = {}) {
  console.log(`\n$ ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.error || result.status !== 0) {
    console.error(`\n[bootstrap] failed: ${command} ${commandArgs.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

function version(command, commandArgs = ["--version"]) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 20_000,
  });
  if (result.error || result.status !== 0) return null;
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split(/\r?\n/)[0];
}

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
if (nodeMajor < 22) {
  console.error(`[bootstrap] Node ${process.version} is too old; pnpm 11 needs Node 22+.`);
  console.error("            Install Node 24 LTS: https://nodejs.org/en/download");
  process.exit(1);
}

if (!version("pnpm")) {
  console.error("[bootstrap] pnpm is missing. Run `corepack enable pnpm` or see https://pnpm.io/installation");
  process.exit(1);
}
if (!version("uv")) {
  console.error("[bootstrap] uv is missing.");
  console.error("  Windows: powershell -ExecutionPolicy ByPass -c \"irm https://astral.sh/uv/install.ps1 | iex\"");
  console.error("  macOS/Linux: curl -LsSf https://astral.sh/uv/install.sh | sh");
  process.exit(1);
}

console.log("[bootstrap] toolchain");
console.log(`  Node    ${process.version}`);
console.log(`  pnpm    ${version("pnpm")}`);
console.log(`  uv      ${version("uv")}`);
console.log(`  Python  ${version("uv", ["run", "--project", "apps/server", "python", "--version"]) ?? "will be installed by uv"}`);
console.log(`  Git     ${version("git") ?? "missing"}`);

run("pnpm", ["install", "--frozen-lockfile"]);

const syncArgs = ["sync", "--project", "apps/server", "--frozen", "--extra", "dev"];
if (withSpeech) syncArgs.push("--extra", "speech");
run("uv", syncArgs);

if (withModels) {
  run("node", ["scripts/download-models.mjs", "mms", "nllb-ct2"]);
}

run("pnpm", ["build"]);

console.log("\n[bootstrap] done.");
console.log("  doctor:   pnpm doctor");
console.log("  e2e:      pnpm setup:e2e && pnpm e2e");
console.log("  API:      uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000");
console.log("  Load:     apps/extension/.output/chrome-mv3 in chrome://extensions (Developer mode)");
if (!existsSync(resolve(root, "models/mms-tts-ful/model.safetensors"))) {
  console.log("  Models:   pnpm models:download mms nllb-ct2");
}
if (!existsSync(resolve(root, `dist/zteam-fulfulde-extension-v${APP_VERSION}.zip`))) {
  console.log("  Package:  pnpm package");
}
