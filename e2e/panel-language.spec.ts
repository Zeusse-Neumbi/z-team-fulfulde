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
    await expect(panel.getByText(/brouillon MT/).first()).toBeVisible();

    const after = clean(await page.locator("body").innerText());
    expect(after).toBe(before);

    await panel.locator(".lang-switch select").selectOption("fr");
    await expect(panel.locator(".summary h2")).toHaveText("Résumé de la page");
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
    await expect(announcement).toContainText("⟦FF:tm.balance.start_transfer⟧");
  } finally {
    await context.close();
  }
});
