# Linguistic validation

## Language

- **Adamawa Fulfulde**, ISO 639-3 `fub`, Cameroon.
- Sub-variety: Ngaoundéré / Garoua / Maroua — confirmed with the speaker and recorded here.
- Script: Latin AGLC/GACL; `ɓ ɗ ƴ ŋ ɲ`; doubled vowels; no tone marks; NFC.

## Two artefacts

1. **Translation memory** (`packages/phrasebank/entries/tm.yaml`) — page strings, keyed by
   normalized FR/EN source.
2. **Phrase bank** (`packages/phrasebank/entries/phrases.yaml`) — spoken plans, keyed by ID
   and slots.

Both follow the same workflow.

## Workflow

1. Extract the exact FR/EN strings from the live page (`pnpm strings`).
2. The team writes the source sentence and slot types; do not paraphrase.
3. A native speaker translates into Adamawa Fulfulde.
4. A second native speaker, blind to the source, back-translates into French.
5. The team and both speakers adjudicate any drift.
6. The speaker records the spoken phrases.
7. Fill `validatedBy` and `backTranslationFr`; the release build enforces them.
8. Any change creates a new version and requires re-validation.

If only one speaker is available, do steps 3 and 4 on different days and record the
limitation in the technical note.

## Acceptance

| Criterion | Target |
|---|---|
| Critical errors (amount, fee, beneficiary, reference, condition, negation, warning) | **0** |
| Meaning score ≥ 4/5 | ≥ 95% of entries |
| Naturalness score ≥ 4/5 | ≥ 90% of entries |
| TTS MOS | ≥ 3.8 (target 4.2) or not shipped |
| Amounts, names, phones, references | 100% intelligible and unaltered |

## Evidence

- `eval/linguistic/strings.csv` — extracted visible strings.
- `eval/linguistic/back-translation.csv` — source, Fulfulde, blind back-translation,
  scores, critical-error flag, fix.
- `eval/linguistic/tts-mos.csv` — naturalness and intelligibility.
- `eval/linguistic/coverage.csv` — coverage output.
- `docs/TTS_REPORT.md` — data, normalisation, training, evaluation, decision.
- Sign-off: initials, dates, TM and phrase bank versions.

## Current status

**Not yet validated.** The checked-in TM and phrase bank are seeds with empty Fulfulde
columns. The development build warns; `pnpm --filter @zteam/phrasebank build:release`
fails until medium/high-risk entries have a target, a validator and a back-translation.

## TTS normalisation

The MMS Fulfulde tokenizer does not contain `ɲ` or `ꞌ`. For TTS input only:

- `ɲ → ny`
- `ꞌ → '`
- keep `ɓ ɗ ƴ ŋ`
- strip Ajami text

The speaker approves the normalized forms of the 20 most frequent words before they are
used.

## Do not translate

- Person names, account numbers, phone numbers, references, amounts, dates, user input,
  brands and security codes. These are protected or glossary decisions, never MT.

## What we do not claim

We do not claim general Fulfulde translation. We claim validated coverage of the demo
domain, with a documented translation memory, a documented phrase bank and native sign-off.
