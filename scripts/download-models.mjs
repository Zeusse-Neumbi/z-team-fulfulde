#!/usr/bin/env node
/**
 * Cross-platform model downloader.
 *
 * Replaces the bash/curl script so the same command works on Windows,
 * macOS and Linux. The Hugging Face CDN hands out short-lived signed URLs,
 * so every retry re-resolves the URL and resumes from the partial file.
 *
 *   pnpm models:download              # mms
 *   pnpm models:download mms nllb-ct2 # ~790 MB
 *   pnpm models:verify                # size + SHA-256 of the local files
 *   node scripts/download-models.mjs --list
 */
import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "models/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const args = process.argv.slice(2);
const options = {
  check: args.includes("--check"),
  force: args.includes("--force"),
  list: args.includes("--list"),
  out: process.env.ZTEAM_MODELS_DIR
    ? resolve(process.env.ZTEAM_MODELS_DIR)
    : join(root, "models"),
  targets: [],
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--out") {
    options.out = resolve(args[index + 1] ?? "");
    index += 1;
  } else if (arg.startsWith("--out=")) {
    options.out = resolve(arg.slice("--out=".length));
  } else if (!arg.startsWith("--")) {
    options.targets.push(arg);
  }
}

const names = Object.keys(manifest.models);
const aliases = new Map();
for (const name of names) {
  for (const alias of manifest.models[name].alias ?? []) aliases.set(alias, name);
}

if (options.list || args.includes("--help") || args.includes("-h")) {
  console.log("Models:");
  for (const name of names) {
    const model = manifest.models[name];
    const size = model.files.reduce((total, file) => total + file.size, 0);
    const also = model.alias?.length ? `  (alias: ${model.alias.join(", ")})` : "";
    console.log(
      `  ${name.padEnd(22)} ${model.repo}  ${(size / 1024 / 1024).toFixed(0)} MB  ${model.licence}${also}`,
    );
  }
  console.log(`\nOutput: ${options.out}`);
  console.log(
    "Usage: node scripts/download-models.mjs [--out DIR] [--check] [--force] [mms] [mms-ybb] [nllb-ct2] [mt-fub] [mt-ybb]",
  );
  process.exit(0);
}

if (options.targets.length === 0) options.targets = options.check ? names : ["mms"];

options.targets = [...new Set(options.targets.map((target) => aliases.get(target) ?? target))];

for (const target of options.targets) {
  if (!manifest.models[target]) {
    console.error(`Unknown model: ${target}. Known: ${names.join(", ")}`);
    process.exit(2);
  }
}

mkdirSync(options.out, { recursive: true });

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

function destination(model, file) {
  return join(options.out, model.dir, file.name);
}

async function verifyFile(model, file) {
  const path = destination(model, file);
  if (!existsSync(path)) return { ok: false, reason: "missing" };
  const size = statSync(path).size;
  if (size !== file.size) {
    return { ok: false, reason: `size ${size} != ${file.size}` };
  }
  const digest = await sha256(path);
  if (file.sha256 && digest !== file.sha256) {
    return { ok: false, reason: `sha256 ${digest.slice(0, 12)}… != ${file.sha256.slice(0, 12)}…` };
  }
  return { ok: true };
}

async function downloadFile(model, file) {
  const path = destination(model, file);
  const part = `${path}.part`;
  mkdirSync(dirname(path), { recursive: true });

  const current = await verifyFile(model, file);
  if (current.ok && !options.force) {
    console.log(`  ok   ${file.name} (${formatBytes(file.size)})`);
    return true;
  }

  if (existsSync(path) && !options.force) {
    console.log(`  warn ${file.name}: ${current.reason}; resuming is not possible, redownloading`);
  }

  const url = `https://huggingface.co/${model.repo}/resolve/main/${file.name}`;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    let position = 0;
    if (existsSync(part)) position = statSync(part).size;
    if (position > file.size) {
      rmSync(part, { force: true });
      position = 0;
    }
    if (position === file.size) {
      rmSync(path, { force: true });
      renameSync(part, path);
      const result = await verifyFile(model, file);
      if (result.ok) {
        console.log(`  ok   ${file.name} (${formatBytes(file.size)})`);
        return true;
      }
      rmSync(path, { force: true });
      position = 0;
    }

    const headers = position > 0 ? { Range: `bytes=${position}-` } : {};
    console.log(
      `  get  ${file.name} (${formatBytes(position)} / ${formatBytes(file.size)}, attempt ${attempt})`,
    );

    try {
      const response = await fetch(url, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(15 * 60_000),
      });
      if (response.status === 416) {
        rmSync(path, { force: true });
        renameSync(part, path);
        continue;
      }
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const append = position > 0 && response.status === 206;
      if (position > 0 && !append) {
        rmSync(part, { force: true });
      }
      const sink = createWriteStream(part, { flags: append ? "a" : "w" });
      await pipeline(Readable.fromWeb(response.body), sink);
    } catch (error) {
      console.log(`  retry ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(30_000, attempt * 2_000)));
    }
  }

  console.error(`  fail ${file.name} after 8 attempts`);
  return false;
}

let failed = 0;

if (options.check) {
  console.log(`[models] verifying ${options.targets.join(", ")} in ${options.out}`);
  for (const target of options.targets) {
    const model = manifest.models[target];
    for (const file of model.files) {
      const result = await verifyFile(model, file);
      if (result.ok) {
        console.log(`  ok   ${model.dir}/${file.name}`);
      } else {
        console.log(`  fail ${model.dir}/${file.name}: ${result.reason}`);
        failed += 1;
      }
    }
  }
  process.exit(failed === 0 ? 0 : 1);
}

console.log(`[models] downloading ${options.targets.join(", ")} into ${options.out}`);

for (const target of options.targets) {
  const model = manifest.models[target];
  console.log(`== ${model.repo} (${model.licence})`);
  for (const file of model.files) {
    const ok = await downloadFile(model, file);
    if (!ok) failed += 1;
  }
}

if (failed > 0) {
  console.error(`[models] ${failed} file(s) failed. Re-run the same command to resume.`);
  process.exit(1);
}

console.log("\n[models] done. Suggested environment:");
for (const target of options.targets) {
  const model = manifest.models[target];
  if (target === "mms" || target === "tts-yemba") {
    console.log(`  ZTEAM_TTS_MODEL=${join(options.out, model.dir)}`);
  }
  if (target === "nllb-ct2") console.log(`  ZTEAM_MT_MODEL=${join(options.out, model.dir)}`);
  if (target === "mt-fufulde-cameroon") {
    console.log(`  ZTEAM_MT_BACKEND=marian`);
    console.log(`  ZTEAM_MT_MARIAN_MODEL=${join(options.out, model.dir, "francais-fufulde")}`);
  }
  if (target === "mt-yemba-cameroon") {
    console.log("  # ybb resolves languages/ybb.yaml; leave ZTEAM_MT_MARIAN_MODEL empty.");
    console.log(`  # model: ${join(options.out, model.dir, "francais-yemba")}`);
  }
  if (target === "tts-yemba") {
    console.log("  # ybb resolves languages/ybb.yaml; leave ZTEAM_TTS_MODEL empty.");
  }
}
console.log("  curl -s http://127.0.0.1:8000/health");
