# Phrasebank and language rules

Applies to `packages/phrasebank/**` and `eval/linguistic/**`.

## Source of truth

- `packages/phrasebank/entries/tm.yaml` — translation memory for interface text.
- `packages/phrasebank/entries/phrases.yaml` — spoken phrases and slots.
- `packages/phrasebank/numbers/numbers.fub.json` — number lexicon.
- `eval/linguistic/back-translation.csv` — validation evidence.
- `docs/LINGUISTIC_VALIDATION.md` — the method and results.

## Adding or changing a translation

1. Add the FR and EN source strings, stable ID and version.
2. Do not invent a Fulfulde target. Leave it empty until a native speaker
   supplies it, unless the entry is low risk and already has a validated source.
3. For medium/high risk, add a validator, a French back-translation and the
   session/date in the evidence file.
4. Preserve placeholders exactly (`{amount}`, `{name}`, `{reference}`).
5. Add or update a loader test.
6. Run:

```bash
pnpm --filter @zteam/phrasebank test
pnpm --filter @zteam/phrasebank build
```

The release build (`pnpm --filter @zteam/phrasebank build:release`) must fail
while any medium/high-risk entry is unvalidated. Do not weaken that gate.

## Orthography

- Target is Adamawa Fulfulde, ISO 639-3 `fub`.
- Normalize `ɲ` → `ny`, `ꞌ` → `'`, NBSP and narrow NBSP to a normal space only
  in lookup keys, never in displayed protected values.
- Record the sub-variety and speaker in the validation evidence.

## Do not

- Translate amounts, fees, totals, references, names, phones or account numbers.
- Use a machine translation as a validator.
- Fill the validator field with a generic name.
- Remove the release gate or add a broad warning ignore.
