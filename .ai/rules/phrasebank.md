# Phrasebank and language rules

Applies to `packages/phrasebank/**`, `languages/**` and `eval/linguistic/**`.
Every rule is per language; Fulfulde (`fub`) and Yemba (`ybb`) are separate
packs and separate validation sessions.

## Source of truth

- `packages/phrasebank/entries/tm.yaml` — translation memory for interface text.
- `packages/phrasebank/entries/phrases.yaml` — spoken phrases and slots.
- `packages/phrasebank/numbers/numbers.fub.json` — number lexicon.
- `eval/linguistic/back-translation.csv` — validation evidence.
- `docs/LINGUISTIC_VALIDATION.md` — the method and results.

## Adding or changing a translation

1. Add the FR and EN source strings, stable ID and version.
2. Do not invent a Fulfulde target. Leave it empty until a native speaker
   supplies or corrects it, unless the entry is low risk and already has a
   validated source.
3. For medium/high risk, add a validator, a French back-translation and the
   session/date in the evidence file. The review may be oral: the speaker hears
   the local MMS audio, gives the French meaning and rates intelligibility; the
   team records it. See
   [`docs/decisions/0013-oral-validation-by-listening.md`](../../docs/decisions/0013-oral-validation-by-listening.md).
4. Preserve placeholders exactly (`{amount}`, `{name}`, `{reference}`).
5. Add or update a loader test.
6. Run:

```bash
pnpm --filter @zteam/phrasebank test
pnpm --filter @zteam/phrasebank build
```

`build:release` enforces evidence only for a language whose registry row says
`status: validated` (ADR 0020). A draft may ship only when the panel labels it
as a draft and `packValidated` is false. `pnpm check:evidence` is the stricter
check and must fail while any language is not validated. Do not weaken either
gate.

## Orthography

- Target languages are registered in `languages/<code>.yaml`. The demonstrated
  language is Adamawa Fulfulde, ISO 639-3 `fub`; Yemba (`ybb`) is a draft.
- Normalize `ɲ` → `ny`, `ꞌ` → `'`, NBSP and narrow NBSP to a normal space only
  in lookup keys, never in displayed protected values.
- Record the sub-variety and speaker in the validation evidence.

## Do not

- Translate amounts, fees, totals, references, names, phones or account numbers.
- Use a machine translation as a validator.
- Fill the validator field with a generic name.
- Remove the release gate or add a broad warning ignore.
