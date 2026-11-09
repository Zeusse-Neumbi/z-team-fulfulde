import { expect, test } from "@playwright/test";
import { launchExtension, openMock, openPanel, startOnPanel } from "./extension";

test("a high-risk page click is paused, announced and only released after confirmation", async () => {
  const { context, extensionId } = await launchExtension();

  try {
    const page = await openMock(context);
    const panel = await openPanel(context, extensionId);
    await startOnPanel(panel);

    // Reach step 4, where the high-risk confirmation button lives.
    await page.locator("#to-fees").click();
    await page.locator("#continue").click();
    await page.locator("#beneficiary-verified").check();
    await page.locator("#continue").click();
    await expect(panel.locator(".chip").first()).toContainText("Étape 4/5");

    // Cancel: the page must not receive the click.
    await page.locator("#confirm").click();
    await expect(panel.locator(".page-guard")).toBeVisible();
    await panel.getByRole("button", { name: "Annuler" }).click();
    await expect(panel.locator(".page-guard")).toHaveCount(0);
    await expect(page.locator("#error")).toHaveCount(0);

    // Confirm then re-click: the page receives the click.
    await page.locator("#confirm").click();
    await panel.getByRole("button", { name: "Autoriser ce clic" }).click();
    await expect(panel.locator(".notice")).toContainText("Clic autorisé");
    await page.locator("#confirm").click();
    await expect(page.locator("#error")).toContainText("CONFIRM_001");
  } finally {
    await context.close();
  }
});
