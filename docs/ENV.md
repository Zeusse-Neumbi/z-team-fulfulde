# Environment

Two machines are used for the preselection. Fill the second one on the day of
the transfer; do not commit credentials or personal paths.

## Development machine (current)

| Item | Value |
| --- | --- |
| OS | Ubuntu 24.04, Linux 6.14.0-37-generic, x86_64 |
| CPU | Intel Core i7-1165G7, 4 cores, 1 thread/core |
| RAM | 15 GiB |
| GPU | none; `torch.cuda.is_available()` is false |
| Node | 24.18.0 |
| pnpm | 11.9.0 |
| uv | 0.11.16 |
| Python | 3.13.9 (system); the project requires >=3.11, CI uses 3.12 |
| Chrome/Chromium | installed through Playwright |
| Models | `models/mms-tts-ful`, `models/nllb-200-600m-int8` |
| Model checksums | `models/manifest.json` |
| API | `127.0.0.1:8000` |

Measured on this machine (from [`MODELS.md`](MODELS.md)):

| Provider | Request | Latency |
| --- | --- | --- |
| `nllb` int8 | FR sentence | 0.99–1.29 s |
| `nllb` int8 | EN sentence | 0.78–0.91 s |
| `mms` cold | `Jam waali.` | 10.8 s |
| `mms` warm | `Jam waali.` | 1.4–1.8 s for 1.3–1.5 s audio |
| `mms` cache | repeat | 6.6 ms |

## Windows 11 machine (to fill)

| Item | Value |
| --- | --- |
| OS | _to fill_ |
| CPU | _to fill_ |
| RAM | _to fill_ |
| GPU | _to fill_ (`pnpm doctor`) |
| Driver | _to fill_ (`nvidia-smi`) |
| Node | _to fill_ |
| pnpm | _to fill_ |
| uv | _to fill_ |
| Python | _to fill_ |
| Chrome/Edge | _to fill_ |
| Models | _to fill_ (copied or downloaded) |
| CUDA / cuDNN | _to fill_ (or "CPU only") |
| API | _to fill_ |

Fill it with:

```bash
pnpm doctor
nvidia-smi            # if NVIDIA
uv run --project apps/server python scripts/probe-models.py \
  --base-url http://127.0.0.1:8000 --tts mms --mt nllb \
  --out eval/latency/models.csv
pnpm prewarm
```

## Runtime choice

- **Development:** CPU, stub/MMS as configured.
- **Demo:** CPU is the safe default; GPU is a speed bonus.
- **Voice:** MMS baseline only; no fine-tune was attempted for this
  preselection.
- **Translation:** validated phrasebank in the extension; NLLB is a draft
  provider, not a validator.

## Privacy

This file contains no credentials, no page values and no personal data. Do not
add `.env` contents, account numbers or speaker contact details here; the
speaker record lives in [`LINGUISTIC_VALIDATION.md`](LINGUISTIC_VALIDATION.md)
with a pseudonym.
