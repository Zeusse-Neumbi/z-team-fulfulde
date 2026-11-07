import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { computeCoverage } from "@zteam/translator";

const { values } = parseArgs({
  options: {
    before: { type: "string", default: "eval/linguistic/strings.csv" },
    after: { type: "string", default: "eval/linguistic/strings.ff.csv" },
    out: { type: "string", default: "eval/latency/coverage.csv" },
  },
});

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function readColumn(file: string, column: number): string[] {
  const content = readFileSync(path.resolve(process.cwd(), file), "utf8").trim();
  if (!content) return [];
  const lines = content.split(/\r?\n/).slice(1);
  return lines.map((line) => parseCsvLine(line)[column] ?? "").filter(Boolean);
}

const before = readColumn(values.before as string, 0);
const after = readColumn(values.after as string, 0);
const coverage = computeCoverage(before, after);

const outPath = path.resolve(process.cwd(), values.out as string);
writeFileSync(
  outPath,
  `baseline,after,coverage\n${before.length},${after.length},${coverage.toFixed(4)}\n`,
  "utf8",
);

console.log(`[coverage] baseline=${before.length} after=${after.length}`);
console.log(`[coverage] ${(coverage * 100).toFixed(1)}%`);
console.log(`[coverage] wrote ${outPath}`);
