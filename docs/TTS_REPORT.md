# TTS report

> **Status: not run.** This file is the required report skeleton. It must be completed at
> submission time, even if the fine-tune is not shipped. A documented negative result is a
> valid outcome.

## 1. Data

| Item | Value |
|---|---|
| Speaker | Native Adamawa Fulfulde; sub-variety confirmed |
| Consent | Written/recorded; prototype, demo and training; deletion on request |
| Recordings | 100–120 minutes clean speech (target) |
| Script | 60 domain phrases + 200 Common Voice CC0 prompts + 80 phonetically balanced |
| Format | WAV mono 48 kHz → 16 kHz mono |
| Processing | Trim, −16 LUFS, high-pass 60 Hz |
| Split | 95% train / 5% validation; 20 held-out sentences for MOS |

## 2. What was not used

- The CLARIN/NOODL Adamawa TTS dataset is **not** used for generative training; its licence
  forbids it without the owner's permission. It is a listening reference only.
- Datasets without a stated licence are not shipped.

## 3. Normalisation

- `ɲ → ny`, `ꞌ → '` for TTS input; `ɓ ɗ ƴ ŋ` preserved.
- NFC; NBSP and narrow NBSP normalized.
- The speaker approved the 20 most frequent normalized forms.

## 4. Training

| Item | Value |
|---|---|
| Base | `facebook/mms-tts-ful` (VITS, 36.3M, CC-BY-NC-4.0) |
| Recipe | `finetune-hf-vits` |
| Hardware | _to fill_ |
| Config | `configs/finetune_ful.json` |
| Duration | _to fill_ |
| Best checkpoint | _to fill_ |

## 5. Evaluation

| Test | Result | Pass |
|---|---|---|
| Naturalness MOS (3–5 listeners) | _to fill_ | ≥ 3.8 |
| ABX preference vs baseline | _to fill_ | ≥ 70% |
| Critical words (implosives, `ɲ`, vowel length) | _to fill_ | 0 meaning-changing errors |
| Numbers (20 amounts) | _to fill_ | 100% |
| Names (10) | _to fill_ | 100% intelligible |
| Latency GPU / CPU | _to fill_ | GPU < 300 ms; CPU < 1 s |

## 6. Decision

- [ ] Ship as optional voice
- [ ] Do not ship; use recorded clips + baseline for names/digits
- [ ] Document as negative result

Reasons: _to fill_

## 7. Licence

The fine-tuned model inherits **CC-BY-NC-4.0** from the MMS base. It is not used in a
commercial path. The model is not bundled in the extension ZIP; it lives in release assets
or a local `models/` directory.
