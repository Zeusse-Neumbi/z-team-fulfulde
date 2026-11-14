import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const extensionPath = path.resolve(
  process.cwd(),
  process.env.ZTEAM_E2E_EXT ?? "apps/extension/.output-test/chrome-mv3",
);
const outDir = path.resolve(process.cwd(), "eval/latency");
const outFile = path.join(outDir, "generalization.csv");

const SITES = [
  ["Example Domain", "https://example.com/"],
  ["IANA example domains", "https://www.iana.org/help/example-domains"],
  ["IANA reserved domains", "https://www.iana.org/domains/reserved"],
  ["Wikipedia EN — Fulfulde", "https://en.wikipedia.org/wiki/Fulfulde_language"],
  ["Wikipedia FR — Peul", "https://fr.wikipedia.org/wiki/Peul"],
  ["Wikipedia EN — Cameroon", "https://en.wikipedia.org/wiki/Cameroon"],
  ["Wikipedia FR — Cameroun", "https://fr.wikipedia.org/wiki/Cameroun"],
  ["Wikipedia EN — Fula people", "https://en.wikipedia.org/wiki/Fula_people"],
  ["Wikipedia FR — Peuls", "https://fr.wikipedia.org/wiki/Peuls"],
  ["MDN EN — Document", "https://developer.mozilla.org/en-US/docs/Web/API/Document"],
  ["MDN FR — Document", "https://developer.mozilla.org/fr/docs/Web/API/Document"],
  ["Python", "https://www.python.org/"],
  ["Python docs — asyncio", "https://docs.python.org/3/library/asyncio.html"],
  ["Python tutorial", "https://docs.python.org/3/tutorial/index.html"],
  ["Python about", "https://www.python.org/about/"],
  ["Node.js", "https://nodejs.org/en"],
  ["Node.js about", "https://nodejs.org/en/about"],
  ["W3C WAI", "https://www.w3.org/WAI/"],
  ["W3C WAI tips", "https://www.w3.org/WAI/tips/"],
  ["Debian", "https://www.debian.org/"],
  ["Debian documentation", "https://www.debian.org/doc/"],
  ["Mozilla", "https://www.mozilla.org/en-US/"],
  ["Mozilla Firefox", "https://www.mozilla.org/en-US/firefox/"],
  ["Hacker News", "https://news.ycombinator.com/"],
  ["Hacker News newest", "https://news.ycombinator.com/newest"],
  ["Stack Overflow", "https://stackoverflow.com/"],
  ["Stack Overflow questions", "https://stackoverflow.com/questions"],
  ["Project Gutenberg", "https://www.gutenberg.org/"],
  ["Project Gutenberg ebooks", "https://www.gutenberg.org/ebooks/"],
  ["RFC Editor", "https://www.rfc-editor.org/"],
];

const CANARY_VALUES = [
  "25 000 FCFA",
  "CM 001 2345 6789 01",
  "+237 6 77 88 99 00",
  "SAF-2026-AB12CD",
  "05 nov. 2026",
  "Amina Ngo Bell",
];
const CANARY_INPUT = "Paiement de services";
const CANARY_EDIT = "Note libre";

if (!existsSync(path.join(extensionPath, "manifest.json"))) {
  console.error(`[sites] extension not found at ${extensionPath}; run "pnpm build:test" first`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(path.join(extensionPath, "manifest.json"), "utf8"));
if (!manifest.host_permissions?.includes("<all_urls>")) {
  console.error("[sites] this harness needs the broad-host fixture build; run pnpm build:test");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    }),
  ]);
}

function clean(value) {
  return value.replace(/[\u00A0\u202F]/g, " ").replace(/\s+/g, " ").trim();
}

function csvEscape(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

const context = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  locale: "en-US",
  viewport: { width: 1280, height: 800 },
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36",
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

let serviceWorker = context.serviceWorkers()[0];
if (!serviceWorker) serviceWorker = await context.waitForEvent("serviceworker");

async function tabIdFor(url) {
  return serviceWorker.evaluate(async (targetUrl) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find(
      (tab) => tab.url === targetUrl || tab.url?.startsWith(`${targetUrl}#`),
    )?.id;
  }, url);
}

async function inject(tabId) {
  await serviceWorker.evaluate(async (targetTabId) => {
    await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      files: ["content-scripts/content.js"],
    });
  }, tabId);
}

async function send(tabId, type) {
  return serviceWorker.evaluate(
    async ({ targetTabId, messageType }) =>
      chrome.tabs.sendMessage(targetTabId, { type: messageType }),
    { targetTabId: tabId, messageType: type },
  );
}

async function ping(tabId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await send(tabId, "PING");
      if (response?.ok) return;
    } catch {
      // The content script may still be starting.
    }
    await sleep(100);
  }
  throw new Error("content script did not answer PING");
}

