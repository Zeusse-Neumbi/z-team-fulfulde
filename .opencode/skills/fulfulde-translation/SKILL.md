---
name: Fulfulde Translation
description: Add or change a Fulfulde translation, translation-memory unit or spoken phrase without inventing language or weakening validation.
---

# Fulfulde translation

Use this skill when the task touches `packages/phrasebank/entries/`,
`packages/phrasebank/numbers/`, `eval/linguistic/` or a translation string in the
extension.

## Read first

- `.ai/rules/project.md`
- `.ai/rules/phrasebank.md`
- `.ai/rules/testing.md`
- `docs/LINGUISTIC_VALIDATION.md`

## Workflow

1. Locate the source string and its stable ID in `tm.yaml` or `phrases.yaml`.
2. Determine the risk: low, medium or high. Amounts, fees, warnings, references
   and confirmations are high risk.
3. Do not invent a Fulfulde target. Leave the target empty until a native
   speaker supplies it, unless the entry is low risk and already validated.
4. For medium/high risk, add:
   - the Fulfulde target;
   - a named validator and session date;
   - a French back-translation;
   - the evidence row in `eval/linguistic/back-translation.csv`.
5. Preserve placeholders exactly (`{amount}`, `{name}`, `{reference}`) and keep
   the protected value outside the translated segment.
6. Add or update a loader test and run:

```bash
pnpm --filter @zteam/phrasebank test
pnpm --filter @zteam/phrasebank build
```

7. The release build must still fail while a medium/high-risk entry is
   unvalidated:

```bash
pnpm --filter @zteam/phrasebank build:release
```

## Guardrails

- Never use a machine translation as the validator.
- Never fill `validatedBy` with a placeholder name.
- Never translate a value, name, phone, account, reference or user input.
- Never remove the release gate to make the build green.
- Record the Adamawa Fulfulde sub-variety and speaker consent.
