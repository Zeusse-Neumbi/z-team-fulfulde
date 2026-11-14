# Add a language

The target language is data. Adding one must not edit the loader, the server,
the translator or the extension; if it does, the extension point is broken.

## Scaffold

```bash
pnpm lang:add ewo --model facebook/mms-tts-ewo --mt francais-ewondo
```

Use `--model none` for a text-only language. The command creates:

| File | Content |
| --- | --- |
| `languages/<code>.yaml` | the registry row (status `draft` or `text-only`) |
| `packages/phrasebank/entries/<code>/tm.yaml` | the fub ids and sources, every target empty (`text: ""`, `origin: human`) |
| `packages/phrasebank/entries/<code>/phrases.yaml` | the same for spoken phrases |
| `packages/phrasebank/numbers/<code>.json` | the empty number lexicon |
| `models/manifest.json` | a download stub for the MT pair and the voice |
| `packages/phrasebank/src/language-<code>.test.ts` | a test that fails until the pack is validated |

Nothing is translated by the scaffolder. An empty target is a valid draft; an
invented target is not.

## Fill the data

1. **Letters.** Replace the placeholder `letters` with the AGLC inventory for
   the language. The tokenizer guard measures the voice against it.
2. **Registry names.** Set `endonym`, `names.fr` and `names.en`. The panel
   picker reads them.
3. **Voice policy.** Set `speech.voice` to `bundled`, `api` or `none`. A new
   language cannot inherit the Fulfulde clips; the panel checks the clip pack
   language. Fill the manifest stubs with the real file names, sizes and
   SHA-256 values, then `pnpm models:download mt-<code> mms-<code>`. The
   downloader verifies every hash.
4. **Numbers.** Fill `numbers/<code>.json` or leave it empty; an empty lexicon
   is a draft, not a validated number verbalizer.
5. **Targets.** Either leave the human pack empty (`origin: human`) or generate
   a candidate pack with `scripts/translate-phrasebank.py --lang <code>`. A
   candidate is written to `entries/<code>/tm.mt.yaml` and
   `phrases.mt.yaml` with `origin: mt`; it is never copied into the human pack
   without review.

## Validate

A native speaker supplies, for every medium/high-risk entry:

- the target text in `target.<code>.text`;
- a non-empty `target.<code>.validatedBy`;
- a French `target.<code>.backTranslationFr`.

The oral-listening path in [ADR 0013](decisions/0013-oral-validation-by-listening.md)
is enough for the evidence; the team records it.

The generated test compares the pack with the release gate:

```bash
pnpm --filter @zteam/phrasebank test
```

It fails while any medium/high-risk entry has no validator or back-translation.
Only then set `status: validated` in `languages/<code>.yaml` and run:

```bash
pnpm check:evidence
pnpm --filter @zteam/phrasebank build:release
pnpm check:tokenizer
```

## Draft versus validated

- `draft` may ship machine candidates or empty targets. The panel shows the
  draft label and `packValidated: false`.
- `validated` means the evidence exists. `build:release` refuses the language
  otherwise.
- `text-only` has no voice; the panel disables audio with a reason.

Never render a draft as validated. Never fill a missing target by guessing.

## Licence

The repository is source-available under PolyForm Noncommercial 1.0.0. A model
under CC-BY-NC-4.0 is compatible with that noncommercial distribution; record
it in [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md). Commercial use still
needs a separate written licence. Do not add a model whose licence forbids
noncommercial redistribution.

## Prove the extension point

On a scratch branch:

```bash
pnpm lang:add lns --model facebook/mms-tts-lns --mt francais-lamnso --name Lamnso
git status --short
```

The diff contains only `languages/`, `packages/phrasebank/entries/`,
`packages/phrasebank/numbers/`, `models/manifest.json` and the new generated
test. No existing `.ts` or `.py` file is edited; the test suite derives the
registry list and `MMSTTS` applies the registry `speech.substitutions`, so a
new voice does not need a Python edit. The `letters` field and any
substitutions are **data to be supplied by a speaker** — the scaffolder's ASCII
placeholder is not an inventory. The generated test stays red until validation.

A worked Lamnso run is recorded in
[`ADD_A_LANGUAGE_PROOF.md`](ADD_A_LANGUAGE_PROOF.md).
