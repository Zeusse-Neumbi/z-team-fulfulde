# TTS report

> **Status: baseline measured; speaker evaluation pending.** The MMS Fulfulde
> baseline runs locally and is the demo voice. No fine-tune was attempted for
> this preselection. The speaker evaluates intelligibility and naturalness by
> listening; this report is completed at submission time.

## 1. Data

| Item | Value |
|---|---|
| Speaker | Native Adamawa Fulfulde; sub-variety to confirm and record |
| Consent | Recorded; prototype, demo and validation; deletion on request |
| Recordings | None used for training in this preselection |
| Script | The 35 spoken phrases and the 20 number entries are the evaluation set |
| Format | WAV mono 16 kHz, generated locally by the MMS baseline |
| Processing | Text normalisation only; no speaker training data |

The speaker is an **evaluator**, not a recorded training voice. The oral
validation method is recorded in
[ADR 0013](decisions/0013-oral-validation-by-listening.md).

## 2. What was not used

- The CLARIN/NOODL Adamawa TTS dataset is **not** used for generative training;
  its licence forbids it without the owner's permission. It is a listening
  reference only.
- Datasets without a stated licence are not shipped.
- No fine-tune was attempted: no licensed training corpus, no GPU time before
  the freeze. This is a documented negative result, not a hidden one.

## 3. Normalisation

- `ɲ → ny`, `ꞌ → '` for TTS input; `ɓ ɗ ƴ ŋ` preserved.
- NFC; NBSP and narrow NBSP normalized.
- The speaker approves the normalized forms of the 20 most frequent words.

## 4. Training

| Item | Value |
|---|---|
| Base | `facebook/mms-tts-ful` (VITS, 36.3M, CC-BY-NC-4.0) |
| Recipe | none; baseline inference only |
| Hardware | CPU, 4 cores (development machine); GPU pending |
| Config | `ZTEAM_TTS_BACKEND=mms`, `models/mms-tts-ful` |
| Duration | not applicable |
| Best checkpoint | upstream baseline, checksum in `models/manifest.json` |

## 5. Evaluation

### Measured baseline (CPU)

| Test | Result | Pass |
|---|---|---|
| Cold synthesis (`Jam waali.`) | 10.8 s including model load | — |
| Warm synthesis (`Jam waali.`) | 1.4–1.8 s for 1.3–1.5 s audio | RTF 1.1–1.9 |
| Warm synthesis (`Ko ɗum woni solde maa.`) | 2.2 s for 1.5 s audio | RTF ≈ 1.4 |
| Cache repeat | 6.6 ms | — |
| Speed 0.8 | 1.0 s for 0.97 s audio | resample, no pitch shift |
| Token check | 0 unknown tokens for `ɓ`/`ɗ` sentences | yes |

Source: [`MODELS.md`](MODELS.md). GPU numbers are added after the transfer.

### Speaker evaluation (to fill at the session)

| Test | Result | Pass |
|---|---|---|
| Naturalness MOS (1–5, single speaker) | _to fill_ | ≥ 3.8 |
| Intelligibility (1–5) | _to fill_ | ≥ 4 |
| Critical words (implosives, `ɲ`, vowel length) | _to fill_ | 0 meaning-changing errors |
| Numbers (20 amounts) | _to fill_ | 100% intelligible |
| Names (10) | _to fill_ | 100% intelligible |
| Latency GPU / CPU | _to fill_ | GPU < 300 ms; CPU < 1 s |

The evidence is `eval/linguistic/tts-mos.csv`. The listening page is
`eval/linguistic/session/index.html` (local, not committed).

## 6. Decision

- [x] Use the MMS baseline as the optional demo voice.
- [ ] Ship a fine-tuned voice (not attempted).
- [ ] Do not ship the voice; document the negative result.

Reasons: the baseline is local, licensed for noncommercial use, and already
integrated. It is slower than real time on four CPU cores and its quality is
not yet rated by the speaker. The page translation does not depend on the
voice; the examiner can load the extension and see the translated page without
the API. If the speaker finds the baseline unintelligible, the voice is
disabled by default and recorded clips or a fine-tune become the roadmap.

## 7. Licence

The fine-tuned model, if any, would inherit **CC-BY-NC-4.0** from the MMS base.
It is not used in a commercial path. The model is not bundled in the extension
ZIP; it lives in `models/` (gitignored) or a release asset.
