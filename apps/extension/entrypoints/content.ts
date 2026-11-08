import { translationUnits } from "@zteam/phrasebank";
import type {
  ActionView,
  ExtensionMessage,
  PageLanguage,
  PanelStep,
  PlaceholderKind,
  ProtectedReason,
  ProtectedValueView,
  Readback,
  TranslationStatus,
} from "@zteam/shared";
import {
  DomTranslator,
  TranslationMemory,
  addPatternValues,
  addVaultValue,
  collectTextNodes,
  isLikelyPersonName,
  normalizeSource,
  type Vault,
  type VaultValue,
} from "@zteam/translator";
import { computeAccessibleName } from "dom-accessibility-api";

interface ActionRecord {
  id: string;
  element: HTMLElement;
  name: string;
  role: ActionView["role"];
  risk: ActionView["risk"];
  enabled: boolean;
  locked: boolean;
  snapshotId: string;
}

declare const __ZTEAM_FIXTURE__: boolean;

const FIXTURE_MODE = typeof __ZTEAM_FIXTURE__ !== "undefined" && __ZTEAM_FIXTURE__;
const MAX_ACTIONS = 200;

const PROTECTED_TERMS: Array<{ value: string; kind: PlaceholderKind; reason?: ProtectedReason }> = [
  { value: "Safinum Pay", kind: "other" },
  { value: "Safinum", kind: "other" },
  { value: "Mobile Money", kind: "other" },
  { value: "Compte Safinum", kind: "other" },
  { value: "FCFA", kind: "other" },
  { value: "XAF", kind: "other" },
  { value: "EN", kind: "other" },
  { value: "FR", kind: "other" },
  { value: "AN", kind: "other" },
];

let translator: DomTranslator | null = null;
let memory: TranslationMemory | null = null;
let observer: MutationObserver | null = null;
let active = false;
let applyTimer: number | null = null;
let actions = new Map<string, ActionRecord>();
let actionSnapshot = "";
let actionSignature = "";
let originalNames = new WeakMap<HTMLElement, string>();
let actionLanguage: PageLanguage = "unknown";
let lastStatus: TranslationStatus = emptyStatus();

function emptyStatus(): TranslationStatus {
  return {
    active: false,
    url: location.href,
    title: document.title,
    step: detectStep(),
    language: detectPageLanguage(),
    coverage: 0,
    applied: 0,
    protectedCount: 0,
    missed: 0,
    translations: 0,
    sentences: [],
    protectedValues: [],
    actions: [],
    actionSnapshotId: "",
    aborted: false,
  };
}

function originalText(node: Node): string {
  if (node.nodeType === 3) {
    const text = node as Text;
    return translator?.originalOf(text) ?? text.nodeValue ?? "";
  }
  if (node.nodeType === 1) {
    const parts = Array.from(node.childNodes)
      .map((child) => originalText(child).trim())
      .filter(Boolean);
    return parts.join(" ");
  }
  return "";
}

function headingText(): string {
  return Array.from(document.querySelectorAll("h1,h2,h3"))
    .map((element) => originalText(element))
    .join(" | ");
}

function mainSections(): Element[] {
  return Array.from(document.querySelectorAll("section")).filter(
    (element) => !element.closest("aside, header, footer, nav"),
  );
}

function mainContentText(): string {
  const sections = mainSections();
  if (sections.length) {
    return sections.map((element) => originalText(element)).join(" | ");
  }
  return headingText();
}

function detectStep(): PanelStep {
  const headings = `${mainContentText()} | ${headingText()}`;
  const steps: Array<[PanelStep, RegExp]> = [
    [5, /transfert effectué|transfer successful|transfer complete|sent successfully/i],
    [4, /\brécapitulatif\b|\bsummary\b/i],
    [3, /\bbénéficiaire\b|\bbeneficiary\b/i],
    [2, /\bfrais de transfert\b|\btransfer fees\b/i],
    [1, /\bsolde disponible\b|\bavailable balance\b|\bvotre compte\b|\byour account\b/i],
  ];
  for (const [step, pattern] of steps) {
    if (pattern.test(headings)) return step;
  }
  return "unknown";
}

