#!/usr/bin/env node
/**
 * Scaffold a new language pack without editing loader, server or translator
 * code.
 *
 *   pnpm lang:add ewo --model facebook/mms-tts-ewo --mt francais-ewondo
 *
 * It creates:
 *   languages/<code>.yaml
 *   packages/phrasebank/entries/<code>/{tm,phrases}.yaml  (empty targets)
 *   packages/phrasebank/numbers/<code>.json
 *   a models/manifest.json stub
 *   packages/phrasebank/src/language-<code>.test.ts
 *
 * The generated test fails until a native speaker supplies the targets,
 * validators and French back-translations. That is deliberate: the easy path
 * must not look like the validated path.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packRoot = join(root, "packages/phrasebank");
const args = process.argv.slice(2);

function option(name, fallback) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
}

function fail(message) {
  console.error(`[lang:add] ${message}`);
  process.exit(2);
}

const code = args.find((arg) => !arg.startsWith("-"))?.toLowerCase();
if (!code || !/^[a-z]{3}$/.test(code)) {
  fail("usage: pnpm lang:add <ISO-639-3-code> --model <hf-repo|none> [--mt pair] [--name label]");
}
if (existsSync(join(root, "languages", `${code}.yaml`))) {
  fail(`languages/${code}.yaml already exists; pick another code or edit that row.`);
}

const voiceRepo = option("--model", "");
if (!voiceRepo) fail("--model <hf-repo> is required (pass --model none for text-only).");
const mtPair = option("--mt", `francais-${code}`);
const label = option("--name", code);
const textOnly = voiceRepo === "none";
const voiceDir = textOnly ? "none" : (voiceRepo.split("/").pop() ?? `mms-tts-${code}`);

const registry = {
  code,
  endonym: label,
  names: { fr: label, en: label },
  script: "Latn",
  direction: "ltr",
  orthography: "AGLC",
  status: textOnly ? "text-only" : "draft",
  // Replace this with the AGLC inventory before trusting the tokenizer guard.
  letters: "abcdefghijklmnopqrstuvwxyz",
  mt: {
    provider: mtPair === "none" ? "none" : "marian",
    model: mtPair === "none" ? "none" : `models/cameroon-int8/${mtPair}`,
    pivot: "fr",
  },
  speech: {
    provider: textOnly ? "none" : "mms",
    model: textOnly ? "none" : `models/${voiceDir}`,
    tone: "none",
    substitutions: {},
  },
  numbers: `numbers/${code}.json`,
  pack: `entries/${code}`,
};

mkdirSync(join(root, "languages"), { recursive: true });
writeFileSync(
  join(root, "languages", `${code}.yaml`),
  YAML.stringify(registry, { lineWidth: 0, schema: "yaml-1.1" }),
  "utf8",
);

const entriesDir = join(packRoot, "entries", code);
mkdirSync(entriesDir, { recursive: true });

function mirror(file, key) {
  const source = YAML.parse(readFileSync(join(packRoot, "entries/fub", file), "utf8"));
  for (const entry of source[key]) {
    delete entry.mtProvider;
    delete entry.mtModel;
    delete entry.mtAt;
    delete entry.mtPlaceholdersOk;
    entry.target = { [code]: { text: "", origin: "human" } };
  }
  writeFileSync(
    join(entriesDir, file),
    YAML.stringify(source, { lineWidth: 0, schema: "yaml-1.1" }),
    "utf8",
  );
  return source[key].length;
}

const tmCount = mirror("tm.yaml", "units");
const phraseCount = mirror("phrases.yaml", "phrases");

const numbers = JSON.parse(readFileSync(join(packRoot, "numbers/fub.json"), "utf8"));
numbers.version = `${new Date().toISOString().slice(0, 10)}.1`;
for (const key of [
  "hundred",
  "thousand",
  "million",
  "billion",
  "and",
  "plus",
  "minus",
  "currency",
]) {
  numbers[key] = "";
}
numbers.units = numbers.units.map(() => "");
numbers.tens = Object.fromEntries(Object.keys(numbers.tens).map((key) => [key, ""]));
writeFileSync(
  join(packRoot, "numbers", `${code}.json`),
  `${JSON.stringify(numbers, null, 2)}\n`,
  "utf8",
);

const manifestPath = join(root, "models/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.models[`mt-${code}`] = {
  repo: "flagship-ai/cameroon-int8",
  dir: "cameroon-int8",
  licence: "CC-BY-NC-4.0",
  note: `Scaffolded ${code} Marian pair. Verify ${mtPair} and fill the file sizes and SHA-256 values.`,
  files: [],
};
if (!textOnly) {
  manifest.models[`tts-${code}`] = {
    repo: voiceRepo,
    dir: voiceDir,
    licence: "UNKNOWN",
    note: "Scaffolded voice model. Verify the licence and fill the file sizes and SHA-256 values.",
    files: [],
  };
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const testPath = join(packRoot, "src", `language-${code}.test.ts`);
writeFileSync(
  testPath,
  `import { describe, expect, it } from "vitest";
import { loadAll, releaseErrors } from "./loader";

describe("${code} language pack", () => {
  it("has a native-speaker validator for every medium/high-risk entry", () => {
    const pack = loadAll()["${code}"];
    expect(pack).toBeDefined();
    expect(pack ? releaseErrors(pack) : ["missing"]).toEqual([]);
  });
});
`,
  "utf8",
);

console.log(`[lang:add] added ${code}`);
console.log(`  languages/${code}.yaml`);
console.log(`  packages/phrasebank/entries/${code}/tm.yaml (${tmCount} empty targets)`);
console.log(`  packages/phrasebank/entries/${code}/phrases.yaml (${phraseCount} empty targets)`);
console.log(`  packages/phrasebank/numbers/${code}.json`);
console.log("  models/manifest.json stub");
console.log(`  packages/phrasebank/src/language-${code}.test.ts (fails until validated)`);
console.log(
  `[lang:add] next: fill the AGLC letters, download the models, collect native-speaker ` +
    `validation, then set status: validated.`,
);
