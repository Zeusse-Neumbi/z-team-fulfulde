# Language registry

One YAML file per target language. The file name must match `code`, which is
the ISO 639-3 code (`fub`, `ybb`, ...). The loader reads every row in this
directory; adding a language is a new file here plus a pack and a model folder,
not a code change.

```yaml
code: fub                 # ISO 639-3, lowercase, three letters
endonym: Fulfulde         # name in the language itself
names: { fr: ..., en: ... }
script: Latn
direction: ltr            # ltr | rtl
orthography: AGLC
status: draft             # validated | draft | text-only
letters: "..."            # alphabet used by the tokenizer coverage check
mt:                       # machine translation
  provider: marian
  model: models/cameroon-int8/francais-fufulde
  pivot: fr
speech:                   # text to speech
  provider: mms
  model: models/mms-tts-ful
  tone: none              # none | partial | full
  substitutions: { ... }  # speech-only letter fallbacks
numbers: numbers/fub.json # relative to packages/phrasebank
pack: entries/fub         # relative to packages/phrasebank
```

`pack` and `numbers` are relative to `packages/phrasebank/`. The loader asserts
that both exist, that every `code` is unique, and that every `target` key in a
pack is a registered language. A typo in a language code fails at load time
instead of silently shipping an empty pack.

## Status

- `draft` — the pack may hold machine candidates or empty targets. The panel
  must show it as a draft and the release gate does not accept it as validated.
- `validated` — every medium/high-risk entry has a validator and a French
  back-translation. `build:release` refuses the language otherwise.
- `text-only` — there is no voice for this language; the audio control is
  disabled with a reason.

A draft pack is never rendered as a validated pack, and no translation is
invented to fill an empty target.

## Adding a language

See [`docs/ADD_A_LANGUAGE.md`](../docs/ADD_A_LANGUAGE.md) for the full
checklist: registry row, empty pack, numbers lexer, model manifest and the test
that fails until a native speaker validates the entries.
