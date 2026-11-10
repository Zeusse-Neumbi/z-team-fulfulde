import { expect, test } from "@playwright/test";
import { launchExtension, openMock, openPanel, startOnPanel } from "./extension";

test("the panel uses the real local voice and never sends a protected value", async () => {
  const health = await fetch("http://127.0.0.1:8000/health").catch(() => null);
  const body = health ? ((await health.json()) as { ready?: { tts?: boolean } }) : null;
  test.skip(!body?.ready?.tts, "local API with a real TTS backend is not running on :8000");

  const { context, extensionId } = await launchExtension();
  const ttsBodies: string[] = [];

  try {
    const page = await openMock(context);
    const panel = await openPanel(context, extensionId);
    panel.on("request", (request) => {
      if (request.url().endsWith("/tts") && request.method() === "POST") {
        ttsBodies.push(request.postData() ?? "");
      }
    });

    await panel.getByRole("checkbox", { name: /Lire aussi les montants|Read amounts/ }).check();
    await startOnPanel(panel);
    await expect(panel.locator(".voice.ready")).toContainText(/Audio/);

    const speak = panel.getByRole("button", { name: "Lire le résumé" });
    await expect(speak).toBeEnabled();
    await speak.click();

    await expect
      .poll(() => ttsBodies.join(" "), { timeout: 60_000 })
      .toContain("Montant");
    const payload = ttsBodies.join(" ");

    // Compare against the exact value the page displays, including its NBSP.
    await panel.locator("details").nth(1).locator("summary").click();
    const values = await panel.locator(".value-list code").allInnerTexts();
    const amount = values.find((value) => value.includes("FCFA"));
    expect(amount).toBeTruthy();
    expect(payload).toContain((amount ?? "").trim());
    expect(payload).not.toContain("CM 999");
    expect(payload).toContain("Étape");

    // The same real voice announces an action before the user confirms it.
    await panel.getByRole("button", { name: /Couper/ }).click();
    await panel.locator("details").nth(2).locator("summary").click();
    const firstAction = panel.locator(".action-list li").first();
    const name = (await firstAction.locator(".action-name").innerText()).trim();
    const before = ttsBodies.length;
    await firstAction.getByRole("button", { name: "Vérifier" }).click();
    await expect
      .poll(() => ttsBodies.slice(before).join(" "), { timeout: 30_000 })
      .toContain(name.slice(0, Math.min(8, name.length)));
    await expect(firstAction.getByRole("button", { name: "Confirmer" })).toBeVisible();
    await firstAction.getByRole("button", { name: "Annuler" }).click();

    // A direct high-risk page click must be read aloud by the local voice.
    await page.locator("#to-fees").click();
    await page.locator("#continue").click();
    await page.locator("#beneficiary-verified").check();
    await page.locator("#continue").click();
    await expect(panel.locator(".chip").first()).toContainText("Étape 4/5");

    const beforePageClick = ttsBodies.length;
    await page.locator("#confirm").click();
    await expect(panel.locator(".page-guard")).toBeVisible();
    await expect
      .poll(() => ttsBodies.slice(beforePageClick).join(" "), { timeout: 30_000 })
      .toContain("Confirmer");
  } finally {
    await context.close();
  }
});
