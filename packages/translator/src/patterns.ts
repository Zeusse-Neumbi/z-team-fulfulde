export const MONEY =
  /[+-]?\d{1,3}(?:[ \u00A0\u202F.,]\d{3})*(?:[.,]\d{1,2})?\s*(?:FCFA|XAF|F\s?CFA|€|\$)/i;

export const PHONE = /(?:\+?237)?[\s.-]*[26]\d(?:[\s.-]*\d){7,8}/;

export const ACCOUNT = /CM\s?\d{3}\s?\d{4}\s?\d{4}\s?\d{2}/i;

export const REFERENCE = /^SAF-\d{4}-[A-Z0-9]{6}$/;

export const DATE =
  /\b\d{1,2}[/\s.-](?:\d{1,2}|janv\.?|févr\.?|mars|avr\.?|mai|juin|juil\.?|août|sept\.?|oct\.?|nov\.?|déc\.?)[/\s.-]\d{4}\b/i;

export const LONG_DIGITS = /\d{6,}/;

export function looksLikeValue(input: string): boolean {
  return (
    MONEY.test(input) ||
    PHONE.test(input) ||
    ACCOUNT.test(input) ||
    REFERENCE.test(input) ||
    DATE.test(input) ||
    LONG_DIGITS.test(input)
  );
}
