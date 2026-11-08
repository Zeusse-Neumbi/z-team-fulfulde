import type { ProtectedReason, TranslationUnit } from "@zteam/shared";
import { normalizeValue, splitWhitespace } from "./normalize";
import { findValueMatches } from "./patterns";
import { classifyNode, type Vault, type VaultValue } from "./protected";
import type { TmCapture, TranslationMemory } from "./tm";

export type TranslationRisk = "low" | "medium" | "high" | "unknown";

export interface TranslatedSentence {
  id: string;
  source: string;
  target: string | null;
  status: "applied" | "missed";
  risk: TranslationRisk;
  protectedReason?: ProtectedReason;
}

export interface TranslateOptions {
  /**
   * Test-only generator for a translatable node that has no TM entry. The
   * production content script never supplies it. The fixture build uses it to
   * prove the generic pipeline on arbitrary pages without inventing Fulfulde.
   */
  fallback?: (source: string) => string | null;
}

const FALLBACK_UNIT: TranslationUnit = {
  id: "fixture.fallback",
  source: { fr: "", en: "" },
  target: { ff: "" },
  risk: "low",
  validatedBy: ["fixture"],
  backTranslationFr: "",
  version: "fixture",
};

export interface TranslationStats {
  applied: number;
  protectedCount: number;
  missed: number;
  coverage: number;
  aborted: boolean;
  abortReason?: "protected_changed" | "mixed_value_missing" | "target_value_mismatch";
  sentences: TranslatedSentence[];
}

interface OriginalRecord {
  source: string;
  leading: string;
  trailing: string;
}

interface AppliedRecord {
  source: string;
  target: string;
  written: string;
  unit: TranslationUnit;
  captures: TmCapture[];
}

interface PlannedWrite {
  node: Text;
  original: OriginalRecord;
  target: string;
  written: string;
  unit: TranslationUnit;
  captures: TmCapture[];
  sentence: TranslatedSentence;
}

const MAX_SENTENCES = 500;

export function collectTextNodes(root: Node): Text[] {
  const nodes: Text[] = [];

  const visit = (node: Node): void => {
    if (node.nodeType === 3) {
      if ((node.nodeValue ?? "").trim().length > 0) nodes.push(node as Text);
      return;
    }

    if (node.nodeType === 1) {
      const element = node as Element;
      if (element.tagName === "IFRAME") {
        try {
          const frame = element as HTMLIFrameElement;
          const frameDocument = frame.contentDocument;
          if (frameDocument?.documentElement) visit(frameDocument.documentElement);
        } catch {
          // Cross-origin frames are unreadable by design.
        }
      }
      if (element.shadowRoot) visit(element.shadowRoot);
    }

    for (const child of Array.from(node.childNodes)) visit(child);
  };

  visit(root);
  return nodes;
}

function valueSet(text: string): Set<string> {
  return new Set(findValueMatches(text).map((match) => normalizeValue(match.value)));
}

/**
 * A translation may keep a source value, but it may never introduce a new
 * amount, phone, account, reference, date or long number.
 */
function requiredValues(source: string, vault: Vault): VaultValue[] {
  const normalized = normalizeValue(source);
  if (!normalized) return [];
  return vault
    .values()
    .filter((value) => value.normalized.length >= 3 && normalized.includes(value.normalized));
}

function hasFreeValue(source: string, target: string): boolean {
  const sourceValues = valueSet(source);
  for (const value of valueSet(target)) {
    if (!sourceValues.has(value)) return true;
  }
  return false;
}

export class DomTranslator {
  private originals = new WeakMap<Text, OriginalRecord>();
  private applied = new WeakMap<Text, AppliedRecord>();
  private changed = new Set<Text>();

