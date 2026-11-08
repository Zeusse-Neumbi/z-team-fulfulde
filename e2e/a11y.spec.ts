import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { launchExtension, openMock, openPanel } from "./extension";

function blockingViolations(results: Awaited<ReturnType<AxeBuilder["analyze"]>>) {
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      id: violation.id,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target),
    }));
}

test("the panel and the page have no serious accessibility violations", async () => {
  const { context, extensionId } = await launchExtension();

  try {
    const page = await openMock(context);
    const panel = await openPanel(context, extensionId);
    await panel.getByRole("button", { name: /Démarrer sur cette page/ }).click();
    await panel.waitForTimeout(800);

    const panelResults = await new AxeBuilder({ page: panel }).analyze();
    expect(
      blockingViolations(panelResults),
      JSON.stringify(blockingViolations(panelResults), null, 2),
    ).toEqual([]);

    const pageResults = await new AxeBuilder({ page }).analyze();
    expect(
      blockingViolations(pageResults),
      JSON.stringify(blockingViolations(pageResults), null, 2),
    ).toEqual([]);

    await expect(panel.locator(".badge")).toHaveAttribute("role", "status");
    await expect(panel.locator(".badge")).toHaveAttribute("aria-live", "polite");

    const target = panel.locator(".actions button.primary");
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  } finally {
    await context.close();
  }
});

test("the main controls work with the keyboard", async () => {
  const { context, extensionId } = await launchExtension();

  try {
    await openMock(context);
    const panel = await openPanel(context, extensionId);

    const start = panel.getByRole("button", { name: /Démarrer sur cette page/ });
    await start.focus();
    await panel.keyboard.press("Enter");
    await expect(panel.locator(".badge")).toHaveText(/Actif/);

    const stop = panel.getByRole("button", { name: /Arrêter/ });
    await stop.focus();
    await panel.keyboard.press("Enter");
    await expect(panel.locator(".badge")).toHaveText(/Inactif/);
  } finally {
    await context.close();
  }
});
