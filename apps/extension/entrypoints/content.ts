import { translationUnits } from "@zteam/phrasebank";
import type {
  ExtensionMessage,
  PlaceholderKind,
  TranslationStatus,
} from "@zteam/shared";
import {
  ACCOUNT,
  DATE,
  DomTranslator,
  LONG_DIGITS,
  MONEY,
  PHONE,
  REFERENCE,
  TranslationMemory,
  type Vault,
  type VaultValue,
  collectTextNodes,
  normalizeValue,
} from "@zteam/translator";
import { computeAccessibleName } from "dom-accessibility-api";

interface ActionRecord {
  id: string;
  element: HTMLElement;
  name: string;
  risk: "low" | "high";
  snapshotId: string;
}

let translator: DomTranslator | null = null;
let memory: TranslationMemory | null = null;
let observer: MutationObserver | null = null;
let active = false;
let applyTimer: number | null = null;
let actions = new Map<string, ActionRecord>();
let snapshotId = "";

function emptyStatus(): TranslationStatus {
  return {
    active: false,
    url: location.href,
    title: document.title,
    coverage: 0,
    applied: 0,
    protectedCount: 0,
    missed: 0,
    translations: 0,
  };
}

let lastStatus: TranslationStatus = emptyStatus();

function addValue(values: VaultValue[], value: string, kind: PlaceholderKind): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const normalized = normalizeValue(trimmed);
  if (!normalized) return;
  if (values.some((item) => item.normalized === normalized)) return;
  values.push({ value: trimmed, normalized, kind });
}

/**
 * Builds the local vault from the page. Values are kept in memory only.
 * The vault is used both to protect value nodes and to verify mixed strings.
 */
function buildVault(root: HTMLElement): Vault {
  const values: VaultValue[] = [];

  for (const node of collectTextNodes(root)) {
    const text = (node.nodeValue ?? "").trim();
    if (!text) continue;

    if (MONEY.test(text)) addValue(values, text, "amount");
    else if (PHONE.test(text)) addValue(values, text, "phone");
    else if (ACCOUNT.test(text)) addValue(values, text, "account");
    else if (REFERENCE.test(text)) addValue(values, text, "reference");
    else if (DATE.test(text)) addValue(values, text, "date");
    else if (LONG_DIGITS.test(text)) addValue(values, text, "other");

    const greeting = text.match(/^(?:Bonjour|Hello),\s+(.+)$/);
    if (greeting?.[1]) addValue(values, greeting[1], "person");
  }

  root.querySelectorAll("input, textarea").forEach((element) => {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    const value = (input.value ?? "").trim();
    if (!value) return;
    const hint = `${input.name} ${input.id} ${input.getAttribute("aria-label") ?? ""} ${
      input.placeholder ?? ""
    }`.toLowerCase();

    if (/phone|telephone|téléphone/.test(hint)) addValue(values, value, "phone");
    else if (/account|compte/.test(hint)) addValue(values, value, "account");
    else if (/reference|référence/.test(hint)) addValue(values, value, "reference");
    else if (/beneficiar|bénéficiaire|name|nom|holder|titulaire/.test(hint)) {
      addValue(values, value, "person");
    } else addValue(values, value, "user_input");
  });

  return { values: () => values };
}

function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    !element.closest('[aria-hidden="true"]')
  );
}

function collectActions(root: HTMLElement): void {
  snapshotId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  actions = new Map();

  const elements = root.querySelectorAll<HTMLElement>(
    'button, a[href], [role="button"], input[type="submit"], input[type="button"], select, input[type="checkbox"]',
  );

  let index = 0;
  elements.forEach((element) => {
    if (!isVisible(element)) return;
    let name = "";
    try {
      name = computeAccessibleName(element);
    } catch {
      name = "";
    }
    name = (name || element.getAttribute("aria-label") || element.textContent || "").trim();
    if (!name) return;

    index += 1;
    const id = `a_${index}`;
    const risk = /confirmer|confirm|envoyer|send|valider|submit|payer|pay/i.test(name)
      ? "high"
      : "low";
    actions.set(id, { id, element, name, risk, snapshotId });
  });
}

function executeAction(actionId: string, expectedSnapshot: string, confirmed: boolean) {
  const record = actions.get(actionId);
  if (!record || record.snapshotId !== expectedSnapshot || record.snapshotId !== snapshotId) {
    return { ok: false, error: "stale_action" as const };
  }
  if (record.risk === "high" && !confirmed) {
    return { ok: false, error: "confirmation_required" as const };
  }
  if (!isVisible(record.element)) {
    return { ok: false, error: "action_unavailable" as const };
  }
  record.element.scrollIntoView({ block: "center" });
  record.element.click();
  return { ok: true as const };
}

function applyTranslation(): TranslationStatus {
  if (!translator || !memory) return lastStatus;
  if (observer) observer.disconnect();

  const vault = buildVault(document.body);
  const stats = translator.translate(document.body, memory, vault);

  if (observer && active) {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  lastStatus = {
    active: true,
    url: location.href,
    title: document.title,
    coverage: stats.coverage,
    applied: stats.applied,
    protectedCount: stats.protectedCount,
    missed: stats.missed,
    translations: memory.size(),
  };
  return lastStatus;
}

function startTranslation(): TranslationStatus {
  if (!translator) translator = new DomTranslator();
  if (!memory) memory = new TranslationMemory(translationUnits);
  active = true;

  if (!observer) {
    observer = new MutationObserver(() => {
      if (!active) return;
      if (applyTimer) window.clearTimeout(applyTimer);
      applyTimer = window.setTimeout(() => {
        applyTimer = null;
        collectActions(document.body);
        applyTranslation();
      }, 80);
    });
  }
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  collectActions(document.body);
  return applyTranslation();
}

function stopTranslation(): TranslationStatus {
  active = false;
  observer?.disconnect();
  observer = null;
  if (applyTimer) window.clearTimeout(applyTimer);
  applyTimer = null;
  translator?.restore(document.body);
  translator = null;
  lastStatus = emptyStatus();
  return lastStatus;
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
              collectActions(document.body);
              sendResponse(applyTranslation());
              break;
            case "GET_STATUS":
              sendResponse(lastStatus);
              break;
            case "EXECUTE_ACTION":
              sendResponse(
                executeAction(message.actionId, message.snapshotId, message.confirmed),
              );
              break;
            default:
              sendResponse({ error: "unknown_message" });
          }
        } catch (error) {
          lastStatus = { ...lastStatus, lastError: String(error) };
          sendResponse({ error: String(error) });
        }
        return true;
      },
    );
  },
});
