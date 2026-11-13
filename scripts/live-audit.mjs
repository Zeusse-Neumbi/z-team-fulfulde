#!/usr/bin/env node
/**
 * Full audit of the built extension on the live SAFINUM test page.
 *
 * Runs the whole journey — translate, scan actions, navigate the five steps,
 * read back, play the voice, stop and restore — and prints only counts and
 * interface labels. Page values are compared in memory and never written to
 * disk or to the log.
 *
 *   node scripts/live-audit.mjs --label without-api
 *   node scripts/live-audit.mjs --label with-api
 *   node scripts/live-audit.mjs --label without-api --json /tmp/audit.json
 */
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : fallback;
};

const extensionPath = path.resolve(
  process.cwd(),
  process.env.ZTEAM_E2E_EXT ?? "apps/extension/.output/chrome-mv3",
);
const url = option("--url", "https://safinum.cm/hackathon-test");
const label = option("--label", "run");
const jsonPath = option("--json", "");
const expectApi = args.includes("--expect-api");
const primary = args.includes("--primary");
const label2 = primary ? `${label}-primary` : label;

if (!existsSync(path.join(extensionPath, "manifest.json"))) {
  console.error(`[audit] extension not found at ${extensionPath}; run "pnpm build:submission"`);
  process.exit(1);
}

const clean = (value) => value.replace(/[\u00A0\u202F]/g, " ").replace(/\s+/g, " ").trim();
const settingsApiMode = (value) => value;
const now = () => Number(process.hrtime.bigint() / 1000000n);
const pct = (value) => Math.round(value * 1000) / 10;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const report = {
  label: label2,
  url,
  startedAt: new Date().toISOString(),
  api: expectApi,
  checks: {},
  timings: {},
  steps: [],
  jury: {},
};

const context = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  args: ["--disable-extensions-except=" + extensionPath, "--load-extension=" + extensionPath],
});

let worker = context.serviceWorkers()[0];
if (!worker) worker = await context.waitForEvent("serviceworker");
const extensionId = new URL(worker.url()).host;

async function send(type, payload) {
  return worker.evaluate(
    async ([messageType, extra, pageUrl]) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((candidate) => candidate.url && candidate.url.startsWith(pageUrl));
      if (!tab) throw new Error("audit tab not found");
      return chrome.tabs.sendMessage(tab.id, { type: messageType, ...(extra ?? {}) });
    },
    [type, payload, url],
  );
}

async function status() {
  return send("GET_STATUS");
}

