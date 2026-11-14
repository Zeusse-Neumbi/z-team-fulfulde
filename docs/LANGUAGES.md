# Language packs

Two Cameroonian language packs ship in the preselection ZIP. Both are
**machine-translation drafts**; neither has native-speaker validation. The
registry is data: adding a language is a new `languages/<code>.yaml` row plus a
pack, a number lexicon, a model manifest entry and a generated validation test.

| Language | Code | Pack source | Targets | Validation | Voice in the ZIP |
| --- | --- | --- | --- | --- | --- |
| Adamawa Fulfulde | `fub` | NLLB-200 int8 draft | 115/115 | 0 validated | 82 playable MMS clips (33 withheld) |
| Yemba | `ybb` | cameroon-int8 Marian draft | 103/115 | 0 validated | API-only; no clips bundled |

The counts come from `packages/phrasebank/src/generated.ts` and
`pnpm check:evidence`:

```text
[evidence] fub: draft (mt); 115/115 targets; 0 validated; 164 release error(s)
[evidence] ybb: draft (mt); 103/115 targets; 0 validated; 174 release error(s)
[evidence] 2 language(s) are not validated.
```

## What ships

- **Fulfulde (`fub`)** is the demonstrated language. The ZIP carries the NLLB
  draft and the MMS voice clips. The panel always says **MT — non validée**.
- **Yemba (`ybb`)** proves the data-only extension point. The ZIP carries the
  Marian draft for 103 of 115 units. Twelve units are withheld because the
  draft lost a protected placeholder or was marked unsafe; those nodes stay in
  French and are counted as missed. The Yemba voice is not bundled; it is
  available only through the optional local API and `models/mms-tts-ybb`.

No Yemba audio is played under a Yemba label unless the local API reports a
ready voice. The panel's voice policy is per language (`speech.voice`:
`bundled`, `api` or `none`), so a Fulfulde clip can never be used for Yemba.

## Withheld Yemba units

| Kind | IDs |
| --- | --- |
| TM | `tm.balance.greeting`, `tm.account.line`, `tm.fees.percent_desc`, `tm.footer.disclaimer` |
| Phrase | `BALANCE_IS`, `ACCOUNT_IS`, `FEE_IS`, `FEE_TOTAL`, `BALANCE_AFTER`, `TRANSFER_AMOUNT_TO`, `TRANSFER_RECIPIENT`, `TRANSFER_REFERENCE` |

The loader empties a candidate whose `mtPlaceholdersOk` is false or whose
`mtWithheld` flag is true. The page pass therefore leaves the node in the source
language instead of aborting on a value mismatch.

## Validation state

The native-speaker session **has not run**. There are no validators, no French
back-translations and no MOS scores. `pnpm check:evidence` fails by design while
either pack is a draft. `build:release` only enforces evidence for a language
that claims `status: validated` (ADR 0020); a draft must stay labelled and
`packValidated: false`.

A validated launch needs, per language:

1. a speaker for that language (Fulfulde and Yemba are separate sessions);
2. corrected targets and a French back-translation for every medium/high-risk
   entry;
3. `validatedBy` and `backTranslationFr` in the human pack;
4. `status: validated` in the registry row;
5. `pnpm check:evidence` passing and `build:release` green.

## Adding a language

See [`ADD_A_LANGUAGE.md`](ADD_A_LANGUAGE.md) and
[`ADD_A_LANGUAGE_PROOF.md`](ADD_A_LANGUAGE_PROOF.md). The runtime path is data;
the validation is deliberately not.

## Evidence

- [`MODELS.md`](MODELS.md) — providers, measured MT and voice results;
- [`evidence/ybb-mt-comparison.md`](evidence/ybb-mt-comparison.md) — Marian vs
  M2M100, and why M2M100 was rejected;
- [`LINGUISTIC_VALIDATION.md`](LINGUISTIC_VALIDATION.md) — the listening method;
- [`PHRASEBANK_MT.md`](PHRASEBANK_MT.md) — candidate generation and promotion.
