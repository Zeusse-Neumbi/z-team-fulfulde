import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const extensionPath = path.resolve(
  process.cwd(),
  process.env.ZTEAM_E2E_EXT ?? "apps/extension/.output-test/chrome-mv3",
);
const liveUrl = process.env.ZTEAM_LIVE_URL ?? "https://safinum.cm/hackathon-test";
const screenshotDir = path.resolve(process.cwd(), "eval/visual");

if (!existsSync(path.join(extensionPath, "manifest.json"))) {
  console.error(`[live] extension not found at ${extensionPath}; run "pnpm build:test" first`);
  process.exit(1);
}

function clean(value) {
  return value.replace(/[\u00A0\u202F]/g, " ").replace(/\s+/g, " ").trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const context = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

let serviceWorker = context.serviceWorkers()[0];
if (!serviceWorker) serviceWorker = await context.waitForEvent("serviceworker");

async function send(type) {
  return serviceWorker.evaluate(async (messageType) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(
      (candidate) => candidate.url && candidate.url.includes("safinum.cm/hackathon-test"),
    );
    if (!tab) throw new Error("live tab not found");
    return chrome.tabs.sendMessage(tab.id, { type: messageType });
  }, type);
}

async function status() {
  return send("GET_STATUS");
}

async function loadLivePage(page) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(liveUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(2000);
      return;
    } catch (error) {
      lastError = error;
      console.error(`[live] load attempt ${attempt} failed: ${String(error).slice(0, 120)}`);
      await page.waitForTimeout(1500);
    }
  }
  throw lastError ?? new Error("live page did not load");
}

async function ping() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await send("PING");
      if (response?.ok) return;
    } catch {
      // The content script may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("content script did not answer PING");
}

async function waitForStep(step, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const current = await status();
    if (current.step === step) return current;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`step ${step} not reached`);
}

const summary = {};

