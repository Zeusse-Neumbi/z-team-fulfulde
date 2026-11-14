# Demo

Two paths, never mixed:

- **Product demo** — `pnpm build:submission`: the labelled MT draft packs (NLLB
  for Fulfulde, cameroon-int8 Marian for Yemba) plus the bundled Opus clips.
  This is the jury path and the video, and the panel states **MT — non validée**
  on every screen.
- **Mechanics test** — fixture build with `⟦FUB:…⟧` tokens. This is for e2e and `check:live`; never record it as Fulfulde.

The production build is honest about the pack. The submission build bundles the NLLB draft
(`packSource: "mt"`); the panel states **MT — non validée** and the audio player withholds 33
clips whose draft is a warning, an error, an ambiguous control, a source echo or a degenerate
repetition. When the validated pack replaces the draft, `build:release` passes and the same
panel reads **validated**. Machine output is never presented as native-speaker validation.

The complete build/load/run walkthrough is in
[`MANUAL_DEMO.md`](MANUAL_DEMO.md).

## One command: local API + models

```bash
pnpm demo -- --check     # preflight: models, device, port, pack, ZIP
pnpm demo                # start MMS + NLLB, wait for /health, prewarm
```

`pnpm demo` starts the local API with the right environment, waits until `/health` is ready, and
warms the demo phrases. With `--port auto` (the default) it reuses a Z-Team API already running on
8000–8010, otherwise it starts on the first free port. The panel discovers the same range, so a
demo on 8001 still works without a rebuild. It never kills a server it did not start.

| Command | Use |
| --- | --- |
| `pnpm demo` | MMS voice + NLLB if available; auto port, auto CPU/GPU; prewarm |
| `pnpm demo:check` | print the preflight and start nothing |
| `pnpm demo -- --deep` | verify NLLB with a real `POST /translate` |
| `pnpm demo:stub` | no models; stub voice; quick UI check |
| `pnpm demo -- --no-prewarm` | fast start |
| `pnpm demo -- --port 8011` | exact port; the panel still discovers 8000–8010 |
| `pnpm demo -- --cpu` / `--gpu` | force the device |
| `pnpm demo -- --download` | download `mms` and `nllb-ct2` first |

Expected preflight:

```text
[demo] check
  mode      product
  models    mms=ok nllb=ok
  runtime   mms=ok ct2=ok
  nllb      model=ok runtime=ok -> new server mt=nllb
  plan      start 8000 (mt=nllb)
  device    cpu (cuda=no)
  port      8000: free
  pack      seed (115/115 empty) — TM-only stays source; local MT is labelled. Do not record the jury video yet.
  extension built
  zip       0.13 MB
```

If 8000 is already a Z-Team API, the plan row says `reuse 8000` and the port row shows its
backends; `pnpm demo` does not start a second server. If CTranslate2 is missing, the `nllb` row
shows `runtime=missing -> new server mt=stub` and the page translation still works because the
extension uses its bundled translation memory. The voice is the part that needs the MMS model.
`--deep` calls `/translate` end-to-end and prints the translated sentence and latency; it is
skipped when `mt=stub` or no API is running.

The extension build is separate: `pnpm build` (product) or `pnpm build:test` (mechanics). Load it
from `apps/extension/.output/chrome-mv3` in `chrome://extensions` (Developer mode → Load
unpacked).

## Before you start

- [ ] `pnpm doctor` — OS, tools, GPU, models, API.
- [ ] `pnpm models:verify` — sizes and SHA-256.
- [ ] `pnpm demo -- --check` — pack state and port.
- [ ] A clean Chrome profile with only this extension, 100% zoom, 1280×800.
- [ ] Fictional data only; no real account, phone, name or reference.
- [ ] The local API is running (`pnpm demo`) or the panel will disable the voice and the
      local-MT fallback; the validated TM and protected-value pipeline still work.

## Two builds

| Build | Command | What it shows | Use |
| --- | --- | --- | --- |
| Production | `pnpm build` | validated pack first; optional local NLLB fallback marked **MT — non validée**; otherwise source + “pack missing” | Product demo, video |
| Fixture | `pnpm build:test` | `⟦FUB:…⟧` tokens, never Fulfulde; API MT disabled | e2e, `check:live` only |
| Stub API | `pnpm demo:stub` | no models; stub voice and stub MT (source unchanged) | UI-only smoke test |

Do not record the fixture build. Do not claim the page is translated when the panel says the pack
is missing.

## Five-minute smoke test

