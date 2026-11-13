#!/usr/bin/env node
/**
 * Build the native-speaker listening pack.
 *
 * Reads the NLLB candidate pack (`tm.mt.yaml`, `phrases.mt.yaml`), renders the
 * placeholders with fictional values, asks the local MMS voice for a WAV per
 * entry, and writes a two-pass HTML page:
 *
 *   - correction: French source + Fulfulde audio
 *   - blind:      Fulfulde audio only
 *
 *   node scripts/generate-listening-pack.mjs --base-url http://127.0.0.1:8011
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function option(name, fallback) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

const baseUrl = option("--base-url", process.env.ZTEAM_API ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const outDir = resolve(option("--out", join(root, "eval/linguistic/session")));
const only = option("--only", "all");
const limit = Number.parseInt(option("--limit", "0"), 10);
const force = args.includes("--force");

const samples = {
  amount: "25 000 FCFA",
  fee: "375 FCFA",
  total: "25 375 FCFA",
  balance: "250 000 FCFA",
  name: "Jean-Paul Mbarga",
  account: "CM 001 2345 6789 01",
  phone: "+237 6 99 12 34 56",
  reference: "SAF-2026-ABC123",
  operation: "Mobile Money",
  date: "12 novembre 2026",
};

function render(text) {
  return text.replace(/\{(\w+)\}/g, (_, key) => samples[key] ?? key);
}

function safeName(id) {
  return id.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function readYaml(path) {
  return YAML.parse(readFileSync(path, "utf8"));
}

const tm = readYaml(join(root, "packages/phrasebank/entries/tm.mt.yaml"));
const phrases = readYaml(join(root, "packages/phrasebank/entries/phrases.mt.yaml"));

const entries = [];
if (only === "all" || only === "tm") {
  for (const unit of tm.units ?? []) {
    const target = unit.target?.ff?.trim();
    if (!target) continue;
    entries.push({
      kind: "tm",
      id: unit.id,
      risk: unit.risk ?? "unknown",
      fr: unit.source?.fr ?? "",
      en: unit.source?.en ?? "",
      ff: render(target),
    });
  }
}
if (only === "all" || only === "phrases") {
  for (const phrase of phrases.phrases ?? []) {
    const target = phrase.ff?.trim();
    if (!target) continue;
    entries.push({
      kind: "phrase",
      id: phrase.id,
      risk: phrase.risk ?? "unknown",
      fr: phrase.fr ?? "",
      en: phrase.en ?? "",
      ff: render(target),
    });
  }
}

const selected = limit > 0 ? entries.slice(0, limit) : entries;
mkdirSync(join(outDir, "audio"), { recursive: true });

async function health() {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

const state = await health();
if (!state) {
  console.error(`[listening] the local API is not reachable at ${baseUrl}.`);
  console.error("  Start it with: ZTEAM_TTS_BACKEND=mms uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000");
  process.exit(1);
}
if (!state.ready?.tts) {
  console.error(`[listening] the TTS backend is not ready: ${JSON.stringify(state.tts)}`);
  process.exit(1);
}

const manifest = [];
let failures = 0;

for (const [index, entry] of selected.entries()) {
  const file = `${String(index + 1).padStart(3, "0")}-${safeName(entry.id)}.wav`;
  const path = join(outDir, "audio", file);
  const label = `[${index + 1}/${selected.length}] ${entry.id}`;

  if (!force && existsSync(path)) {
    console.log(`${label} cached`);
    manifest.push({ ...entry, audio: `audio/${file}` });
    continue;
  }

  let done = false;
  for (let attempt = 1; attempt <= 3 && !done; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: entry.ff, provider: "mms", speed: 1 }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`HTTP ${response.status}: ${detail.slice(0, 160)}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 1000) throw new Error(`short audio (${bytes.length} bytes)`);
      writeFileSync(path, bytes);
      console.log(`${label} ${(bytes.length / 1024).toFixed(0)} KB`);
      manifest.push({ ...entry, audio: `audio/${file}` });
      done = true;
    } catch (error) {
      console.log(`${label} attempt ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!done) failures += 1;
}

writeFileSync(join(outDir, "manifest.json"), JSON.stringify({ baseUrl, entries: manifest }, null, 2));

function csv(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

const backHeader = "kind,id,risk,source_fr,source_en,target_ff,back_translation_fr,meaning_1_5,naturalness_1_5,critical_error,fix";
const backRows = selected.map((entry) =>
  [entry.kind, entry.id, entry.risk, entry.fr, entry.en ?? "", entry.ff, "", "", "", "", ""].map(csv).join(","),
);
writeFileSync(join(root, "eval/linguistic/back-translation.template.csv"), `${backHeader}\n${backRows.join("\n")}\n`);

const mosHeader = "sample,sentence,naturalness_1_5,intelligibility_1_5,wrong_word,notes";
const mosRows = selected.map((entry) => [entry.id, entry.ff, "", "", "", ""].map(csv).join(","));
writeFileSync(join(root, "eval/linguistic/tts-mos.template.csv"), `${mosHeader}\n${mosRows.join("\n")}\n`);

const rows = manifest
  .map(
    (entry) => `        <article class="entry" data-kind="${entry.kind}">
          <div class="meta">
            <span class="id">${entry.id}</span>
            <span class="risk risk-${entry.risk}">${entry.risk}</span>
          </div>
          <p class="source" lang="fr">${entry.fr.replace(/</g, "&lt;")}</p>
          <p class="target" lang="fub">${entry.ff.replace(/</g, "&lt;")}</p>
          <audio controls preload="none" src="${entry.audio}"></audio>
        </article>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Z-Team — session d'écoute</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #f5f2ea; color: #1e1b16; }
    header { position: sticky; top: 0; background: #1e1b16; color: #f5f2ea; padding: 14px 20px; display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
    header h1 { font-size: 16px; margin: 0; font-weight: 600; }
    header label { font-size: 14px; display: flex; gap: 8px; align-items: center; }
    main { max-width: 920px; margin: 0 auto; padding: 20px; }
    .intro { background: #fff; border: 1px solid #ddd5c7; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px; font-size: 14px; line-height: 1.5; }
    .entry { background: #fff; border: 1px solid #ddd5c7; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }
    .meta { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
    .id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #6b5f4c; }
    .risk { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 2px 7px; border-radius: 999px; }
    .risk-low { background: #e7f3e7; color: #245c24; }
    .risk-medium { background: #fff2d6; color: #7a5200; }
    .risk-high { background: #fde2de; color: #8a2318; }
    .source { margin: 0 0 4px; font-size: 14px; }
    .target { margin: 0 0 10px; font-size: 15px; font-weight: 600; }
    audio { width: 100%; }
    body.blind .source, body.blind .target { visibility: hidden; height: 0; margin: 0; overflow: hidden; }
    .foot { font-size: 12px; color: #6b5f4c; margin-top: 24px; }
  </style>
</head>
<body>
  <header>
    <h1>Z-Team — session d'écoute</h1>
    <label><input type="checkbox" id="blind"> Mode écoute aveugle</label>
    <span>${manifest.length} entrées</span>
  </header>
  <main>
    <div class="intro">
      <p><strong>Passe 1 — correction.</strong> Le français est visible. Écoutez le fulfulde, dites si le sens est correct, puis dictez la forme corrigée.</p>
      <p><strong>Passe 2 — écoute aveugle.</strong> Cochez la case ci-dessus : le français et le fulfulde sont masqués. Écoutez et dites le sens en français.</p>
      <p>Notez le sens (1–5), la naturalité (1–5), l'erreur critique (oui/non) et la correction dans <code>eval/linguistic/back-translation.csv</code>. L'intelligibilité et la naturalité de la voix vont dans <code>eval/linguistic/tts-mos.csv</code>.</p>
      <p>Ouvrez ce dossier avec <code>pnpm serve:listening</code>, puis <code>http://127.0.0.1:4175/</code>. Le serveur est local et ne sert que ce dossier.</p>
    </div>
${rows}
    <p class="foot">Généré le ${new Date().toISOString().slice(0, 10)} depuis ${baseUrl}. Audio MMS local, jamais envoyé ailleurs.</p>
  </main>
  <script>
    const toggle = document.getElementById("blind");
    toggle.addEventListener("change", () => document.body.classList.toggle("blind", toggle.checked));
  </script>
</body>
</html>`;

writeFileSync(join(outDir, "index.html"), html);
console.log(`\n[listening] ${manifest.length} entries, ${failures} failure(s)`);
console.log(`[listening] open ${join(outDir, "index.html")} through a local static server.`);
console.log("[listening] the audio is gitignored; do not commit the speaker recordings.");
