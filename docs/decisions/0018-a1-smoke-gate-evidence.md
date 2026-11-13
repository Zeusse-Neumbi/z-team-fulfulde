# 0018 — The A1 smoke-test gate: what `cameroon-int8` can and cannot produce

- **Status:** accepted
- **Date:** 2026-11-13
- **Related:** [0017](0017-cameroonian-fulfulde-mt.md) — the Cameroonian MT
  route. This record narrows the evidence claim in 0017; it does not change the
  routing decision.

## Context

A1's acceptance asked for `/translate` output containing `ɛ`, `ɔ` or `ŋ`. The
exact sentence used for the smoke test was:

```
Votre solde est de 250 000 FCFA.
```

It returned:

```
On payi mooɗon ɗon njogi, nden kam haa fodde fodde: Fombinaaɗam, njoweeɗam.
```

That output contains `ɗ`, but no `ɛ`, `ɔ` or `ŋ`. It was reported as "AGLC
letters present" and A2–A4 proceeded. That was too generous: the literal gate
was not met, and the gap was left without evidence. This record closes it.

## Evidence

All measured on 13 November 2026, `marian` + `models/cameroon-int8/francais-fufulde`,
`ZTEAM_MT_BEAM_SIZE=2`, through `POST /translate`:

| Letter | 97-sentence probe | Notes |
| --- | --- | --- |
| `ɗ` | 50/97 | common |
| `ɓ` | 34/97 | common |
| `ŋ` | 12/97 | e.g. `mbaŋgina`, `gooŋɗini`, `ɓiŋngel` |
| `ɛ` | **0/97** | never selected |
| `ɔ` | **0/97** | never selected |
| `ɲ` | 0/97 | never selected |
| `ƴ` | 0/97 | absent from the vocabulary |

The 97 source/output pairs are in
[`docs/evidence/a1-smoke-probe.tsv`](../docs/evidence/a1-smoke-probe.tsv).

Vocabulary (`vocab.json`, 59,514 pieces):

- `ɛ`, `ɔ`, `ŋ`, `ɓ` and `ɗ` each occur **once**, as the bare character.
- `ɛ` and `ɔ` have **zero** multi-character pieces.
- `e` has 27,058 pieces and `o` 16,214, so the training corpus writes `e`/`o`.
- `ƴ` has no piece at all: `ƴeewndo → eewndo`, `ƴiiƴam → iiam`.

The decoder composes `ŋ` into words because the character is in the alphabet and
the corpus uses it inside words. It never selects `ɛ` or `ɔ`, because the corpus
does not use them inside words; beam width, length penalty, repetition penalty
and no-repeat-ngram settings were tested and none changes that.

## Decision

1. **The gate is met for `ŋ`** (and for `ɓ`/`ɗ`), and **not met for `ɛ`/`ɔ`.**
2. The `ɛ`/`ɔ` requirement is recorded as **unachievable for this checkpoint**,
   not as a defect to be fixed by decoding. A model cannot emit a letter its
   corpus never used in words.
3. The claim in 0017 is narrowed: the default route produces labelled MT in AGLC
   `ŋ ɓ ɗ`, **not** "AGLC output including `ɛ` and `ɔ`". `docs/MODELS.md`
   carries the table and the reproducible command.
4. The out-of-scope `.gitignore` edit from PR #62 is reverted in this follow-up.
   `models/manifest.json` stays tracked because ignore rules do not apply to
   tracked files; a modification still shows as ` M` after the revert.

## Consequences

- Do not advertise `ɛ` or `ɔ` output from this pair. Doing so would be a false
  claim about the model and about AGLC.
- A hard `ɛ`/`ɔ` requirement needs either a model trained on that orthography or
  native-speaker post-editing. Neither exists in this track.
- Accepting the gap is a product decision for the owner, not an engineering
  one. This record is the evidence that decision needs.

## What would reverse this

- A model whose sentencepiece vocabulary has multi-character `ɛ`/`ɔ` pieces,
  which would prove the corpus uses those letters.
- A native speaker confirming that `e`/`o` spelling is the intended Adamawa
  convention for this corpus. In that case the gate itself was wrong, not the
  model, and the acceptance criterion should be rewritten rather than the
  weights.
