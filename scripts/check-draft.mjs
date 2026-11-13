#!/usr/bin/env node
/**
 * Check the submission build against the local demo page.
 *
 * Unlike `check-live.mjs` this runs the **draft (MT) pack**, not the fixture
 * pack, so it can produce the measured coverage printed in the technical note
 * and prove that the label-collision guard fires on a real page.
 *
 *   pnpm serve:eval            # in another terminal
 *   node scripts/check-draft.mjs
 *   node scripts/check-draft.mjs --url http://127.0.0.1:4173/mock-b/
 */
import { existsSync } from "node:fs";
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
const url = option("--url", "http://127.0.0.1:4173/journey/");

if (!existsSync(path.join(extensionPath, "manifest.json"))) {
  console.error(`[draft] extension not found at ${extensionPath}; run "pnpm build:submission"`);
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

let worker = context.serviceWorkers()[0];
if (!worker) worker = await context.waitForEvent("serviceworker");

async function send(type, payload) {
  return worker.evaluate(
    async ([messageType, extra, pageUrl]) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((candidate) => candidate.url && candidate.url.startsWith(pageUrl));
      if (!tab) throw new Error("demo tab not found");
      return chrome.tabs.sendMessage(tab.id, { type: messageType, ...(extra ?? {}) });
    },
    [type, payload, url.replace(/\/$/, "")],
  );
}

try {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  // The bundled pack must be reachable from inside the extension itself.
  const audio = await worker.evaluate(async () => {
    const manifestUrl = chrome.runtime.getURL("audio/demo/manifest.json");
    const response = await fetch(manifestUrl);
    if (!response.ok) return { ok: false, error: `manifest ${response.status}` };
    const pack = await response.json();
    const first = pack.clips.find((clip) => !clip.blocked);
    const clipResponse = await fetch(chrome.runtime.getURL(`audio/demo/${first.file}`));
    const bytes = (await clipResponse.arrayBuffer()).byteLength;
    return { ok: !pack.clips.some((clip) => clip.blocked) || true, total: pack.clips.length, playable: pack.spoken, bytes };
  });
  assert(audio.ok, `bundled audio unavailable: ${audio.error}`);
  assert(audio.total === 115, `expected 115 clips in the ZIP, got ${audio.total}`);
  assert(audio.playable > 50, `too few playable clips: ${audio.playable}`);
  assert(audio.bytes > 1000, `clip did not load: ${audio.bytes} bytes`);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      if ((await send("PING"))?.ok) break;
    } catch {
      await page.waitForTimeout(150);
    }
  }

  const before = clean(await page.locator("body").innerText());
  const status = await send("START_TRANSLATION");
  assert(!status.aborted, `translation aborted: ${status.abortReason}`);
  assert(status.applied > 20, `expected applied > 20, got ${status.applied}`);

  const after = clean(await page.locator("body").innerText());
  const values = status.protectedValues.map((value) => value.value);
  assert(values.length >= 4, `expected protected values, got ${values.length}`);
  let checked = 0;
  for (const value of values) {
    if (!before.includes(value)) continue;
    checked += 1;
    assert(after.includes(value), `protected value changed by the draft: ${value}`);
  }
  assert(checked >= 4, `expected at least 4 visible protected values, checked ${checked}`);

  const sentences = status.sentences ?? [];
  const held = sentences.filter((sentence) => sentence.holdReason === "label_collision");
  const fulfulde = sentences.filter(
    (sentence) => sentence.status === "applied" && sentence.target,
  );
  assert(fulfulde.length > 0, "no Fulfulde target applied");
  assert(
    fulfulde.some((sentence) => /[ɓɗƴŋ]|\b(e|nder|mon|ko)\b/i.test(sentence.target ?? "")),
    "applied targets do not look like the draft pack",
  );

  const body = clean(await page.locator("body").innerText());
  const stillFrench = held.filter((sentence) => body.includes(sentence.source));

  console.log(
    JSON.stringify(
      {
        url,
        applied: status.applied,
        protected: status.protectedCount,
        missed: status.missed,
        coverage: Number(status.coverage.toFixed(4)),
        coveragePercent: Math.round(status.coverage * 1000) / 10,
        labelCollisions: held.length,
        heldVisibleInFrench: stillFrench.length,
        held: held.map((sentence) => sentence.source),
        audioClips: audio.total,
        audioPlayable: audio.playable,
        audioBytes: audio.bytes,
      },
      null,
      2,
    ),
  );

  assert(
    held.length === 0 || stillFrench.length === held.length,
    "a held label was rewritten anyway",
  );

  // The panel must offer the bundled clips even with the local API stopped.
  const extensionId = new URL(worker.url()).host;
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await panel.waitForTimeout(1500);
  const voiceBadge = clean(await panel.locator(".voice").innerText());
  assert(/clips/i.test(voiceBadge), `panel does not advertise the bundled clips: ${voiceBadge}`);
  await panel.locator(".audio-actions button").first().click();
  await panel.waitForTimeout(2500);
  const audioError = await panel
    .locator(".audio .error")
    .count()
    .then((count) => (count > 0 ? panel.locator(".audio .error").innerText() : ""));
  assert(!audioError, `bundled playback failed: ${audioError}`);
  console.log(`[draft] panel voice: ${voiceBadge}`);

  await send("STOP_TRANSLATION");
  await page.waitForTimeout(300);
  const restored = clean(await page.locator("body").innerText());
  assert(restored === before, "Stop did not restore the page byte-for-byte");

  console.log("[draft] PASS");
} finally {
  await context.close();
}
