import { normalizeValue } from "./normalize";

/**
 * Coverage = share of baseline text nodes that are no longer present
 * verbatim (normalized) after translation.
 *
 * This is the project's own metric for "did we actually translate the page",
 * computed from two text dumps. It is intentionally independent of any
 * particular test harness.
 */
export function computeCoverage(baseline: string[], after: string[]): number {
  if (baseline.length === 0) return 0;

  const remaining = new Map<string, number>();
  for (const text of after) {
    const key = normalizeValue(text);
    if (!key) continue;
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }

  let changed = 0;
  for (const text of baseline) {
    const key = normalizeValue(text);
    if (!key) continue;
    const count = remaining.get(key) ?? 0;
    if (count > 0) remaining.set(key, count - 1);
    else changed += 1;
  }

  return changed / baseline.length;
}