async function addCanary(page) {
  await page.evaluate(
    ({ values, inputValue, editValue }) => {
      document.getElementById("zteam-canary")?.remove();

      const section = document.createElement("section");
      section.id = "zteam-canary";
      section.style.cssText =
        "display:block;position:relative;z-index:2147483647;margin:12px;padding:12px;" +
        "background:#fff;color:#111;border:3px solid #111;font:14px/1.4 sans-serif;";

      const dl = document.createElement("dl");
      for (const [label, value] of values) {
        const row = document.createElement("div");
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = value;
        row.append(dt, dd);
        dl.append(row);
      }

      const label = document.createElement("label");
      label.textContent = "Motif ";
      const input = document.createElement("input");
      input.id = "zteam-canary-input";
      input.value = inputValue;
      label.append(input);

      const editable = document.createElement("div");
      editable.id = "zteam-canary-edit";
      editable.contentEditable = "true";
      editable.textContent = editValue;

      section.append(dl, label, editable);
      document.body.append(section);
    },
    {
      values: [
        ["Total", CANARY_VALUES[0]],
        ["Compte", CANARY_VALUES[1]],
        ["Téléphone", CANARY_VALUES[2]],
        ["Référence", CANARY_VALUES[3]],
        ["Date", CANARY_VALUES[4]],
        ["Nom", CANARY_VALUES[5]],
      ],
      inputValue: CANARY_INPUT,
      editValue: CANARY_EDIT,
    },
  );
}

async function canaryState(page) {
  return page.evaluate(() => {
    const canary = document.getElementById("zteam-canary");
    const input = document.getElementById("zteam-canary-input");
    const editable = document.getElementById("zteam-canary-edit");
    const text = canary?.textContent ?? "";
    return {
      text,
      input: input?.value ?? "",
      edit: editable?.textContent ?? "",
      canaryHasToken: /⟦[A-Z]{3}:/.test(text),
      bodyHasToken: /⟦[A-Z]{3}:/.test(document.body.textContent ?? ""),
    };
  });
}

const rows = [];
let dynamicChecked = false;
const filter = process.env.ZTEAM_SITES_FILTER;
const sitesToRun = filter
  ? SITES.filter(([site, url]) => new RegExp(filter, "i").test(`${site} ${url}`))
  : SITES;

