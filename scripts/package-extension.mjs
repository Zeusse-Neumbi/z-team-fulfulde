import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import archiver from "archiver";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "apps/extension/.output/chrome-mv3");
const outDir = path.join(root, "dist");
const out = path.join(outDir, "zteam-fulfulde-extension-v0.1.0.zip");

if (!existsSync(source)) {
  console.error("Extension build not found. Run: pnpm --filter @zteam/extension build");
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
await rm(out, { force: true });

const output = createWriteStream(out);
const archive = archiver("zip", { zlib: { level: 9 } });

const done = new Promise((resolve, reject) => {
  output.on("close", resolve);
  output.on("error", reject);
  archive.on("warning", (error) => {
    if (error.code === "ENOENT") console.warn(error);
    else reject(error);
  });
  archive.on("error", reject);
});

archive.pipe(output);
archive.directory(source, false);
await archive.finalize();
await done;

const { size } = await stat(out);
console.log(`[package] ${out}`);
console.log(`[package] ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MB)`);
