# Phrasebank machine-translation candidates

- Date: 2026-11-09
- Model: `JustFrederik/nllb-200-distilled-600M-ct2-int8` (NLLB-200 600M, int8,
  CTranslate2, `fuv_Latn` token)
- Runtime: local API `POST /translate`, `provider=nllb`, loopback only

## What was produced

| Artefact | Content |
|---|---|
| `packages/phrasebank/entries/tm.mt.yaml` | 80 interface strings with an MT `ff` candidate |
| `packages/phrasebank/entries/phrases.mt.yaml` | 35 spoken phrases with an MT `ff` candidate |
| `eval/linguistic/mt-candidates.csv` | one row per entry: source, candidate, placeholders, mask check |

Run summary:

```
[phrasebank-mt] translated=115 skipped=0 placeholder_failures=0 in 120.5s
```

Every placeholder (`{amount}`, `{name}`, `{account}`, `{reference}`) survived the
mask/translate/unmask pass. `validatedBy` and `backTranslationFr` are empty in
every candidate, so `releaseErrors()` still lists the pack and
`pnpm --filter @zteam/phrasebank build:release` still fails.

## How to preview the candidates

The validated production pack is unchanged; the runtime local-API fallback in
[ADR 0015](decisions/0015-runtime-local-mt-fallback.md) is a separate, labelled
path and does not promote these candidates. To build an evaluation pack:

```bash
ZTEAM_PHRASEBANK=mt pnpm --filter @zteam/phrasebank build
ZTEAM_PHRASEBANK=mt pnpm build:test       # fixture build for the canary harness
```

`ZTEAM_PHRASEBANK=mt` makes the loader read `tm.mt.yaml` and `phrases.mt.yaml`.
The extension then shows the MT candidates, and the panel still says the pack is
unvalidated. Never ship this ZIP as the validated product.

To regenerate after a model or prompt change:

```bash
ZTEAM_MT_BACKEND=nllb ZTEAM_MT_RUNTIME=ct2 \
ZTEAM_MT_MODEL=models/nllb-200-600m-int8 \
  uv run --project apps/server uvicorn app.main:app --port 8002
uv run --project apps/server python scripts/translate-phrasebank.py \
  --base-url http://127.0.0.1:8002
```

## Quality: what the model gets right and wrong

Good signs:

- amounts and placeholders are preserved: `Votre solde est de {amount}.` →
  `Fedde mon woni {amount} .`;
- simple labels are recognisable: `Banque en ligne` → `Banki e nder internet`,
  `Frais` → `Feeje`;
- a native speaker can correct the output faster than translating from zero.

Blocking defects found in the candidates (why this is not a release pack):

| Source | Candidate | Problem |
|---|---|---|
| `Confirmer` | `Fedde jaaynde` | means "group of the market"; wrong |
| `Bénéficiaire` | `Jaɓɓorgo Fedde` | wrong register and duplicated noun |
| `Le bénéficiaire est {name}.` | `Jaɓɓorgo Jaɓɓorgo Fuuta: {name} .` | duplicated noun, wrong place name |
| `Une erreur est affichée…` | `… dow dow dow dow walluki…` | degenerate repetition |
| `Solde insuffisant…` | `Ɗuum je'aaki…` | negation/meaning not reliable |
| `Le total sera de {amount}.` | `Fedde nden nden ko {amount} .` | duplicated determiner |

Verdict: NLLB-600M on `fuv` is a useful **drafting assistant**, not a translator
for financial instructions. The warning, confirmation, negation and error
strings are exactly the ones a mistranslation can make dangerous. They must go
through the native-speaker back-translation workflow in
`docs/LINGUISTIC_VALIDATION.md` before any release build.

## Promotion workflow

1. A native speaker reviews every candidate in `tm.mt.yaml` / `phrases.mt.yaml`.
2. The corrected target is copied into `tm.yaml` / `phrases.yaml`.
3. A second speaker back-translates blind; the result is recorded in
   `eval/linguistic/back-translation.csv`.
4. `validatedBy` and `backTranslationFr` are filled.
5. `build:release` is the gate; it must pass only after step 4.

No candidate was copied into the main pack automatically. That is deliberate:
the repository rule is that a machine translation is never a validator.