  translate(
    root: Node,
    tm: TranslationMemory,
    vault: Vault,
    options: TranslateOptions = {},
  ): TranslationStats {
    const nodes = collectTextNodes(root);
    const protectedBefore = new Map<Text, string>();
    const plans: PlannedWrite[] = [];
    const sentences: TranslatedSentence[] = [];
    let applied = 0;
    let protectedCount = 0;
    let missed = 0;
    let abortReason: TranslationStats["abortReason"];

    for (const node of nodes) {
      const classification = classifyNode(node, vault);
      if (classification.kind === "ignore") continue;

      if (classification.kind === "protected") {
        protectedCount += 1;
        protectedBefore.set(node, node.nodeValue ?? "");
        continue;
      }

      const current = node.nodeValue ?? "";
      const protectionReason =
        classification.kind === "mixed" ? classification.reason : undefined;
      const previous = this.applied.get(node);

      if (previous && current === previous.written) {
        applied += 1;
        if (sentences.length < MAX_SENTENCES) {
          sentences.push({
            id: `n${sentences.length}`,
            source: previous.source.trim(),
            target: previous.target,
            status: "applied",
            risk: previous.unit.risk,
            protectedReason: protectionReason,
          });
        }
        continue;
      }

      if (previous && current !== previous.source) {
        // The page rendered something new in this node; treat it as a new source.
        this.applied.delete(node);
        this.originals.delete(node);
      }

      const whitespace = splitWhitespace(current);
      const original = this.originals.get(node) ?? {
        source: current,
        leading: whitespace.leading,
        trailing: whitespace.trailing,
      };
      this.originals.set(node, original);

      let hit = tm.lookup(original.source);
      if (!hit && options.fallback) {
        const fallback = options.fallback(original.source);
        if (fallback) {
          hit = {
            unit: FALLBACK_UNIT,
            target: fallback,
            source: original.source,
            captures: [],
          };
        }
      }
      if (!hit) {
        missed += 1;
        if (sentences.length < MAX_SENTENCES) {
          sentences.push({
            id: `n${sentences.length}`,
            source: original.source.trim(),
            target: null,
            status: "missed",
            risk: "unknown",
            protectedReason: protectionReason,
          });
        }
        continue;
      }

      if (classification.kind === "mixed") {
        const targetNormalized = normalizeValue(hit.target);
        const missingValue = requiredValues(original.source, vault).find(
          (value) => !targetNormalized.includes(value.normalized),
        );
        if (missingValue) {
          abortReason = "mixed_value_missing";
          break;
        }
      }

      const missingCapture = hit.captures.find(
        (capture) => !capture.value || !hit.target.includes(capture.value),
      );
      if (missingCapture) {
        abortReason = "mixed_value_missing";
        break;
      }

      if (hasFreeValue(original.source, hit.target)) {
        abortReason = "target_value_mismatch";
        break;
      }

      const target = hit.target.trim();
      const written = `${original.leading}${target}${original.trailing}`;
      const sentence: TranslatedSentence = {
        id: `n${sentences.length}`,
        source: original.source.trim(),
        target,
        status: "applied",
        risk: hit.unit.risk,
        protectedReason: protectionReason,
      };

      plans.push({
        node,
        original,
        target,
        written,
        unit: hit.unit,
        captures: hit.captures,
        sentence,
      });
      applied += 1;
      if (sentences.length < MAX_SENTENCES) sentences.push(sentence);
    }

    if (abortReason) {
      this.restore(root);
      return {
        applied: 0,
        protectedCount,
        missed,
        coverage: 0,
        aborted: true,
        abortReason,
        sentences: [],
      };
    }

    for (const plan of plans) {
      plan.node.nodeValue = plan.written;
      this.changed.add(plan.node);
      this.applied.set(plan.node, {
        source: plan.original.source,
        target: plan.target,
        written: plan.written,
        unit: plan.unit,
        captures: plan.captures,
      });
    }

    for (const [node, before] of protectedBefore) {
      if (node.isConnected && node.nodeValue !== before) {
        this.restore(root);
        return {
          applied: 0,
          protectedCount,
          missed,
          coverage: 0,
          aborted: true,
          abortReason: "protected_changed",
          sentences: [],
        };
      }
    }

    for (const plan of plans) {
      for (const capture of plan.captures) {
        if (!plan.node.nodeValue?.includes(capture.value)) {
          this.restore(root);
          return {
            applied: 0,
            protectedCount,
            missed,
            coverage: 0,
            aborted: true,
            abortReason: "mixed_value_missing",
            sentences: [],
          };
        }
      }
    }

    return {
      applied,
      protectedCount,
      missed,
      coverage: applied / Math.max(1, applied + missed),
      aborted: false,
      sentences,
    };
  }

  originalOf(node: Text): string | undefined {
    return this.originals.get(node)?.source;
  }

  restore(root: Node): void {
    for (const node of this.changed) {
      const original = this.originals.get(node);
      if (original) node.nodeValue = original.source;
    }

    for (const node of collectTextNodes(root)) {
      const original = this.originals.get(node);
      if (original) node.nodeValue = original.source;
    }

    this.originals = new WeakMap();
    this.applied = new WeakMap();
    this.changed = new Set();
  }

  translatedUnit(node: Text): TranslationUnit | undefined {
    return this.applied.get(node)?.unit;
  }
}
