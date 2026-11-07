export function normalizeSource(input: string): string {
  return input.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/**
 * Normalization used to compare financial values.
 *
 * This mirrors the way a human or an evaluation harness compares displayed
 * values: currency tokens, spaces (including NBSP / narrow NBSP), commas,
 * dots and apostrophes do not carry meaning, and case is irrelevant.
 */
export function normalizeValue(input: string): string {
  return normalizeSource(input)
    .toLowerCase()
    .replace(/fcfa|xaf|f\s*cfa/gi, "")
    .replace(/[\s\u00A0\u202F,.'’]/g, "");
}

export function splitWhitespace(input: string): {
  leading: string;
  core: string;
  trailing: string;
} {
  const leading = input.match(/^\s*/)?.[0] ?? "";
  const trailing = input.match(/\s*$/)?.[0] ?? "";
  const core = input.slice(leading.length, input.length - trailing.length);
  return { leading, core, trailing };
}

export function isWhitespace(input: string): boolean {
  return input.trim().length === 0;
}
