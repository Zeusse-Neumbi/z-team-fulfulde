# Speaker packet — oral validation session

This packet is for the Fulfulde native-speaker session. Yemba needs a separate
speaker and a separate packet; the Fulfulde session does not validate Yemba. It is written so the session can
run without the speaker reading Fulfulde: the speaker listens, speaks and rates;
the team transcribes.

- **Speaker pseudonym:** `SPK-01`
- **Language:** Adamawa Fulfulde (`fub`)
- **Sub-variety:** to confirm at the session (Ngaoundéré / Garoua / Maroua)
- **Consent:** prototype, demo and validation; audio kept locally; deletion on
  request. Record the date and the scope.
- **Method:** [ADR 0013](decisions/0013-oral-validation-by-listening.md)

## Before the session

```bash
# 1. local API with the MMS voice
ZTEAM_TTS_BACKEND=mms uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. generate the listening pack (115 entries)
pnpm generate:listening -- --base-url http://127.0.0.1:8000

# 3. serve the page
pnpm serve:listening
# open http://127.0.0.1:4175/
```

The page has two modes:

- **Correction:** French source + Fulfulde audio.
- **Blind:** audio only (tick the checkbox).

The 115 entries are the 80 translation-memory units and the 35 spoken phrases,
with fictional placeholders (`25 000 FCFA`, `Jean-Paul Mbarga`,
`CM 001 2345 6789 01`, `SAF-2026-ABC123`). The generated templates are
`eval/linguistic/back-translation.template.csv` and
`eval/linguistic/tts-mos.template.csv` (115 rows each); copy the filled one to
the evidence file.

## Pass 1 — correction

For each entry:

1. Play the Fulfulde audio.
2. Ask: “Does it mean the same thing as the French?”
3. If not, ask for the correct spoken form; write it down.
4. Rate meaning 1–5 and naturalness 1–5.
5. Mark a critical error when the meaning of an amount, fee, beneficiary,
   reference, condition, negation or warning changes.

## Pass 2 — blind

Hide the French and Fulfulde text. Play the corrected audio and ask: “What does
this mean in French?” Record the answer as `back_translation_fr`. Do not show the
source before the answer.

## Pass 3 — confirmation

Regenerate the audio for the corrected entries and let the speaker confirm.

## Number lexicon

The speaker says each item; the team fills
`packages/phrasebank/numbers/fub.json`:

| Field | Items |
| --- | --- |
| `units` | 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19 |
| `tens` | 20, 30, 40, 50, 60, 70, 80, 90 |
| `hundred` | hundred |
| `thousand` | thousand |
| `million` | million |
| `billion` | billion |
| `and` | and / join |
| `plus` | plus |
| `minus` | minus |
| `currency` | FCFA |

Demo amounts to say and confirm: `0 FCFA`, `375 FCFA`, `25 000 FCFA`,
`25 375 FCFA`, `250 000 FCFA`.

## Rating sheet

Fill `eval/linguistic/back-translation.csv` with:

| Column | Meaning |
| --- | --- |
| `target_ff` | the corrected Fulfulde text |
| `back_translation_fr` | the French meaning given in the blind pass |
| `meaning_1_5` | 1–5 |
| `naturalness_1_5` | 1–5 |
| `critical_error` | `yes` / `no` |
| `fix` | what changed, if anything |

Fill `eval/linguistic/tts-mos.csv` with the voice ratings:

| Column | Meaning |
| --- | --- |
| `sample` | entry ID |
| `sentence` | Fulfulde text |
| `naturalness_1_5` | 1–5 |
| `intelligibility_1_5` | 1–5 |
| `wrong_word` | the word heard wrong, if any |
| `notes` | comment |

## After the session

1. Apply the corrections to `tm.yaml` and `phrases.yaml`; set `validatedBy` and
   `backTranslationFr`.
2. Fill `packages/phrasebank/numbers/fub.json`.
3. Run `pnpm --filter @zteam/phrasebank build:release`.
4. Run `pnpm build` and `pnpm package`.
5. Update `docs/LINGUISTIC_VALIDATION.md` with the speaker, dialect, date,
   method, counts, critical errors, scores and limitation.
6. Do not commit the audio; it stays in `eval/linguistic/session/` (gitignored).

## Honest limitation

The session is a single-speaker, oral review. It is not a written translation
and it is not a second blind speaker. The note says so. The target for the
post-hackathon release is a second native speaker and, where possible, a written
back-translation.
