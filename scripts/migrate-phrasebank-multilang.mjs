#!/usr/bin/env node
/**
 * Move the single-language phrasebank to per-language packs.
 *
 *   entries/tm.yaml          -> entries/fub/tm.yaml
 *   entries/phrases.yaml     -> entries/fub/phrases.yaml
 *   entries/tm.mt.yaml       -> entries/fub/tm.mt.yaml
 *   entries/phrases.mt.yaml  -> entries/fub/phrases.mt.yaml
 *   numbers/numbers.fub.json -> numbers/fub.json
 *
 * Then rewrite `ff` / `target.ff` into `target.<code>` and scaffold the ybb
 * pack with the same ids and every target empty (`origin: human`). Nothing is
 * translated here.
 *
 * Run once with `pnpm exec tsx scripts/migrate-phrasebank-multilang.mjs`.
 * The transform itself is tested in packages/phrasebank/src/migrate.test.ts;
 * this CLI is deleted before the pull request.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import {
  upgradePhraseYaml,
  upgradeTmYaml,
} from "../packages/phrasebank/src/migrate.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packRoot = join(root, "packages/phrasebank");
const entriesRoot = join(packRoot, "entries");
const numbersRoot = join(packRoot, "numbers");

function move(from, to) {
  if (!existsSync(from)) {
    console.log(`[migrate] skip missing ${from.slice(root.length + 1)}`);
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  execFileSync("git", ["mv", from, to], { cwd: root, stdio: "inherit" });
}

const moves = [
  ["entries/tm.yaml", "entries/fub/tm.yaml"],
  ["entries/phrases.yaml", "entries/fub/phrases.yaml"],
  ["entries/tm.mt.yaml", "entries/fub/tm.mt.yaml"],
  ["entries/phrases.mt.yaml", "entries/fub/phrases.mt.yaml"],
  ["entries/audio.blocked.yaml", "entries/fub/audio.blocked.yaml"],
  ["numbers/numbers.fub.json", "numbers/fub.json"],
];
for (const [from, to] of moves) move(join(packRoot, from), join(packRoot, to));

function rewrite(path, transform) {
  const source = readFileSync(path, "utf8");
  writeFileSync(path, transform(source), "utf8");
  console.log(`[migrate] rewrote ${path.slice(root.length + 1)}`);
}

rewrite(join(entriesRoot, "fub/tm.yaml"), (source) => upgradeTmYaml(source, "fub", "human"));
rewrite(join(entriesRoot, "fub/phrases.yaml"), (source) =>
  upgradePhraseYaml(source, "fub", "human"),
);
if (existsSync(join(entriesRoot, "fub/tm.mt.yaml"))) {
  rewrite(join(entriesRoot, "fub/tm.mt.yaml"), (source) =>
    upgradeTmYaml(source, "fub", "mt"),
  );
  rewrite(join(entriesRoot, "fub/phrases.mt.yaml"), (source) =>
    upgradePhraseYaml(source, "fub", "mt"),
  );
}

// --- ybb scaffold: same ids and sources, every target empty and human ------
const ybb = "ybb";
const ybbDir = join(entriesRoot, ybb);
mkdirSync(ybbDir, { recursive: true });

function mirror(file, key) {
  const source = parse(readFileSync(join(entriesRoot, "fub", file), "utf8"));
  for (const entry of source[key]) {
    entry.target = { [ybb]: { text: "", origin: "human" } };
  }
  writeFileSync(join(ybbDir, file), stringify(source, { lineWidth: 0 }), "utf8");
  console.log(`[migrate] wrote entries/${ybb}/${file} (${source[key].length} entries)`);
}

mirror("tm.yaml", "units");
mirror("phrases.yaml", "phrases");

const numbers = JSON.parse(readFileSync(join(numbersRoot, "fub.json"), "utf8"));
for (const key of ["hundred", "thousand", "million", "billion", "and", "plus", "minus", "currency"]) {
  numbers[key] = "";
}
numbers.units = numbers.units.map(() => "");
numbers.tens = Object.fromEntries(Object.keys(numbers.tens).map((key) => [key, ""]));
writeFileSync(join(numbersRoot, `${ybb}.json`), `${JSON.stringify(numbers, null, 2)}\n`, "utf8");
console.log(`[migrate] wrote numbers/${ybb}.json`);

// --- post-conditions -------------------------------------------------------
const fubTm = parse(readFileSync(join(entriesRoot, "fub", "tm.yaml"), "utf8"));
const fubPhrases = parse(readFileSync(join(entriesRoot, "fub", "phrases.yaml"), "utf8"));
const ybbTm = parse(readFileSync(join(ybbDir, "tm.yaml"), "utf8"));
const ybbPhrases = parse(readFileSync(join(ybbDir, "phrases.yaml"), "utf8"));

for (const unit of [...fubTm.units, ...fubPhrases.phrases]) {
  if (unit.ff !== undefined || unit.validatedBy !== undefined || unit.backTranslationFr !== undefined) {
    throw new Error(`Legacy field still present on ${unit.id}`);
  }
  if (!unit.target?.fub) throw new Error(`Missing target.fub on ${unit.id}`);
}
for (const unit of [...ybbTm.units, ...ybbPhrases.phrases]) {
  if (!unit.target?.ybb) throw new Error(`Missing target.ybb on ${unit.id}`);
  if (unit.target.ybb.text !== "") throw new Error(`Invented ybb target on ${unit.id}`);
  if (unit.target.ybb.origin !== "human") throw new Error(`Wrong ybb origin on ${unit.id}`);
}
const ids = (data) => data.map((entry) => entry.id).join("\n");
if (ids(fubTm.units) !== ids(ybbTm.units) || ids(fubPhrases.phrases) !== ids(ybbPhrases.phrases)) {
  throw new Error("ybb pack ids do not mirror fub");
}

console.log(
  `[migrate] done: fub ${fubTm.units.length} units / ${fubPhrases.phrases.length} phrases, ` +
    `ybb ${ybbTm.units.length} units / ${ybbPhrases.phrases.length} phrases`,
);
