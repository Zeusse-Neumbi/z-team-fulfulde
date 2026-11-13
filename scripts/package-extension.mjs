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

files["INSTALL.md"] = new TextEncoder().encode(`# Z-Team Fulfulde Assistant — installation

1. Unzip this archive into a folder.
2. Open \`chrome://extensions\` in Chrome or Edge.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder (the one that contains
   \`manifest.json\`).
5. Open https://safinum.cm/hackathon-test
6. Click the extension icon. The side panel opens.
7. Click **Activer sur ce site** / **Démarrer sur cette page**.
8. The page is translated into Fulfulde in place. Amounts, fees, totals,
   balances, names, phones, accounts, references and your input stay unchanged.

The page translation is bundled and works without the local API.

The voice is optional. To enable it, start the local API from the repository:

\`\`\`bash
uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000
\`\`\`

Use fictional data only. This is a simulated prototype; there is no real
transfer and no real bank identifier. The extension talks only to
\`127.0.0.1\`.

Repository and documentation: https://github.com/Zeusse-Neumbi/z-team-fulfulde
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
  if (text.includes("⟦FF:") || text.includes("FF:tm")) {
    console.error(`[package] refusing to package fixture token in ${relativePath}`);
    process.exit(1);
  }
}

const archive = zipSync(files, { level: 9 });
writeFileSync(out, archive);

const { size } = statSync(out);
console.log(`[package] ${out}`);
console.log(`[package] ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB), ${Object.keys(files).length} files`);

const generated = path.join(root, "packages/phrasebank/src/generated.ts");
if (existsSync(generated)) {
  const empty = (readFileSync(generated, "utf8").match(/"ff": ""/g) ?? []).length;
  if (empty > 0) {
    console.warn(
      `[package] warning: ${empty} empty Fulfulde target(s). Run ` +
        "`pnpm --filter @zteam/phrasebank build:release` before submitting.",
    );
  }
}
