# Live audit — real test page, with and without the local API

> **Snapshot: 2026-11-13, Fulfulde-only build.** The current submission ZIP
> also carries the Yemba draft (103/115) and resolves the voice per language.
> Re-run the audit after `pnpm build:submission`. Numbers below are historical.

- **Date:** 2026-11-13
- **Build:** `pnpm build:submission` (draft MT pack + 115 bundled clips)
- **Page:** <https://safinum.cm/hackathon-test> (the page named in the form)
- **Harness:** `node scripts/live-audit.mjs` — drives the real side panel button,
  walks the five steps, plays the voice, rescans, stops and restores.
- **Privacy:** the harness compares page values in memory and records counts and
  interface labels only. No page value, name, account or reference is written to
  this file or to the JSON report.

## Runs

| Run | Command | Local API |
| --- | --- | --- |
| A | `node scripts/live-audit.mjs --label without-api` | stopped |
| B | `node scripts/live-audit.mjs --label with-api --expect-api` | `ZTEAM_TTS_BACKEND=mms ZTEAM_MT_BACKEND=nllb`, port 8000 |
| C (experiment) | `... --primary` | same, panel set to "API locale d'abord" |

## Results

| Measure | A — no API | B — API fallback (default) | C — API first |
| --- | --- | --- | --- |
| Translatable texts on step 1 | 29 | 29 | 29 |
| Translated | 27 | 27 | 29 |
| Coverage, step 1 | 93,1 % | 93,1 % | 100 % |
| Coverage, steps 2–5 | 100 % | 100 % | 100 % |
| Protected values seen | 17 | 17 | 17 |
| Protected values changed | **0** | **0** | **0** |
| Labels held for ambiguity | 2 | 2 | 0 |
| Steps walked | 5/5 | 5/5 | 5/5 |
| Time to translated page | 142 ms | 111 ms | **33 723 ms** |
| Time to first audio | 164 ms | 170 ms | 170 ms |
| Audio source | 82 bundled clips | 82 bundled clips | 82 bundled clips |
| Automatic submits | 0 | 0 | 0 |
| Stop restores the page | yes | yes | yes |
| Panel badge | Fulfulde : MT — non validée | MT local · Prêt | MT local · non validée |

Panel language switch (FR → EN → FF) works and never touches the page; the FF
mode shows the "brouillon MT" note. Rescan is idempotent and leaves user input
untouched. The read-back returns all seven fields and every value is present on
the page.

## What this proves

1. **The ZIP is self-sufficient.** Without any local server, 27 of 29 texts are
   translated, all five steps work, the voice plays from the bundled clips, and
   the guard pauses the risky click. The examiner needs no install.
2. **The API adds nothing on this page.** The pack already covers 27 strings and
   the two remaining ones are controls the collision guard deliberately keeps in
   French, so the fallback has no source to translate (`mt.done = 0`).
3. **The API is much slower than the clips.** A warm `POST /tts` takes 7,6 s and
   a cold one 15,4 s; a warm `POST /translate` takes 3,6 s for one phrase. The
   bundled clip reaches the speaker in 170 ms.
4. **"API first" is not actually first.** The pack is applied before the MT
   results arrive and the idempotence rule skips nodes that already show a
   translation, so the API only fills the two gaps while paying for 23 requests
   (33,7 s once; a repeat attempt exceeded the extension's 45 s MT deadline and
   translated nothing). Keep the default **fallback** for the demo; do not
   select "API locale d'abord" in front of the jury.

## Numbers for the jury

| | |
| --- | --- |
| Page texts translated on step 1 | 27 / 29 (93,1 %) |
| Coverage on steps 2–5 | 100 % |
| Financial values changed | 0 of 17 |
| Ambiguous action labels kept in French | 2 ("Effectuer un transfert", "Consulter les frais") |
| Steps demonstrated | 5 / 5 |
| Time to translated page | 0,11 s (API fallback) / 0,14 s (no API) |
| Time to first spoken sentence | 0,17 s |
| Automatic submits | 0 |
| Installation required | none (load unpacked) |

## Reproduce

```bash
pnpm build:submission
node scripts/live-audit.mjs --label without-api --json /tmp/audit-a.json

# second terminal
ZTEAM_TTS_BACKEND=mms ZTEAM_MT_BACKEND=nllb \
  uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000
node scripts/live-audit.mjs --label with-api --expect-api --json /tmp/audit-b.json
```
