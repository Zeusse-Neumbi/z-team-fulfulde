import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { zipSync } from "fflate";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "apps/extension/.output/chrome-mv3");
const outDir = path.join(root, "dist");
const out = path.join(outDir, "zteam-fulfulde-extension-v0.1.0.zip");

if (!existsSync(source)) {
  console.error("Extension build not found. Run: pnpm --filter @zteam/extension build");
  process.exit(1);
}

function collectFiles(directory, base = directory, files = {}) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, base, files);
      continue;
    }
    if (!entry.isFile()) continue;

    const relativePath = path.relative(base, fullPath).split(path.sep).join("/");
    files[relativePath] = new Uint8Array(readFileSync(fullPath));
  }
  return files;
}

mkdirSync(outDir, { recursive: true });
rmSync(out, { force: true });

const files = collectFiles(source);
const decoder = new TextDecoder();

files["LICENSE"] = new Uint8Array(readFileSync(path.join(root, "LICENSE")));

files["INSTALL.md"] = new TextEncoder().encode(`# Z-Team Fulfulde Assistant — installation

1. Unzip this archive into a folder.
2. Open \`chrome://extensions\` in Chrome or Edge.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder (the one that contains
   \`manifest.json\`).
5. Open https://safinum.cm/hackathon-test
6. Click the extension icon. The side panel opens.
7. Click **Activer sur ce site** / **Démarrer sur cette page**.
8. The page is translated into Fulfulde (or Yemba) in place. Amounts, fees,
   totals, balances, names, phones, accounts, references and your input stay
   unchanged. Use the **Langue de traduction** picker in the panel header to
   switch languages; the page is re-translated without a reload.

## What Fulfulde or Yemba you are reading

The bundled packs are **machine-translated drafts**: NLLB-200 for Fulfulde and
the local cameroon-int8 Marian pair for Yemba. Both are labelled
**MT — non validée** in the panel. They have **not** been reviewed by a native
speaker yet; the listening pack and the protocol are in the repository.
Buttons whose draft would read the same as another button stay in French on
purpose, so that a confirmation and a cancellation can never look identical.

The page translation and the short spoken Fulfulde clips are bundled and work
without the local API. The Yemba voice is optional and needs the local API and
the mms-tts-ybb weights.

The voice is optional. To enable live speech for text that has no bundled clip,
start the local API from the repository:

\`\`\`bash
uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000
\`\`\`

Use fictional data only. This is a simulated prototype; there is no real
transfer and no real bank identifier. The extension talks only to
\`127.0.0.1\`.

Repository and documentation: https://github.com/Zeusse-Neumbi/z-team-fulfulde

## Licence

PolyForm Noncommercial 1.0.0 (source-available). Commercial use requires a
separate written licence. The full text is in \`LICENSE\`.
`);

const manifest = JSON.parse(decoder.decode(files["manifest.json"]));
const broadHosts = (manifest.host_permissions ?? []).filter(
  (pattern) => pattern === "<all_urls>" || pattern === "*://*/*",
);
if (broadHosts.length > 0) {
  console.error("[package] refusing to package a test build with broad host permissions");
  process.exit(1);
}
for (const [relativePath, bytes] of Object.entries(files)) {
  const text = decoder.decode(bytes);
  if (/⟦[A-Z]{3}:/.test(text) || /(?:FUB|YBB):tm/.test(text)) {
    console.error(`[package] refusing to package fixture token in ${relativePath}`);
    process.exit(1);
  }
}

const generated = path.join(root, "packages/phrasebank/src/generated.ts");
if (existsSync(generated)) {
  const source = readFileSync(generated, "utf8");
  const marker = "export const languages: Record<string, Pack> = ";
  const start = source.indexOf(marker);
  if (start >= 0) {
    const packs = JSON.parse(source.slice(start + marker.length).trim().replace(/;\s*$/, ""));
    const empty = {};
    for (const [code, pack] of Object.entries(packs)) {
      const entries = [...(pack.translationUnits ?? []), ...(pack.phrases ?? [])];
      const missing = entries.filter((entry) => !entry.target?.[code]?.text).length;
      if (missing > 0) empty[code] = missing;
    }
    const blocked = Object.entries(empty).filter(
      ([code]) => packs[code]?.status === "validated",
    );
    if (blocked.length > 0) {
      console.error(
        `[package] refusing to package empty targets for validated language(s): ${blocked
          .map(([code, count]) => `${code} (${count})`)
          .join(", ")}.`,
      );
      console.error("[package] run `pnpm build:submission` before `pnpm package`.");
      process.exit(1);
    }
    const drafts = Object.keys(empty);
    if (drafts.length > 0) {
      console.warn(
        `[package] warning: draft language(s) ${drafts.join(", ")} ship with empty targets; ` +
          "the panel labels them as draft.",
      );
    }
  }
}

const archive = zipSync(files, { level: 9 });
writeFileSync(out, archive);

const { size } = statSync(out);
console.log(`[package] ${out}`);
console.log(
  `[package] ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB), ${Object.keys(files).length} files`,
);
