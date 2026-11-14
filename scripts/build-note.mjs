#!/usr/bin/env node
/**
 * Render the French or English technical note to PDF with the Chromium that
 * Playwright already installs. No LaTeX, no Word, no remote font.
 *
 *   pnpm note:build -- --draft       # allow [[placeholders]] while drafting
 *   pnpm note:build                  # French final: 5 pages max
 *   pnpm note:build:en               # English final: 5 pages max
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NOTE_VERSION } from "./version.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const draft = args.includes("--draft");

function option(name, fallback) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

const lang = option("--lang", "fr").toLowerCase();
if (lang !== "fr" && lang !== "en") {
  console.error(`[note] --lang must be fr or en, got ${lang}`);
  process.exit(2);
}
const htmlPath = resolve(
  option("--html", resolve(root, `docs/note/note.${lang}.html`)),
);
const outPath = resolve(
  option(
    "--out",
    resolve(root, `dist/Z-Team_Lingua_Technical_Note_v${NOTE_VERSION}_${lang.toUpperCase()}.pdf`),
  ),
);
const maxBytes = 10 * 1024 * 1024;
const maxPages = 5;

const html = readFileSync(htmlPath, "utf8");
const placeholders = [...html.matchAll(/\[\[[^\]]+\]\]/g)].map((match) => match[0]);
if (placeholders.length > 0 && !draft) {
  console.error(`[note] ${placeholders.length} placeholder(s) left:`);
  for (const placeholder of placeholders.slice(0, 20)) console.error(`  ${placeholder}`);
  if (placeholders.length > 20) console.error(`  ... and ${placeholders.length - 20} more`);
  console.error("Remove them, or run with --draft for a working copy.");
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });

let browser;
try {
  browser = await chromium.launch();
} catch (error) {
  console.warn("[note] bundled Chromium unavailable, falling back to the installed Chrome.");
  console.warn(`       ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  browser = await chromium.launch({ channel: "chrome" });
}
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: outPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
} finally {
  await browser.close();
}

const bytes = statSync(outPath).size;
const pdf = readFileSync(outPath);
const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

console.log(`[note] ${outPath}`);
console.log(`[note] ${(bytes / 1024 / 1024).toFixed(2)} MB, ${pageCount || "unknown"} page(s)`);

if (bytes > maxBytes) {
  console.error(`[note] FAIL: ${(bytes / 1024 / 1024).toFixed(2)} MB exceeds 10 MB`);
  process.exit(1);
}
if (pageCount > maxPages) {
  console.error(`[note] FAIL: ${pageCount} pages exceeds ${maxPages}`);
  if (!draft) process.exit(1);
}
if (placeholders.length > 0) {
  console.warn(`[note] draft has ${placeholders.length} placeholder(s); the final build must fail.`);
}
if (pageCount === 0) {
  console.warn("[note] page count could not be read from the PDF; check it visually.");
}
