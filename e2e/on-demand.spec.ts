import { expect, test } from "@playwright/test";
import { launchExtension, ON_DEMAND_URL, openMock, openPanel } from "./extension";

test("the panel injects the runtime on demand outside the manifest matches", async () => {
  const { context, extensionId } = await launchExtension();

  try {
    const page = await openMock(context, ON_DEMAND_URL);
    await expect(page.getByText("Solde disponible").first()).toBeVisible();

    const panel = await openPanel(context, extensionId);
    await expect(panel.locator(".page-title")).toContainText("Banque Démo");

    await panel.getByRole("button", { name: /Démarrer sur cette page/ }).click();
    await expect(panel.locator(".badge")).toHaveText(/Actif/);
    await expect(page.locator("body")).toContainText("⟦FUB:");
    await expect(panel.locator(".coverage-meter-head strong")).toHaveText("100 %");

    await panel.getByRole("button", { name: /Arrêter/ }).click();
    await expect(page.locator("body")).not.toContainText("⟦FUB:");
  } finally {
    await context.close();
  }
});
