#!/usr/bin/env node
/**
 * Build the bundled demo audio pack.
 *
 * Source: the native-speaker listening pack in `eval/linguistic/session`
 * (115 WAV clips generated locally by MMS-TTS). The WAVs are not committed;
 * the encoded Opus clips and the manifest are.
 *
 * Output:
 *   apps/extension/public/audio/demo/<kind>-<id>.opus
 *   apps/extension/public/audio/demo/manifest.json
 *
 * A clip is only ever played when the spoken text equals the clip transcript
 * exactly (see apps/extension/lib/audio-pack.ts). That is what lets the demo
 * voice say "25 000 FCFA" without ever saying it for a different amount.
 *
 * Four rules withhold audio, because a spoken sentence cannot be re-read:
 *   1. warnings, errors and generic safety fallbacks;
 *   2. a control that collides with another control;
 *   3. a target that echoes its own source;
 *   4. a target with degenerate token repetition.
 * Plus the explicit list in `packages/phrasebank/entries/audio.blocked.yaml`.
 *
 *   node scripts/build-audio-pack.mjs
 *   node scripts/build-audio-pack.mjs --check   # verify the committed pack
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args.includes("--check");

function option(name, fallback) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

const lang = option("--lang", "fub");
if (!/^[a-z]{3}$/.test(lang)) {
  console.error(`[audio] --lang must be an ISO 639-3 code, got ${lang}`);
  process.exit(2);
}

const sessionDir = join(root, "eval/linguistic/session");
const sessionManifestPath = join(sessionDir, "manifest.json");
const blockedPath = join(root, `packages/phrasebank/entries/${lang}/audio.blocked.yaml`);
const outDir = join(root, "apps/extension/public/audio/demo");
const manifestPath = join(outDir, "manifest.json");
const BITRATE = "32k";

const blocked = existsSync(blockedPath)
  ? YAML.parse(readFileSync(blockedPath, "utf8"))
  : { blocked: [] };
const explicit = new Map((blocked.blocked ?? []).map((entry) => [entry.id, entry.reason]));

const WARNING_OR_ERROR = /^(WARN_|ERROR_|SAFE_GENERIC_)|^tm\.(warn|warning|error)\./i;
const CONTROL = /^ACTION_|^tm\.(action|summary\.(confirm|edit))\b/i;

function normalize(text) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** The same token three or more times in a row is a broken generation. */
function degenerate(text) {
  const tokens = normalize(text).split(" ").filter(Boolean);
  let run = 1;
  for (let index = 1; index < tokens.length; index += 1) {
    run = tokens[index] === tokens[index - 1] ? run + 1 : 1;
    if (run >= 3) return true;
  }
  return false;
}

/** The "translation" is just the source string, or keeps a two-word source run. */
function echoesSource(entry) {
  const target = normalize(entry.ff ?? "");
  if (!target) return false;
  const targetTokens = target.split(" ").filter(Boolean);
  const targetBigrams = new Set(
    targetTokens.slice(1).map((token, index) => `${targetTokens[index]} ${token}`),
  );
  return [entry.fr, entry.en].some((source) => {
    if (!source) return false;
    const normalized = normalize(source);
    if (normalized === target) return true;
    const tokens = normalized.split(" ").filter(Boolean);
    return tokens
      .slice(1)
      .some((token, index) => targetBigrams.has(`${tokens[index]} ${token}`));
  });
}

function blockReason(entry) {
  if (explicit.has(entry.id)) return explicit.get(entry.id);
  if (WARNING_OR_ERROR.test(entry.id)) return "warning or error text is never spoken before validation";
  if (collidingControls.has(entry.id)) return "control label collides with another control";
  if (echoesSource(entry)) return "target echoes the source language";
  if (degenerate(entry.ff ?? "")) return "degenerate repetition in the draft";
  return null;
}

