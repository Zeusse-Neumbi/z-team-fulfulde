import { YAMLMap, type YAMLSeq, parseDocument } from "yaml";

/**
 * One-off migration helpers for the single-language to multi-language pack
 * shape. They edit the YAML document in place so comments and flow style
 * survive; the migration script and its round-trip test share this code.
 *
 * Legacy translation memory: `target: { ff: "..." }` plus top-level
 * `validatedBy` / `backTranslationFr`.
 * Legacy phrases: `ff: "..."` plus the same two top-level fields.
 */
export type MigrationOrigin = "human" | "mt";

function assertCode(code: string): void {
  if (!/^[a-z]{3}$/.test(code)) throw new Error(`Not an ISO 639-3 code: ${code}`);
}

function entries(document: ReturnType<typeof parseDocument>, key: string): YAMLMap[] {
  const sequence = document.get(key) as YAMLSeq | undefined;
  if (!sequence) throw new Error(`Phrasebank YAML has no \`${key}\` list`);
  return sequence.items.filter((item): item is YAMLMap => item instanceof YAMLMap);
}

function textOf(map: YAMLMap | undefined, key: string): string {
  const value = map?.get(key);
  return typeof value === "string" ? value : "";
}

function listOf(map: YAMLMap, key: string): string[] {
  const value = map.get(key) as YAMLSeq | undefined;
  return (value?.toJSON() as string[] | undefined) ?? [];
}

function targetNode(
  document: ReturnType<typeof parseDocument>,
  code: string,
  text: string,
  origin: MigrationOrigin,
  validatedBy: string[],
  backTranslationFr: string,
): YAMLMap {
  const node = document.createNode({
    [code]: {
      text,
      origin,
      ...(validatedBy.length ? { validatedBy } : {}),
      ...(backTranslationFr ? { backTranslationFr } : {}),
    },
  }) as YAMLMap;
  node.flow = true;
  return node;
}

function replaceKeyInPlace(
  map: YAMLMap,
  from: string,
  to: string,
  value: unknown,
): void {
  const index = map.items.findIndex((pair) => String(pair.key) === from);
  map.delete(from);
  map.set(to, value);
  if (index < 0 || from === to) return;
  const pair = map.items.pop();
  if (pair) map.items.splice(index, 0, pair);
}

/** `entries/tm.yaml` → `entries/<code>/tm.yaml` shape. */
export function upgradeTmYaml(
  source: string,
  code: string,
  origin: MigrationOrigin = "human",
): string {
  assertCode(code);
  const document = parseDocument(source);
  for (const unit of entries(document, "units")) {
    const target = unit.get("target") as YAMLMap | undefined;
    const text = textOf(target, "ff");
    const validatedBy = listOf(unit, "validatedBy");
    const backTranslationFr = textOf(unit, "backTranslationFr");
    unit.set("target", targetNode(document, code, text, origin, validatedBy, backTranslationFr));
    unit.delete("validatedBy");
    unit.delete("backTranslationFr");
  }
  return document.toString({ lineWidth: 0 });
}

/** `entries/phrases.yaml` → `entries/<code>/phrases.yaml` shape. */
export function upgradePhraseYaml(
  source: string,
  code: string,
  origin: MigrationOrigin = "human",
): string {
  assertCode(code);
  const document = parseDocument(source);
  for (const phrase of entries(document, "phrases")) {
    const text = textOf(phrase, "ff");
    const validatedBy = listOf(phrase, "validatedBy");
    const backTranslationFr = textOf(phrase, "backTranslationFr");
    const node = targetNode(document, code, text, origin, validatedBy, backTranslationFr);
    replaceKeyInPlace(phrase, "ff", "target", node);
    phrase.delete("validatedBy");
    phrase.delete("backTranslationFr");
  }
  return document.toString({ lineWidth: 0 });
}

/** Inverse of `upgradeTmYaml`, used to prove the codemod round-trips. */
export function downgradeTmYaml(source: string, code: string): string {
  assertCode(code);
  const document = parseDocument(source);
  for (const unit of entries(document, "units")) {
    const target = unit.get("target") as YAMLMap | undefined;
    const entry = target?.get(code) as YAMLMap | undefined;
    const validatedBy = entry?.get("validatedBy") as YAMLSeq | undefined;
    unit.set("target", document.createNode({ ff: textOf(entry, "text") }));
    unit.set("validatedBy", validatedBy ?? document.createNode([]));
    unit.set("backTranslationFr", textOf(entry, "backTranslationFr"));
  }
  return document.toString({ lineWidth: 0 });
}

/** Inverse of `upgradePhraseYaml`, used to prove the codemod round-trips. */
export function downgradePhraseYaml(source: string, code: string): string {
  assertCode(code);
  const document = parseDocument(source);
  for (const phrase of entries(document, "phrases")) {
    const target = phrase.get("target") as YAMLMap | undefined;
    const entry = target?.get(code) as YAMLMap | undefined;
    const validatedBy = entry?.get("validatedBy") as YAMLSeq | undefined;
    replaceKeyInPlace(phrase, "target", "ff", document.createNode(textOf(entry, "text")));
    phrase.set("validatedBy", validatedBy ?? document.createNode([]));
    phrase.set("backTranslationFr", textOf(entry, "backTranslationFr"));
  }
  return document.toString({ lineWidth: 0 });
}
