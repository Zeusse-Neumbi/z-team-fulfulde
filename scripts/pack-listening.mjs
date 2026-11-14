#!/usr/bin/env node
/**
 * Package the native-speaker listening pack for distribution.
 *
 * The WAV session in `eval/linguistic/session` is gitignored (7.9 MB of
 * generated speech). This script converts it to Opus, rewrites the two-pass
 * page and the manifest to the new paths, and writes a ZIP next to the other
 * release artefacts. The ZIP is a release asset, not a form upload: the form
 * only accepts the 10 MB extension and the PDF.
 *
 *   node scripts/pack-listening.mjs
 *   gh release upload <tag> dist/zteam-listening-pack-v0.2.1.zip
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import { APP_VERSION } from "./version.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sessionDir = join(root, "eval/linguistic/session");
const outDir = join(root, "dist");
const stage = join(outDir, "listening-pack");
const zipPath = join(outDir, `zteam-listening-pack-v${APP_VERSION}.zip`);

if (!existsSync(join(sessionDir, "manifest.json"))) {
  console.error(`[listening] missing ${join(sessionDir, "manifest.json")}`);
  console.error("[listening] run `pnpm generate:listening` first");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, "audio"), { recursive: true });

const wavFiles = readdirSync(join(sessionDir, "audio")).filter((name) => name.endsWith(".wav"));
let bytes = 0;
for (const name of wavFiles) {
  const target = join(stage, "audio", name.replace(/\.wav$/, ".opus"));
  execFileSync(
    "ffmpeg",
    [
      "-v", "error", "-y", "-i", join(sessionDir, "audio", name),
      "-ac", "1", "-ar", "24000",
      "-c:a", "libopus", "-b:a", "24k",
      "-fflags", "+bitexact", "-flags", "+bitexact",
      target,
    ],
    { stdio: "inherit" },
  );
  bytes += statSync(target).size;
}

const html = readFileSync(join(sessionDir, "index.html"), "utf8").replaceAll(".wav", ".opus");
const manifest = JSON.parse(readFileSync(join(sessionDir, "manifest.json"), "utf8"));
for (const entry of manifest.entries) entry.audio = entry.audio.replace(/\.wav$/, ".opus");
manifest.baseUrl = "(offline listening pack; generated locally)";

const readme = `# Z-Team — pack d'écoute pour validation native

Ce pack contient les 115 entrées du brouillon machine, avec l'audio fulfulde
synthétique rendu localement (MMS-TTS, CC-BY-NC-4.0). Il sert à la session de
validation orale décrite dans l'ADR 0013 et \`docs/SPEAKER_PACKET.md\`.

## Utilisation

1. Décompresser ce dossier.
2. Ouvrir \`index.html\` dans un navigateur (aucun serveur, aucun réseau).
3. **Passe de correction** : le français est visible, l'audio fulfulde est joué.
   Le locuteur dit si le sens est correct, ce qui ne va pas, et la forme parlée
   correcte. L'équipe transcrit.
4. **Passe aveugle** : cocher la case pour masquer le texte, jouer l'audio, et
   noter le sens donné en français.
5. Remplir \`back-translation.template.csv\` et \`tts-mos.template.csv\`.

Durée estimée : 45 à 60 minutes pour les 15 entrées à risque élevé, environ
2 heures pour les 115.

## Limites

- Voix synthétique, non validée : ce pack n'est pas une preuve de validation.
- Un locuteur unique, revue orale, pas de rétro-traduction écrite.
- Aucune donnée réelle : les valeurs sont fictives.
`;

writeFileSync(join(stage, "index.html"), html);
writeFileSync(join(stage, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(stage, "README.md"), readme);
for (const name of ["back-translation.template.csv", "tts-mos.template.csv"]) {
  const source = join(root, "eval/linguistic", name);
  if (existsSync(source)) writeFileSync(join(stage, name), readFileSync(source));
}

const files = {};
for (const name of readdirSync(stage)) {
  const full = join(stage, name);
  if (name === "audio") {
    for (const clip of readdirSync(full)) {
      files[`audio/${clip}`] = new Uint8Array(readFileSync(join(full, clip)));
    }
    continue;
  }
  if (name.endsWith(".csv") || name.endsWith(".html") || name.endsWith(".json") || name.endsWith(".md")) {
    files[name] = new Uint8Array(readFileSync(full));
  }
}

writeFileSync(zipPath, zipSync(files, { level: 9 }));
const size = statSync(zipPath).size;
const digest = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
rmSync(stage, { recursive: true, force: true });

console.log(`[listening] ${wavFiles.length} clips, ${(bytes / 1024 / 1024).toFixed(2)} MB of Opus`);
console.log(`[listening] ${zipPath}`);
console.log(`[listening] ${(size / 1024 / 1024).toFixed(2)} MB`);
console.log(`[listening] sha256 ${digest}`);
