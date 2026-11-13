import type { ProtectedReason, TranslationUnit } from "@zteam/shared";
import { normalizeSource, normalizeValue, splitWhitespace } from "./normalize";
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
  holdReason?: "label_collision";
  origin?: "tm" | "mt" | "fixture";
  provider?: string;
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
  target: {
    fub: {
      text: "",
      origin: "seed",
      validatedBy: ["fixture"],
      backTranslationFr: "",
    },
  },
  risk: "low",
  version: "fixture",
};

export interface TranslationStats {
  applied: number;
  tmApplied: number;
  mtApplied: number;
  protectedCount: number;
  missed: number;
  coverage: number;
  /** Interactive labels held in the source language to avoid an ambiguity. */
  labelCollisions: number;
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
  origin: "tm" | "mt" | "fixture";
  provider?: string;
}

interface PlannedWrite {
  node: Text;
  original: OriginalRecord;
  target: string;
  written: string;
  unit: TranslationUnit;
  captures: TmCapture[];
  origin: "tm" | "mt" | "fixture";
  provider?: string;
  sentence: TranslatedSentence;
}

const MAX_SENTENCES = 500;

const INTERACTIVE_TAGS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"]);
const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "tab",
  "menuitem",
  "menuitemradio",
  "menuitemcheckbox",
  "option",
  "switch",
  "checkbox",
  "radio",
  "combobox",
]);
/** Unit ids that name a control rather than a piece of prose. */
const CONTROL_UNIT_ID = /(^|\.)(action|cta)(\.|$)|\.(confirm|edit|submit|cancel|continue|back)$/i;

function parentOf(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  if (typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot) return root.host;
  return null;
}

/**
 * True when the text is (or sits inside) a control the user can activate.
 * Two controls that read the same are a safety problem, not a style problem.
 */
export function isInteractiveText(node: Text): boolean {
  let element: Element | null = node.parentElement;
  while (element) {
    if (INTERACTIVE_TAGS.has(element.tagName)) return true;
    const role = element.getAttribute("role");
    if (role && INTERACTIVE_ROLES.has(role.toLowerCase())) return true;
    element = parentOf(element);
  }
  return false;
}

function looksLikeControl(plan: PlannedWrite): boolean {
  return CONTROL_UNIT_ID.test(plan.unit.id) || isInteractiveText(plan.node);
}

export interface MaskedSource {
  source: string;
  masked: string;
  values: Array<{ token: string; value: string }>;
}

/**
 * Replaces displayed values with stable placeholders before a local API call.
 * The value itself never leaves the page; a mixed node can still be translated
 * around it.
 */
export function maskVaultValues(
  text: string,
  vault: Vault,
): { masked: string; values: Array<{ token: string; value: string }> } | null {
  const candidates = vault
    .values()
    .filter((value) => value.value && value.normalized.length >= 3 && text.includes(value.value))
    .sort((left, right) => right.value.length - left.value.length);
  if (candidates.length === 0) return null;

  let masked = text;
  const values: Array<{ token: string; value: string }> = [];
  for (const candidate of candidates) {
    if (!masked.includes(candidate.value)) continue;
    const token = `[[Z${values.length + 1}]]`;
    masked = masked.split(candidate.value).join(token);
    values.push({ token, value: candidate.value });
  }
  return values.length > 0 ? { masked, values } : null;
}

