# 0013 — Validate Fulfulde by listening, with the local voice as the interface

- **Status:** accepted
- **Date:** 2026-11-11
- **Supersedes:** the written-only back-translation assumption in
  [`LINGUISTIC_VALIDATION.md`](../LINGUISTIC_VALIDATION.md)

## Context

Adamawa Fulfulde is predominantly an oral language for many of its speakers.
Written Fulfulde literacy is not universal, and the preselection team has access
to a native speaker who can judge the language by ear but is not a fluent
reader of the Latin orthography. A validation protocol that requires the
speaker to read a source sentence and write a back-translation would exclude
the very users the product is built for.

The product already ships a local MMS voice. That voice is not a decoration: it
is the access layer for users who do not read Fulfulde, and it can also be the
interface through which a speaker validates the translation memory and the
spoken phrase bank.

## Decision

Validate the Fulfulde pack **by listening**, in two passes:

1. **Correction pass.** The team plays the MMS audio for an entry with the
   French source visible. The speaker says whether the meaning is right, what
   is wrong, and the correct spoken form. The team transcribes the correction.
2. **Blind pass.** The team plays the corrected Fulfulde audio only. The speaker
   says the French meaning. The team records it as `backTranslationFr`, with a
   meaning score (1–5), a naturalness score (1–5) and a critical-error flag.
3. **Confirmation.** The corrected entry is synthesized again; the speaker
   listens and confirms it.

The validation interface is the local `/tts` endpoint with
`ZTEAM_TTS_BACKEND=mms`. The audio stays on the machine.

## What the release gate checks

`pnpm --filter @zteam/phrasebank build:release` still requires, for every
medium/high-risk entry:

- a Fulfulde target;
- a non-empty `validatedBy`;
- a non-empty `backTranslationFr`.

The oral method fills the same fields as a written review. The evidence file
records the method, the speaker pseudonym and the session date.

## Consequences

- The note must say **“revised and evaluated by a native speaker through
  listening”**, not “translated by a native speaker”.
- A single-speaker session is a documented limitation, not a hidden one.
- The TTS is now a P0 deliverable: it is the validation interface and the
  access layer.
- A second native speaker remains the target for the post-hackathon release;
  the limitation is recorded in the note and in the validation evidence.
- If the MMS voice is judged unintelligible, the decision is a negative TTS
  result: the page translation still ships, the voice is disabled by default,
  and recorded clips or a fine-tune become the roadmap.

## Evidence

- `eval/linguistic/back-translation.csv`
- `eval/linguistic/tts-mos.csv`
- [`docs/LINGUISTIC_VALIDATION.md`](../LINGUISTIC_VALIDATION.md)
- [`docs/TTS_REPORT.md`](../TTS_REPORT.md)
- `eval/linguistic/session/index.html` (local, not committed)
