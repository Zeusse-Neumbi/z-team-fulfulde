import { expect, test } from "@playwright/test";
import { launchExtension, openMock, openPanel, startOnPanel } from "./extension";

function clean(value: string): string {
  return value.replace(/[\u00A0\u202F]/g, " ").replace(/\s+/g, " ").trim();
}

test("the panel summarises the page instead of reading every sentence", async () => {
  const { context, extensionId } = await launchExtension();

  try {
    await openMock(context);
    const panel = await openPanel(context, extensionId);
    await startOnPanel(panel);

    const summary = panel.locator(".summary");
    await expect(summary).toBeVisible();
    await expect(summary.locator("h2")).toHaveText("Résumé de la page");
    await expect(panel.getByRole("button", { name: "Lire le résumé" })).toBeVisible();

    const plan = clean(await summary.locator(".plan-list").innerText());
    expect(plan.length).toBeGreaterThan(10);
    expect(plan).toContain("Étape 1/5");

    // The summary is a prioritised read, not a copy of the sentence list.
    const sentenceCount = await panel.locator(".sentence-list li").count();
    const planCount = await panel.locator(".plan-list li").count();
    expect(planCount).toBeGreaterThan(0);
    expect(planCount).toBeLessThan(sentenceCount);

    // Values are never part of the spoken plan.
    for (const value of ["175 000 FCFA", "CM 999 8887 7776 55", "12 500 FCFA"]) {
      expect(plan).not.toContain(value);
    }
  } finally {
    await context.close();
  }
});

test("an action is announced and needs a confirmation before it is shown", async () => {
  const { context, extensionId } = await launchExtension();

  try {
    await openMock(context);
    const panel = await openPanel(context, extensionId);
    await startOnPanel(panel);

    await panel.locator("details").nth(2).locator("summary").click();
    const firstAction = panel.locator(".action-list li").first();
    const name = clean(await firstAction.locator(".action-name").innerText());
    expect(name.length).toBeGreaterThan(0);

    await firstAction.getByRole("button", { name: "Vérifier" }).click();
    await expect(firstAction.getByRole("button", { name: "Confirmer" })).toBeVisible();
    await expect(firstAction.getByRole("button", { name: "Annuler" })).toBeVisible();
    await expect(panel.locator(".notice")).toContainText("Action annoncée");

    // Cancel leaves the page untouched.
    await firstAction.getByRole("button", { name: "Annuler" }).click();
    await expect(firstAction.getByRole("button", { name: "Vérifier" })).toBeVisible();

    // Confirm is the only path that reaches the page.
    await firstAction.getByRole("button", { name: "Vérifier" }).click();
    await firstAction.getByRole("button", { name: "Confirmer" }).click();
    await expect(panel.locator(".notice")).toContainText("Action montrée sur la page");
  } finally {
    await context.close();
  }
});
