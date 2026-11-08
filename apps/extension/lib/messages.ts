import type { ExtensionMessage } from "@zteam/shared";

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

export function isWebTab(url: string | undefined): boolean {
  return Boolean(url && /^https?:\/\//i.test(url));
}

export function isRestrictedTab(url: string | undefined): boolean {
  if (!url) return true;
  return /^(?:chrome|edge|about|devtools|chrome-extension|view-source):/i.test(url);
}

/**
 * In a real side panel the active tab is the page. In the Playwright harness the
 * panel is opened as a tab, so the active tab is the panel itself; fall back to
 * the most recently used web tab in the same window.
 */
export async function getTargetTab(): Promise<chrome.tabs.Tab | null> {
  const active = await getActiveTab();
  if (isWebTab(active?.url)) return active;

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const webTabs = tabs
    .filter((tab) => isWebTab(tab.url))
    .sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0));

  return webTabs[0] ?? active ?? null;
}

export async function sendToTab<T>(tabId: number, message: ExtensionMessage): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message) as Promise<T>;
}

export function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
