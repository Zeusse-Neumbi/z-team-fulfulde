import { expect, test } from "@playwright/test";
import {
  launchExtension,
  openMock,
  openPanel,
  startOnPanel,
} from "./extension";

function clean(value: string): string {
  return value.replace(/[\u00A0\u202F]/g, " ").replace(/\s+/g, " ").trim();
}

test("full French journey keeps every protected value", async () => {
  const { context, extensionId } = await launchExtension();
  const external: string[] = [];
  context.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("http") && !url.startsWith("http://127.0.0.1")) external.push(url);
  });

  try {
    const page = await openMock(context);
    const panel = await openPanel(context, extensionId);

    await expect(panel.getByRole("heading", { name: "Z-Team Lingua" })).toBeVisible();
    await expect(panel.locator(".page-title")).toContainText("Banque Démo");
    await startOnPanel(panel);

    await expect(panel.locator(".badge")).toHaveText(/Actif/);
    await expect.poll(async () => clean(await panel.locator(".coverage-meter-head strong").innerText())).toBe(
      "100 %",
    );
    await expect(panel.locator(".sentence.missed")).toHaveCount(0);
    await expect(page.locator("body")).toContainText("⟦FUB:tm.");

    let body = clean(await page.locator("body").innerText());
    for (const value of [
      "175 000 FCFA",
      "CM 999 8887 7776 55",
      "Aïssatou Bello",
      "12 500 FCFA",
    ]) {
      expect(body).toContain(value);
    }

    await page.locator("#to-fees").click();
    await expect(panel.locator(".chip").first()).toContainText("Étape 2/5");
    await page.locator("#operation").selectOption("mobile");
    await expect.poll(async () => clean(await page.locator("body").innerText())).toContain(
      "375 FCFA",
    );
    await expect.poll(async () => clean(await page.locator("body").innerText())).toContain(
      "25 375 FCFA",
    );
    await expect.poll(async () => clean(await page.locator("body").innerText())).toContain(
      "149 625 FCFA",
    );
    await expect(panel.locator(".sentence.missed")).toHaveCount(0);

    await page.locator("#continue").click();
    await expect(panel.locator(".chip").first()).toContainText("Étape 3/5");
    await expect(page.locator("#beneficiary")).toHaveValue("Aïssatou Bello");
    await expect(page.locator("#phone")).toHaveValue("+237 6 77 88 99 00");
    await expect(page.locator("#reason")).toHaveValue("Frais de scolarité");
    await expect(page.locator("#beneficiary-verified")).not.toBeChecked();

    await page.locator("#continue").click();
    await expect(page.locator("#error")).toContainText("SECURITY_001");
    await expect(page.locator("#error")).toContainText("FUB:tm.warning.security_verify");

    await page.locator("#beneficiary-verified").check();
    await page.locator("#continue").click();
    await expect(panel.locator(".chip").first()).toContainText("Étape 4/5");
    await expect(page.locator("#summary-confirmed")).not.toBeChecked();
    await expect(page.locator("#new-transfer")).toHaveCount(0);

    await panel.getByRole("button", { name: "Lire le récapitulatif" }).click();
    await expect(panel.locator(".readback-grid")).toBeVisible();
    const readback = clean(await panel.locator(".readback-grid").innerText());
    for (const value of [
      "25 000 FCFA",
      "375 FCFA",
      "25 375 FCFA",
      "Aïssatou Bello",
      "+237 6 77 88 99 00",
      "SAF-2026-TEST01",
      "Mobile Money",
    ]) {
      expect(readback).toContain(value);
    }

    await panel.locator("details").nth(2).locator("summary").click();
    const editAction = panel
      .locator(".action-list li")
      .filter({ hasText: "Modifier" })
      .getByRole("button", { name: "Vérifier" });
    await expect(editAction).toBeVisible();
    await editAction.click();
    const confirmAction = panel
      .locator(".action-list li")
      .filter({ hasText: "Modifier" })
      .getByRole("button", { name: "Confirmer" });
    await expect(confirmAction).toBeVisible();
    await confirmAction.click();
    await expect.poll(async () => page.evaluate(() => document.activeElement?.id)).toBe("edit");
    await expect(panel.locator(".locked-note")).toHaveCount(1);

    await page.locator("#confirm").click();
    await expect(panel.locator(".page-guard")).toBeVisible();
    await expect(panel.locator(".page-guard")).toContainText("Confirmer");
    await panel.getByRole("button", { name: "Autoriser ce clic" }).click();
    await expect(panel.locator(".notice")).toContainText("Clic autorisé");
    await page.locator("#confirm").click();
    await expect(page.locator("#error")).toContainText("CONFIRM_001");
    await expect(page.locator("#error")).toContainText("FUB:tm.error.confirm_required");

    await page.locator("#summary-confirmed").check();
    await page.locator("#confirm").click();
    await expect(panel.locator(".chip").first()).toContainText("Étape 5/5");

    body = clean(await page.locator("body").innerText());
    for (const value of [
      "SAF-2026-TEST01",
      "25 375 FCFA",
      "Aïssatou Bello",
      "Succès",
    ]) {
      expect(body).toContain(value);
    }

    await panel.getByRole("button", { name: /Arrêter/ }).click();
    await expect(panel.locator(".badge")).toHaveText(/Inactif/);
    body = clean(await page.locator("body").innerText());
    expect(body).not.toContain("⟦FUB:tm.");
    expect(body.toLowerCase()).toContain("transfert effectué");
    expect(body).toContain("SAF-2026-TEST01");

    const stored = await panel.evaluate(async () => await chrome.storage.local.get(null));
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain("175");
    expect(serialized).not.toContain("Aïssatou");
    expect(serialized).not.toContain("CM 999");

    expect(external, `unexpected egress: ${external.join(", ")}`).toEqual([]);
  } finally {
    await context.close();
  }
});

