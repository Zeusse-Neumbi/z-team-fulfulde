import { languages } from "./generated";

export { languageCodes, languages } from "./generated";
export type { Pack } from "./generated";
export { packSource, packValidated, type PackSource } from "./generated.provenance";

/** The bundled pack for one language; throws instead of returning empty data. */
export function getPack(code: string): (typeof languages)[string] {
  const pack = languages[code];
  if (!pack) throw new Error(`Unknown language pack: ${code}`);
  return pack;
}
