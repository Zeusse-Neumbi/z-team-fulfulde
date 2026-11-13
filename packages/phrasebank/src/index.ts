import { languages } from "./generated";

export { languageCodes, languages } from "./generated";
export type { Pack } from "./generated";
export {
  assertKnownTargets,
  loadAll,
  loadLanguage,
  loadRegistry,
  releaseErrors,
  releaseGate,
} from "./loader";
export type { LanguagePack } from "./loader";
export { packSource, packValidated, type PackSource } from "./generated.provenance";

/** The bundled pack for one language; throws instead of returning empty data. */
export function getPack(code: string): (typeof languages)[string] {
  const pack = languages[code];
  if (!pack) throw new Error(`Unknown language pack: ${code}`);
  return pack;
}