function detectPageLanguage(): PageLanguage {
  if (!memory) return "unknown";

  let fr = 0;
  let en = 0;
  for (const element of document.querySelectorAll("h1,h2,h3")) {
    const language = memory.languageOf(originalText(element));
    if (language === "fr") fr += 1;
    if (language === "en") en += 1;
  }

  const samples = mainSections().flatMap((section) => collectTextNodes(section)).slice(0, 40);
  for (const node of samples) {
    const text = translator?.originalOf(node) ?? node.nodeValue ?? "";
    const language = memory.languageOf(text);
    if (language === "fr") fr += 1;
    if (language === "en") en += 1;
  }
  if (fr !== en) return fr > en ? "fr" : "en";

  const htmlLang = document.documentElement.lang.toLowerCase();
  if (htmlLang.startsWith("fr")) return "fr";
  if (htmlLang.startsWith("en")) return "en";
  return "unknown";
}

function isSensitiveInput(input: HTMLInputElement | HTMLTextAreaElement): boolean {
  const hint = [
    input.type,
    input.name,
    input.id,
    input.getAttribute("autocomplete") ?? "",
    input.getAttribute("aria-label") ?? "",
    input.placeholder,
  ]
    .join(" ")
    .toLowerCase();
  return (
    input.type === "password" ||
    /one-time-code|otp|\bpin\b|password|code secret|secret code/.test(hint)
  );
}

function addInputValues(root: HTMLElement, values: VaultValue[]): void {
  root.querySelectorAll("input, textarea").forEach((element) => {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    if (isSensitiveInput(input)) return;
    const value = (input.value ?? "").trim();
    if (!value) return;
    const hint = `${input.name} ${input.id} ${input.getAttribute("aria-label") ?? ""} ${
      input.placeholder
    }`.toLowerCase();

    if (/phone|telephone|téléphone/.test(hint)) addVaultValue(values, value, "phone");
    else if (/account|compte/.test(hint)) addVaultValue(values, value, "account");
    else if (/reference|référence/.test(hint)) addVaultValue(values, value, "reference");
    else if (/beneficiar|bénéficiaire|name|nom|holder|titulaire/.test(hint)) {
      addVaultValue(values, value, "person");
    } else addVaultValue(values, value, "user_input");
  });
}

function addGlossary(values: VaultValue[]): void {
  for (const term of PROTECTED_TERMS) {
    addVaultValue(values, term.value, term.kind, term.reason);
  }
}

function addNamedValues(root: HTMLElement, values: VaultValue[]): void {
  for (const node of collectTextNodes(root)) {
    const text = translator?.originalOf(node) ?? node.nodeValue ?? "";
    const trimmed = text.trim();

    const greeting = trimmed.match(/^(?:Bonjour|Hello),\s+(.+)$/);
    if (greeting?.[1] && isLikelyPersonName(greeting[1].trim(), { allowSingle: true })) {
      addVaultValue(values, greeting[1], "person");
    }

    if (isLikelyPersonName(trimmed, { tagName: node.parentElement?.tagName })) {
      addVaultValue(values, trimmed, "person");
    }
  }

  root.querySelectorAll("strong, b").forEach((element) => {
    const text = originalText(element).trim();
    if (isLikelyPersonName(text, { tagName: element.tagName, allowSingle: true })) {
      addVaultValue(values, text, "person");
    }
  });

  root.querySelectorAll("dt, th, label, strong").forEach((element) => {
    const label = normalizeSource(element.textContent ?? "").toLowerCase();
    if (!/^(?:bénéficiaire|beneficiary|titulaire|account holder|nom|name)$/.test(label)) return;
    const value = element.nextElementSibling?.textContent?.trim() ?? "";
    if (value && isLikelyPersonName(value, { tagName: element.nextElementSibling?.tagName, allowSingle: true })) {
      addVaultValue(values, value, "person");
    }
  });
}

/**
 * Builds the local vault from the page. Values stay in memory only.
 *
 * The translator's original text is used so a second pass does not learn the
 * translated text as a new value.
 */
function buildVault(root: HTMLElement): Vault {
  const values: VaultValue[] = [];

  for (const node of collectTextNodes(root)) {
    const text = translator?.originalOf(node) ?? node.nodeValue ?? "";
    addPatternValues(values, text);
  }

  addInputValues(root, values);
  addGlossary(values);
  addNamedValues(root, values);

  return { values: () => values };
}

function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  if (element.closest('[aria-hidden="true"]') || element.closest("[hidden]")) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function roleOf(element: HTMLElement): ActionView["role"] {
  if (element.tagName === "SELECT") return "select";
  if (element.tagName === "A") return "link";
  const input = element as HTMLInputElement;
  if (input.type === "checkbox" || input.type === "radio") return "checkbox";
  if (input.type === "submit" || input.type === "button") return "button";
  return "button";
}

