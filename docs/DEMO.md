# Demo

## Two builds

| Build | Command | Use |
|---|---|---|
| Production | `pnpm build` | Honest FR/EN source view; panel says the Fulfulde pack is missing |
| Fixture | `pnpm build:test` | Test tokens prove translation, protection and restore; never shown as Fulfulde |

The video below is the **target** once the validated Fulfulde pack is installed. Do not record
the fixture tokens as if they were Fulfulde, and do not claim the page is translated when the
production build is showing the source.

## Setup

1. Build the extension: `pnpm build:test` for mechanics, `pnpm build` for the production view.
2. Load `apps/extension/.output/chrome-mv3` in `chrome://extensions` (Developer mode).
3. Start the local API: `uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000`.
4. Open `https://safinum.cm/hackathon-test` in a clean Chrome profile.
5. Click the extension icon, then **Activer sur ce site**.

Use a clean profile with only this extension. Do not use real personal or banking data.

## Evidence commands

```bash
pnpm build:test
pnpm e2e          # local journey, EN, errors, novel content, axe, keyboard
pnpm check:live   # real SAFINUM page, fixture tokens, protected values, restore
```

`pnpm check:live` writes screenshots to `eval/visual/` (gitignored) and prints a JSON summary
with applied/missed/protected counts for each step.

## Three-minute video

| Time | Visual | Audio / subtitle |
|---|---|---|
| 0:00–0:15 | The live page in French; a user looks confused | "For millions of Fulfulde speakers, a French banking interface is a wall." |
| 0:15–0:30 | Extension enabled; page text switches to Fulfulde; "Aucune modification du code" | "Z-Team translates the page into Fulfulde, without touching the bank's code." |
| 0:30–0:55 | Balance page; Fulfulde text; audio; exact `250 000 FCFA`; "rien ne quitte cette page" | "The page is translated; the amount stays exact." |
| 0:55–1:20 | Fees page; fee/total/balance after; switch operation to Mobile Money; fee updates | "Fees and totals are preserved, whatever the operation." |
| 1:20–1:55 | Beneficiary; voice "send money"; name/phone untouched; read-back; tap confirm | "User input is never translated. The assistant reads back before confirming." |
| 1:55–2:20 | Summary; reference; warning; original text toggle | "References and warnings stay exact and clear." |
| 2:20–2:40 | New message appears; translated without reload | "New content, translated live, without a reload." |
| 2:40–3:00 | Validation sheet, MOS, architecture, repo | "Validated by native speakers. Measured. Documented." |

French subtitles; Fulfulde voice; English subtitles optional. 1080p H.264, ≤ 3:00.

## Live demo (6–7 minutes)

1. **Setup (30 s)** — page in French; extension disabled; enable on this site; show privacy.
2. **Balance (60 s)** — page translates; audio; exact amount; replay slower.
3. **Fees (45 s)** — fee/total/balance; change operation to Mobile Money; fee recalculated.
4. **Transfer (120 s)** — voice; amount keypad; recipient untouched; read-back; tap confirm.
5. **Warning (45 s)** — warning translated by validated phrase; original available.
6. **Novel content (60 s)** — new message appears; translated live or safely handled.
7. **EN toggle (30 s)** — switch the page to English; extension still works.
8. **Evidence (30 s)** — coverage, integrity, latency, validation, repo.

## Backup

- 3-minute screen recording of the same flow.
- Prewarmed cache and packaged ZIP.
- Recorded fallback audio if the backend fails.

## What not to do

- Do not claim the stub TTS is Fulfulde speech.
- Do not present the fixture `⟦FF:...⟧` tokens as Fulfulde.
- Do not claim the production page is translated while the pack is missing.
- Do not enter real data.
- Do not auto-submit a transfer.
- Do not hide the original text from the jury.
