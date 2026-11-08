import { existsSync } from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";

export const extensionPath = path.resolve(
  process.cwd(),
  process.env.ZTEAM_E2E_EXT ?? "apps/extension/.output-test/chrome-mv3",
);

export const MOCK_URL = "http://127.0.0.1:4173/journey/";

export interface ExtensionContext {
  context: BrowserContext;
  extensionId: string;
}

export async function launchExtension(): Promise<ExtensionContext> {
  if (!existsSync(path.join(extensionPath, "manifest.json"))) {
    throw new Error(
      `Extension not found at ${extensionPath}. Run "pnpm build:test" before "pnpm e2e".`,
    );
  }

  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) serviceWorker = await context.waitForEvent("serviceworker");
  const extensionId = new URL(serviceWorker.url()).host;

  return { context, extensionId };
}

export async function openMock(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(MOCK_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  return page;
}

export async function openPanel(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.waitForTimeout(400);
  return page;
}

export async function startOnPanel(panel: Page): Promise<void> {
  await panel.getByRole("button", { name: /Démarrer sur cette page|Start on this page/ }).click();
  await panel.waitForTimeout(700);
}
