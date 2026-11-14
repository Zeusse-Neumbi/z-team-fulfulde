# TTS report

> **Status: baseline measured; no speaker evaluation.** The MMS Fulfulde and
> Yemba models load locally. No fine-tune was attempted for this preselection.
> No native speaker has rated intelligibility or naturalness; the report does
> not publish a MOS, a naturalness score or a validation claim.

## 1. Data

| Item | Value |
|---|---|
| Speaker | None recorded; no session has run |
| Consent | Not applicable until a session is booked |
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

### Speaker evaluation

**Not measured — no session has run.** No MOS, intelligibility, naturalness or
number/name rating is published. The listening pack and the protocol are ready;
see `docs/SPEAKER_PACKET.md`.

| Test | Result | Target when a session runs |
|---|---|---|
| Naturalness MOS (1–5, single speaker) | not measured | ≥ 3.8 |
| Intelligibility (1–5) | not measured | ≥ 4 |
| Critical words (implosives, `ɲ`, vowel length) | not measured | 0 meaning-changing errors |
| Numbers (20 amounts) | not measured | 100% intelligible |
| Names (10) | not measured | 100% intelligible |
| Latency GPU / CPU | CPU measured; GPU not measured | GPU < 300 ms; CPU < 1 s |

The evidence is `eval/linguistic/tts-mos.csv`. The listening page is
`eval/linguistic/session/index.html` (local, not committed).

## 6. Decision

- [x] Use the MMS Fulfulde baseline as the optional demo voice.
- [x] Keep the Yemba MMS voice API-only; it is not bundled and has no MOS.
- [ ] Ship a fine-tuned voice (not attempted).
- [ ] Do not ship the voice; document the negative result.

Reasons: the baseline is local, licensed for noncommercial use, and already
integrated. It is slower than real time on four CPU cores and its quality is
not yet rated by the speaker. The page translation does not depend on the
voice; the examiner can load the extension and see the translated page without
the API. If the speaker finds the baseline unintelligible, the voice is
disabled by default and recorded clips or a fine-tune become the roadmap.

## 7. Licence

The Yemba voice uses `facebook/mms-tts-ybb`, also CC-BY-NC-4.0. A fine-tuned model, if any, would inherit the same licence from the MMS base.
It is not used in a commercial path. The model is not bundled in the extension
ZIP; it lives in `models/` (gitignored) or a release asset.
