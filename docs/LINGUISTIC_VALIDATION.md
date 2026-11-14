# Linguistic validation

## Status (2026-11-14)

**No session has run.** No entry has a validator, no back-translation has been
recorded, and no score is published. Two packs ship as labelled drafts:

| Language | Targets | Validators | Release errors | Status |
| --- | --- | --- | --- | --- |
| `fub` | 115/115 | 0 | 164 | draft |
| `ybb` | 103/115 (12 withheld) | 0 | 174 | draft |

`pnpm check:evidence` fails by design while either pack is a draft. `build:release`
enforces evidence only for a language whose registry row says `status: validated`
(ADR 0020); it does not turn a draft into a validated pack. The panel, `INSTALL.md`
and the technical note all say **MT — non validée**.

Ready to use:

- `docs/SPEAKER_PACKET.md` — the 45-minute protocol, written for a speaker who
  does not read Fulfulde.
- `pnpm pack:listening` — the 115-clip two-pass pack as a single ZIP
  (`dist/zteam-listening-pack-v0.2.1.zip`, ~0.7 MB), attached as a draft release
  asset. It opens offline in a browser.
- `eval/linguistic/back-translation.template.csv` and
  `eval/linguistic/tts-mos.template.csv` — 115 rows each.

## Languages

- **Adamawa Fulfulde**, ISO 639-3 `fub`, Cameroon. Demonstrated language.
- **Yemba**, ISO 639-3 `ybb`, Cameroon. Second data-only pack; it needs its own
  speaker and its own session.
- Fulfulde sub-variety: to confirm with the speaker at the session; record
  Ngaoundéré / Garoua / Maroua here once known.
- Script: Latin AGLC/GACL; `ɓ ɗ ƴ ŋ ɲ`; doubled vowels; no tone marks; NFC.
- The target users may not read Fulfulde. The voice is therefore part of the
  access layer and part of the validation method.

## Two artefacts

1. **Translation memory** (`packages/phrasebank/entries/<code>/tm.yaml`) — page strings, keyed by
   normalized FR/EN source.
2. **Phrase bank** (`packages/phrasebank/entries/<code>/phrases.yaml`) — spoken plans, keyed by ID
   and slots.

Both follow the same workflow.

## Method — validation by listening

A written back-translation would exclude speakers who do not read Fulfulde. The
preselection uses an oral protocol, recorded in
[ADR 0013](decisions/0013-oral-validation-by-listening.md):

1. **Correction pass.** The team plays the local MMS audio for an entry with the
   French source visible. The speaker says whether the meaning is right, what is
   wrong, and the correct spoken form. The team transcribes.
2. **Blind pass.** The team plays the corrected Fulfulde audio only. The speaker
   says the French meaning. The team records it as `backTranslationFr`, with a
   meaning score (1–5), a naturalness score (1–5) and a critical-error flag.
3. **Confirmation.** The corrected entry is synthesized again; the speaker
   listens and confirms it.
4. **Record the limitation.** One speaker, oral review, no written
   back-translation, same-day passes. The note states it.

The audio is generated locally by `POST /tts` with `ZTEAM_TTS_BACKEND=mms`. It
never leaves the machine.

## Workflow

1. Extract the exact FR/EN strings from the live page (`pnpm strings`).
2. The team writes the source sentence and slot types; do not paraphrase.
3. A native speaker supplies or corrects the Adamawa Fulfulde target **orally**;
   the team transcribes it. A machine translation is a draft, never a validator.
4. A native speaker, blind to the source, gives the French meaning by listening;
   the team records it. A second speaker is preferred; a single-speaker
   limitation must be recorded.
5. The team and the speaker adjudicate any drift; the speaker confirms the
   corrected audio.
6. The speaker records the spoken phrases, or the MMS baseline is used and
   evaluated.
7. Fill `validatedBy` and `backTranslationFr`; the release build enforces them.
8. Any change creates a new version and requires re-validation.

If only one speaker is available, run the correction and blind passes on
different days where possible and record the limitation in the technical note.
If the session is compressed into one day, say so.

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
- `eval/linguistic/back-translation.csv` — source, Fulfulde, French meaning,
  scores, critical-error flag, fix.
- `eval/linguistic/tts-mos.csv` — naturalness and intelligibility ratings.
- `eval/linguistic/session/index.html` — the two-pass listening page (local, not
  committed; the audio is gitignored).
- `eval/linguistic/coverage.csv` — coverage output.
- `docs/TTS_REPORT.md` — data, normalisation, training, evaluation, decision.
- Sign-off: speaker pseudonym, dates, TM and phrase bank versions, method
  (`oral-listening`).

## Current status

**Draft packs, oral validation pending.** The checked-in human packs
`entries/<code>/tm.yaml` and `phrases.yaml` are seeds with empty targets. The NLLB
and Marian candidates live in `tm.mt.yaml` and `phrases.mt.yaml` and are drafts,
not validated. The development build warns. A generated language test stays red
until medium/high-risk entries have a target, a validator and a French
back-translation. `pnpm check:evidence` reports the stricter all-languages state
and fails while either pack is a draft.

No session is booked. This section becomes the signed record when it runs:
speaker pseudonym, language, dialect, date, method, number of entries, critical
errors, scores and limitation.

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

We do not claim general Fulfulde or Yemba translation, validated coverage, a
recorded native-speaker review or a MOS. No session has run. The repository
documents the candidate packs and the protocol that will produce that evidence.
