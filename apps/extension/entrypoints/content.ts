import { languages } from "@zteam/phrasebank";
import type {
  ActionView,
  ExtensionMessage,
  MtRequestOptions,
  MtStatus,
  MtTranslateResponse,
  PageBrief,
  PageCoverage,
  PageKind,
  PageLanguage,
  PanelStep,
  PlaceholderKind,
  ProtectedReason,
  ProtectedValueView,
  Readback,
  TranslationStatus,
} from "@zteam/shared";
import {
  DEFAULT_TARGET_LANG,
  DomTranslator,
  TranslationMemory,
  addPatternValues,
  addVaultValue,
  collectTextNodes,
  isLikelyPersonName,
  normalizeSource,
  unmaskVaultValues,
  type Vault,
  type VaultValue,
} from "@zteam/translator";
import { computeAccessibleName } from "dom-accessibility-api";

interface ActionRecord {
  id: string;
  element: HTMLElement;
  name: string;
  spokenName?: string;
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
let pendingPageAction: ActionView | null = null;
let armedAction: { id: string; snapshotId: string; expiresAt: number } | null = null;
let mtOptions: MtRequestOptions = {
  mode: "off",
  provider: null,
  targetLang: DEFAULT_TARGET_LANG,
};
let mtStatus: MtStatus = { mode: "off", state: "off", done: 0, total: 0 };
let applyChain: Promise<unknown> = Promise.resolve();
let applyGeneration = 0;
type PageBaseline = Array<{ key: string; protectedOnly: boolean }>;
let pageBaselines = new Map<string, PageBaseline>();
let pageBaselineKey = "";
const GUARD_TTL_MS = 20_000;

function emptyStatus(): TranslationStatus {
  return {
    active: false,
    url: location.href,
    title: document.title,
    step: detectStep(),
    language: detectPageLanguage(),
    coverage: 0,
    applied: 0,
    tmApplied: 0,
    mtApplied: 0,
    protectedCount: 0,
    missed: 0,
    translations: 0,
    mt: { mode: "off", state: "off", done: 0, total: 0 },
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

/**
 * Normalizes page text the same way for the baseline and the live scan: NFKC,
 * no currency word, no spaces/NBSP/punctuation, lowercase. This measures
 * whether a visible string actually changed, not how it was rewritten.
 */
function pageKey(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/fcfa/gi, "")
    .replace(/[\s\u00A0\u202F,.'’]+/g, "")
    .trim()
    .toLowerCase();
}

function isVisibleTextNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return false;
  if (parent.closest('[aria-hidden="true"]') || parent.closest("[hidden]")) return false;
  const style = window.getComputedStyle(parent);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function pageCoverageRoot(): HTMLElement {
  return (
    document.querySelector<HTMLElement>("#app .mx-auto.max-w-6xl, main, [role=main]") ??
    document.body
  );
}

function pageTextNodes(): Text[] {
  return collectTextNodes(pageCoverageRoot()).filter((node) => {
    const parent = node.parentElement;
    if (!parent) return false;
    // Page coverage measures the page content, not fixed tool overlays.
    if (parent.closest("aside.fixed")) return false;
    const text = (node.nodeValue ?? "").trim();
    return text.length > 0 && /[A-Za-zÀ-ÿ]/.test(text) && isVisibleTextNode(node);
  });
}

function pageBaselineId(): string {
  return `${detectPageLanguage()}:${detectStep()}`;
}

function capturePageBaseline(vault: Vault, id = pageBaselineId()): void {
  const protectedKeys = new Set(vault.values().map((value) => value.normalized));
  const baseline = pageTextNodes()
    .map((node) => {
      // Shared header/sidebar nodes may already be translated from a previous
      // step. Baseline their source, not their current target.
      const text = (translator?.originalOf(node) ?? node.nodeValue ?? "").trim();
      const key = pageKey(text);
      return key ? { key, protectedOnly: protectedKeys.has(key) } : null;
    })
    .filter((entry): entry is { key: string; protectedOnly: boolean } => entry !== null);
  pageBaselines.set(id, baseline);
  pageBaselineKey = id;
}

function computePageCoverage(): PageCoverage | undefined {
  const baseline = pageBaselines.get(pageBaselineKey) ?? [];
  if (baseline.length === 0) return undefined;

  const current = new Map<string, number>();
  for (const node of pageTextNodes()) {
    const key = pageKey(node.nodeValue ?? "");
    if (!key) continue;
    current.set(key, (current.get(key) ?? 0) + 1);
  }

  let changed = 0;
  let protectedOnly = 0;
  for (const entry of baseline) {
    if (entry.protectedOnly) protectedOnly += 1;
    const count = current.get(entry.key) ?? 0;
    if (count > 0) current.set(entry.key, count - 1);
    else changed += 1;
  }

  const tracked = baseline.length;
  return {
    tracked,
    changed,
    percent: Math.round((changed / tracked) * 100),
    protectedOnly,
    safeCeiling: Math.round(((tracked - protectedOnly) / tracked) * 100),
  };
}

function isInChrome(element: Element): boolean {
  // Normal page asides (account, security) are content. Only fixed overlays
  // are treated as chrome and kept out of the page brief.
  return Boolean(element.closest("header, nav, footer, aside.fixed"));
}

function cleanElementText(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function translatedElementText(
  element: Element,
  requireTranslated: boolean,
): string | undefined {
  const current = cleanElementText(element);
  if (!current) return undefined;
  const source = originalText(element).replace(/\s+/g, " ").trim();
  if (requireTranslated && source && current === source) {
    // A client-side re-render can replace the text node after translation and
    // lose the source mapping. Keep a heading that is visibly Fulfulde.
    if (/[ɓɗŋƴɲƙʼ]/i.test(current)) return current;
    return undefined;
  }
  return current;
}

function pageKind(): PageKind {
  const step = detectStep();
  if (step === 1) return "balance";
  if (step === 2) return "fees";
  if (step === 3) return "beneficiary";
  if (step === 4) return "summary";
  if (step === 5) return "receipt";
  if (document.querySelector('[role="alert"], .alert, .warning')) return "error";
  return "unknown";
}

function buildPageBrief(): PageBrief | undefined {
  const language = detectPageLanguage();
  const requireTranslated = language === "fr" || language === "en";
  const main = document.querySelector<HTMLElement>("main, [role=main]") ?? document.body;
  const mainContent =
    Array.from(main.querySelectorAll<HTMLElement>("section")).find(
      (section) => !section.closest("aside"),
    ) ?? main;

  const titleElement = Array.from(main.querySelectorAll("h1")).find(
    (element) => !isInChrome(element),
  );
  const title = titleElement ? translatedElementText(titleElement, false) : undefined;

  let purpose: string | undefined;
  for (const element of mainContent.querySelectorAll("p")) {
    if (isInChrome(element) || element.closest("aside")) continue;
    const text = translatedElementText(element, requireTranslated);
    if (!text) continue;
    if (text.split(/\s+/).filter(Boolean).length >= 6) {
      purpose = text;
      break;
    }
  }
  if (!purpose) {
    for (const element of mainContent.querySelectorAll("h1, h2")) {
      if (isInChrome(element) || element.closest("aside")) continue;
      const text = translatedElementText(element, requireTranslated);
      if (!text) continue;
      if (text.split(/\s+/).filter(Boolean).length >= 5) {
        purpose = text;
        break;
      }
    }
  }

  const sections: PageBrief["sections"] = [];
  const seenHeadings = new Set<string>();
  if (purpose) seenHeadings.add(purpose);
  for (const section of main.querySelectorAll("section")) {
    if (isInChrome(section)) continue;
    const headingElement = section.querySelector("h2, h3");
    if (!headingElement) continue;
    const heading = translatedElementText(headingElement, requireTranslated);
    if (!heading || seenHeadings.has(heading)) continue;
    let text: string | undefined;
    for (const element of section.querySelectorAll("p, li")) {
      if (isInChrome(element)) continue;
      const candidate = translatedElementText(element, requireTranslated);
      if (
        candidate &&
        candidate !== purpose &&
        candidate.split(/\s+/).filter(Boolean).length >= 4
      ) {
        text = candidate;
        break;
      }
    }
    seenHeadings.add(heading);
    sections.push({ heading, text: text ?? "" });
    if (sections.length >= 3) break;
  }

  // Some pages use a heading outside a <section> (for example a recent
  // transactions block). Keep the translated heading even without a safe
  // paragraph; it still tells the listener what the block is.
  if (sections.length < 3) {
    for (const headingElement of main.querySelectorAll("h2, h3")) {
      if (isInChrome(headingElement)) continue;
      const heading = translatedElementText(headingElement, requireTranslated);
      if (!heading || seenHeadings.has(heading)) continue;
      let text = "";
      const container = headingElement.parentElement;
      if (container) {
        for (const element of container.querySelectorAll("p, li")) {
          // Only text after the heading belongs to that block; this avoids
          // reusing the page purpose sentence for the first section.
          if (
            !(headingElement.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
          ) {
            continue;
          }
          const candidate = translatedElementText(element, requireTranslated);
          if (
            candidate &&
            candidate !== purpose &&
            candidate.split(/\s+/).filter(Boolean).length >= 4
          ) {
            text = candidate;
            break;
          }
        }
      }
      seenHeadings.add(heading);
      sections.push({ heading, text });
      if (sections.length >= 3) break;
    }
  }

  const warnings: string[] = [];
  for (const element of document.querySelectorAll('[role="alert"], .alert, .warning')) {
    if (isInChrome(element)) continue;
    const text = translatedElementText(element, requireTranslated);
    if (text && !warnings.includes(text)) warnings.push(text);
    if (warnings.length >= 2) break;
  }

  const priority = /transfert|frais|continuer|confirmer|valider|envoyer|modifier|réessayer/i;
  const actionCandidates = Array.from(actions.values())
    .filter((record) => !isInChrome(record.element) && record.enabled && isVisible(record.element))
    .map((record) => cleanElementText(record.element) || record.spokenName || record.name)
    .filter((name) => /[A-Za-zÀ-ÿ]{2,}/.test(name) && !/^(?:EN|FR|FF)$/i.test(name));
  const prioritized = actionCandidates.filter((name) => priority.test(name));
  const actionNames = Array.from(new Set([...prioritized, ...actionCandidates])).slice(0, 3);

  if (!title && !purpose && sections.length === 0 && warnings.length === 0) {
    return undefined;
  }

  return {
    kind: pageKind(),
    title,
    purpose,
    sections,
    warnings,
    actions: actionNames,
  };
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
    let spokenName = name;
    try {
      const current = computeAccessibleName(element).trim();
      if (current && current !== name) spokenName = current;
    } catch {
      // Keep the original name when the accessible-name computation fails.
    }
    index += 1;
    next.set(`a_${index}`, {
      id: `a_${index}`,
      element,
      name,
      spokenName,
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

function refreshActionSpokenNames(): void {
  for (const record of actions.values()) {
    try {
      const current = computeAccessibleName(record.element).trim();
      if (current && current !== record.name) record.spokenName = current;
    } catch {
      // Keep the previous name when the accessible-name computation fails.
    }
  }
}

function actionView(record: ActionRecord): ActionView {
  return {
    id: record.id,
    name: record.name,
    spokenName: record.spokenName,
    role: record.role,
    risk: record.risk,
    enabled: record.enabled,
    locked: record.locked,
  };
}

function actionViews(): ActionView[] {
  return Array.from(actions.values()).map((record) => ({
    id: record.id,
    name: record.name,
    spokenName: record.spokenName,
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
    tmApplied: stats.tmApplied,
    mtApplied: stats.mtApplied,
    protectedCount: stats.protectedCount,
    missed: stats.missed,
    translations: memory?.baseSize() ?? 0,
    mt: mtStatus,
    pageBrief: buildPageBrief(),
    pageCoverage: computePageCoverage(),
    sentences: stats.sentences.slice(0, 200),
    protectedValues: protectedViews(vault),
    actions: actionViews(),
    actionSnapshotId: snapshotId,
    pendingPageAction: pendingPageAction ?? undefined,
    aborted: stats.aborted,
    abortReason: stats.abortReason,
  };
}

/**
 * Collects plain translatable strings and asks the background worker for
 * local-API targets. Mixed nodes are never sent: no amount, name, account,
 * phone, reference or user input leaves the page.
 */
async function prepareMt(): Promise<void> {
  if (!translator || !memory || !active) return;

  const mode = mtOptions.mode;
  if (FIXTURE_MODE || mode === "off") {
    mtStatus = { mode, state: "off", done: 0, total: 0 };
    return;
  }

  const language = detectPageLanguage();
  if (language !== "fr" && language !== "en") {
    mtStatus = { mode, state: "off", done: 0, total: 0, error: "unsupported_language" };
    return;
  }

  const vault = buildVault(document.body);
  memory.setRuntimePriority(mode === "primary");
  const plainSources = translator.translatableSources(document.body, memory, vault, {
    includeTm: mode === "primary",
  });
  const mixed = translator.mixedSources(document.body, memory, vault);
  const mixedByMasked = new Map(mixed.map((item) => [item.masked.trim(), item]));
  const sources = [...plainSources, ...mixed.map((item) => item.masked.trim())];

  const previousProvider = mtStatus.provider;
  const previousModel = mtStatus.model;
  if (!sources.length) {
    mtStatus = {
      mode,
      state: "ready",
      done: 0,
      total: 0,
      provider: previousProvider,
      model: previousModel,
    };
    return;
  }

  mtStatus = {
    mode,
    state: "running",
    done: 0,
    total: sources.length,
    provider: previousProvider,
    model: previousModel,
  };
  lastStatus = { ...lastStatus, active: true, mt: mtStatus };

  let response: MtTranslateResponse;
  try {
    response = (await chrome.runtime.sendMessage({
      type: "MT_TRANSLATE",
      texts: sources,
      source: language,
      provider: mtOptions.provider,
      baseUrl: mtOptions.baseUrl,
      targetLang: mtOptions.targetLang,
    })) as MtTranslateResponse;
  } catch (error) {
    if (!active) return;
    mtStatus = {
      mode,
      state: "error",
      done: 0,
      total: sources.length,
      error: error instanceof Error ? error.message : "translation_failed",
    };
    return;
  }

  if (!active) return;

  if (!response?.ok) {
    mtStatus = {
      mode,
      state: response?.error === "api_offline" ? "offline" : "error",
      done: 0,
      total: sources.length,
      error: response?.error ?? "translation_failed",
    };
    return;
  }

  for (const translation of response.translations ?? []) {
    const mixedItem = mixedByMasked.get(translation.source.trim());
    if (mixedItem) {
      const restored = unmaskVaultValues(translation.target, mixedItem.values);
      if (!restored) continue;
      memory.addRuntime(
        mixedItem.source,
        restored,
        translation.provider,
        translation.model,
        mode === "primary",
      );
      continue;
    }
    memory.addRuntime(
      translation.source,
      translation.target,
      translation.provider,
      translation.model,
      mode === "primary",
    );
  }

  mtStatus = {
    mode,
    state: "ready",
    done: sources.length,
    total: sources.length,
    provider: response.provider,
    model: response.model,
    ...(response.error ? { error: response.error } : {}),
  };
}

function applyTranslation(): TranslationStatus {
  if (!translator || !memory) return lastStatus;
  observer?.disconnect();

  try {
    const vault = buildVault(document.body);
    const baselineId = pageBaselineId();
    if (!pageBaselines.has(baselineId)) {
      capturePageBaseline(vault, baselineId);
    } else {
      pageBaselineKey = baselineId;
    }
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
    refreshActionSpokenNames();

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

async function runApply(): Promise<TranslationStatus> {
  if (!active || !translator || !memory) return lastStatus;
  const generation = applyGeneration;
  await prepareMt();
  if (!active || generation !== applyGeneration) return lastStatus;
  return applyTranslation();
}

function scheduleApply(): Promise<TranslationStatus> {
  const next = applyChain.then(() => runApply());
  applyChain = next.catch(() => undefined);
  return next;
}

function targetLangOf(options: MtRequestOptions): string {
  return options.targetLang ?? DEFAULT_TARGET_LANG;
}

function optionsChanged(next: MtRequestOptions): boolean {
  return (
    next.mode !== mtOptions.mode ||
    next.provider !== mtOptions.provider ||
    (next.baseUrl ?? "") !== (mtOptions.baseUrl ?? "") ||
    targetLangOf(next) !== targetLangOf(mtOptions)
  );
}

/** Rebuilds the TM for a language and clears the worker's MT cache. */
function switchLanguage(language: string): TranslationMemory {
  memory = new TranslationMemory(languages[language]?.translationUnits ?? [], language);
  void chrome.runtime.sendMessage({ type: "MT_CLEAR_CACHE" }).catch(() => undefined);
  return memory;
}

function startTranslation(options?: MtRequestOptions): Promise<TranslationStatus> {
  const next = options ?? { mode: "off", provider: null };
  const languageChanged = targetLangOf(next) !== targetLangOf(mtOptions);
  mtOptions = next;
  applyGeneration += 1;
  if (active && translator) translator.restore(document.body);
  if (!translator) translator = new DomTranslator();
  if (!memory || languageChanged) memory = switchLanguage(targetLangOf(mtOptions));
  memory.clearRuntime();
  pageBaselines.clear();
  pageBaselineKey = "";
  capturePageBaseline(buildVault(document.body));
  mtStatus = {
    mode: mtOptions.mode,
    state: mtOptions.mode === "off" ? "off" : "ready",
    done: 0,
    total: 0,
  };
  active = true;
  actionLanguage = "unknown";
  pendingPageAction = null;
  armedAction = null;
  originalNames = new WeakMap();
  lastStatus = { ...emptyStatus(), active: true, mt: mtStatus };

  if (!observer) {
    observer = new MutationObserver(() => {
      if (!active) return;
      if (applyTimer) window.clearTimeout(applyTimer);
      applyTimer = window.setTimeout(() => {
        applyTimer = null;
        if (active) void scheduleApply();
      }, 80);
    });
  }

  return scheduleApply();
}

function rescan(options?: MtRequestOptions): Promise<TranslationStatus> {
  if (!active) return Promise.resolve(lastStatus);
  if (options) {
    const languageChanged = targetLangOf(options) !== targetLangOf(mtOptions);
    if (optionsChanged(options)) {
      applyGeneration += 1;
      translator?.restore(document.body);
      if (languageChanged) memory = switchLanguage(targetLangOf(options));
      else memory?.clearRuntime();
    }
    mtOptions = options;
  }
  return scheduleApply();
}

function stopTranslation(): TranslationStatus {
  active = false;
  applyGeneration += 1;
  observer?.disconnect();
  observer = null;
  if (applyTimer) window.clearTimeout(applyTimer);
  applyTimer = null;

  try {
    translator?.restore(document.body);
  } finally {
    memory?.clearRuntime();
    memory = null;
    translator = null;
    pageBaselines.clear();
    pageBaselineKey = "";
    mtStatus = { mode: mtOptions.mode, state: "off", done: 0, total: 0 };
    actions = new Map();
    actionSnapshot = "";
    actionSignature = "";
    originalNames = new WeakMap();
    actionLanguage = "unknown";
    pendingPageAction = null;
    armedAction = null;
    lastStatus = emptyStatus();
  }

  return lastStatus;
}

function guardPageClick(event: MouseEvent): void {
  if (!active) return;
  const target = event.target as Element | null;
  const element = target?.closest<HTMLElement>(
    'button, a[href], [role="button"], input[type="submit"], input[type="button"]',
  );
  if (!element) return;
  const record = Array.from(actions.values()).find((item) => item.element === element);
  if (!record) return;

  // Low and medium actions keep their native behaviour, but the panel still
  // announces the translated action name so the user knows what was clicked.
  if (record.risk !== "high") {
    try {
      void chrome.runtime.sendMessage({
        type: "PAGE_ACTION_CLICKED",
        actionId: record.id,
        name: record.spokenName ?? record.name,
        risk: record.risk,
      });
    } catch {
      // The side panel may be closed; the click itself is unaffected.
    }
    return;
  }

  if (
    armedAction &&
    armedAction.id === record.id &&
    armedAction.snapshotId === record.snapshotId &&
    Date.now() < armedAction.expiresAt
  ) {
    // Keep the action armed for the TTL: after a validation error the user may
    // legitimately retry the same button without a second announcement.
    pendingPageAction = null;
    lastStatus = { ...lastStatus, pendingPageAction: undefined };
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  pendingPageAction = actionView(record);
  lastStatus = { ...lastStatus, pendingPageAction };
}

function confirmPageAction(
  actionId: string,
  expectedSnapshot: string,
): { ok: boolean; error?: string } {
  const record = actions.get(actionId);
  if (
    !pendingPageAction ||
    pendingPageAction.id !== actionId ||
    !record ||
    record.snapshotId !== expectedSnapshot ||
    record.snapshotId !== actionSnapshot
  ) {
    return { ok: false, error: "stale_action" };
  }
  armedAction = {
    id: actionId,
    snapshotId: expectedSnapshot,
    expiresAt: Date.now() + GUARD_TTL_MS,
  };
  pendingPageAction = null;
  lastStatus = { ...lastStatus, pendingPageAction: undefined };
  return { ok: true };
}

function cancelPageAction(): { ok: boolean } {
  pendingPageAction = null;
  armedAction = null;
  lastStatus = { ...lastStatus, pendingPageAction: undefined };
  return { ok: true };
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
    document.addEventListener("click", guardPageClick, true);

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
              void startTranslation(message.api)
                .then(sendResponse)
                .catch((error: unknown) => {
                  lastStatus = {
                    ...lastStatus,
                    active: false,
                    aborted: true,
                    lastError: error instanceof Error ? error.message : String(error),
                  };
                  sendResponse(lastStatus);
                });
              return true;
            case "STOP_TRANSLATION":
              sendResponse(stopTranslation());
              break;
            case "RESCAN":
              void rescan(message.api)
                .then(sendResponse)
                .catch((error: unknown) => {
                  lastStatus = {
                    ...lastStatus,
                    active: false,
                    aborted: true,
                    lastError: error instanceof Error ? error.message : String(error),
                  };
                  sendResponse(lastStatus);
                });
              return true;
            case "MT_PROGRESS":
              mtStatus = {
                ...mtStatus,
                state: "running",
                done: message.done,
                total: message.total,
              };
              lastStatus = { ...lastStatus, mt: mtStatus };
              sendResponse({ ok: true });
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
            case "CONFIRM_PAGE_ACTION":
              sendResponse(confirmPageAction(message.actionId, message.snapshotId));
              break;
            case "CANCEL_PAGE_ACTION":
              sendResponse(cancelPageAction());
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
