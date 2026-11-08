---
name: Linguistic Validation
description: Record native-speaker validation, back-translation, coverage and TTS evidence that a jury can audit.
---

# Linguistic validation

Use this skill when the task is native-speaker review, back-translation, coverage
evidence, TTS evaluation or the linguistic section of the technical note.

## Read first

- `.ai/rules/phrasebank.md`
- `docs/LINGUISTIC_VALIDATION.md`
- `eval/linguistic/README.md`
- `docs/TTS_REPORT.md`

## Workflow

1. Prepare the string inventory and the speaker packet:
   - source FR/EN;
   - context and risk;
   - placeholder list;
   - recording script.
2. Record the session metadata: date, speaker, dialect/sub-variety, consent and
   whether a second speaker adjudicated.
3. Fill the Fulfulde target and the blind French back-translation. Do not let
   the translator see the original while back-translating.
4. Score meaning and naturalness. Flag critical errors: changed value, wrong
   warning, wrong action, unsafe confirmation.
5. Update:
   - `packages/phrasebank/entries/tm.yaml` and `phrases.yaml`;
   - `eval/linguistic/back-translation.csv`;
   - `eval/linguistic/tts-mos.csv` when speech is evaluated;
   - `docs/LINGUISTIC_VALIDATION.md` with the method and results.
6. Run:

```bash
pnpm --filter @zteam/phrasebank test
pnpm --filter @zteam/phrasebank build
```

## Guardrails

- Do not invent a validator or a session.
- Do not use machine translation as the validator.
- Do not attribute a quote to a speaker who did not say it.
- Do not include real personal data or page values.
- A negative TTS result is valid evidence; document it instead of hiding it.