function riskOf(element: HTMLElement, name: string, role: ActionView["role"]): ActionView["risk"] {
  if (role === "checkbox") return "high";
  if (
    /confirmer|confirm|envoyer|send|valider|validate|submit|payer|pay|annuler|cancel|supprimer|delete|sign|signer/i.test(
      name,
    )
  ) {
    return "high";
  }
  if (/continuer|continue|suivant|next|retour|back|modifier|edit/i.test(name)) return "medium";
  return "low";
}

function collectActions(root: HTMLElement): { actions: Map<string, ActionRecord>; snapshotId: string } {
  const language = detectPageLanguage();
  if (language !== actionLanguage) {
    originalNames = new WeakMap();
    actionLanguage = language;
  }

  const elements = root.querySelectorAll<HTMLElement>(
    'button, a[href], [role="button"], input[type="submit"], input[type="button"], select, input[type="checkbox"], input[type="radio"]',
  );

  const next = new Map<string, ActionRecord>();
  let index = 0;

  elements.forEach((element) => {
    if (index >= MAX_ACTIONS) return;
    if (!isVisible(element)) return;
    let name = originalNames.get(element) ?? "";
    if (!name) {
      try {
        name = computeAccessibleName(element);
      } catch {
        name = "";
      }
      name = (name || element.getAttribute("aria-label") || element.textContent || "").trim();
      if (!name) return;
      originalNames.set(element, name);
    }

    const role = roleOf(element);
    index += 1;
    next.set(`a_${index}`, {
      id: `a_${index}`,
      element,
      name,
      role,
      risk: riskOf(element, name, role),
      enabled: !(element as HTMLButtonElement).disabled,
      locked: role === "checkbox",
      snapshotId: "",
    });
  });

  const signature = `${location.href}|${language}|${Array.from(next.values())
    .map((record) => `${record.name}:${record.role}:${record.risk}:${record.enabled}`)
    .join("|")}`;

  if (signature !== actionSignature) {
    actionSignature = signature;
    actionSnapshot = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  for (const record of next.values()) record.snapshotId = actionSnapshot;
  actions = next;
  return { actions: next, snapshotId: actionSnapshot };
}

function actionViews(): ActionView[] {
  return Array.from(actions.values()).map((record) => ({
    id: record.id,
    name: record.name,
    role: record.role,
    risk: record.risk,
    enabled: record.enabled,
    locked: record.locked,
  }));
}

function protectedViews(vault: Vault): ProtectedValueView[] {
  const seen = new Set<string>();
  const output: ProtectedValueView[] = [];
  for (const value of vault.values()) {
    if (!value.value || seen.has(value.value)) continue;
    seen.add(value.value);
    output.push({ value: value.value, kind: value.kind, reason: value.reason });
    if (output.length >= 100) break;
  }
  return output;
}

function normalizeLabel(text: string): string {
  return normalizeSource(text).toLowerCase().replace(/[:：]\s*$/, "").trim();
}

function readLabeledValue(labels: string[]): string | undefined {
  const wanted = new Set(labels.map(normalizeLabel));

  for (const element of document.querySelectorAll("dt, th, label, strong, p, span")) {
    if (!wanted.has(normalizeLabel(originalText(element)))) continue;
    const value = element.nextElementSibling?.textContent?.trim();
    if (value) return value;
  }

  for (const row of document.querySelectorAll("tr")) {
    const cells = row.querySelectorAll("th, td");
    if (cells.length < 2) continue;
    if (!wanted.has(normalizeLabel(originalText(cells[0] as Element)))) continue;
    const value = cells[1]?.textContent?.trim();
    if (value) return value;
  }

  return undefined;
}

function readback(): Readback {
  return {
    amount: readLabeledValue(["Montant", "Amount"]),
    fee: readLabeledValue(["Frais", "Fee"]),
    total: readLabeledValue(["Total débité", "Total debited", "Total"]),
    beneficiary: readLabeledValue(["Bénéficiaire", "Beneficiary"]),
    phone: readLabeledValue(["Téléphone", "Phone"]),
    reference: readLabeledValue(["Référence", "Reference"]),
    operation: readLabeledValue(["Opération", "Operation"]),
  };
}

function buildStatus(
  stats: ReturnType<DomTranslator["translate"]>,
  vault: Vault,
  snapshotId: string,
): TranslationStatus {
  return {
    active: active && !stats.aborted,
    url: location.href,
    title: document.title,
    step: detectStep(),
    language: detectPageLanguage(),
    coverage: stats.coverage,
    applied: stats.applied,
    protectedCount: stats.protectedCount,
    missed: stats.missed,
    translations: memory?.size() ?? 0,
    sentences: stats.sentences.slice(0, 200),
    protectedValues: protectedViews(vault),
    actions: actionViews(),
    actionSnapshotId: snapshotId,
    aborted: stats.aborted,
    abortReason: stats.abortReason,
  };
}

function applyTranslation(): TranslationStatus {
  if (!translator || !memory) return lastStatus;
  observer?.disconnect();

  try {
    const vault = buildVault(document.body);
    const collected = collectActions(document.body);
    const stats = translator.translate(
      document.body,
      memory,
      vault,
      FIXTURE_MODE
        ? {
            fallback: (source: string) =>
              source.trim() ? `⟦FF:novel⟧ ${source.trim()}` : null,
          }
        : undefined,
    );

    if (stats.aborted) {
      active = false;
    }

    lastStatus = buildStatus(stats, vault, collected.snapshotId);
    return lastStatus;
  } catch (error) {
    active = false;
    lastStatus = {
      ...lastStatus,
      active: false,
      aborted: true,
      lastError: error instanceof Error ? error.message : String(error),
    };
    return lastStatus;
  } finally {
    if (active && observer) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }
}

function startTranslation(): TranslationStatus {
  if (!translator) translator = new DomTranslator();
  if (!memory) memory = new TranslationMemory(translationUnits);
  active = true;
  actionLanguage = "unknown";
  originalNames = new WeakMap();

  if (!observer) {
    observer = new MutationObserver(() => {
      if (!active) return;
      if (applyTimer) window.clearTimeout(applyTimer);
      applyTimer = window.setTimeout(() => {
        applyTimer = null;
        if (active) applyTranslation();
      }, 80);
    });
  }

  return applyTranslation();
}

function stopTranslation(): TranslationStatus {
  active = false;
  observer?.disconnect();
  observer = null;
  if (applyTimer) window.clearTimeout(applyTimer);
  applyTimer = null;

  try {
    translator?.restore(document.body);
  } finally {
    translator = null;
    actions = new Map();
    actionSnapshot = "";
    actionSignature = "";
    originalNames = new WeakMap();
    actionLanguage = "unknown";
    lastStatus = emptyStatus();
  }

  return lastStatus;
}

function highlightAction(actionId: string, expectedSnapshot: string): { ok: boolean; error?: string } {
  const record = actions.get(actionId);
  if (!record || record.snapshotId !== expectedSnapshot || record.snapshotId !== actionSnapshot) {
    return { ok: false, error: "stale_action" };
  }
  if (!record.enabled || !isVisible(record.element)) {
    return { ok: false, error: "action_unavailable" };
  }

  record.element.scrollIntoView({ block: "center", behavior: "smooth" });
  try {
    record.element.focus({ preventScroll: true });
  } catch {
    // Not all clickable elements are focusable; scrolling is still useful.
  }
  return { ok: true };
}

const windowWithGuard = window as Window & { __zteamLoaded?: boolean };

export default defineContentScript({
  matches: ["https://safinum.cm/*", "http://localhost/*", "http://127.0.0.1/*"],
  runAt: "document_idle",
  main() {
    if (windowWithGuard.__zteamLoaded) return;
    windowWithGuard.__zteamLoaded = true;

    chrome.runtime.onMessage.addListener(
      (
        message: ExtensionMessage,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response: unknown) => void,
      ) => {
        try {
          switch (message.type) {
            case "PING":
              sendResponse({ ok: true });
              break;
            case "START_TRANSLATION":
              sendResponse(startTranslation());
              break;
            case "STOP_TRANSLATION":
              sendResponse(stopTranslation());
              break;
            case "RESCAN":
              sendResponse(applyTranslation());
              break;
            case "GET_STATUS":
              sendResponse(
                lastStatus.active
                  ? { ...lastStatus, url: location.href, title: document.title }
                  : emptyStatus(),
              );
              break;
            case "GET_READBACK":
              sendResponse(readback());
              break;
            case "HIGHLIGHT_ACTION":
              sendResponse(highlightAction(message.actionId, message.snapshotId));
              break;
            default:
              sendResponse({ error: "unknown_message" });
          }
        } catch (error) {
          lastStatus = {
            ...lastStatus,
            active: false,
            aborted: true,
            lastError: error instanceof Error ? error.message : String(error),
          };
          sendResponse({ error: lastStatus.lastError });
        }
        return true;
      },
    );
  },
});