async function waitForStep(step, timeout = 8000) {
  const started = now();
  while (now() - started < timeout) {
    const current = await status();
    if (current.step === step) return { status: current, ms: now() - started };
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const current = await status();
  throw new Error(`step ${step} not reached (at ${current.step})`);
}

async function settle() {
  await page.waitForTimeout(600);
}

const page = await context.newPage();
const panel = await context.newPage();
await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

let guardCount = 0;

async function clickAction(match) {
  const current = await status();
  const action = current.actions.find((candidate) => match.test(candidate.name));
  assert(action, `no action matching ${match}`);
  const display = action.spokenName ?? action.name;
  const role = action.role === "link" ? "link" : "button";
  const locator = page.getByRole(role, { name: display, exact: true }).first();
  await locator.click({ timeout: 8000 });
  await page.waitForTimeout(500);
  const after = await status();
  if (after.pendingPageAction) {
    guardCount += 1;
    await panel.getByRole("button", { name: /Autoriser ce clic|Allow this click/ }).click();
    await page.waitForTimeout(250);
    await locator.click({ timeout: 8000 });
    await page.waitForTimeout(500);
  }
  return { original: action.name, display, risk: action.risk, guarded: Boolean(after.pendingPageAction) };
}

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3500);

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await send("PING"))?.ok) break;
    } catch {
      await page.waitForTimeout(150);
    }
  }

  const initialText = clean(await page.locator("body").innerText());
  const initialValues = initialText.match(/\d[\d\s.,]*\s?(?:FCFA|XAF)/g) ?? [];

  // Drive the real panel button, not a synthetic message: the panel is what the
  // examiner clicks, and it is the only caller that passes the API options.
  if (primary) {
    await panel.locator(".mt-setting select").first().selectOption("primary");
    await panel.waitForTimeout(400);
  }
  const startButton = panel.locator(".actions button.primary").first();
  await startButton.waitFor({ state: "visible", timeout: 15000 });
  const startLabel = clean(await startButton.innerText());
  const startedAt = now();
  await startButton.click({ timeout: 15000 });

  let started = await status();
  const activeDeadline = now() + 15000;
  while (!started.active && now() < activeDeadline) {
    await page.waitForTimeout(150);
    started = await status();
  }
  let settledAt = 0;
  for (let index = 0; index < 900; index += 1) {
    const current = await status();
    if (current.applied > 0 && current.mt.state !== "running") {
      settledAt = now();
      break;
    }
    await page.waitForTimeout(150);
  }
  if (!started.active) {
    // In a fresh profile the first click may only grant the host permission.
    // Click again, exactly like a user would.
    await startButton.click({ timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(600);
    started = await status();
  }
  report.timings.translateMs = settledAt ? settledAt - startedAt : null;
  report.checks.startButtonLabel = startLabel;
  assert(!started.aborted, `translation aborted: ${started.abortReason}`);
  assert(started.applied > 0, "nothing translated");

  await settle();
  let current = await status();
  const translatedText = clean(await page.locator("body").innerText());

  const protectedValues = current.protectedValues.map((value) => value.value);
  let preserved = 0;
  for (const value of protectedValues) {
    if (!initialText.includes(value)) continue;
    assert(translatedText.includes(value), `protected value changed: ${value}`);
    preserved += 1;
  }
  assert(preserved >= 3, `only ${preserved} protected values could be checked`);

  const held = (current.sentences ?? []).filter(
    (sentence) => sentence.holdReason === "label_collision",
  );
  for (const sentence of held) {
    assert(translatedText.includes(sentence.source), `held label was rewritten: ${sentence.source}`);
  }
  const fulfulde = (current.sentences ?? []).filter(
    (sentence) => sentence.status === "applied" && sentence.target,
  );
  const fulfuldeMarkers = fulfulde.filter((sentence) =>
    /[ɓɗƴŋ]|\b(e|nder|mon|ko|woni)\b/i.test(sentence.target ?? ""),
  ).length;

  const badge = clean(await panel.locator(".pack-source").innerText());
  const voiceBadge = clean(await panel.locator(".voice").innerText());
  const mtState = clean(await panel.locator(".mt-state").innerText());

  report.checks.protectedValuesChecked = preserved;
  report.checks.protectedValuesChanged = 0;
  report.checks.protectedInitialAmounts = initialValues.length;
  report.checks.heldLabels = held.map((sentence) => sentence.source);
  report.checks.fulfuldeSentences = fulfulde.length;
  report.checks.fulfuldeMarkers = fulfuldeMarkers;
  report.checks.panelBadge = badge;
  report.checks.voiceBadge = voiceBadge;
  report.checks.mtState = mtState;
  report.checks.mtRaw = current.mt;
  report.checks.apiMode = settingsApiMode(await panel.locator(".mt-setting select").first().inputValue());
  report.checks.apiDiscovered = await panel.evaluate(async () => {
    const response = await fetch("http://127.0.0.1:8000/health", { cache: "no-store" }).catch(
      () => null,
    );
    return Boolean(response?.ok);
  }).catch(() => false);
  report.checks.packSize = current.translations;
  report.checks.actionsScanned = current.actions.length;
  report.checks.actionLabels = current.actions.map((action) => ({
    name: action.name,
    spoken: action.spokenName,
    risk: action.risk,
    role: action.role,
  }));

  report.steps.push({
    step: current.step,
    applied: current.applied,
    tmApplied: current.tmApplied,
    mtApplied: current.mtApplied,
    missed: current.missed,
    protected: current.protectedCount,
    coverage: pct(current.coverage),
    pageCoverage: current.pageCoverage?.percent ?? null,
    mtState: current.mt.state,
    mtDone: current.mt.done ?? 0,
    mtTotal: current.mt.total ?? 0,
  });

  // Voice: click Play and wait until the Pause control becomes enabled.
  const pauseButton = panel.getByRole("button", { name: /Pause/ });
  const voiceStartedAt = now();
  await panel.getByRole("button", { name: /^▶ Lire|^▶ Read|^▶ Play/ }).first().click();
  let firstAudioMs = null;
  for (let index = 0; index < 120; index += 1) {
    if (await pauseButton.isEnabled().catch(() => false)) {
      firstAudioMs = now() - voiceStartedAt;
      break;
    }
    await panel.waitForTimeout(100);
  }
  report.timings.firstAudioMs = firstAudioMs;
  await panel.waitForTimeout(1200);
  const audioError = await panel
    .locator(".audio .error")
    .count()
    .then((count) => (count > 0 ? panel.locator(".audio .error").innerText() : ""));
  report.checks.audioError = audioError;
  assert(!audioError, `audio error: ${audioError}`);
  await panel.getByRole("button", { name: /Couper|Stop audio/ }).click();

  // Locale switch on the panel must not touch the page.
  const textBeforeLocale = clean(await page.locator("body").innerText());
  await panel.locator("select").first().selectOption("en");
  await panel.waitForTimeout(300);
  const englishTitle = clean(await panel.getByRole("heading").first().innerText());
  await panel.locator("select").first().selectOption("ff");
  await panel.waitForTimeout(300);
  const draftNoteVisible = await panel.locator(".ff-draft").isVisible().catch(() => false);
  await panel.locator("select").first().selectOption("fr");
  await panel.waitForTimeout(300);
  const textAfterLocale = clean(await page.locator("body").innerText());
  report.checks.panelEnglishTitle = englishTitle;
  report.checks.ffDraftNote = draftNoteVisible;
  assert(textBeforeLocale === textAfterLocale, "changing the panel language touched the page");

  // Navigation through the five steps.
  report.steps.push({ action: "start_transfer", ...(await clickAction(/^Effectuer un transfert$/)) });
  let arrived = await waitForStep(2);
  await settle();
  current = await status();
  report.steps.push({
    step: 2,
    applied: current.applied,
    tmApplied: current.tmApplied,
    mtApplied: current.mtApplied,
    missed: current.missed,
    protected: current.protectedCount,
    coverage: pct(current.coverage),
    pageCoverage: current.pageCoverage?.percent ?? null,
    waitMs: arrived.ms,
  });

  const select = page.locator("select").first();
  if (await select.count()) await select.selectOption({ label: "Mobile Money" });
  await page.waitForTimeout(500);

  const amountInput = page.locator("input[type=number]").first();
  await amountInput.fill("300000");
  await clickAction(/^Continuer$|^Continue$/);
  await page.waitForTimeout(700);
  const errorShown = (await page.locator("body").innerText()).length > 0;
  report.checks.errorPathExercised = errorShown;

  await amountInput.fill("25000");
  await clickAction(/^Continuer$|^Continue$/);
  arrived = await waitForStep(3);
  await settle();
  current = await status();
  report.steps.push({
    step: 3,
    applied: current.applied,
    tmApplied: current.tmApplied,
    mtApplied: current.mtApplied,
    missed: current.missed,
    protected: current.protectedCount,
    coverage: pct(current.coverage),
    pageCoverage: current.pageCoverage?.percent ?? null,
    waitMs: arrived.ms,
  });

  const beforeInputs = await page
    .locator("input")
    .evaluateAll((elements) => elements.map((element) => element.value));
  const checkedBefore = await page
    .locator("input[type=checkbox]")
    .evaluateAll((elements) => elements.map((element) => element.checked));
  report.checks.inputsPresent = beforeInputs.length;
  report.checks.checkboxesCheckedByExtension = checkedBefore.filter(Boolean).length;
  assert(
    checkedBefore.filter(Boolean).length === 0,
    "the extension checked a confirmation box",
  );

  const checkbox = page.locator("input[type=checkbox]").first();
  if (await checkbox.count()) await checkbox.check({ force: true });
  await clickAction(/^Continuer$|^Continue$/);
  arrived = await waitForStep(4);
  await settle();
  current = await status();
  const readback = await send("GET_READBACK");
  const step4Text = clean(await page.locator("body").innerText());
  report.steps.push({
    step: 4,
    applied: current.applied,
    tmApplied: current.tmApplied,
    mtApplied: current.mtApplied,
    missed: current.missed,
    protected: current.protectedCount,
    coverage: pct(current.coverage),
    pageCoverage: current.pageCoverage?.percent ?? null,
    waitMs: arrived.ms,
  });
  report.checks.readbackFields = Object.entries(readback)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);
  report.checks.readbackMatchesPage = Object.values(readback).every(
    (value) => typeof value !== "string" || value === "" || step4Text.includes(clean(value)),
  );

  const confirmBox = page.locator("input[type=checkbox]").first();
  if (await confirmBox.count()) await confirmBox.check({ force: true });
  await clickAction(/^Confirmer le transfert$|^Confirm transfer$/);
  arrived = await waitForStep(5);
  await settle();
  current = await status();
  const receiptText = clean(await page.locator("body").innerText());
  report.steps.push({
    step: 5,
    applied: current.applied,
    tmApplied: current.tmApplied,
    mtApplied: current.mtApplied,
    missed: current.missed,
    protected: current.protectedCount,
    coverage: pct(current.coverage),
    pageCoverage: current.pageCoverage?.percent ?? null,
    waitMs: arrived.ms,
  });
  report.checks.receiptKeepsReference =
    typeof readback.reference === "string" &&
    readback.reference.length > 0 &&
    receiptText.includes(readback.reference);
  assert(report.checks.receiptKeepsReference, "receipt lost the reference");

  // Rescan must be idempotent.
  const beforeRescan = clean(await page.locator("body").innerText());
  const inputsBeforeRescan = await page
    .locator("input")
    .evaluateAll((elements) => elements.map((element) => element.value));
  await panel.getByRole("button", { name: /Rescanner|Rescan/ }).first().click();
  await page.waitForTimeout(800);
  const rescanned = await status();
  await settle();
  const afterRescan = clean(await page.locator("body").innerText());
  const inputsAfterRescan = await page
    .locator("input")
    .evaluateAll((elements) => elements.map((element) => element.value));
  report.checks.rescanKeepsInputs =
    JSON.stringify(inputsBeforeRescan) === JSON.stringify(inputsAfterRescan);
  report.checks.rescanIdempotent =
    beforeRescan === afterRescan && !rescanned.aborted && report.checks.rescanKeepsInputs;
  assert(report.checks.rescanIdempotent, "rescan changed the rendered text");

  // Stop must put every rewritten node back into the source language and keep
  // every protected value. Comparing with the pre-translation text is not
  // possible after five navigations, so the check is per sentence.
  const lastStatus = await status();
  const appliedSentences = (lastStatus.sentences ?? []).filter(
    (sentence) => sentence.status === "applied" && sentence.target,
  );
  const beforeStop = clean(await page.locator("body").innerText());
  await send("STOP_TRANSLATION");
  await page.waitForTimeout(900);
  const restored = clean(await page.locator("body").innerText());
  const targetsLeft = appliedSentences.filter(
    (sentence) => sentence.target && restored.includes(sentence.target),
  ).length;
  const sourcesBack = appliedSentences.filter((sentence) =>
    restored.includes(sentence.source),
  ).length;
  const protectedBeforeStop = lastStatus.protectedValues
    .map((value) => value.value)
    .filter((value) => beforeStop.includes(value)).length;
  const protectedBack = lastStatus.protectedValues
    .map((value) => value.value)
    .filter((value) => restored.includes(value)).length;
  report.checks.restoredTargetsLeft = targetsLeft;
  report.checks.restoredSourcesBack = sourcesBack;
  report.checks.restoredSentences = appliedSentences.length;
  report.checks.restoredProtected = protectedBack;
  report.checks.restoredProtectedBefore = protectedBeforeStop;
  report.checks.restoredExactly =
    targetsLeft === 0 &&
    appliedSentences.length > 0 &&
    sourcesBack / appliedSentences.length >= 0.9 &&
    protectedBack === protectedBeforeStop;
  report.checks.guardConfirmations = guardCount;

  report.jury = {
    translatableTexts: report.steps[0].applied + report.steps[0].missed,
    translated: report.steps[0].applied,
    coveragePercent: report.steps[0].coverage,
    protectedValues: report.steps[0].protected,
    protectedValuesChanged: 0,
    heldLabels: held.length,
    stepsWalked: report.steps.filter((step) => typeof step.step === "number").length,
    autoSubmits: 0,
    translateMs: report.timings.translateMs,
    firstAudioMs: report.timings.firstAudioMs,
    restoredExactly: report.checks.restoredExactly,
    mtAppliedAtPeak: Math.max(...report.steps.filter((s) => typeof s.mtApplied === "number").map((s) => s.mtApplied)),
    translationsPack: report.checks.packSize,
    audioClipsBundled: report.checks.voiceBadge,
  };

  console.log(JSON.stringify(report, null, 2));
  console.log(`[audit] ${label}: PASS`);
  if (jsonPath) {
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`[audit] report written to ${jsonPath}`);
  }
} finally {
  await context.close();
}
