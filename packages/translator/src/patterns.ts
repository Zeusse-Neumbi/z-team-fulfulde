import type { PlaceholderKind } from "@zteam/shared";

const MONEY_SOURCE =
  String.raw`[+-]?\d{1,3}(?:[ \u00A0\u202F.,]\d{3})*(?:[.,]\d{1,2})?\s*(?:FCFA|XAF|F\s?CFA|€|\$)`;
const PHONE_SOURCE = String.raw`(?:\+?237)?[\s.-]*[26](?:[\s.-]*\d){8,9}`;
const ACCOUNT_SOURCE = String.raw`CM\s?\d{3}\s?\d{4}\s?\d{4}\s?\d{2}`;
const REFERENCE_SOURCE = String.raw`SAF-\d{4}-[A-Z0-9]{6}`;
const DATE_FR_SOURCE =
  String.raw`\b\d{1,2}[/\s.-](?:\d{1,2}|janv\.?|févr\.?|mars|avr\.?|mai|juin|juil\.?|août|sept\.?|oct\.?|nov\.?|déc\.?)[/\s.-]\d{4}\b`;
const DATE_EN_SOURCE =
  String.raw`\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b`;
const DATE_SOURCE = String.raw`(?:${DATE_FR_SOURCE}|${DATE_EN_SOURCE})`;
const LONG_DIGITS_SOURCE = String.raw`\d{6,}`;
const ERROR_CODE_SOURCE = String.raw`\b[A-Z][A-Z0-9_]*_\d{3}\b`;
const CURRENCY_SOURCE = String.raw`\b(?:FCFA|XAF|F\s?CFA)\b`;

export const MONEY = new RegExp(MONEY_SOURCE, "i");
export const PHONE = new RegExp(PHONE_SOURCE, "i");
export const ACCOUNT = new RegExp(ACCOUNT_SOURCE, "i");
export const REFERENCE = new RegExp(REFERENCE_SOURCE, "i");
export const REFERENCE_FULL = new RegExp(`^${REFERENCE_SOURCE}$`, "i");
export const DATE = new RegExp(DATE_SOURCE, "i");
export const LONG_DIGITS = new RegExp(LONG_DIGITS_SOURCE);
export const ERROR_CODE = new RegExp(ERROR_CODE_SOURCE, "i");
export const CURRENCY = new RegExp(CURRENCY_SOURCE, "i");

const MONEY_GLOBAL = new RegExp(MONEY_SOURCE, "gi");
const PHONE_GLOBAL = new RegExp(PHONE_SOURCE, "gi");
const ACCOUNT_GLOBAL = new RegExp(ACCOUNT_SOURCE, "gi");
const REFERENCE_GLOBAL = new RegExp(REFERENCE_SOURCE, "gi");
const DATE_GLOBAL = new RegExp(DATE_SOURCE, "gi");
const LONG_DIGITS_GLOBAL = new RegExp(LONG_DIGITS_SOURCE, "g");
const ERROR_CODE_GLOBAL = new RegExp(ERROR_CODE_SOURCE, "g");
const CURRENCY_GLOBAL = new RegExp(CURRENCY_SOURCE, "gi");

export interface ValueMatch {
  value: string;
  kind: PlaceholderKind;
}

interface MatchRange {
  start: number;
  end: number;
}

function addMatch(
  output: ValueMatch[],
  seen: Set<string>,
  occupied: MatchRange[],
  match: RegExpMatchArray,
  kind: PlaceholderKind,
): void {
  const raw = match[0] ?? "";
  const value = raw.trim();
  if (!value) return;

  const leading = raw.length - raw.trimStart().length;
  const start = (match.index ?? 0) + leading;
  const end = start + value.length;
  if (occupied.some((range) => start < range.end && end > range.start)) return;

  occupied.push({ start, end });
  const key = `${kind}:${value}`;
  if (seen.has(key)) return;
  seen.add(key);
  output.push({ value, kind });
}

/**
 * Finds the value substrings inside a text node.
 *
 * The caller must never treat a mixed label/value node as one value: the
 * returned matches are the only substrings that enter the vault.
 */
export function findValueMatches(text: string): ValueMatch[] {
  const output: ValueMatch[] = [];
  const seen = new Set<string>();
  const occupied: MatchRange[] = [];

  // Priority order: a matched account/amount owns its range, so a shorter
  // phone or digit run inside it is not added as a second value.
  for (const match of text.matchAll(MONEY_GLOBAL)) addMatch(output, seen, occupied, match, "amount");
  for (const match of text.matchAll(ACCOUNT_GLOBAL)) addMatch(output, seen, occupied, match, "account");
  for (const match of text.matchAll(REFERENCE_GLOBAL)) {
    addMatch(output, seen, occupied, match, "reference");
  }
  for (const match of text.matchAll(ERROR_CODE_GLOBAL)) addMatch(output, seen, occupied, match, "other");
  for (const match of text.matchAll(PHONE_GLOBAL)) addMatch(output, seen, occupied, match, "phone");
  for (const match of text.matchAll(DATE_GLOBAL)) addMatch(output, seen, occupied, match, "date");
  for (const match of text.matchAll(CURRENCY_GLOBAL)) addMatch(output, seen, occupied, match, "other");
  for (const match of text.matchAll(LONG_DIGITS_GLOBAL)) {
    addMatch(output, seen, occupied, match, "other");
  }

  return output;
}

export function looksLikeValue(input: string): boolean {
  return (
    MONEY.test(input) ||
    PHONE.test(input) ||
    ACCOUNT.test(input) ||
    REFERENCE.test(input) ||
    DATE.test(input) ||
    LONG_DIGITS.test(input) ||
    ERROR_CODE.test(input) ||
    REFERENCE_FULL.test(input)
  );
}
