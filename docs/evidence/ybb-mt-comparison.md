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

## Full-pack inspection: disqualifying contamination

The metrics above are not the whole result. A full 80-unit + 35-phrase candidate
pack was generated with M2M100 and reviewed before adoption. It contains a
failure the automatic checks cannot see: **11 of 80 UI strings fabricate
“Yɛɛ́so” (Jesus), four of them also “Klísto” (Christ).**

| Entry | French source | M2M100 target |
| --- | --- | --- |
| `tm.ben.title`, `tm.step.beneficiary`, `tm.summary.beneficiary`, `tm.receipt.beneficiary` | Bénéficiaire | `… ánɛ Yɛɛ́so Klísto` |
| `tm.ben.name` | Nom du bénéficiaire | `Yɛɛ́so á zéŋ ndé ŋ́gɛ: «Ntē ŋiŋ yīi…` |
| `tm.fees.free` | Gratuit | `Yɛɛ́so á zéŋ ndé ŋ́gɛ: «Alémndēm` |
| `tm.summary.confirm` | Confirmer le transfert | `… á mbū Yɛɛ́so, tɛ́ ndɔk ntsékne.` |
| `tm.nav.back_hackathon` | Retour au hackathon | `… ŋke mbɔŋ Yɛɛ́so` |
| `tm.ben.warning_new` | Ce bénéficiaire n'a jamais été utilisé… | `… á nzem Yɛɛ́so.` |
| `tm.novel.example` | Un message important pour les clients… | `… pɔ́ é epuɔ Yɛɛ́so.` |
| `WARN_NEW_BENEFICIARY` | new-beneficiary warning | `… ánɛ anu jɔ mɛ́t ɛ́…` + term |

`Bénéficiaire → Jésus-Christ` is fabricated content in a financial label. At
runtime the same model would translate unseen page text with no pack review, so
the error cannot be contained by withholding the affected entries. The loader
has no semantic check for this class of failure.

## Verdict

**Rejected.** M2M100 wins the automatic metrics but fails the semantic-safety
requirement. The committed Yemba pack stays the Marian candidate, and
`languages/ybb.yaml` stays on `marian`. The M2M100 provider, manifest entry and
download alias remain as an opt-in experiment only; no registry row selects
them. See [ADR 0021](../decisions/0021-reject-m2m100-yemba.md).

The latency cost is also recorded: ~19–24× slower on this CPU. It is not the
reason for rejection, but it reinforces the decision not to make M2M100 a
default anywhere.

## Limits

- No native-speaker review; both packs remain `origin: mt`, `status: draft`.
- The corpus is 20 sentences plus 5 masked strings, not a BLEU benchmark.
- Amounts are protected by the extension, not by the model. A raw sentence with
  a number is not an acceptable MT input in this product.
- The M2M100 pair is FR→ybb only; English needs the separate `en2ybb`
  fine-tune and is refused with a typed 422.
