import type { ExtensionMessage, MtTranslateResponse } from "@zteam/shared";
import { clearMtCache, translateTexts } from "../lib/mt";

export default defineBackground(() => {
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Older Chromium builds may not expose the side panel behavior API.
  });

  chrome.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: MtTranslateResponse) => void,
    ) => {
      if (message.type === "MT_CLEAR_CACHE") {
        clearMtCache();
        sendResponse({ ok: true });
        return false;
      }
      if (message.type !== "MT_TRANSLATE") return;

      const source = message.source === "en" ? "en" : message.source === "fr" ? "fr" : null;
      if (!source || !Array.isArray(message.texts)) {
        sendResponse({ ok: false, error: "invalid_request" });
        return false;
      }

      const tabId = sender.tab?.id;
      void translateTexts({
        texts: message.texts,
        source,
        targetLang: typeof message.targetLang === "string" ? message.targetLang : undefined,
        baseUrl: typeof message.baseUrl === "string" ? message.baseUrl : null,
        provider: typeof message.provider === "string" ? message.provider : null,
        onProgress: tabId
          ? (done, total) => {
              void chrome.tabs
                .sendMessage(tabId, { type: "MT_PROGRESS", done, total })
                .catch(() => undefined);
            }
          : undefined,
      })
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "translation_failed",
          });
        });

      // Keep the message channel open for the async API batch.
      return true;
    },
  );
});
