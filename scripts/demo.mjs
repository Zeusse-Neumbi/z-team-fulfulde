#!/usr/bin/env node
/**
 * One command for the local demo.
 *
 *   pnpm demo                 # MMS + NLLB, auto port, auto CPU/GPU, prewarm
 *   pnpm demo -- --check      # preflight only
 *   pnpm demo -- --deep       # verify NLLB end-to-end with /translate
 *   pnpm demo -- --stub       # no models; stub voice; UI smoke test
 *   pnpm demo -- --no-prewarm
 *   pnpm demo -- --port 8011  # exact port
 *   pnpm demo -- --cpu | --gpu
 *   pnpm demo -- --download   # download the models first
 *
 * With --port auto (the default) it reuses a Z-Team API on 8000-8010, otherwise
 * it starts on the first free port. The panel discovers the same range.
 * It never kills a server it did not start.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);

function option(name, fallback) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

if (has("--help") || has("-h")) {
  console.log(`Usage: pnpm demo [options]

  --check       preflight only; start nothing
  --deep        verify NLLB with a real POST /translate
  --stub        no models; stub voice; UI smoke test
  --no-prewarm  skip the /tts prewarm
  --port auto   reuse a Z-Team API or start on the first free port (default)
  --port N      exact port
  --cpu         force CPU
  --gpu         force CUDA (fails if CUDA is unavailable)
  --download    download the MMS and NLLB int8 models first
`);
  process.exit(0);
}

const check = has("--check");
const deep = has("--deep");
const stub = has("--stub");
const skipPrewarm = has("--no-prewarm") || stub;
const portOption = option("--port", "auto");
const forceCpu = has("--cpu");
const forceGpu = has("--gpu");
const download = has("--download");

let port = 8000;
let baseUrl = `http://127.0.0.1:${port}`;

const mmsDir = join(root, "models/mms-tts-ful");
const nllbDir = join(root, "models/nllb-200-600m-int8");
const mmsModel = join(mmsDir, "model.safetensors");
const nllbModel = join(nllbDir, "model.bin");
const generated = join(root, "packages/phrasebank/src/generated.ts");
const extension = join(root, "apps/extension/.output/chrome-mv3");
const zip = join(root, "dist/zteam-fulfulde-extension-v0.1.0.zip");
const ports = Array.from({ length: 11 }, (_, index) => 8000 + index);

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
    shell: process.platform === "win32",
    ...options,
  });
}

function portFree(portNumber) {
  return new Promise((resolveFree) => {
    const server = createServer();
    server.once("error", () => resolveFree(false));
    server.once("listening", () => server.close(() => resolveFree(true)));
    server.listen({ port: portNumber, host: "127.0.0.1", exclusive: true });
  });
}

async function health(url, timeout = 1_500) {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(timeout) });
    if (!response.ok) return { foreign: true, status: response.status };
    const data = await response.json();
    if (data?.service !== "zteam-server") return { foreign: true, data };
    return data;
  } catch {
    return null;
  }
}

async function selectPort(value) {
  if (value !== "auto") {
    const number = Number.parseInt(value, 10);
    if (!Number.isInteger(number) || number < 1 || number > 65535) {
      console.error(`[demo] invalid port: ${value}`);
      return null;
    }
    const url = `http://127.0.0.1:${number}`;
    const state = await health(url, 500);
    if (state?.foreign) {
      console.error(`[demo] port ${number} is used by another service (HTTP ${state.status ?? "?"}).`);
      console.error("       Use --port auto, or stop that service.");
      return null;
    }
    if (state) return { port: number, existing: state };
    if (!(await portFree(number))) {
      console.error(`[demo] port ${number} is busy. Use --port auto, or stop that process.`);
      return null;
    }
    return { port: number, existing: null };
  }

  for (const candidate of ports) {
    const state = await health(`http://127.0.0.1:${candidate}`, 500);
    if (state && !state.foreign) return { port: candidate, existing: state };
  }
  for (const candidate of ports) {
    if (await portFree(candidate)) return { port: candidate, existing: null };
  }
  return null;
}

function mmsExtra() {
  const result = run("uv", [
    "run",
    "--project",
    "apps/server",
    "python",
    "-c",
    "import torch, transformers; print('ok')",
  ]);
  return result.status === 0;
}

function ct2Available() {
  const result = run("uv", [
    "run",
    "--project",
    "apps/server",
    "python",
    "-c",
    "import ctranslate2; print('ok')",
  ]);
  return result.status === 0;
}

function cudaAvailable() {
  const result = run("uv", [
    "run",
    "--project",
    "apps/server",
    "python",
    "-c",
    "import torch; print('cuda' if torch.cuda.is_available() else 'cpu')",
  ]);
  if (result.status !== 0) return false;
  return `${result.stdout ?? ""}`.trim().endsWith("cuda");
}

function packState() {
  if (!existsSync(generated)) return { state: "missing", empty: 0, total: 0 };
  const text = readFileSync(generated, "utf8");
  const total = (text.match(/"text":/g) ?? []).length;
  const empty = (text.match(/"text": ""/g) ?? []).length;
  const state =
    total === 0 ? "missing" : empty === 0 ? "validated" : empty === total ? "seed" : "partial";
  return { state, empty, total };
}

function apiSummary(state) {
  if (!state) return "not running";
  if (state.foreign) return `busy (HTTP ${state.status ?? "?"})`;
  const ready = state.ready ?? {};
  return `zteam api tts=${state.backends?.tts} mt=${state.backends?.mt} ready=${JSON.stringify(ready)}`;
}

function printPack(pack) {
  if (pack.state === "seed") {
    console.log(
      `  pack      seed (${pack.empty}/${pack.total} empty) — TM-only stays source; local MT is labelled. Do not record the jury video yet.`,
    );
  } else if (pack.state === "partial") {
    console.log(`  pack      partial (${pack.empty}/${pack.total} empty) — check the missing entries.`);
  } else {
    console.log(`  pack      ${pack.state}`);
  }
}

function printRunbook({ tts, mt, device, pack }) {
  const loadPath =
    process.platform === "win32"
      ? "apps\\extension\\.output\\chrome-mv3"
      : "apps/extension/.output/chrome-mv3";
  console.log("\n[demo] ready");
  console.log(`  API       ${baseUrl}`);
  console.log(`  health    ${baseUrl}/health`);
  console.log(`  tts       ${tts} (${device})`);
  console.log(`  mt        ${mt}`);
  printPack(pack);
  console.log("  panel     discovers the API on 127.0.0.1:8000-8010");
  console.log("  mode      Traduction → Repli après la TM (MT local, non validée)");
  console.log("  guide     docs/MANUAL_DEMO.md");
  console.log("  build     pnpm build          # product; pnpm build:test for mechanics");
  console.log(`  load      ${loadPath}`);
  console.log("  page      https://safinum.cm/hackathon-test");
  console.log(`  reset     curl -X POST ${baseUrl}/demo/reset`);
  console.log("  stop      Ctrl+C");
  if (!existsSync(extension)) {
    console.log("  warn      the extension is not built yet; run pnpm build.");
  }
  if (existsSync(zip)) {
    console.log(`  zip       ${formatBytes(statSync(zip).size)}`);
  }
}

async function deepTranslate(url) {
  console.log("[demo] NLLB deep check: POST /translate...");
  try {
    const response = await fetch(`${url}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Votre solde est de 250 000 FCFA.",
        source: "fr",
        target: "fub",
        provider: "nllb",
      }),
      signal: AbortSignal.timeout(180_000),
    });
    const data = await response.json();
    if (!response.ok || !data.translated) {
      console.log(`[demo] NLLB deep failed: ${data?.detail?.code ?? response.status}`);
      return false;
    }
    console.log(`[demo] NLLB deep ok (${data.latency_ms} ms): ${data.text}`);
    return true;
  } catch (error) {
    console.log(`[demo] NLLB deep failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  if (download && !stub) {
    console.log("[demo] downloading mms and nllb-ct2...");
    const result = run("node", ["scripts/download-models.mjs", "mms", "nllb-ct2"], {
      stdio: "inherit",
      timeout: 0,
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }

  const pack = packState();
  const tts = stub ? "stub" : "mms";
  const mms = stub ? true : mmsExtra();
  const ct2 = stub ? false : ct2Available();
  const nllbModelOk = existsSync(nllbModel);
  const nllbPlan = stub ? "stub" : nllbModelOk && ct2 ? "nllb" : "stub";
  const mt = nllbPlan;

  if (!stub && !existsSync(mmsModel)) {
    console.error("[demo] the MMS model is missing:");
    console.error(`       ${mmsModel}`);
    console.error("       Run: pnpm models:download mms nllb-ct2");
    process.exit(1);
  }

  if (!stub && !mms) {
    console.error("[demo] the MMS dependencies are missing (torch / transformers).");
    console.error("       Run: pnpm bootstrap --speech");
    console.error("       or:  uv sync --project apps/server --extra speech");
    process.exit(1);
  }

  const cuda = !stub && !forceCpu ? cudaAvailable() : false;
  if (!stub && forceGpu && !cuda) {
    console.error("[demo] --gpu was requested but torch.cuda.is_available() is false.");
    console.error("       Install CUDA 12.x and cuDNN 8 (see docs/SETUP.md), or use --cpu.");
    process.exit(1);
  }
  const device = cuda ? "cuda" : "cpu";
  if (forceGpu && stub) {
    console.log("[demo] --gpu ignored with --stub.");
  }

  const selected = await selectPort(portOption);
  if (!selected) {
    console.error("[demo] no usable port in 8000-8010. Use --port N.");
    process.exit(1);
  }
  port = selected.port;
  baseUrl = `http://127.0.0.1:${port}`;
  const existing = selected.existing;

  if (!stub && !ct2 && !(existing && existing.backends?.mt === "nllb")) {
    console.log("[demo] CTranslate2 is missing; a new server would use mt=stub. The page translation uses the extension TM.");
    console.log("       Install it with: uv pip install ctranslate2  (or pnpm bootstrap --speech)");
  }
  if (!stub && nllbModelOk && !ct2 && !(existing && existing.backends?.mt === "nllb")) {
    console.log("[demo] NLLB model present but CTranslate2 missing; mt=stub for a new server.");
  }
  if (!stub && !nllbModelOk) {
    console.log("[demo] NLLB model missing; mt=stub. Page translation still uses the extension TM.");
  }

  const plan = existing
    ? `reuse ${port} (mt=${existing.backends?.mt ?? nllbPlan})`
    : `start ${port} (mt=${nllbPlan})`;

  if (check) {
    console.log("[demo] check");
    console.log(`  mode      ${stub ? "stub" : "product"}`);
    console.log(`  models    mms=${existsSync(mmsModel) ? "ok" : "missing"} nllb=${nllbModelOk ? "ok" : "missing"}`);
    if (stub) {
      console.log("  runtime   stub (no models)");
      console.log("  nllb      skipped (stub mode)");
    } else {
      console.log(`  runtime   mms=${mms ? "ok" : "missing"} ct2=${ct2 ? "ok" : "missing"}`);
      console.log(`  nllb      model=${nllbModelOk ? "ok" : "missing"} runtime=${ct2 ? "ok" : "missing"} -> new server mt=${nllbPlan}`);
    }
    if (existing) {
      console.log(
        `            existing ${port}: mt=${existing.backends?.mt ?? "?"} ready=${existing.ready?.mt ?? "?"}`,
      );
    }
    console.log(`  plan      ${plan}`);
    console.log(`  device    ${device}${!stub && !forceCpu ? ` (cuda=${cuda ? "yes" : "no"})` : ""}`);
    console.log(`  port      ${port}: ${existing ? apiSummary(existing) : "free"}`);
    printPack(pack);
    console.log(`  extension ${existsSync(extension) ? "built" : "missing (pnpm build)"}`);
    console.log(`  zip       ${existsSync(zip) ? formatBytes(statSync(zip).size) : "missing (pnpm package)"}`);
    if (deep) {
      if (existing && existing.backends?.mt === "nllb") await deepTranslate(baseUrl);
      else if (!existing) console.log("  deep      skipped (no running API)");
      else console.log(`  deep      skipped (mt=${existing.backends?.mt ?? "?"})`);
    }
    const failed = (!stub && !existsSync(mmsModel)) || (!stub && !mms);
    process.exit(failed ? 1 : 0);
  }

  if (existing) {
    console.log(`[demo] reusing the API already running at ${baseUrl} (${apiSummary(existing)})`);
    if (deep && existing.backends?.mt === "nllb") await deepTranslate(baseUrl);
    else if (deep) console.log(`[demo] deep check skipped (mt=${existing.backends?.mt ?? "?"})`);
    if (!skipPrewarm) {
      const result = run(
        "uv",
        ["run", "--project", "apps/server", "python", "scripts/prewarm.py", "--base-url", baseUrl],
        { stdio: "inherit", timeout: 180_000 },
      );
      if (result.status !== 0) console.log("[demo] prewarm failed; the demo can still run.");
    }
    printRunbook({ tts: existing.backends?.tts ?? tts, mt: existing.backends?.mt ?? mt, device, pack });
    return;
  }

  const env = {
    ...process.env,
    ZTEAM_TTS_BACKEND: tts,
    ZTEAM_MT_BACKEND: mt,
    ZTEAM_TTS_DEVICE: device,
    ZTEAM_MT_DEVICE: device,
    ZTEAM_MT_COMPUTE_TYPE: device === "cuda" ? "int8_float16" : "int8",
    ZTEAM_TTS_MODEL: mmsDir,
    ZTEAM_MT_MODEL: nllbDir,
  };

  console.log(`[demo] starting ${tts} + ${mt} on ${device} at ${baseUrl}`);
  const child = spawn(
    "uv",
    [
      "run",
      "--project",
      "apps/server",
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: root,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  child.on("error", (error) => {
    console.error(`[demo] could not start the API: ${error.message}`);
    process.exit(1);
  });

  let state = null;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    state = await health(baseUrl, 1_000);
    if (state && !state.foreign) break;
    if (state?.foreign) {
      console.error(`[demo] port ${port} was taken by another service while starting.`);
      break;
    }
    if (child.exitCode !== null) break;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }

  if (!state || state.foreign) {
    console.error("[demo] the API did not become healthy. See the uvicorn output above.");
    if (child.exitCode === null) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
      }
    }
    process.exit(1);
  }

  if (tts === "mms" && !state.ready?.tts) {
    console.error(`[demo] the MMS voice is not ready: ${JSON.stringify(state.tts?.reason ?? state.tts)}`);
    if (child.exitCode === null) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
      }
    }
    process.exit(1);
  }

  if (deep && mt === "nllb") await deepTranslate(baseUrl);
  else if (deep) console.log(`[demo] deep check skipped (mt=${mt})`);

  if (!skipPrewarm) {
    const result = run(
      "uv",
      ["run", "--project", "apps/server", "python", "scripts/prewarm.py", "--base-url", baseUrl],
      { stdio: "inherit", timeout: 180_000 },
    );
    if (result.status !== 0) console.log("[demo] prewarm failed; the demo can still run.");
  }

  printRunbook({ tts, mt, device, pack });

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    if (child.exitCode === null) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null) child.kill("SIGKILL");
        }, 2_000).unref();
      }
    }
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("exit", (code) => {
    if (!stopping) process.exit(code ?? 0);
  });
}

await main();
