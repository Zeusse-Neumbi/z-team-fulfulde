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
const archive = zipSync(files, { level: 9 });
writeFileSync(out, archive);

const { size } = statSync(out);
console.log(`[package] ${out}`);
console.log(`[package] ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB), ${Object.keys(files).length} files`);
