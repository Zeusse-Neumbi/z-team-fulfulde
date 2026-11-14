import { expect, test } from "@playwright/test";
import { launchExtension, openMock, openPanel, startOnPanel } from "./extension";

function clean(value: string): string {
  return value.replace(/[\u00A0\u202F]/g, " ").replace(/\s+/g, " ").trim();
}

test("the panel switches to Fulfulde without touching the translated page", async () => {
  const { context, extensionId } = await launchExtension();
  try {
    const page = await openMock(context);
    const panel = await openPanel(context, extensionId);
    await startOnPanel(panel);

    const before = clean(await page.locator("body").innerText());
    await expect(panel.locator(".page-coverage")).toBeVisible();
    const plan = clean(await panel.locator(".plan-list").innerText());
    expect(plan).toContain("Étape 1/5");
    expect(plan).not.toContain("Retour au hackathon");

    await panel.locator(".lang-switch select").selectOption("ff");
    await expect(panel.locator(".summary h2")).toHaveText("Ɗuɓɓere hello");
    await expect(panel.locator(".pack-source")).toHaveClass(/fixture|draft/);

    const after = clean(await page.locator("body").innerText());
    expect(after).toBe(before);

    await panel.locator(".lang-switch select").selectOption("fr");
    await expect(panel.locator(".summary h2")).toHaveText("Résumé de la page");
  } finally {
    await context.close();
  }
});

test("the panel switches the target language and the page follows", async () => {
  const { context, extensionId } = await launchExtension();
  try {
    const page = await openMock(context);
    const panel = await openPanel(context, extensionId);
    await startOnPanel(panel);

    await expect(page.locator("body")).toContainText("⟦FUB:tm.");
    await panel.locator(".target-switch select").selectOption("ybb");
    await expect(page.locator("body")).toContainText("⟦YBB:tm.", { timeout: 10_000 });
    await expect(panel.locator(".page-coverage")).toBeVisible();
    // No Yemba clips are bundled and no API is running in this test. The
    // Fulfulde clips must not be offered under the Yemba label.
    await expect(panel.locator(".audio-actions button").first()).toBeDisabled();
    await expect(panel.locator(".voice")).toContainText(/API/i);
    await expect(panel.locator(".voice")).not.toContainText("clips inclus");
  } finally {
    await context.close();
  }
});

test("a page action is announced with its translated name", async () => {
  const { context, extensionId } = await launchExtension();
  try {
    const page = await openMock(context);
    const panel = await openPanel(context, extensionId);
    await startOnPanel(panel);

    await page.locator("#to-fees").click();
    const announcement = panel.locator(".notice").filter({ hasText: /Vous avez cliqué/ });
    await expect(announcement).toBeVisible({ timeout: 5_000 });
    await expect(announcement).toContainText("⟦FUB:tm.balance.start_transfer⟧");
  } finally {
    await context.close();
  }
});