/** Restores masked values only when every placeholder survived exactly. */
export function unmaskVaultValues(
  target: string,
  values: Array<{ token: string; value: string }>,
): string | null {
  let restored = target;
  for (const { token, value } of values) {
    if (!restored.includes(token)) return null;
    restored = restored.split(token).join(value);
  }
  if (/\[\[Z\d+\]\]/.test(restored)) return null;
  return restored;
}

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
    let tmApplied = 0;
    let mtApplied = 0;
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
        if (previous.origin === "mt") mtApplied += 1;
        else tmApplied += 1;
        if (sentences.length < MAX_SENTENCES) {
          sentences.push({
            id: `n${sentences.length}`,
            source: previous.source.trim(),
            target: previous.target,
            status: "applied",
            risk: previous.unit.risk,
            protectedReason: protectionReason,
            origin: previous.origin,
            provider: previous.provider,
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
            origin: "fixture",
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
        origin: hit.origin,
        provider: hit.provider,
      };

      plans.push({
        node,
        original,
        target,
        written,
        unit: hit.unit,
        captures: hit.captures,
        origin: hit.origin,
        provider: hit.provider,
        sentence,
      });
      applied += 1;
      if (hit.origin === "mt") mtApplied += 1;
      else tmApplied += 1;
      if (sentences.length < MAX_SENTENCES) sentences.push(sentence);
    }

    if (abortReason) {
      this.restore(root);
      return {
        applied: 0,
        tmApplied: 0,
        mtApplied: 0,
        protectedCount,
        missed,
        coverage: 0,
        labelCollisions: 0,
        aborted: true,
        abortReason,
        sentences: [],
      };
    }

    // Two different sources that now read the same make two controls
    // indistinguishable. Keep the control label in the source language and say
    // so; never let a confirmation and a cancellation look identical.
    const held = new Set<PlannedWrite>();
    const byTarget = new Map<string, PlannedWrite[]>();
    for (const plan of plans) {
      const key = normalizeSource(plan.target);
      if (!key) continue;
      const group = byTarget.get(key);
      if (group) group.push(plan);
      else byTarget.set(key, [plan]);
    }
    for (const group of byTarget.values()) {
      if (group.length < 2) continue;
      const sources = new Set(group.map((plan) => normalizeSource(plan.original.source)));
      if (sources.size < 2) continue;
      for (const plan of group) {
        if (looksLikeControl(plan)) held.add(plan);
      }
    }

    for (const plan of held) {
      applied -= 1;
      missed += 1;
      if (plan.origin === "mt") mtApplied -= 1;
      else tmApplied -= 1;
      plan.sentence.status = "missed";
      plan.sentence.target = null;
      plan.sentence.holdReason = "label_collision";
    }

    for (const plan of plans) {
      if (held.has(plan)) continue;
      plan.node.nodeValue = plan.written;
      this.changed.add(plan.node);
      this.applied.set(plan.node, {
        source: plan.original.source,
        target: plan.target,
        written: plan.written,
        unit: plan.unit,
        captures: plan.captures,
        origin: plan.origin,
        provider: plan.provider,
      });
    }

    for (const [node, before] of protectedBefore) {
      if (node.isConnected && node.nodeValue !== before) {
        this.restore(root);
        return {
          applied: 0,
          tmApplied: 0,
          mtApplied: 0,
          protectedCount,
          missed,
          coverage: 0,
          labelCollisions: 0,
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
            tmApplied: 0,
            mtApplied: 0,
            protectedCount,
            missed,
            coverage: 0,
            labelCollisions: 0,
            aborted: true,
            abortReason: "mixed_value_missing",
            sentences: [],
          };
        }
      }
    }

    return {
      applied,
      tmApplied,
      mtApplied,
      protectedCount,
      missed,
      coverage: applied / Math.max(1, applied + missed),
      labelCollisions: held.size,
      aborted: false,
      sentences,
    };
  }

  /**
   * Collects plain, unique translatable sources for the local API. Mixed
   * nodes are deliberately excluded: the API must never receive a value,
   * name, account, phone, reference or user input.
   */
  translatableSources(
    root: Node,
    tm: TranslationMemory,
    vault: Vault,
    options: { includeTm?: boolean; max?: number } = {},
  ): string[] {
    const output: string[] = [];
    const seen = new Set<string>();
    const max = options.max ?? 80;

    for (const node of collectTextNodes(root)) {
      if (output.length >= max) break;
      const classification = classifyNode(node, vault);
      if (classification.kind !== "translatable") continue;

      const currentValue = node.nodeValue ?? "";
      const previous = this.applied.get(node);
      if (previous && currentValue === previous.written) continue;

      // A node that changed after a pass is a new source; do not reuse the
      // original from the previous pass.
      const current =
        previous && currentValue !== previous.source
          ? currentValue
          : (this.originalOf(node) ?? currentValue);
      const source = current.trim();
      if (!source || source.length > 3_500) continue;

      const hit = tm.lookup(current);
      if (hit?.origin === "mt") continue;
      if (hit && !options.includeTm) continue;

      const key = normalizeSource(current);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push(source);
    }

    return output;
  }

  /**
   * Collects mixed label/value nodes and masks their values. The API receives
   * only the masked text; the caller restores the values before writing.
   */
  mixedSources(
    root: Node,
    tm: TranslationMemory,
    vault: Vault,
    options: { max?: number } = {},
  ): MaskedSource[] {
    const output: MaskedSource[] = [];
    const seen = new Set<string>();
    const max = options.max ?? 40;

    for (const node of collectTextNodes(root)) {
      if (output.length >= max) break;
      const classification = classifyNode(node, vault);
      if (classification.kind !== "mixed") continue;

      const currentValue = node.nodeValue ?? "";
      const previous = this.applied.get(node);
      if (previous && currentValue === previous.written) continue;
      const current =
        previous && currentValue !== previous.source
          ? currentValue
          : (this.originalOf(node) ?? currentValue);
      const source = current.trim();
      if (!source || source.length > 3_500) continue;

      const hit = tm.lookup(current);
      if (hit) continue;

      const masked = maskVaultValues(current, vault);
      if (!masked) continue;
      const key = normalizeSource(current);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      output.push({ source, masked: masked.masked, values: masked.values });
    }

    return output;
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