1. `pnpm demo -- --check` — expected output above.
2. `pnpm demo` — leave the terminal open.
3. `pnpm build` — production build.
4. Load `apps/extension/.output/chrome-mv3` in a clean profile.
5. Open `https://safinum.cm/hackathon-test`.
6. Click the extension icon, then **Activer sur ce site**.
7. Check the panel: translatable coverage, page coverage with its safe ceiling, applied,
   protected, missed; badge **Rien — traitement local**. In the **Traduction** card, confirm
   the mode. With **Repli après la TM** and the API running, the API count is non-zero and the
   warning says **MT local — non validée**. Choose **Désactivée** to prove the TM-only path.
   Switch the panel to **FF** and back: the page text must not change. Play the summary and
   confirm the voice reads Fulfulde only, even when the panel is in French or English.
8. Balance: the amount is exact; play, pause, replay slower.
9. Fees: fee, total and balance after; change the operation if the page offers it. Click a
   button and confirm the panel announces its translated name.
10. Beneficiary: the input is untouched; the read-back shows the exact name, phone and reference.
11. Confirm: the assistant announces the action; the user taps Confirm; the extension never
    clicks or submits.
12. Warning: the warning is translated; the original text is available.
13. Novel content: validated content is translated; unknown content stays in the source
    language and is counted, unless the labelled local-API fallback is on. In that case the
    output is machine translation, not a validated phrase.
14. Stop: the page is restored and the audio stops.
15. `pnpm e2e` and `pnpm check:live` (mechanics path).

## Mechanics test path

```bash
pnpm build:test
pnpm e2e          # 12 tests: FR/EN, novel content, click guard, a11y, visual, errors
pnpm check:live   # real SAFINUM page with fixture tokens; values, read-back, restore
pnpm check:sites  # 30 public pages; canary values, dynamic content, restore
```

What they prove:

- the scanner and translator work on the real page;
- protected values and inputs are unchanged;
- Stop restores the page;
- a high-risk click is paused and confirmed;
- the panel and the page have no serious axe violations;
- the layout does not overflow at 390×844 and 1280×800.

What they do **not** prove: that the tokens are Fulfulde. The fixture build is a mechanics
harness, not a language demo.

## Product demo path

1. `pnpm demo` — MMS voice, NLLB if available, prewarmed.
2. `pnpm build` — production build with the validated pack.
3. Load unpacked, clean profile, open the live page.
4. Click the extension; the panel opens. Show the privacy badge before enabling.
5. **Balance**: start; the page translates; the amount stays exact; play the summary; replay
   slower.
6. **Fees**: fee, total, balance after; change the operation if the page offers it; the fee
   updates and the values stay exact.
7. **Beneficiary**: the name and phone are untouched; the read-back reads them verbatim; the user
   taps Confirm.
8. **Warning**: the warning is translated by a validated phrase; show the original text toggle.
9. **Novel content**: trigger the new message. Validated content is translated; unknown content
   stays in the source language and the panel counts it, unless the labelled local-API
   fallback is on. Say explicitly which mode is active.
10. **Stop**: the page returns to French, the audio stops, the panel shows inactive.
11. **Evidence**: coverage, protected values, read-back, restore, the 30-page sweep, the repo.

## Evidence commands

| Command | Proves | Artefact |
| --- | --- | --- |
| `pnpm doctor` | environment, models, API, GPU | console |
| `pnpm models:verify` | sizes and SHA-256 | console |
| `pnpm demo -- --check` | backend, device, port, pack | console |
| `pnpm e2e` | FR/EN journey, novel content, click guard, a11y, visual | console |
| `pnpm check:live` | real page, values, read-back, restore | `eval/visual/*.png`, JSON summary |
| `pnpm check:sites` | 30 public pages, canary values | `eval/latency/generalization.csv` |
| `curl -X POST http://127.0.0.1:8000/demo/reset` | clear metrics between runs | — |

`pnpm check:live` writes screenshots to `eval/visual/` (gitignored) and prints a JSON summary with
applied/missed/protected counts for each step. It uses the fixture build; keep it out of the jury
recording.

## Three-minute video

The video is the **after-pack target**: production build, validated Fulfulde, local voice.

