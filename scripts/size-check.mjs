import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { APP_VERSION } from "./version.mjs";

const root = path.resolve(import.meta.dirname, "..");
const zip = path.join(root, `dist/zteam-fulfulde-extension-v${APP_VERSION}.zip`);

const TARGET_MB = 8;
const HARD_MB = 10;

if (!existsSync(zip)) {
  console.error("No package found. Run: pnpm package");
  process.exit(1);
}

const { size } = await stat(zip);
const mb = size / 1024 / 1024;

console.log(`[size] ${zip}`);
console.log(`[size] ${mb.toFixed(2)} MB (target <= ${TARGET_MB} MB, hard limit ${HARD_MB} MB)`);

if (mb > HARD_MB) {
  console.error(`[size] FAIL: exceeds the submission hard limit of ${HARD_MB} MB`);
  process.exit(1);
}

if (mb > TARGET_MB) {
  console.error(`[size] FAIL: exceeds the internal target of ${TARGET_MB} MB`);
  process.exit(1);
}

console.log("[size] OK");
