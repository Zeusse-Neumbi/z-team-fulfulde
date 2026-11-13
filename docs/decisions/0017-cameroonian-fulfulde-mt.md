# 0017 — Cameroonian Fulfulde text and a voice that stops dropping letters

- **Status:** accepted
- **Date:** 2026-11-13
- **Supersedes:** the "treat Adamawa output as a proxy" part of
  [0011](0011-configurable-model-providers.md) for the default Fulfulde route.
  The provider contract, typed failures and the NLLB fallback stay in force.
- **Related:** [0013](0013-oral-validation-by-listening.md) — the voice is still
  not natively validated; this record only stops it destroying words.

> The plan named this record `0014`. Numbers 0014 (`loopback-api-discovery`),
> 0015 (`runtime-local-mt-fallback`) and 0016 (`ship-labelled-mt-pack-and-audio`)
> were already accepted, so it is 0017.

## Context

Two independent defects shipped together and neither raised an error.

1. **The text was not Cameroonian.** `services/mt.py` mapped `fub` to the NLLB
   token `fuv_Latn` because NLLB has no `fub` token. `fuv_Latn` is Nigerian
   Fulfulde: the vocabulary is close enough to translate, far enough to be the
   wrong orthography and the wrong lexicon for an Adamawa reader.
2. **The voice deleted letters.** `models/mms-tts-ful` is the Fulah
   *macrolanguage* checkpoint. Its 41-entry vocabulary contains only
   `ŋ ƴ ɓ ɗ` as non-ASCII characters. `VitsTokenizer` silently drops every
   character missing from that vocabulary, so:

   ```
   nɛɛsa   ->  |n|s|a|        (ɛ dropped)
   ɲaamdu  ->  |a|a|m|d|u|     (ɲ dropped)
   ```

   AGLC segmental coverage measured **26/30 = 86.7%**, tone coverage **0**. This,
   not the choice of language, is why Cameroonian listeners did not understand
   the audio.

`flagship-ai/cameroon-int8` is a ready-to-serve int8 CTranslate2 bundle with 119
French-pivot Marian pairs across Cameroonian languages, corpus normalised under
the AGLC alphabet. Its `francais-fufulde` pair is 77 MB, ships its own
sentencepiece tokenizer, and loads through the existing `MarianMT` provider with
no new code.

## Decision

1. **Default Fulfulde text is `marian` + `francais-fufulde`.** A new setting,
   `ZTEAM_MT_MARIAN_MODEL` (default
   `models/cameroon-int8/francais-fufulde`), points the Marian backend at the
   Cameroonian pair. `.env.example` sets `ZTEAM_MT_BACKEND=marian`. The server's
   code default stays `stub`, so a bare checkout still starts without weights.
2. **NLLB stays as the explicit fallback.** `ZTEAM_MT_MODEL` keeps its NLLB
   meaning and `NLLB_LANGS` keeps `fub → fuv_Latn`. Selecting
   `ZTEAM_MT_BACKEND=nllb` still works and is the documented route for English,
   because the Marian pair is French-pivot only.
3. **Speech input is normalized per language, displayed text is not.**
   `services/speech_norm.py` holds `SPEECH_SUBSTITUTIONS` and
   `normalize_for_speech(lang, text)`. `MMSTTS` takes `lang=` and normalizes
   before tokenizing. `ɛ ɔ ɲ ʼ` map to the nearest grapheme the voice has; tone
   marks are folded to their base vowel. The `fub` table does **not** map
   `ƴ`, `ŋ`, `ɓ` or `ɗ`: the measurement shows the voice can say them, so
   replacing `ƴ` with `y` (as the draft plan proposed) would discard a sound for
   no reason.
4. **The tokenizer gap is a measured, tested guard.**
   `scripts/check-tokenizer-coverage.py` compares a model vocabulary with the
   AGLC inventory and prints one machine-readable summary line. `pnpm
   check:tokenizer` is strict and exits 1 on `mms-tts-ful` — the correct result.
   `pnpm ci:local` runs `pnpm check:tokenizer:warn`, which prints
   `status=warn` and exits 0, because blocking the gate before a better voice
   lands would make every branch red for a known defect. The guard itself is
   tested in `apps/server/tests/test_tokenizer_coverage.py`.
5. **No display-layer change.** Amounts, references and every protected value
   are untouched: normalization happens inside the TTS provider, after the
   translator. There is no new host permission, no network egress and no cloud
   call.

## Reproduce

```bash
# the voice gap (exits 1, prints: missing: ɛ ɔ ɲ ʼ / tone: none)
pnpm check:tokenizer

# the MT vocabulary (exits 0, prints: missing: ƴ, tone marks present)
python3 scripts/check-tokenizer-coverage.py \
  --lang fub --model models/cameroon-int8/francais-fufulde
```

## Consequences

- **Quality spot check failed on financial strings.** Six samples through the
  shipped configuration produced `Solde → Balance` (untranslated),
  `Numéro de compte → Nden kam, Allah wi'i:` (scripture), a repeated
  `Ndaa, ndaa, ndaa, ndaa`, and `Aïssatou → Aiyatu` (a name change). The table
  is in `docs/MODELS.md`. The pair is therefore a **candidate**, not adopted
  text: keep the `MT` label, never send mixed label/value nodes to
  `/translate`, and prefer `ZTEAM_MT_BACKEND=nllb` for the demo until a native
  speaker reviews a sample. This record adopts the *route*, not the output.
- **French-pivot only.** An English page routed to `marian` is translated
  French-pivot from English input; the model was not trained for it. Keep
  English on `nllb`, or add an EN→FR step. This is a known limitation, not a
  silent fallback.
- **`ƴ` is missing from the MT vocabulary.** Confirmed end to end:
  `ƴeewndo → eewndo`, `ƴiiƴam → iiam`. The piece is absent from the
  sentencepiece vocabulary, so it is dropped on encode and cannot be produced
  on decode. Treat any `ƴ` word as corrupted.
- **The voice is still not Adamawa.** Normalization keeps the word shape; it
  cannot restore `ɛ`, `ɔ`, `ɲ` or tone. `mms-tts-ful` remains a macrolanguage
  voice and must be labelled as such. The real fix is a fine-tune on a Cameroon
  Adamawa corpus (`mimba/afrilang`, `fub_cm`), which is post-deadline.
- **Licence asymmetry.** The int8 bundle is **CC-BY-NC-4.0**; the fp32
  originals are CC-BY-4.0. Both are recorded in `THIRD_PARTY_NOTICES.md`. Anyone
  who needs BY-only terms must convert the fp32 originals locally.
- **`models/manifest.json` is now tracked.** It was gitignored while
  `scripts/download-models.mjs`, `pnpm doctor` and the docs all required it, so
  a fresh clone could not verify or download a model. The manifest holds
  metadata only (names, sizes, SHA-256, licences); weights stay ignored.

## What would reverse this

- A validated Adamawa MT model, or a native-speaker-reviewed corpus that shows
  the Cameroonian pair is worse than NLLB on financial vocabulary.
- A voice whose vocabulary covers the full AGLC inventory, which would let the
  strict guard become blocking and retire the substitutions.
- Evidence that `ƴ` output from the bundle is materially wrong, which would
  make the French-pivot pair unsafe for words that use it.
