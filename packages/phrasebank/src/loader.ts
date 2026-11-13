import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type PhraseEntry, type TranslationUnit, phraseEntrySchema, translationUnitSchema } from "@zteam/shared";
import { parse } from "yaml";
import { z } from "zod";

const root = fileURLToPath(new URL("../", import.meta.url));

export type PackSource = "validated" | "mt";

/**
 * `ZTEAM_PHRASEBANK=mt` loads the machine-translated candidate pack
 * (`tm.mt.yaml` / `phrases.mt.yaml`) for an evaluation build. Those entries
 * have no validator and no back-translation, so `build:release` still fails.
 *
 * The pack source is carried into the generated module so the panel can label
 * the draft it is showing. A draft pack is never presented as validated.
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

const numbersSchema = z.object({
  version: z.string(),
  units: z.array(z.string()),
  tens: z.record(z.string(), z.string()),
  hundred: z.string(),
  thousand: z.string(),
  million: z.string(),
  billion: z.string(),
  and: z.string(),
  plus: z.string(),
  minus: z.string(),
  currency: z.string(),
});

export interface PhrasebankData {
  packSource: PackSource;
  tmVersion: string;
  phrasebankVersion: string;
  translationUnits: TranslationUnit[];
  phrases: PhraseEntry[];
  numbers: z.infer<typeof numbersSchema>;
  warnings: string[];
}

function readYaml(path: string): unknown {
  return parse(readFileSync(`${root}${path}`, "utf8"));
}

function assertUnique(ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate id: ${id}`);
    seen.add(id);
  }
}

export function loadAll(): PhrasebankData {
  const tmRaw = tmFileSchema.parse(readYaml(`entries/tm${packSuffix()}.yaml`));
  const phraseRaw = phraseFileSchema.parse(readYaml(`entries/phrases${packSuffix()}.yaml`));
  const numbers = numbersSchema.parse(
    JSON.parse(readFileSync(`${root}numbers/numbers.fub.json`, "utf8")),
  );

  assertUnique(tmRaw.units.map((u) => u.id));
  assertUnique(phraseRaw.phrases.map((p) => p.id));

  const warnings: string[] = [];

  for (const unit of tmRaw.units) {
    if (!unit.target.ff) warnings.push(`Missing FF target: ${unit.id}`);
    if (!unit.validatedBy.length) warnings.push(`Missing validator: ${unit.id}`);
    if (!unit.backTranslationFr) warnings.push(`Missing back-translation: ${unit.id}`);
  }

  for (const phrase of phraseRaw.phrases) {
    if (!phrase.ff) warnings.push(`Missing FF phrase: ${phrase.id}`);
    if (!phrase.validatedBy.length) warnings.push(`Missing phrase validator: ${phrase.id}`);
    if (!phrase.backTranslationFr) {
      warnings.push(`Missing phrase back-translation: ${phrase.id}`);
    }
  }

  return {
    packSource: packSource(),
    tmVersion: tmRaw.version,
    phrasebankVersion: phraseRaw.version,
    translationUnits: tmRaw.units,
    phrases: phraseRaw.phrases,
    numbers,
    warnings,
  };
}

export function releaseErrors(data: PhrasebankData): string[] {
  const errors: string[] = [];
  for (const unit of data.translationUnits) {
    if (unit.risk === "low") continue;
    if (!unit.target.ff) errors.push(`Missing FF target: ${unit.id}`);
    if (!unit.validatedBy.length) errors.push(`Missing validator: ${unit.id}`);
    if (!unit.backTranslationFr) errors.push(`Missing back-translation: ${unit.id}`);
  }
  for (const phrase of data.phrases) {
    if (phrase.risk === "low") continue;
    if (!phrase.ff) errors.push(`Missing FF phrase: ${phrase.id}`);
    if (!phrase.validatedBy.length) errors.push(`Missing phrase validator: ${phrase.id}`);
    if (!phrase.backTranslationFr) {
      errors.push(`Missing phrase back-translation: ${phrase.id}`);
    }
  }
  return errors;
}