test("English page keeps the same protection", async () => {
  const { context, extensionId } = await launchExtension();

  try {
    const page = await openMock(context);
    await page.locator("#lang").click();
    await page.waitForTimeout(300);
    const panel = await openPanel(context, extensionId);
    await startOnPanel(panel);

    await expect(panel.locator(".page-meta")).toContainText("EN");
    await expect.poll(async () => clean(await panel.locator(".coverage-meter-head strong").innerText())).toBe(
      "100 %",
    );
    await expect(panel.locator(".sentence.missed")).toHaveCount(0);

    const body = clean(await page.locator("body").innerText());
    expect(body).toContain("175,000 FCFA");
    expect(body).toContain("CM 999 8887 7776 55");
    expect(body).toContain("Aïssatou Bello");
    expect(body).toContain("⟦FUB:tm.");

    await page.locator("#to-fees").click();
    await expect(panel.locator(".chip").first()).toContainText("Étape 2/5");
    await page.locator("#operation").selectOption("mobile");
    await expect.poll(async () => clean(await page.locator("body").innerText())).toContain(
      "25,375 FCFA",
    );
  } finally {
    await context.close();
  }
});

test("novel content and errors are handled without a reload", async () => {
  const { context, extensionId } = await launchExtension();

  try {
    const page = await openMock(context);
    const panel = await openPanel(context, extensionId);
    await startOnPanel(panel);

    await page.locator("#inject-novel").click();
    await expect(page.locator("#novel")).toContainText("FUB:tm.novel.example", {
      timeout: 1500,
    });

    await page.locator("#inject-unknown").click();
    await expect(page.locator("#novel-unknown")).toContainText(
      "Le service sera indisponible demain",
    );
    await expect(page.locator("#novel-unknown")).toContainText("FUB:novel", {
      timeout: 1500,
    });
    await expect(panel.locator(".sentence.missed")).toHaveCount(0);

    await page.locator("#trigger-error").click();
    await expect(page.locator("#error")).toContainText("AMOUNT_002");
    await expect(page.locator("#error")).toContainText("FUB:tm.error.insufficient");

    await page.locator("#to-fees").click();
    await page.locator("#amount").fill("300000");
    await page.locator("#continue").click();
    await expect(page.locator("#error")).toContainText("AMOUNT_002");
    await expect(page.locator("#error")).toContainText("FUB:tm.error.insufficient");
    await expect(page.locator("#error")).toContainText("Solde insuffisant");
  } finally {
    await context.close();
  }
});
