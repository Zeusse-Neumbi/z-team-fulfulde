export default defineBackground(() => {
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Older Chromium builds may not expose the side panel behavior API.
  });
});
