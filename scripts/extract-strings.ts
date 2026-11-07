import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "https://safinum.cm/hackathon-test" },
    out: { type: "string", default: "eval/linguistic/strings.csv" },
    wait: { type: "string", default: "1500" },
  },
});

const waitMs = Number.parseInt(values.wait ?? "1500", 10);

function csvEscape(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(values.url as string, { waitUntil: "networkidle" });
await page.waitForTimeout(waitMs);

const rows = await page.evaluate(() => {
  const seen = new Set<string>();
  const output: Array<{ text: string; normalized: string; lang: string }> = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  let node = walker.nextNode();
  while (node) {
    const text = (node.nodeValue ?? "").trim();
    if (text && /[A-Za-zÀ-ÿ]/.test(text)) {
      const normalized = text.normalize("NFKC").replace(/\s+/g, " ").trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        output.push({
          text,
          normalized,
          lang: document.documentElement.lang || "unknown",
        });
      }
    }
    node = walker.nextNode();
  }
  return output;
});

const outPath = path.resolve(process.cwd(), values.out as string);
mkdirSync(path.dirname(outPath), { recursive: true });

const lines = ["text,normalized,lang", ...rows.map((row) => [row.text, row.normalized, row.lang].map(csvEscape).join(","))];
writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");

console.log(`[strings] ${rows.length} unique visible strings`);
console.log(`[strings] wrote ${outPath}`);

await browser.close();
