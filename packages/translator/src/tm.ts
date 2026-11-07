import type { TranslationUnit } from "@zteam/shared";
import { normalizeSource } from "./normalize";

export interface TmHit {
  unit: TranslationUnit;
  target: string;
  source: string;
}

interface PatternEntry {
  unit: TranslationUnit;
  regex: RegExp;
  keys: string[];
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPattern(source: string, unit: TranslationUnit): PatternEntry | null {
  const keys: string[] = [];
  const pattern = normalizeSource(source)
    .split(/(\{\w+\})/g)
    .map((part) => {
      const match = part.match(/^\{(\w+)\}$/);
      if (!match?.[1]) return escapeRegExp(part);
      keys.push(match[1]);
      return "(.+?)";
    })
    .join("");
  if (keys.length === 0) return null;
  return { unit, regex: new RegExp(`^${pattern}$`, "i"), keys };
}

export class TranslationMemory {
  private readonly fr = new Map<string, TranslationUnit>();
  private readonly en = new Map<string, TranslationUnit>();
  private readonly patterns: PatternEntry[] = [];

  constructor(units: TranslationUnit[]) {
    for (const unit of units) {
      if (!unit.target.ff) continue;
      const fr = normalizeSource(unit.source.fr);
      const en = normalizeSource(unit.source.en);
      if (fr) this.fr.set(fr, unit);
      if (en) this.en.set(en, unit);
      const frPattern = toPattern(unit.source.fr, unit);
      const enPattern = toPattern(unit.source.en, unit);
      if (frPattern) this.patterns.push(frPattern);
      if (enPattern) this.patterns.push(enPattern);
    }
  }

  lookup(text: string): TmHit | null {
    const normalized = normalizeSource(text);
    const exact = this.fr.get(normalized) ?? this.en.get(normalized);
    if (exact?.target.ff) {
      return { unit: exact, target: exact.target.ff, source: text };
    }

    for (const pattern of this.patterns) {
      const match = pattern.regex.exec(normalized);
      if (!match) continue;
      let target = pattern.unit.target.ff;
      pattern.keys.forEach((key, index) => {
        const value = match[index + 1] ?? "";
        target = target.replaceAll(`{${key}}`, value);
      });
      return { unit: pattern.unit, target, source: text };
    }

    return null;
  }

  size(): number {
    return this.fr.size + this.en.size;
  }
}
