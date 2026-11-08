import type { PlaceholderKind, ProtectedReason } from "@zteam/shared";
import { normalizeSource, normalizeValue } from "./normalize";
import { findValueMatches, looksLikeValue } from "./patterns";

export interface VaultValue {
  value: string;
  normalized: string;
  kind: PlaceholderKind;
  reason?: ProtectedReason;
}

export interface Vault {
  values(): VaultValue[];
}

export type NodeClassification =
  | { kind: "protected"; reason: ProtectedReason }
  | { kind: "mixed"; reason: ProtectedReason }
  | { kind: "translatable" }
  | { kind: "ignore" };

const IGNORE_SELECTOR =
  'script,style,code,pre,svg,canvas,textarea,input,noscript,template,[aria-hidden="true"],[hidden]';

const KIND_TO_REASON: Record<PlaceholderKind, ProtectedReason> = {
  amount: "value",
  fee: "value",
  person: "name",
  phone: "phone",
  account: "account",
  reference: "reference",
  date: "date",
  user_input: "user_input",
  other: "value",
};

/**
 * Adds a value to the vault. Callers must pass a single displayed value, not a
 * whole label/value sentence; `addPatternValues` is the helper for text nodes.
 */
export function addVaultValue(
  values: VaultValue[],
  value: string,
  kind: PlaceholderKind,
  reason?: ProtectedReason,
): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const normalized = normalizeValue(trimmed) || normalizeSource(trimmed).toLowerCase();
  if (!normalized) return;
  if (values.some((item) => item.normalized === normalized)) return;
  values.push({ value: trimmed, normalized, kind, reason });
}

/** Extracts every financial/code value substring from a text node. */
export function addPatternValues(values: VaultValue[], text: string): void {
  for (const match of findValueMatches(text)) {
    const reason = match.value.match(/\b[A-Z][A-Z0-9_]*_\d{3}\b/) ? "code" : undefined;
    addVaultValue(values, match.value, match.kind, reason);
  }
}

/** Builds a vault from an already-normalized list, mainly for tests. */
export function vaultFrom(values: VaultValue[]): Vault {
  return { values: () => values };
}

export function isIgnoredNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest(IGNORE_SELECTOR)) return true;

  // A dedicated node in a hidden subtree must not be translated or counted.
  const view = parent.ownerDocument.defaultView;
  const style = view?.getComputedStyle(parent);
  if (style?.display === "none" || style?.visibility === "hidden" || style?.opacity === "0") {
    return true;
  }

  return false;
}

export function classifyNode(node: Text, vault: Vault): NodeClassification {
  if (isIgnoredNode(node)) return { kind: "ignore" };

  const raw = node.nodeValue ?? "";
  if (raw.trim().length === 0) return { kind: "ignore" };
  // Step numbers and separators are ignored, but a bare amount, phone, date or
  // digit run is still a protected value.
  if (!/[A-Za-zÀ-ÿ]/.test(raw) && !looksLikeValue(raw)) return { kind: "ignore" };

  const parent = node.parentElement;
  if (parent?.isContentEditable || parent?.closest('[contenteditable="true"]')) {
    return { kind: "protected", reason: "user_input" };
  }

  const normalized = normalizeValue(raw) || normalizeSource(raw).toLowerCase();
  if (!normalized) return { kind: "translatable" };

  for (const value of vault.values()) {
    if (!value.normalized) continue;
    if (value.normalized === normalized) {
      return {
        kind: "protected",
        reason: value.reason ?? KIND_TO_REASON[value.kind],
      };
    }
  }

  for (const value of vault.values()) {
    if (!value.normalized || value.normalized.length < 3) continue;
    if (normalized.includes(value.normalized)) {
      return {
        kind: "mixed",
        reason: value.reason ?? KIND_TO_REASON[value.kind],
      };
    }
  }

  if (looksLikeValue(raw)) return { kind: "protected", reason: "value" };

  return { kind: "translatable" };
}
