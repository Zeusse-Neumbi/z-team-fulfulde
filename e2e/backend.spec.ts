import { expect, test } from "@playwright/test";
import { launchExtension, openMock, openPanel, startOnPanel } from "./extension";

test("the panel uses the real local voice and never sends a protected value", async () => {
  const health = await fetch("http://127.0.0.1:8000/health").catch(() => null);
  const body = health ? ((await health.json()) as { ready?: { tts?: boolean } }) : null;
  test.skip(!body?.ready?.tts, "local API with a real TTS backend is not running on :8000");

  const { context, extensionId } = await launchExtension();
  const ttsBodies: string[] = [];

  try {
    await openMock(context);
    const panel = await openPanel(context, extensionId);
    panel.on("request", (request) => {
      if (request.url().endsWith("/tts") && request.method() === "POST") {
        ttsBodies.push(request.postData() ?? "");
      }
    });

    await startOnPanel(panel);
    await expect(panel.locator(".voice.ready")).toContainText(/Audio/);

    const speak = panel.getByRole("button", { name: "Lire le résumé" });
    await expect(speak).toBeEnabled();
    await speak.click();

    await expect.poll(() => ttsBodies.length, { timeout: 60_000 }).toBeGreaterThan(0);
    const payload = ttsBodies.join(" ");
    for (const value of ["175 000 FCFA", "CM 999 8887 7776 55", "12 500 FCFA"]) {
      expect(payload).not.toContain(value);
    }
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
  } finally {
    await context.close();
  }
});
