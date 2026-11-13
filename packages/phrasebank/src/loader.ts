import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type LanguageRegistryEntry,
  type NumbersLexicon,
  type PhraseEntry,
  type TranslationUnit,
  languageRegistryEntrySchema,
  numbersLexiconSchema,
  phraseEntrySchema,
  translationUnitSchema,
} from "@zteam/shared";
import { parse } from "yaml";
import { z } from "zod";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));

/**
 * The registry lives at the repository root; the pack paths inside a row are
 * relative to this package. Walk up so the same code works from `src` and
 * from `dist`.
 */
function findLanguagesRoot(): string {
  let directory = packageRoot;
  for (let depth = 0; depth < 4; depth += 1) {
    const candidate = join(directory, "languages");
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
    directory = dirname(directory);
  }
  throw new Error(`Language registry not found above ${packageRoot}`);
}

const languagesRoot = findLanguagesRoot();

export type PackSource = "validated" | "mt";

/**
 * `ZTEAM_PHRASEBANK=mt` loads the machine-translated candidate pack
 * (`tm.mt.yaml` / `phrases.mt.yaml`) for an evaluation build. Those entries
 * have no validator and no back-translation, so `build:release` still fails
 * for a validated language.
 *
 * The per-language pack source is carried into the generated provenance so
 * the panel can label the draft it is showing. A draft pack is never
 * presented as validated.
 */
function packSource(): PackSource {
  return process.env.ZTEAM_PHRASEBANK === "mt" ? "mt" : "validated";
}

function packSuffix(): string {
  return packSource() === "mt" ? ".mt" : "";
}

const tmFileSchema = z.object({
  version: z.string(),
  units: z.array(translationUnitSchema),
});

const phraseFileSchema = z.object({
  version: z.string(),
  phrases: z.array(phraseEntrySchema),
});

export interface LanguagePack {
  code: string;
  status: "validated" | "draft" | "text-only";
  /** Where the loaded targets came from: the human pack or the MT candidates. */
  packSource: PackSource;
  tmVersion: string;
  phrasebankVersion: string;
  translationUnits: TranslationUnit[];
  phrases: PhraseEntry[];
  numbers: NumbersLexicon;
  warnings: string[];
}

function readYaml(path: string): unknown {
  return parse(readFileSync(resolve(packageRoot, path), "utf8"));
}

