import type { ActionView, TranslationStatus } from "@zteam/shared";

export type SpeechKind =
  | "page"
  | "purpose"
  | "section"
  | "step"
  | "value"
  | "fact"
  | "warning"
  | "action"
  | "note";

export interface SpeechItem {
  id: string;
  kind: SpeechKind;
  text: string;
  /** False when the sentence contains a protected value and must not be sent to TTS. */
  speakable: boolean;
}

export interface SpeechPlanStrings {
  step: string;
  stepLabels: Record<1 | 2 | 3 | 4 | 5, string>;
  valuesNote: string;
  amountLabel: string;
  feeLabel: string;
  actionsNote: string;
  noContent: string;
}

export interface SpeechPlan {
  items: SpeechItem[];
  /** Texts that may be sent to the local TTS service. */
  spoken: string[];
  skippedValues: number;
  actionCount: number;
}

const FACT_LABEL =
  /solde|balance|frais|fee|total|montant|amount|bénéficiaire|beneficiary|compte|account|référence|reference/i;
const WARNING_LABEL =
  /attention|avertissement|warning|important|jamais|never|ne partagez|do not share|danger|risque/i;
const PRIMARY_ACTION =
  /transfert|transfer|frais|fee|continuer|continue|suivant|next|confirmer|confirm|valider|validate|envoyer|send|modifier|edit|réessayer|retry/i;
const MAX_ITEMS = 11;
const MAX_FACTS = 4;
const MAX_WARNINGS = 2;
const MAX_ACTIONS = 3;

