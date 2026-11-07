export async function hasOriginPermission(origin: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [`${origin}/*`] });
}

export async function requestOriginPermission(origin: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [`${origin}/*`] });
}

/**
 * Injects the built runtime content script into a tab.
 *
 * The manifest content script already covers the demo origins. This is the
 * on-demand path for any other site the user explicitly enables.
 */
export async function injectContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content-scripts/content.js"],
  });
}