function assertUnique(ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate id: ${id}`);
    seen.add(id);
  }
}

function assertRelativePath(value: string, field: string, code: string): void {
  if (value.startsWith("/") || value.split("/").includes("..")) {
    throw new Error(`Language ${code} ${field} must stay inside the package: ${value}`);
  }
}

/**
 * Reads every `languages/*.yaml` row, validates it, and checks that both the
 * pack directory and the numbers file exist. A registry typo fails here, not
 * as a silently empty pack.
 */
export function loadRegistry(): LanguageRegistryEntry[] {
  const files = readdirSync(languagesRoot)
    .filter((file) => file.endsWith(".yaml"))
    .sort();
  if (!files.length) throw new Error(`No language registry rows in ${languagesRoot}`);

  const registry = files.map((file) => {
    const parsed = languageRegistryEntrySchema.safeParse(
      parse(readFileSync(join(languagesRoot, file), "utf8")),
    );
    if (!parsed.success) {
      throw new Error(`Invalid language registry row ${file}: ${parsed.error.message}`);
    }
    const entry = parsed.data;
    if (`${entry.code}.yaml` !== file) {
      throw new Error(`Registry row ${file} must be named ${entry.code}.yaml`);
    }
    assertRelativePath(entry.pack, "pack", entry.code);
    assertRelativePath(entry.numbers, "numbers", entry.code);
    const pack = resolve(packageRoot, entry.pack);
    if (!existsSync(pack) || !statSync(pack).isDirectory()) {
      throw new Error(`Language ${entry.code} pack directory is missing: ${entry.pack}`);
    }
    if (!existsSync(resolve(packageRoot, entry.numbers))) {
      throw new Error(`Language ${entry.code} numbers file is missing: ${entry.numbers}`);
    }
    return entry;
  });

  const codes = new Set<string>();
  for (const entry of registry) {
    if (codes.has(entry.code)) throw new Error(`Duplicate language code: ${entry.code}`);
    codes.add(entry.code);
  }

  const packDirectories = readdirSync(join(packageRoot, "entries"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const directory of packDirectories) {
    if (!codes.has(directory)) {
      throw new Error(`Pack directory entries/${directory} has no languages/${directory}.yaml row`);
    }
  }

  return registry;
}

/**
 * A pack may only carry targets for registered languages. This catches a
 * typo'd code at load time instead of shipping an empty target at runtime.
 */
export function assertKnownTargets(
  entries: ReadonlyArray<{ id: string; target: Record<string, unknown> }>,
  codes: ReadonlySet<string>,
  kind: "tm" | "phrase",
): void {
  for (const entry of entries) {
    for (const code of Object.keys(entry.target)) {
      if (!codes.has(code)) {
        throw new Error(`Unknown target language "${code}" in ${kind} ${entry.id}`);
      }
    }
  }
}

interface PackFile {
  path: string;
  fallback: boolean;
}

function readPackFile(
  pack: string,
  name: string,
  suffix: string,
  code: string,
  warnings: string[],
): PackFile {
  const candidate = `${pack}/${name}${suffix}.yaml`;
  if (!suffix || existsSync(resolve(packageRoot, candidate))) {
    return { path: candidate, fallback: false };
  }
  warnings.push(`No ${code} candidate ${name}${suffix}.yaml; using the base pack`);
  return { path: `${pack}/${name}.yaml`, fallback: true };
}

export function loadLanguage(
  entry: LanguageRegistryEntry,
  registryCodes: ReadonlySet<string>,
): LanguagePack {
  const suffix = packSuffix();
  const warnings: string[] = [];
  const tmFile = readPackFile(entry.pack, "tm", suffix, entry.code, warnings);
  const phraseFile = readPackFile(entry.pack, "phrases", suffix, entry.code, warnings);
  const tmRaw = tmFileSchema.parse(readYaml(tmFile.path));
  const phraseRaw = phraseFileSchema.parse(readYaml(phraseFile.path));
  const numbers = numbersLexiconSchema.parse(
    JSON.parse(readFileSync(resolve(packageRoot, entry.numbers), "utf8")),
  );

  assertUnique(tmRaw.units.map((unit) => unit.id));
  assertUnique(phraseRaw.phrases.map((phrase) => phrase.id));
  assertKnownTargets(tmRaw.units, registryCodes, "tm");
  assertKnownTargets(phraseRaw.phrases, registryCodes, "phrase");

  for (const unit of tmRaw.units) {
    const target = unit.target[entry.code];
    if (!target?.text) warnings.push(`Missing ${entry.code} target: ${unit.id}`);
    if (!target?.validatedBy.length) warnings.push(`Missing validator: ${unit.id}`);
    if (!target?.backTranslationFr) warnings.push(`Missing back-translation: ${unit.id}`);
  }

  for (const phrase of phraseRaw.phrases) {
    const target = phrase.target[entry.code];
    if (!target?.text) warnings.push(`Missing ${entry.code} phrase: ${phrase.id}`);
    if (!target?.validatedBy.length) warnings.push(`Missing phrase validator: ${phrase.id}`);
    if (!target?.backTranslationFr) {
      warnings.push(`Missing phrase back-translation: ${phrase.id}`);
    }
  }

  return {
    code: entry.code,
    status: entry.status,
    packSource: suffix && !tmFile.fallback && !phraseFile.fallback ? "mt" : "validated",
    tmVersion: tmRaw.version,
    phrasebankVersion: phraseRaw.version,
    translationUnits: tmRaw.units,
    phrases: phraseRaw.phrases,
    numbers,
    warnings,
  };
}

/** Every registered language, keyed by ISO 639-3 code. */
export function loadAll(): Record<string, LanguagePack> {
  const registry = loadRegistry();
  const codes = new Set(registry.map((entry) => entry.code));
  const packs: Record<string, LanguagePack> = {};
  for (const entry of registry) packs[entry.code] = loadLanguage(entry, codes);
  return packs;
}

/** Release errors for one language. Only called for a `validated` pack. */
export function releaseErrors(pack: LanguagePack): string[] {
  const errors: string[] = [];
  for (const unit of pack.translationUnits) {
    if (unit.risk === "low") continue;
    const target = unit.target[pack.code];
    if (!target?.text) errors.push(`Missing ${pack.code} target: ${unit.id}`);
    if (!target?.validatedBy.length) errors.push(`Missing validator: ${unit.id}`);
    if (!target?.backTranslationFr) errors.push(`Missing back-translation: ${unit.id}`);
  }
  for (const phrase of pack.phrases) {
    if (phrase.risk === "low") continue;
    const target = phrase.target[pack.code];
    if (!target?.text) errors.push(`Missing ${pack.code} phrase: ${phrase.id}`);
    if (!target?.validatedBy.length) errors.push(`Missing phrase validator: ${phrase.id}`);
    if (!target?.backTranslationFr) {
      errors.push(`Missing phrase back-translation: ${phrase.id}`);
    }
  }
  return errors;
}

/**
 * The release gate is per language: a `draft` or `text-only` pack never blocks
 * the build, and a `validated` pack always must pass. The existing low-risk
 * exemption stays exactly as it was.
 */
export function releaseGate(packs: Record<string, LanguagePack>): string[] {
  const errors: string[] = [];
  for (const code of Object.keys(packs).sort()) {
    const pack = packs[code];
    if (!pack || pack.status !== "validated") continue;
    errors.push(...releaseErrors(pack).map((error) => `${code}: ${error}`));
  }
  return errors;
}