if (check) {
  // `--check` verifies the committed clips and manifest only: the listener
  // session is gitignored and is not present in CI.
  if (!existsSync(manifestPath)) {
    console.error("[audio] no committed pack manifest; run without --check to build it");
    process.exit(1);
  }
  const committed = JSON.parse(readFileSync(manifestPath, "utf8"));
  const onDisk = readdirSync(outDir).filter((name) => name.endsWith(".opus"));
  const expected = new Set(committed.clips.map((clip) => clip.file));
  const missing = [...expected].filter((name) => !onDisk.includes(name));
  const stale = onDisk.filter((name) => !expected.has(name));
  if (missing.length || stale.length) {
    console.error(`[audio] pack out of date: ${missing.length} missing, ${stale.length} stale`);
    process.exit(1);
  }
  let bad = 0;
  for (const clip of committed.clips) {
    const bytes = readFileSync(join(outDir, clip.file));
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== clip.sha256) {
      console.error(`[audio] checksum mismatch: ${clip.file}`);
      bad += 1;
    }
  }
  if (bad > 0) process.exit(1);
  console.log(`[audio] OK: ${committed.clips.length} clips, ${committed.spoken} playable`);
  process.exit(0);
}

const session = JSON.parse(readFileSync(sessionManifestPath, "utf8"));
const entries = session.entries ?? [];

// Collisions: two different sources that now read the same.
const byTarget = new Map();
for (const entry of entries) {
  const key = normalize(entry.ff ?? "");
  if (!key) continue;
  const group = byTarget.get(key);
  if (group) group.push(entry);
  else byTarget.set(key, [entry]);
}
const collidingControls = new Set();
for (const group of byTarget.values()) {
  if (group.length < 2) continue;
  const sources = new Set(group.map((entry) => normalize(entry.fr ?? "")));
  if (sources.size < 2) continue;
  for (const entry of group) if (CONTROL.test(entry.id)) collidingControls.add(entry.id);
}

mkdirSync(outDir, { recursive: true });
for (const name of readdirSync(outDir)) {
  if (name.endsWith(".opus") || name === "manifest.json") rmSync(join(outDir, name));
}

const clips = [];
let spoken = 0;
let bytes = 0;
const missingAudio = [];

for (const entry of entries) {
  const source = join(sessionDir, entry.audio ?? "");
  if (!entry.audio || !existsSync(source)) {
    missingAudio.push(entry.id);
    continue;
  }
  const file = `${entry.kind}-${entry.id}.opus`;
  const target = join(outDir, file);
  execFileSync(
    "ffmpeg",
    [
      "-v", "error", "-y", "-i", source,
      "-ac", "1", "-ar", "24000",
      "-c:a", "libopus", "-b:a", BITRATE,
      // Deterministic Ogg serial and no encoder metadata: rebuilding the pack
      // must produce byte-identical clips, otherwise the manifest checksums
      // change on every run.
      "-fflags", "+bitexact", "-flags", "+bitexact",
      target,
    ],
    { stdio: "inherit" },
  );
  const clipBytes = readFileSync(target);
  bytes += clipBytes.byteLength;
  const reason = blockReason(entry);
  if (!reason) spoken += 1;
  clips.push({
    id: entry.id,
    kind: entry.kind,
    risk: entry.risk,
    text: entry.ff,
    file,
    sha256: createHash("sha256").update(clipBytes).digest("hex"),
    bytes: clipBytes.byteLength,
    blocked: reason !== null,
    blockedReason: reason ?? undefined,
  });
}

if (missingAudio.length > 0) {
  console.error(`[audio] ${missingAudio.length} entries have no clip: ${missingAudio.slice(0, 5).join(", ")}`);
  process.exit(1);
}

clips.sort((left, right) => left.id.localeCompare(right.id));
const manifest = {
  version: blocked.version,
  source: "facebook/mms-tts-ful (synthetic, CC-BY-NC-4.0), rendered by the local API",
  note: "A clip is played only when the spoken text equals `text` exactly. Blocked clips keep their transcript but are never played.",
  bitrate: BITRATE,
  total: clips.length,
  spoken,
  blocked: clips.length - spoken,
  clips,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`[audio] ${clips.length} clips, ${spoken} playable, ${clips.length - spoken} blocked`);
console.log(`[audio] ${(bytes / 1024 / 1024).toFixed(2)} MB of Opus in ${outDir}`);
