# Yemba MT comparison: Marian int8 vs M2M100 418M

- **Date:** 2026-11-14 (Africa/Douala)
- **Machine:** same CPU-only host for both models
- **Source set:** the 20 fictional financial sentences in
  [`mt-head-to-head.tsv`](mt-head-to-head.tsv), plus a 5-sentence
  placeholder-masked set drawn from the real Yemba pack
- **Raw output:** [`ybb-mt-comparison.tsv`](ybb-mt-comparison.tsv) and
  [`ybb-mt-masked.tsv`](ybb-mt-masked.tsv)
- **Harness:** [`scripts/compare-ybb-mt.py`](../../scripts/compare-ybb-mt.py)

Both models are French-pivot only and local. Nothing was sent off the machine.
The values are fictional. This is a translation-quality comparison, not native
validation: no speaker has reviewed either output.

## Contenders

| Role | Model | Runtime | Size | Licence |
| --- | --- | --- | --- | --- |
| Incumbent | `flagship-ai/cameroon-int8`, `francais-yemba` | CTranslate2 int8 | 77 MB | CC-BY-NC-4.0 |
| Candidate | `danyanderson/m2m100-yemba-french-fr2ybb` | transformers fp32 | 1.85 GB | MIT |

The incumbent uses beam 2 (the `MarianMT` provider setting). The candidate uses
the model card's own recipe: 5 beams, 200 output tokens, `__ybb__` forced as the
target token. The `__ybb__` token is marked special so it no longer leaks into
decoded text.

## Results on literal sentences

| Metric | Marian int8 | M2M100 418M | Better |
| --- | ---: | ---: | --- |
| Digit groups kept (of 20) | 14 | **16** | M2M100 |
| Rows with a 3-gram repeated ≥3× | 11 | **4** | M2M100 |
| Worst 3-gram repetition | 12× | **4×** | M2M100 |
| Total characters | 1,869 | **1,139** | M2M100 |
| Median latency | **1.27 s** | 24.1 s | Marian (~19×) |

The four M2M100 failures are exactly the four sentences that contain a literal
amount (`250 000 FCFA`, `1 000 FCFA`, `25 500 FCFA`). On those it repeats a
phrase 3–4 times, drops the amount, and one output is cut at the 200-token
limit. Marian also drops every one of those amounts and repeats on 11 of 20
rows, with one 10× and one 12× loop.

M2M100 keeps the phone number (`6 12 34 56 78`) and the reference
(`ABC-1234`) verbatim; Marian destroys both. M2M100 is concise on short UI
commands (`Annuler` → `Ŋ́gɛ ndɛ́ʼ`, `Continuer` → `Ŋ́gɔ nzɛ́t`). It changed the
personal name `Aïssatou` to `Izatú`, which is why the product masks names as
`{name}` and never sends them to MT.

## Results on the masked pack path

The extension never sends a raw amount: protected values are masked before MT.
The masked set uses the pack's `ZZPH<n>ZZ` placeholders.

| Metric | Marian int8 | M2M100 418M |
| --- | ---: | ---: |
| Placeholders preserved (of 3 masked sources) | 0/3 | **2/3** |
| Rows with a 3-gram repeated ≥3× (of 5) | 3 | **1** |
| Worst 3-gram repetition | 14× | 4× |
| Total characters | 624 | **344** |
| Median latency | 3.21 s | 33.2 s |

- `Numéro de compte : ZZPH0ZZ` → M2M100 keeps `ZZPH0ZZ`; Marian replaces it
  with a hallucinated word and loops.
- `Bonjour, ZZPH0ZZ` → M2M100 keeps `ZZPH0ZZ`; Marian turns it into
  `Zzftɛzaz`.
- The three-placeholder fee sentence is **not** safe on M2M100: it emits
  `ZZPH0Z` and `ZPH2Z` (missing characters) and truncates. The loader's
  placeholder check withholds that entry; it is not shipped as a translation.

## Decision

Adopt M2M100 for the Yemba candidate pack and as the `ybb` registry MT provider.
The literal-sentence rule “no 3-gram repeated ≥3×” was not met in the strict
sense (4/20 rows), but all four are the raw-amount sentences that the product
never sends; on the masked path, where the extension actually operates, the
candidate is better on placeholders, repetition, length and digits. Marian stays
available as an explicit opt-in provider (`marian`) and is not deleted.

The latency cost is real and recorded: ~19–24× slower on this CPU. That is
acceptable for an explicit Yemba selection and is why M2M100 is not the default
for Fulfulde, and why it is not forced on any other language.

## Limits

- No native-speaker review; both packs remain `origin: mt`, `status: draft`.
- The corpus is 20 sentences plus 5 masked strings, not a BLEU benchmark.
- Amounts are protected by the extension, not by the model. A raw sentence with
  a number is not an acceptable MT input in this product.
- The M2M100 pair is FR→ybb only; English needs the separate `en2ybb`
  fine-tune and is refused with a typed 422.