try {
  const page = await context.newPage();
  await loadLivePage(page);
  await ping();

  const initial = clean(await page.locator("body").innerText());
  for (const value of [
    "250 000 FCFA",
    "CM 001 2345 6789 01",
    "Amina Ngo Bell",
    "05 nov. 2026",
  ]) {
    assert(initial.includes(value), `initial protected value missing: ${value}`);
  }

  const started = await send("START_TRANSLATION");
  assert(!started.aborted, `translation aborted: ${started.abortReason}`);
  assert(started.applied > 20, `expected applied > 20, got ${started.applied}`);
  assert(started.missed === 0, `expected no missed node, got ${started.missed}`);
  assert(started.coverage >= 0.9, `coverage too low: ${started.coverage}`);
  assert(started.step === 1, `expected step 1, got ${started.step}`);
  assert(started.language === "fr", `expected FR, got ${started.language}`);

  const home = clean(await page.locator("body").innerText());
  assert(home.includes("FF:tm."), "no fixture translation token on the page");
  for (const value of [
    "250 000 FCFA",
    "CM 001 2345 6789 01",
    "Amina Ngo Bell",
    "05 nov. 2026",
    "Safinum Pay",
  ]) {
    assert(home.includes(value), `home protected value missing: ${value}`);
  }
  summary.home = {
    applied: started.applied,
    protected: started.protectedCount,
    missed: started.missed,
    coverage: started.coverage,
    step: started.step,
    language: started.language,
  };
  await page.screenshot({ path: path.join(screenshotDir, "live-home.png"), fullPage: true });

  await page.getByRole("button", { name: /FF:tm.balance.start_transfer/ }).click();
  let current = await waitForStep(2);
  assert(current.coverage >= 0.9, `fees coverage too low: ${current.coverage}`);
  await page.locator("select").selectOption({ label: "Mobile Money" });
  await page.waitForTimeout(900);
  current = await status();
  const fees = clean(await page.locator("body").innerText());
  for (const value of ["375 FCFA", "25 375 FCFA", "224 625 FCFA", "Mobile Money"]) {
    assert(fees.includes(value), `fee value missing: ${value}`);
  }
  assert(fees.includes("FF:tm.fees.percent_desc"), "fee description pattern not applied");
  summary.fees = {
    applied: current.applied,
    protected: current.protectedCount,
    missed: current.missed,
    coverage: current.coverage,
    step: current.step,
  };
  await page.screenshot({ path: path.join(screenshotDir, "live-fees.png"), fullPage: true });

  await page.locator("input[type=number]").fill("300000");
  await page.getByRole("button", { name: /FF:tm.action.continue/ }).click();
  await page.waitForTimeout(900);
  const errorText = clean(await page.locator("body").innerText());
  assert(errorText.includes("AMOUNT_002"), "error code AMOUNT_002 missing");
  assert(errorText.includes("FF:tm.error.insufficient"), "error message was not translated");
  await page.screenshot({ path: path.join(screenshotDir, "live-error.png"), fullPage: true });

  await page.locator("input[type=number]").fill("25000");
  await page.getByRole("button", { name: /FF:tm.action.continue/ }).click();
  current = await waitForStep(3);
  const inputs = await page
    .locator("input")
    .evaluateAll((elements) =>
      elements.map((element) => ({ type: element.type, value: element.value, checked: element.checked })),
    );
  assert(
    inputs.some((input) => input.value === "Jean-Paul Mbarga"),
    "beneficiary input changed",
  );
  assert(
    inputs.some((input) => input.value === "+237 6 99 12 34 56"),
    "phone input changed",
  );
  assert(
    inputs.filter((input) => input.type === "checkbox").every((input) => !input.checked),
    "the extension checked a confirmation box",
  );
  assert(current.step === 3, `expected step 3, got ${current.step}`);
  summary.beneficiary = { step: current.step, applied: current.applied, missed: current.missed };
  await page.screenshot({
    path: path.join(screenshotDir, "live-beneficiary.png"),
    fullPage: true,
  });

  await page.locator("input[type=checkbox]").check();
  await page.getByRole("button", { name: /FF:tm.action.continue/ }).click();
  current = await waitForStep(4);
  const readback = await send("GET_READBACK");
  for (const key of ["amount", "fee", "total", "beneficiary", "phone", "reference", "operation"]) {
    assert(readback[key], `readback missing ${key}`);
  }
  assert(clean(readback.amount) === "25 000 FCFA", `amount changed: ${readback.amount}`);
  assert(clean(readback.fee) === "375 FCFA", `fee changed: ${readback.fee}`);
  assert(clean(readback.total) === "25 375 FCFA", `total changed: ${readback.total}`);
  assert(readback.beneficiary === "Jean-Paul Mbarga", "beneficiary changed");
  assert(readback.phone === "+237 6 99 12 34 56", "phone changed");
  assert(/^SAF-2026-[A-Z0-9]{6}$/.test(readback.reference), "reference format changed");
  const summaryBody = clean(await page.locator("body").innerText());
  assert(summaryBody.includes(readback.reference), "reference not displayed verbatim");
  assert(summaryBody.includes("FF:tm.summary.confirm"), "confirm action not translated");
  summary.summary = { step: current.step, readback, applied: current.applied, missed: current.missed };
  await page.screenshot({ path: path.join(screenshotDir, "live-summary.png"), fullPage: true });

  await page.locator("input[type=checkbox]").check();
  await page.getByRole("button", { name: /FF:tm.summary.confirm/ }).click();
  current = await waitForStep(5);
  const receipt = clean(await page.locator("body").innerText());
  assert(receipt.includes(readback.reference), "receipt reference changed");
  assert(receipt.includes("25 375 FCFA"), "receipt total changed");
  assert(receipt.includes("Succès"), "receipt status missing");
  summary.receipt = { step: current.step, applied: current.applied, missed: current.missed };
  await page.screenshot({ path: path.join(screenshotDir, "live-receipt.png"), fullPage: true });

  await send("STOP_TRANSLATION");
  await page.waitForTimeout(400);
  const restored = clean(await page.locator("body").innerText());
  assert(!restored.includes("FF:"), "translation tokens remain after Stop");
  assert(restored.toLowerCase().includes("transfert effectué"), "page was not restored");
  assert(restored.includes(readback.reference), "reference lost after Stop");
  summary.restore = true;

  console.log("[live] PASS");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await context.close();
}
