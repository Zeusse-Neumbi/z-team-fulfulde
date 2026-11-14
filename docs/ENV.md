# Environment

The development machine is the measured environment for this submission. The
Windows path is documented but was not executed; do not commit credentials or
personal paths.

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
| Models | `models/mms-tts-ful`, `models/nllb-200-600m-int8`, `models/cameroon-int8/francais-fufulde`; optional `cameroon-int8/francais-yemba`, `mms-tts-ybb` |
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

## Windows 11 machine

The Windows transfer was **not executed for this submission**. The commands and
the CPU/CUDA decision are kept in [`SETUP.md`](SETUP.md) and
[`TRANSFER.md`](TRANSFER.md); they are a guide, not measured evidence. Do not
publish a Windows GPU or latency number without running `pnpm doctor` and
`pnpm models:verify` on that machine.

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
