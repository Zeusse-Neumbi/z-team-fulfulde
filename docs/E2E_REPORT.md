# End-to-end and stress report

- Date: 2026-11-09
- Models: `mms-tts-ful` (TTS) and `nllb-200-600m-int8` (MT), both local
- API: `127.0.0.1:8000`, `tts=mms`, `mt=nllb`, `ready={tts:true, mt:true}`

## 1. Frontend contract

The side panel now:

1. reads `/health` and only enables the voice when `ready.tts` is true;
2. builds a **spoken summary** instead of reading every sentence;
3. never sends a sentence that contains a protected value to `/tts`;
4. asks for a confirmation after announcing an action, and only then shows it
   on the page.

Playwright suite (`pnpm e2e`), 10 tests:

| Spec | What it proves |
|---|---|
| `journey.spec.ts` (3) | FR and EN journeys, protected values, novel content, errors |
| `summary.spec.ts` (2) | summary is shorter than the sentence list, values excluded, action needs confirmation |
| `backend.spec.ts` (1) | real local voice is `ready`, spoken amounts are byte-identical in the `/tts` body, account numbers are not |
| `click-guard.spec.ts` (1) | a high-risk page click is paused, cancelled, confirmed and re-clicked without auto-clicking |
| `a11y.spec.ts` (2) | no serious axe violations, keyboard-only controls |
| `on-demand.spec.ts` (1) | runtime injection outside the manifest matches |
| `smoke.spec.ts` (1) | extension and panel load |
| `visual.spec.ts` (1) | no overflow at mobile and desktop widths |

Result: **12 passed**.

Example evidence from `summary.spec.ts`:

```
plan contains: Étape 1/5 …
plan does NOT contain: 175 000 FCFA, CM 999 8887 7776 55, 12 500 FCFA
plan item count < sentence list count
Vérifier → Confirmer/Annuler visible → Confirmer → "Action montrée sur la page"
```

`backend.spec.ts` asserts that the panel's `.voice.ready` is visible and that
the `/tts` request bodies contain `Étape` and none of the canary values.

## 1b. Page click guard and spoken amounts

- Clicking `#confirm` on step 4 does not reach the page: the panel shows
  `Vous avez cliqué : Confirmer` with `Autoriser ce clic` / `Annuler`.
- Cancel leaves the page untouched; confirm arms the action for 20 s and the
  user re-clicks. The extension never dispatches the click.
- Clicking the page's high-risk `#confirm` directly triggers a real `/tts`
  request whose body contains `Confirmer le transfert` — the button's exact
  accessible name — before the panel asks for confirmation. The assertion reads
  the bodies captured from the panel's own fetch.
- With **Lire aussi les montants** enabled, the plan speaks
  `Montant 175 000 FCFA` (and the fee/movement values) through the local MMS
  voice. The Playwright assertion compares the `/tts` body with the exact value
  shown in the panel, including its NBSP. `CM 999 8887 7776 55` is absent.

## 2. Local API stress

`scripts/stress-api.py`, concurrency 2, 20 translations and 8 speech requests:

```
[stress] 20 translations p50=2061 ms p95=3479 ms
[stress] 8 speech        p50=647 ms  p95=3646 ms
[stress] wall=28.2s failures=0
```

Concurrency raises the translation p50 from ~0.9 s to ~2.1 s because NLLB and
MMS share four CPU cores. A future optimisation should serialise model access
or cap the panel to one synthesis at a time (it already plays one utterance at a
time).

## 3. Generalization sweep

`pnpm check:sites` runs 30 public pages with a canary block (amount, account,
phone, reference, date, name, input, contenteditable) on the fixture build.

```
tested=30  passed=26  skipped=4  product_failures=0
```

The four skips are network failures during `page.goto` (`mozilla.org`,
`gutenberg.org` twice, `rfc-editor.org`), not extension failures. Every page
that loaded passed the canary: values, input and contenteditable unchanged,
Stop restored the original text, coverage 1.000, missed 0.

Highlights: Wikipedia EN applied 1,902 nodes, Wikipedia FR 2,250, Hacker News
260, Mozilla Firefox 544, Project Gutenberg 612 in the earlier run, all with
zero value changes. Node.js `/en` passed in the final sweep.

The one flake found: `nodejs.org/en` reported `restore=false` once. A focused
rerun passed (`before=141 after=260 restored=141, bodyToken=false`): the React
page repainted just after Stop. The harness now re-checks the restore state for
up to 1.2 s before calling it a product failure. This is a test-timing fix, not
a relaxation of the canary check: the token, input and contenteditable
assertions are unchanged.

### MT candidate pack build

```
ZTEAM_PHRASEBANK=mt pnpm --filter @zteam/phrasebank build
  → generated 80 TM units and 35 phrases, version 2026-11-09.2+mt
ZTEAM_PHRASEBANK=mt pnpm --filter @zteam/phrasebank build:release
  → Exit status 1 (Missing validator / back-translation)
pnpm --filter @zteam/phrasebank build
  → back to 2026-11-09.2, no candidate in generated.ts
```

## 4. Phrasebank machine translation

See [`PHRASEBANK_MT.md`](PHRASEBANK_MT.md) and
`eval/linguistic/mt-candidates.csv`:

```
translated=115 skipped=0 placeholder_failures=0 in 120.5s
```

The candidate pack is evaluation-only; `validatedBy` is empty and
`build:release` still fails.

## 5. Artefacts

| File | Content |
|---|---|
| `eval/latency/generalization.csv` | site sweep, one row per page |
| `eval/latency/mms.csv` | MMS probe rows |
| `eval/latency/nllb.csv` | NLLB probe rows |
| `eval/linguistic/mt-candidates.csv` | 115 machine-translation candidates |

## 6. Known limits

- MMS-TTS is slower than real time on this CPU (RTF 1.1–1.9).
- NLLB uses `fuv_Latn`; the output is Nigerian Fulfulde, not validated Adamawa.
- The spoken summary reads labels and actions, not amounts. Values stay on
  screen by design; speaking them needs recorded digit clips or a value-safe
  TTS path.
- Some sites remove injected nodes during hydration; the harness treats that as
  a skip only when the canary disappears before translation, never as a pass.
