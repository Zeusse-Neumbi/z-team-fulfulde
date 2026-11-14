# Data-only proof: adding Lamnso (`lns`)

A third Cameroonian language was added on a scratch branch to test the claim
that a language is data, not code. The proof branch is
`scratch/proof-lns`, based on Track B commit `0011440`; it is intentionally
**not merged**. The full run log is in `/tmp/lns-proof-report.md` on the
machine that ran it.

## Scaffold

```bash
node scripts/add-language.mjs lns --model facebook/mms-tts-lns --mt francais-lamnso --name Lamnso
```

Output: `languages/lns.yaml`, `entries/lns/{tm,phrases}.yaml` (80 units,
35 phrases, every target `text: ""`, `origin: human`), `numbers/lns.json`, a
manifest stub and the generated `language-lns.test.ts`.

The only changes on the branch were:

```
languages/lns.yaml
packages/phrasebank/entries/lns/tm.yaml
packages/phrasebank/entries/lns/phrases.yaml
packages/phrasebank/numbers/lns.json
models/manifest.json
packages/phrasebank/src/language-lns.test.ts   (new generated test)
```

`git diff --name-only -- '*.ts' '*.py'` was empty: no existing TypeScript or
Python file was edited.

## Models

| Entry | Repo | Size | Licence |
| --- | --- | --- | --- |
| `mt-lns` | `flagship-ai/cameroon-int8`, `francais-lamnso` | 77 MB int8 + 4.1 MB tokenizer | CC-BY-NC-4.0 |
| `tts-lns` | `facebook/mms-tts-lns` | 145 MB VITS | CC-BY-NC-4.0 |

The manifest stubs were filled from the Hub tree (LFS `oid` is the SHA-256),
and `node scripts/download-models.mjs --check mt-lns mms-lns` reported every
file `ok`. The link was degraded (~11–20 KB/s per connection); the transfer
used parallel HTTP/1.1 ranges and the assembled bytes were checked against the
manifest hashes. Models stay gitignored.

## Build and gate

```text
[phrasebank] generated 3 language pack(s):
  fub (80 units, 35 phrases, draft),
  lns (80 units, 35 phrases, draft),
  ybb (80 units, 35 phrases, draft)
```

`lns` is emitted as `draft` with `packValidated: false`. `pnpm typecheck`
passed.

The generated validation test fails with **246 release errors** until a native
speaker supplies targets, validators and French back-translations. That is the
honest gate, not a regression: a scaffolded language cannot look validated.

## Tokenizer

`python3 scripts/check-tokenizer-coverage.py --registry --warn-only` measured
`lns` at **24/26 (92%)** against the scaffolder's **placeholder ASCII** letters
(missing `q`, `x`). The MMS Lamnso vocabulary has no `ɛ ɔ ɲ ɓ ɗ ƴ`. The real
AGLC inventory and any substitutions must come from a speaker; the placeholder
is not an alphabet and was not treated as one.

## Draft MT and voice

Five fictional French financial sentences were translated with the local
Lamnso Marian pair. The draft **does not preserve amounts** (`12 500`, `1 000`,
`25 000`, `3 500` were dropped or rewritten; `FCFA` became `FCAFA`). Only the
alphanumeric reference survived. This is a draft signal; the extension's
protected-value vault still keeps page values out of translation.

The MMS Lamnso voice produced a 16 kHz mono WAV, **10.06 s**, 322,048 PCM
bytes. It is a draft: uppercase and punctuation were dropped, and it has no
native-speaker listening validation.

## Gaps fixed after the proof

The first run found two real extensibility gaps (both fixed in the main
branch before this document was written):

1. **Hardcoded language lists in tests.** Six assertions in
   `packages/phrasebank/src/{generated,loader}.test.ts` and
   `apps/server/tests/{test_translate,test_tts,test_phrasebank}.py` expected
   exactly `["fub","ybb"]`. They now require `fub`/`ybb` to be present and
   derive the rest from the registry, so a third language does not need a test
   edit. Re-running the fixed checks in the proof worktree with `lns` present:
   `generated.test.ts` + `loader.test.ts` **15 passed**, and the three Python
   files **42 passed**. The generated `language-lns.test.ts` still fails by
   design; the test files were restored so the branch remains data-only.
2. **Registry substitutions were unused.** `speech.substitutions` was parsed
   but the voice grapheme map lived only in `speech_norm.py`. `MMSTTS` now
   applies the registry substitutions for the requested language, so a new
   voice can map its missing letters from data. The fub/ybb tables in
   `speech_norm.py` are unchanged.

After those fixes the runtime path is data-only: registry row, empty packs,
numbers, manifest, voice substitutions, MT model resolution and the extension
picker all come from data. The **validation** remains deliberately gated.

## Verdict

Adding a language is data-only for the runtime; a native speaker is still
required before `status: validated`. The Lamnso pack is not merged; the proof
branch exists to show the extension point and to keep an unvalidated language
out of the submission ZIP. A real Lamnso launch needs the AGLC letters, a
speaker-validated pack and a listening test for the voice.
