import type { TranslationUnit } from "@zteam/shared";
import { normalizeSource } from "./normalize";

export interface TmCapture {
  key: string;
  value: string;
}

export interface TmHit {
  unit: TranslationUnit;
  target: string;
  source: string;
  captures: TmCapture[];
  origin: "tm" | "mt" | "fixture";
  provider?: string;
  model?: string;
}

interface PatternEntry {
  unit: TranslationUnit;
  regex: RegExp;
  keys: string[];
}

interface RuntimeEntry {
  target: string;
  unit: TranslationUnit;
  provider: string;
  model: string;
}

function runtimeUnit(target: string, provider: string, model: string): TranslationUnit {
  return {
    id: `mt.${provider}`,
    source: { fr: "", en: "" },
    target: { ff: target },
    risk: "medium",
    validatedBy: [],
    backTranslationFr: "",
    version: `mt:${provider}:${model}`,
  };
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
  private readonly runtime = new Map<string, RuntimeEntry>();
  private runtimeFirst = false;

  constructor(units: TranslationUnit[]) {
    for (const unit of units) {
      if (!unit.target.ff) continue;
      const fr = normalizeSource(unit.source.fr);
      const en = normalizeSource(unit.source.en);
      if (fr && !this.fr.has(fr)) this.fr.set(fr, unit);
      if (en && !this.en.has(en)) this.en.set(en, unit);
      const frPattern = toPattern(unit.source.fr, unit);
      const enPattern = toPattern(unit.source.en, unit);
      if (frPattern) this.patterns.push(frPattern);
      if (enPattern) this.patterns.push(enPattern);
    }
  }

  lookup(text: string): TmHit | null {
    const normalized = normalizeSource(text);
    if (!normalized) return null;

    if (this.runtimeFirst) {
      const runtime = this.lookupRuntime(normalized, text);
      if (runtime) return runtime;
    }

    const exact = this.fr.get(normalized) ?? this.en.get(normalized);
    if (exact?.target.ff) {
      return {
        unit: exact,
        target: exact.target.ff,
        source: text,
        captures: [],
        origin: "tm",
      };
    }

    for (const pattern of this.patterns) {
      const match = pattern.regex.exec(normalized);
      if (!match) continue;
      let target = pattern.unit.target.ff;
      const captures: TmCapture[] = [];
      pattern.keys.forEach((key, index) => {
        const value = match[index + 1] ?? "";
        captures.push({ key, value });
        target = target.replaceAll(`{${key}}`, value);
      });
      return { unit: pattern.unit, target, source: text, captures, origin: "tm" };
    }

    if (!this.runtimeFirst) {
      return this.lookupRuntime(normalized, text);
    }

    return null;
  }

  private lookupRuntime(normalized: string, text: string): TmHit | null {
    const entry = this.runtime.get(normalized);
    if (!entry) return null;
    return {
      unit: entry.unit,
      target: entry.target,
      source: text,
      captures: [],
      origin: "mt",
      provider: entry.provider,
      model: entry.model,
    };
  }

  /**
   * Adds a local-API target to the in-memory layer. The validated TM always
   * wins in fallback mode; primary mode may override it explicitly.
   */
  addRuntime(
    source: string,
    target: string,
    provider: string,
    model: string,
    override = false,
  ): boolean {
    const normalized = normalizeSource(source);
    const value = target.trim();
    if (!normalized || !value) return false;
    if (!override && (this.fr.has(normalized) || this.en.has(normalized))) return false;
    this.runtime.set(normalized, {
      target: value,
      unit: runtimeUnit(value, provider, model),
      provider,
      model,
    });
    return true;
  }

  setRuntimePriority(value: boolean): void {
    this.runtimeFirst = value;
  }

  clearRuntime(): void {
    this.runtime.clear();
    this.runtimeFirst = false;
  }

  runtimeSize(): number {
    return this.runtime.size;
  }

  baseSize(): number {
    return this.fr.size + this.en.size;
  }

  languageOf(text: string): "fr" | "en" | "unknown" {
    const normalized = normalizeSource(text);
    if (this.fr.has(normalized)) return "fr";
    if (this.en.has(normalized)) return "en";
    return "unknown";
  }

  size(): number {
    return this.baseSize() + this.runtime.size;
  }
}