for (const [site, url] of sitesToRun) {
  const startedAt = Date.now();
  let page = null;
  let loaded = false;
  let tabId = null;

  try {
    page = await context.newPage();
    await timeout(
      page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 }),
      35_000,
      "page load",
    );
    await page.waitForSelector("body", { timeout: 5_000 });
    await page.waitForTimeout(800);
    loaded = true;

    await addCanary(page);
    const before = await canaryState(page);

    tabId = await tabIdFor(page.url());
    if (!tabId) throw new Error("tab not found");

    await timeout(inject(tabId), 15_000, "inject");
    await timeout(ping(tabId), 5_000, "ping");

    const status = await timeout(send(tabId, "START_TRANSLATION"), 15_000, "start");
    await page.waitForTimeout(150);
    const after = await canaryState(page);

    const dynamicPage = !dynamicChecked;
    let dynamic = true;
    let dynamicSource = true;
    if (dynamicPage) {
      dynamicChecked = true;
      await page.evaluate(() => {
        document.getElementById("zteam-dynamic")?.remove();
        const paragraph = document.createElement("p");
        paragraph.id = "zteam-dynamic";
        paragraph.textContent = "Nouveau message important";
        document.body.append(paragraph);
      });
      await page.waitForTimeout(1500);
      const dynamicText = await page.evaluate(
        () => document.getElementById("zteam-dynamic")?.textContent ?? "",
      );
      dynamic = /⟦[A-Z]{3}:/.test(dynamicText);
    }

    const stopStatus = await timeout(send(tabId, "STOP_TRANSLATION"), 10_000, "stop");
    await page.waitForTimeout(150);
    let restored = await canaryState(page);
    // Client-rendered pages (React, Vue) may repaint just after Stop. Give the
    // page a second chance before treating a text mismatch as a product bug.
    for (let attempt = 0; attempt < 2 && restored.text !== before.text; attempt += 1) {
      await page.waitForTimeout(600);
      restored = await canaryState(page);
    }
    if (process.env.ZTEAM_DEBUG_SITES) {
      console.log(`[sites] ${site} before=${before.text.length} after=${after.text.length} restored=${restored.text.length}`);
      if (restored.text !== before.text) {
        const a = before.text;
        const b = restored.text;
        let i = 0;
        while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
        console.log(`[sites] first diff at ${i}: ${JSON.stringify(a.slice(i, i + 80))} != ${JSON.stringify(b.slice(i, i + 80))}`);
      }
      console.log(`[sites] bodyToken=${restored.bodyHasToken} input=${restored.input === before.input} edit=${restored.edit === before.edit}`);
    }

    if (dynamicPage && dynamic) {
      const dynamicText = await page.evaluate(
        () => document.getElementById("zteam-dynamic")?.textContent ?? "",
      );
      dynamicSource = dynamicText === "Nouveau message important";
    }

    const valuesPreserved = CANARY_VALUES.every((value) => after.text.includes(value));
    const inputPreserved = after.input === before.input && after.input === CANARY_INPUT;
    const editPreserved = after.edit === before.edit && after.edit === CANARY_EDIT;
    const statusOk =
      !status?.aborted &&
      !status?.lastError &&
      Number(status?.applied ?? 0) > 0 &&
      Number(status?.missed ?? 0) === 0 &&
      Number(status?.protectedCount ?? 0) > 0;
    const changed = after.canaryHasToken && after.bodyHasToken;
    const restoredOk =
      restored.text === before.text &&
      restored.input === before.input &&
      restored.edit === before.edit &&
      !restored.bodyHasToken &&
      !stopStatus?.aborted;

    const dynamicOk = !dynamicPage || (dynamic && dynamicSource);
    const ok =
      statusOk &&
      changed &&
      valuesPreserved &&
      inputPreserved &&
      editPreserved &&
      restoredOk &&
      dynamicOk;

    rows.push({
      site,
      url,
      loaded: true,
      ok,
      skipped: false,
      applied: Number(status?.applied ?? 0),
      protectedCount: Number(status?.protectedCount ?? 0),
      missed: Number(status?.missed ?? 0),
      coverage: Number(status?.coverage ?? 0),
      canaryChanged: after.canaryHasToken,
      valuesPreserved,
      inputPreserved,
      editPreserved,
      restored: restoredOk,
      dynamic: dynamicPage ? dynamic && dynamicSource : "n/a",
      durationMs: Date.now() - startedAt,
      note: ok ? "" : `status=${statusOk} changed=${changed} restore=${restoredOk} dynamic=${dynamicOk}`,
    });
  } catch (error) {
    rows.push({
      site,
      url,
      loaded,
      ok: false,
      skipped: !loaded,
      applied: 0,
      protectedCount: 0,
      missed: 0,
      coverage: 0,
      canaryChanged: false,
      valuesPreserved: false,
      inputPreserved: false,
      editPreserved: false,
      restored: false,
      dynamic: false,
      durationMs: Date.now() - startedAt,
      note: clean(String(error instanceof Error ? error.message : error)).slice(0, 160),
    });
  } finally {
    await page?.close().catch(() => undefined);
  }
}

await context.close();

mkdirSync(outDir, { recursive: true });
const header = [
  "site",
  "url",
  "loaded",
  "ok",
  "skipped",
  "applied",
  "protected",
  "missed",
  "coverage",
  "canary_changed",
  "values_preserved",
  "input_preserved",
  "editable_preserved",
  "restored",
  "dynamic",
  "duration_ms",
  "note",
];
const lines = [
  header.join(","),
  ...rows.map((row) =>
    [
      row.site,
      row.url,
      row.loaded,
      row.ok,
      row.skipped,
      row.applied,
      row.protectedCount,
      row.missed,
      row.coverage.toFixed(3),
      row.canaryChanged,
      row.valuesPreserved,
      row.inputPreserved,
      row.editPreserved,
      row.restored,
      row.dynamic,
      row.durationMs,
      row.note,
    ]
      .map(csvEscape)
      .join(","),
  ),
];
writeFileSync(outFile, `${lines.join("\n")}\n`, "utf8");

const passed = rows.filter((row) => row.ok).length;
const failed = rows.filter((row) => !row.ok && !row.skipped);
const skipped = rows.filter((row) => row.skipped);

console.log(
  `[sites] tested=${rows.length} passed=${passed} failed=${failed.length} skipped=${skipped.length}`,
);
console.log(
  "site".padEnd(28),
  "ok".padEnd(6),
  "applied".padEnd(8),
  "protected".padEnd(10),
  "missed".padEnd(7),
  "ms".padEnd(6),
  "note",
);
for (const row of rows) {
  console.log(
    row.site.slice(0, 27).padEnd(28),
    String(row.ok).padEnd(6),
    String(row.applied).padEnd(8),
    String(row.protectedCount).padEnd(10),
    String(row.missed).padEnd(7),
    String(row.durationMs).padEnd(6),
    row.skipped ? `SKIP ${row.note}` : row.note,
  );
}
console.log(`[sites] wrote ${outFile}`);

if (failed.length > 0) {
  console.error(`[sites] product failures: ${failed.map((row) => row.site).join(", ")}`);
  process.exitCode = 1;
} else if (passed < 20) {
  console.error(`[sites] only ${passed} pages passed; expected at least 20`);
  process.exitCode = 1;
}
