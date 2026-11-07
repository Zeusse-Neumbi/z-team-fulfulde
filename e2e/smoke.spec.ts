import { expect, test, chromium } from "@playwright/test";
import path from "node:path";

const extensionPath = path.join(process.cwd(), "apps/extension/.output/chrome-mv3");

test("the extension loads and the side panel renders", async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) serviceWorker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(serviceWorker.url()).host;

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await expect(page.getByRole("heading", { name: "Fulfulde assistant" })).toBeVisible();
  await expect(page.getByText("Rien — traitement local")).toBeVisible();

  await context.close();
});