| Time | Visual | Audio / subtitle |
| --- | --- | --- |
| 0:00–0:15 | The live page in French; a user looks confused | “For millions of Fulfulde speakers, a French banking interface is a wall.” |
| 0:15–0:30 | Extension enabled; page text switches to Fulfulde; “Aucune modification du code” | “Z-Team translates the page into Fulfulde, without touching the bank’s code.” |
| 0:30–0:55 | Balance page; Fulfulde text; audio; exact `250 000 FCFA`; “rien ne quitte cette page” | “The page is translated; the amount stays exact.” |
| 0:55–1:20 | Fees page; fee/total/balance; change operation to Mobile Money; fee updates | “Fees and totals are preserved, whatever the operation.” |
| 1:20–1:55 | Beneficiary; the assistant announces the action; name/phone untouched; read-back; the user taps Confirm | “User input is never translated. The assistant reads back before confirming.” |
| 1:55–2:20 | Summary; reference; warning; original text toggle | “References and warnings stay exact and clear.” |
| 2:20–2:40 | A new message appears; validated content translated; unknown content stays source; no reload | “New content is detected without a reload. The extension does not invent a translation.” |
| 2:40–3:00 | Validation sheet, listener ratings, architecture, repo | “Reviewed by a native speaker through listening. Measured. Documented.” |

French subtitles; Fulfulde voice; English subtitles optional. 1080p H.264, ≤ 3:00.

Do not put a voice command in the video: the ASR classifier is a stub. The voice is output and
read-back, not input.

## Live demo (6–7 minutes)

1. **Setup (30 s)** — page in French; extension disabled; enable on this site; show privacy.
2. **Balance (60 s)** — page translates; audio; exact amount; replay slower.
3. **Fees (45 s)** — fee/total/balance; change operation to Mobile Money; fee recalculated.
4. **Transfer (120 s)** — the assistant announces the action; the user taps Confirm; the
   recipient and phone stay untouched; the read-back is exact. No voice command is used.
5. **Warning (45 s)** — warning translated by a validated phrase; original available.
6. **Novel content (60 s)** — a new message appears; validated content is translated; unknown
   content stays in the source language and is counted, unless the labelled local-API
   fallback is on. No output is claimed as validated.
7. **Panel language (30 s)** — toggle the panel between FR and EN; the page EN path is covered by
   `pnpm e2e` (the live page is FR).
8. **Evidence (30 s)** — coverage, integrity, latency, single-speaker listening review, repo.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `pnpm demo` says port 8000 is busy | leave the default `--port auto`; it starts on 8001–8010 and the panel discovers it. `--port 8000` forces 8000 and fails if it is busy. |
| MMS model missing | `pnpm models:download mms nllb-ct2` |
| CTranslate2 missing | `uv pip install ctranslate2` or `pnpm bootstrap --speech`; `mt=stub` is fine for the page |
| `torch.cuda.is_available()` is false | CPU is fine; `pnpm demo -- --cpu`; for NVIDIA see `docs/SETUP.md` |
| Extension does not load | `pnpm build`; load `apps/extension/.output/chrome-mv3`; Developer mode |
| Panel says the pack is missing | the validated pack is still a seed. Enable **Repli après la TM** with the local API running, or run `pnpm --filter @zteam/phrasebank build:release` after validation. |
| Page shows MT output | the local-API fallback is active. It is machine translation, not validated Fulfulde; the panel marks it **MT — non validée**. |
| Voice button is disabled | API not running, or TTS not ready; `pnpm demo -- --check` |
| `check:live` shows `⟦FUB:…⟧` | fixture build; never record it |
| The live page changed | `pnpm check:live` fails; use the mock, capture a screenshot and note the change |
| Side panel does not open | click the extension icon; check the active tab permission |

## Clean profile

- New Chrome profile, no other extensions.
- 100% zoom, 1280×800.
- Only `https://safinum.cm/hackathon-test` open.
- Fictional data only; no real account, phone, name or reference.
- The side panel is visible without scrolling; the privacy badge is visible.

## Backup

- `pnpm demo` prewarms the demo phrases; the cache makes the second run repeatable.
- `pnpm package` produces the ZIP that is also uploaded to the form.
- The Windows machine has the same models; it is the fallback if this machine fails.
- If the voice fails, continue with the page translation and say the voice is optional. There is
  no recorded fallback audio in the repository; do not claim one.

## What not to do

- Do not claim voice input or ASR: the classifier is a stub.
- Do not claim two native speakers, a written back-translation or MOS if it was not measured.
- Do not claim novel content is translated when the mode is off or the API is unavailable and
  the production build leaves it in the source language. Labelled local-API output is machine
  translation, not validation.
- Do not claim recorded fallback audio.
- Do not present the fixture `⟦FUB:…⟧` tokens as Fulfulde.
- Do not claim the production page is translated by a validated pack while the pack is
  missing. Local NLLB output is machine translation and must be labelled as such.
- Do not enter real data.
- Do not auto-submit a transfer.
- Do not hide the original text from the jury.
