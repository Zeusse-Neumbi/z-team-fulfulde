# 0021 — Reject M2M100 for the Yemba pack

- **Status:** accepted
- **Date:** 2026-11-14
- **Rejects:** `danyanderson/m2m100-yemba-french-fr2ybb` as the `ybb` pack and
  registry provider. The Fulfulde default stays NLLB per `0019`, and the Yemba
  registry row stays on Marian.
- **Evidence:** [`docs/evidence/ybb-mt-comparison.md`](../evidence/ybb-mt-comparison.md)

## Context

`languages/ybb.yaml` resolves the `marian` provider to
`flagship-ai/cameroon-int8/francais-yemba`. That candidate pack is degenerate:
11 of 20 financial test sentences loop, the worst 12 times, and 11 of 115 pack
entries fail the placeholder mask.

`danyanderson/m2m100-yemba-french-fr2ybb` is a 418M M2M100 fine-tune, MIT,
FR→Yemba only, 1.85 GB fp32. On the same CPU and 20 sentences it looked better
on every automatic metric: 16 digit groups kept versus 14, 4 looping rows versus
11 (worst 4× versus 12×), 1,139 versus 1,869 characters, and 2/3 masked
placeholders preserved versus 0/3. It is ~19–24× slower (24.1 s versus 1.27 s
median).

A full 80-unit + 35-phrase pack was then generated to inspect the real output.
It exposed a disqualifying failure that the automatic metrics cannot see:
**11 of 80 UI strings fabricate the proper name “Yɛɛ́so” (Jesus), four of them
also “Klísto” (Christ).** The affected entries include core financial labels:

- `Bénéficiaire` → `… ánɛ Yɛɛ́so Klísto` (`tm.step.beneficiary`,
  `tm.ben.title`, `tm.summary.beneficiary`, `tm.receipt.beneficiary`)
- `Nom du bénéficiaire` → a sentence starting `Yɛɛ́so á zéŋ ndé ŋ́gɛ:`
- `Gratuit` → a sentence starting `Yɛɛ́so á zéŋ ndé ŋ́gɛ: «Alémndēm`
- `Confirmer le transfert` → inserts `Yɛɛ́so`
- `Retour au hackathon`, `tm.ben.warning_new`, `tm.novel.example` and
  `WARN_NEW_BENEFICIARY` also insert it.

This is semantic fabrication in a financial interface, not a style issue. A
runtime MT call on unseen page text could inject the same content, and there is
no pack review to catch it. No blacklist or post-edit is acceptable without a
speaker, and the loader cannot detect this class of error.

## Decision

1. **Do not adopt M2M100 for the Yemba pack.** The committed Marian candidate
   pack is restored; `languages/ybb.yaml` stays `provider: marian`.
2. **Keep the M2M100 provider registered but opt-in.** `M2M100MT`, the manifest
   entry, `mt-ybb-m2m100` alias and `ZTEAM_MT_M2M100_MODEL` remain available for
   controlled experiments. No registry row selects it.
3. **Do not rebuild the submission with M2M100 text.** The extension bundle
   keeps the Marian candidate pack and the `mms-tts-ybb` voice; nothing
   user-facing changes.
4. **Keep the evidence and harness.** The 20-sentence comparison, the masked
   set and this record stay in the repository so the rejection is reproducible.
5. **Guard the generator.** `scripts/translate-phrasebank-m2m100.py` withholds a
   candidate that contains a banned proper-name/religious term, so a future run
   cannot silently produce the same pack.

## Consequences

- The MIT model is not shipped and is not required for a Yemba run. The 1.85 GB
  download is optional.
- The Yemba candidate pack remains the Marian draft: noisy, but it does not
  fabricate a name in a label. It still ships as `status: draft`,
  `packValidated: false`, and the release gate still refuses validation claims.
- The speed and metric advantage of M2M100 is recorded, not hidden. The
  rejection is about semantic safety, not performance.
- `THIRD_PARTY_NOTICES.md` keeps the MIT entry with the “evaluated, not adopted”
  note.

## Reversal conditions

- A retrained or cleaned M2M100 checkpoint that no longer fabricates names, run
  through the same 20-sentence and masked sets **and** a full-pack inspection.
- A native speaker post-edits the affected entries and explicitly approves the
  rest of the pack; then the pack may use `origin: human` for the edited entries
  and keep `origin: mt` only where reviewed.
- The model licence or availability changes; the provider then stays opt-in or
  is removed, and the registry row remains on `marian`.