function normalized(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function containsValue(text: string, values: string[]): boolean {
  return values.some((value) => value.length > 0 && text.includes(value));
}

/**
 * Builds the short spoken summary of the current page.
 *
 * The assistant never reads the whole page. It reads the step, the most
 * important facts and warnings, and the next actions. A sentence that contains
 * a protected value is kept out of the TTS payload; the panel tells the user to
 * verify the value on screen instead.
 */
export function buildSpeechPlan(
  status: TranslationStatus,
  strings: SpeechPlanStrings,
  options: { maxItems?: number; allowValues?: boolean } = {},
): SpeechPlan {
  const maxItems = options.maxItems ?? MAX_ITEMS;
  const allowValues = options.allowValues ?? false;
  const values = status.protectedValues.map((value) => value.value.trim()).filter(Boolean);
  const kinds = new Map(
    status.protectedValues.map((value) => [value.value.trim(), value.kind] as const),
  );
  // Even when amounts are allowed, identifiers are never read aloud.
  const hasSensitiveValue = (text: string): boolean =>
    values.some(
      (value) =>
        text.includes(value) && !["amount", "fee"].includes(kinds.get(value) ?? "other"),
    );
  const items: SpeechItem[] = [];
  const seen = new Set<string>();
  let skippedValues = 0;

  const push = (kind: SpeechKind, id: string, text: string, speakable: boolean) => {
    if (items.length >= maxItems) return;
    const key = normalized(text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push({ id, kind, text: text.trim(), speakable });
  };

  if (status.pageBrief) {
    const brief = status.pageBrief;
    const pageLabel =
      status.step !== "unknown"
        ? `${strings.step} ${status.step}/5 — ${strings.stepLabels[status.step]}`
        : "";
    if (brief.title) {
      push("page", "page-title", pageLabel ? `${brief.title} — ${pageLabel}` : brief.title, true);
    } else if (pageLabel) {
      push("step", "step", pageLabel, true);
    }
    if (allowValues) {
      let added = 0;
      for (const value of status.protectedValues) {
        if (added >= 3) break;
        if (value.kind !== "amount" && value.kind !== "fee") continue;
        const label = value.kind === "fee" ? strings.feeLabel : strings.amountLabel;
        push("value", `v-${value.kind}-${added}`, `${label} ${value.value}`, true);
        added += 1;
      }
    }
    if (brief.purpose) {
      const unsafe = containsValue(brief.purpose, values) || hasSensitiveValue(brief.purpose);
      if (unsafe) skippedValues += 1;
      else push("purpose", "purpose", brief.purpose, true);
    }
    for (const [index, section] of brief.sections.entries()) {
      const headingUnsafe = containsValue(section.heading, values) || hasSensitiveValue(section.heading);
      if (headingUnsafe) {
        skippedValues += 1;
        continue;
      }
      const textUnsafe = containsValue(section.text, values) || hasSensitiveValue(section.text);
      if (section.text && !textUnsafe) {
        push("section", `s-${index}`, `${section.heading}. ${section.text}`, true);
      } else {
        push("section", `s-${index}`, section.heading, true);
        if (section.text) skippedValues += 1;
      }
    }
    for (const [index, warning] of brief.warnings.entries()) {
      const unsafe = containsValue(warning, values) || hasSensitiveValue(warning);
      if (unsafe) {
        skippedValues += 1;
        continue;
      }
      push("warning", `w-${index}`, warning, true);
    }
    for (const [index, action] of brief.actions.entries()) {
      const unsafe = containsValue(action, values) || hasSensitiveValue(action);
      if (unsafe) {
        skippedValues += 1;
        continue;
      }
      push("action", `a-${index}`, action, true);
    }
    if (brief.actions.length > 0) push("note", "actions-note", strings.actionsNote, true);
    if (values.length > 0 && !allowValues) {
      push("note", "values-note", strings.valuesNote, true);
    }
    if (items.length === 0) push("note", "empty", strings.noContent, true);
    return {
      items,
      spoken: items.filter((item) => item.speakable).map((item) => item.text),
      skippedValues,
      actionCount: brief.actions.length,
    };
  }

  if (status.step !== "unknown") {
    const label = strings.stepLabels[status.step];
    push("step", "step", `${strings.step} ${status.step}/5 — ${label}`, true);
  }

  if (allowValues) {
    let added = 0;
    for (const value of status.protectedValues) {
      if (added >= 3) break;
      if (value.kind !== "amount" && value.kind !== "fee") continue;
      const label = value.kind === "fee" ? strings.feeLabel : strings.amountLabel;
      push("value", `v-${value.kind}-${added}`, `${label} ${value.value}`, true);
      added += 1;
    }
  }

  const applied = status.sentences.filter(
    (sentence) => sentence.status === "applied" && sentence.target?.trim(),
  );

  let facts = 0;
  let warnings = 0;
  let fallback: string | null = null;
  let shortFact: { id: string; target: string } | null = null;

  for (const sentence of applied) {
    const target = sentence.target?.trim() ?? "";
    const words = sentence.source.trim().split(/\s+/).filter(Boolean).length;
    const unsafe = containsValue(target, values) || containsValue(sentence.source, values);
    const sensitive = hasSensitiveValue(target) || hasSensitiveValue(sentence.source);
    if (sensitive || (unsafe && !allowValues)) {
      skippedValues += 1;
      continue;
    }
    if (WARNING_LABEL.test(sentence.source) && words >= 4 && warnings < MAX_WARNINGS) {
      push("warning", `w-${sentence.id}`, target, true);
      warnings += 1;
      continue;
    }
    if (FACT_LABEL.test(sentence.source)) {
      if (words >= 5 && facts < MAX_FACTS) {
        push("fact", `f-${sentence.id}`, target, true);
        facts += 1;
      } else if (!shortFact) {
        shortFact = { id: sentence.id, target };
      }
      continue;
    }
    if (!fallback) fallback = target;
  }

  if (facts === 0 && shortFact) {
    push("fact", `f-${shortFact.id}`, shortFact.target, true);
    facts = 1;
  }

  if (!facts && !warnings && fallback) {
    push("fact", "f-fallback", fallback, true);
  }

  const availableActions = status.actions.filter((action) => !action.locked && action.enabled);
  const primaryActions = availableActions.filter((action) => PRIMARY_ACTION.test(action.name));
  const actions = (primaryActions.length > 0 ? primaryActions : availableActions)
    .sort((left, right) => riskRank(right) - riskRank(left))
    .slice(0, MAX_ACTIONS);

  for (const action of actions) {
    const name = action.spokenName ?? action.name;
    const unsafe = containsValue(name, values);
    push("action", `a-${action.id}`, name, !unsafe || (allowValues && !hasSensitiveValue(name)));
  }

  if (actions.length > 0) {
    push("note", "actions-note", strings.actionsNote, true);
  }
  if (values.length > 0 && !allowValues) {
    push("note", "values-note", strings.valuesNote, true);
  }
  if (items.length === 0) {
    push("note", "empty", strings.noContent, true);
  }

  return {
    items,
    spoken: items.filter((item) => item.speakable).map((item) => item.text),
    skippedValues,
    actionCount: actions.length,
  };
}

function riskRank(action: ActionView): number {
  if (action.risk === "high") return 3;
  if (action.risk === "medium") return 2;
  return 1;
}

/**
 * Backwards-compatible helper: the spoken part of the plan only.
 * A sentence containing a protected value is never returned.
 */
export function safeSpeechTexts(status: TranslationStatus, limit = 12): string[] {
  const values = status.protectedValues.map((value) => value.value.trim()).filter(Boolean);
  return status.sentences
    .filter((sentence) => sentence.status === "applied" && sentence.target)
    .map((sentence) => sentence.target?.trim() ?? "")
    .filter(
      (text) =>
        text.length > 0 && !values.some((protectedValue) => text.includes(protectedValue)),
    )
    .slice(0, limit);
}

/**
 * A page-click announcement is spoken only when the button name does not
 * contain a protected value. The voice must be local; the caller checks that.
 */
export function shouldSpeakPageAction(
  action: { name: string } | undefined,
  values: Array<{ value: string; kind?: string }>,
): boolean {
  if (!action || !action.name.trim()) return false;
  const sensitive = new Set(["account", "phone", "reference", "person", "user_input"]);
  return !values.some(
    (value) =>
      value.value.length >= 4 &&
      (!value.kind || sensitive.has(value.kind)) &&
      action.name.includes(value.value),
  );
}
