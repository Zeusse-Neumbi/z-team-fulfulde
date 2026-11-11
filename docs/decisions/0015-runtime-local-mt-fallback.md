# 0015 — Runtime local machine translation as a labelled fallback

- **Status:** accepted
- **Date:** 2026-11-11
- **Supersedes:** the empty-pack consequence in
  [0007](0007-browser-translation-runtime.md) when the local API fallback is
  enabled. The integrity rules in 0007 remain in force.

## Context

The checked-in Fulfulde targets are still empty, so the production build left
every page in French or English. The owner asked the production extension to
use the local API and run with its Fulfulde output without touching code.

The local API already exposes `POST /translate` with NLLB-200 int8. On this
machine it answers 25 short page strings in about 16 seconds at concurrency 4.
A probe showed why the API must not receive mixed label/value nodes:
`Bonjour, Aïssatou` came back as `Bonjour, Aissatou`, changing the name, and
`Effectuer un transfert` came back as a repeated form. The output is useful
machine translation, not validated Adamawa Fulfulde.

## Decision

1. **Three runtime modes.** The panel persists `apiTranslation` as `off`,
   `fallback` (default) or `primary`. `fallback` uses the validated TM first and
   asks the local API only for plain strings with no entry. `primary` asks the
   API first and falls back to the TM when the API is unavailable.
2. **Provider switch without a rebuild.** The panel persists `mtProvider` as
   `null` (API default), `nllb` or `ollama`. The API's `ZTEAM_MT_BACKEND` and
   provider settings still work independently.
3. **Only plain translatable nodes reach the API.** `mixed` and `protected`
   nodes are never sent. Amounts, fees, totals, balances, names, phones,
   accounts, references, dates, error codes and user input stay in the browser.
   A mixed label/value node stays in its source language unless a validated TM
   pattern covers it.
4. **The background worker performs the calls.** A content script fetch from a
   target page to `127.0.0.1` would be blocked by CORS. The service worker
   discovers or accepts a loopback base URL on `127.0.0.1:8000–8010`, keeps four
   requests in flight, applies a 20-second per-request timeout and a 45-second
   batch deadline, and caches successful targets in memory only.
5. **The TM remains an overlay.** API targets are added to a runtime layer on
   `TranslationMemory`. In fallback mode a validated unit always wins. In
   primary mode the runtime layer is checked first. A new page start clears the
   runtime layer.
6. **Integrity is unchanged.** Every applied target still goes through the
   mixed-value check and the free-value check. A target that introduces or drops
   a value aborts the pass and restores every changed node.
7. **The panel tells the truth.** API targets are counted separately, every
   sentence carries a `TM`, `MT` or `TEST` origin chip, and a visible warning
   says the output is local machine translation, not validated by a native
   speaker. The validated release gate is unchanged.
8. **The fixture build stays deterministic.** `pnpm build:test` disables API
   machine translation and keeps the `⟦FF:…⟧` harness. It is never packaged.
9. **No new permission.** The production manifest already grants
   `http://127.0.0.1/*`; no host permission, cloud provider, API key or
   telemetry is added.
10. **Mixed nodes are masked, not skipped.** A mixed label/value node replaces
    every displayed value with a stable `[[Z1]]` placeholder before the API
    call. The values stay on the page, the model never receives them, and the
    target is used only if every placeholder survives. This raises real
    coverage without weakening the value rule.
11. **Two coverage numbers, one honest floor.** The panel keeps the
    translatable-text coverage and adds a page-coverage baseline over every
    visible letter-bearing text node. The second number includes protected
    values, so it is shown with the protected-value count and a safe ceiling.
    A 100% page coverage would require changing amounts or names and is never a
    target.
12. **The summary is a structured page brief.** The content script extracts the
    page kind, the main purpose sentence, section headings, warnings and primary
    actions. The panel reads that brief instead of the flat sentence list, so a
    listener hears what the page is, what it contains and what can be done.
13. **Clicks are announced.** A page action click sends its translated name to
    the panel, which speaks it with the local voice. High-risk actions keep the
    pause-and-confirm guard. The extension never clicks or submits.
14. **The panel has a Fulfulde draft.** FR/EN/FF switch only the panel, never
    the page. The FF copy is machine-generated, labelled **Fulfulde (MT)** and
    explicitly not native-validated.

## Consequences

- With the API running, the production build translates plain page labels into
  NLLB output. With the API stopped, it falls back to the validated TM and the
  source language, and the panel reports the API as unavailable.
- The first page pass is slower (about 10–16 seconds for the 25-string mock).
  The panel shows progress, and rescans reuse the in-memory cache.
- Quality is below a validated pack. A mixed greeting such as
  `Bonjour, Aïssatou` intentionally stays French rather than risking the name.
- The validated pack remains the only source of release-quality Fulfulde. The
  runtime fallback is a visible convenience, not evidence of validation.
- The page-coverage number is expected to be lower than the translatable
  coverage because it counts protected values that must not change. The safe
  ceiling makes that visible instead of implying a failed translation.
- The Fulfulde panel draft needs a native speaker before it can be called a
  validated interface.
- Privacy documentation must say that translatable labels can reach the local
  API when the user enables the mode; protected values never do.
- A future batch endpoint would improve latency but does not change this
  contract.

## Evidence

- `packages/translator/src/tm.ts` — runtime layer, origin and priority.
- `packages/translator/src/dom-translator.ts` — source collection, TM/MT counts.
- `apps/extension/lib/mt.ts` — loopback validation, API client, cache, limits.
- `apps/extension/entrypoints/background.ts` — async worker and progress.
- `apps/extension/entrypoints/content.ts` — modes, async pass, Stop race guard.
- `apps/extension/entrypoints/sidepanel/App.tsx` — mode/provider controls and
  MT labelling.
- `packages/translator/src/runtime.test.ts`, `apps/extension/lib/mt.test.ts`,
  `packages/shared/src/schemas.test.ts`.
- Manual Chrome run: 23 API translations, 11 protected values, 0 validated TM,
  mixed greeting preserved, Stop restored the page.
