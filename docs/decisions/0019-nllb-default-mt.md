# 0019 — Keep NLLB as the default Fulfulde MT; `cameroon-int8` stays opt-in

- **Status:** accepted
- **Date:** 2026-11-13
- **Supersedes:** the default-route part of
  [0017](0017-cameroonian-fulfulde-mt.md). The Cameroonian model, its manifest
  entry, its downloader target and the evidence in
  [0018](0018-a1-smoke-gate-evidence.md) all remain in force as an evaluation
  asset. Nothing is deleted.

## Context

0017 made `marian` + `flagship-ai/cameroon-int8/francais-fufulde` the default
Fulfulde route on the strength of its AGLC alphabet, before a controlled
financial comparison. The 6-sentence spot check already looked bad; this record
adds a 20-sentence head-to-head on the same endpoint, beam size 2 and int8 CPU
compute type, and uses it to choose the default.

## Evidence

Full table: [`docs/evidence/mt-head-to-head.tsv`](../docs/evidence/mt-head-to-head.tsv).

| Metric | `nllb` int8 | `marian` cameroon-int8 |
| --- | --- | --- |
| Amounts / phone / reference kept byte-identical | **6/6** | **0/6** |
| Name kept (`Aïssatou`) | 0/1 | 0/1 |
| Rows with a repeated 3-gram (≥3×) | **0/20** | 1/20 (one row repeated 30×) |
| Rows with any AGLC letter | 14/20 | 15/20 |
| Median latency | 1278 ms | 737 ms |

Two rows make the difference concrete:

| Source | `nllb` | `marian` |
| --- | --- | --- |
| Votre solde est de 250 000 FCFA. | Fedde mooɗon woni 250 000 FCFA. | On payi mooɗon ɗon njogi, nden kam haa fodde fodde… |
| Numéro de téléphone : 6 12 34 56 78 | Ɗerewol telefoŋ: 6 12 34 56 78 | Tel: wi'i: Jawmiraawo, jawdi am, jawdi am… (30×) |

## Decision

1. **The default Fulfulde MT is NLLB-200 int8**: `ZTEAM_MT_BACKEND=nllb`,
   `ZTEAM_MT_MODEL=models/nllb-200-600m-int8`,
   `ZTEAM_MT_TOKENIZER=models/nllb-200-600m-tokenizer`. `.env.example` reflects
   it. The server code default stays `stub`, so a bare checkout still starts
   without weights.
2. **`marian` + `cameroon-int8` remains fully wired**: its own setting, manifest
   entry, downloader target and documentation. It is an opt-in candidate for
   orthography evaluation with `ZTEAM_MT_BACKEND=marian`, not the shipped
   translator.
3. **`fuv_Latn` stays.** NLLB's variety gap (Nigerian Fulfulde) is documented,
   not hidden.
4. **Nothing from 0017/0018 is removed.** The spot check, the A1 gate record,
   the 97-pair probe and both licence entries stay.

## Why NLLB, despite the wrong variety

- It preserves the invariant that decides whether a banking screen is usable:
  values survive, 6/6 versus 0/6.
- It does not repeat or drift into scripture vocabulary.
- It is slower (1.28 s versus 0.74 s median), which is acceptable against
  correctness.
- Its defect is a **quality** gap that a native reviewer can label and later
  fix. The Marian pair's defect is a **correctness** gap: it destroys the
  amounts the page exists to show.

## Consequences

- Demo and default runs use NLLB. The panel still labels the output as
  unvalidated machine translation.
- The Cameroon pair can still be shown as "59-language bundle, opt-in" without
  claiming it translates financial text.
- The head-to-head is the standing promotion test: rerun it before making any
  other pair the default.
- Neither model preserves names at the API level; the extension's
  protected-value masking remains mandatory.

## What would reverse this

A Cameroonian pair that keeps 20/20 values byte-identical and passes a native
speaker's review — for example a fine-tune on `mimba/afrilang` `fub_cm` — or a
reviewed corpus showing the current pair's failures were measurement artefacts.
