import type { PlaceholderKind, ProtectedReason } from "@zteam/shared";
import { normalizeValue } from "./normalize";
import { looksLikeValue } from "./patterns";

export interface VaultValue {
  value: string;
  normalized: string;
  kind: PlaceholderKind;
}

export interface Vault {
  values(): VaultValue[];
}

export type NodeClassification =
  | { kind: "protected"; reason: ProtectedReason }
  | { kind: "mixed"; reason: ProtectedReason }
  | { kind: "translatable" }
  | { kind: "ignore" };

const IGNORE_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "CODE",
  "PRE",
  "SVG",
  "CANVAS",
  "TEXTAREA",
  "INPUT",
  "NOSCRIPT",
  "TEMPLATE",
]);

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

export function isIgnoredNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (IGNORE_TAGS.has(parent.tagName)) return true;
  if (parent.closest('[aria-hidden="true"]')) return true;
  if (parent.closest("[hidden]")) return true;

  const style = parent.style;
  if (style?.display === "none" || style?.visibility === "hidden" || style?.opacity === "0") {
    return true;
  }

  return false;
}

export function classifyNode(node: Text, vault: Vault): NodeClassification {
  if (isIgnoredNode(node)) return { kind: "ignore" };

  const raw = node.nodeValue ?? "";
  if (raw.trim().length === 0) return { kind: "ignore" };

  const parent = node.parentElement;
  if (parent?.isContentEditable) return { kind: "protected", reason: "user_input" };

  const normalized = normalizeValue(raw);
  if (!normalized) return { kind: "translatable" };

  for (const value of vault.values()) {
    if (!value.normalized) continue;
    if (value.normalized === normalized) {
      return { kind: "protected", reason: KIND_TO_REASON[value.kind] };
    }
  }

  for (const value of vault.values()) {
    if (!value.normalized || value.normalized.length < 3) continue;
    if (normalized.includes(value.normalized)) {
      return { kind: "mixed", reason: KIND_TO_REASON[value.kind] };
    }
  }

  if (looksLikeValue(raw)) return { kind: "protected", reason: "value" };

  return { kind: "translatable" };
}
