# Models

Model weights are **not** committed and never bundled in the extension ZIP.
They are downloaded into `models/` (gitignored) with
[`scripts/download-models.sh`](../scripts/download-models.sh).

```bash
./scripts/download-models.sh            # MMS-TTS Fulah, ~138 MB
./scripts/download-models.sh mms nllb   # + NLLB-200 600M, ~2.6 GB
```

| Model | Licence | Use |
|---|---|---|
| `facebook/mms-tts-ful` | CC-BY-NC-4.0 | TTS baseline; fine-tune optional |
| `facebook/nllb-200-distilled-600M` | CC-BY-NC-4.0 | FR/EN → Fulfulde baseline (fp32) |
| `JustFrederik/nllb-200-distilled-600M-ct2-int8` | CC-BY-NC-4.0 | Community int8 conversion; loads with CTranslate2 |
| Fine-tuned MMS/VITS | CC-BY-NC-4.0 (inherits) | Optional demo voice |
| `flagship-ai/francais-fufulde` | CC-BY-4.0 | Optional local FR→FF fallback |
| `DS4H-ICTU/linguo_mt_en_fub` | Apache-2.0 | Optional local EN→FUB fallback |
| Intent classifier | Project licence | Closed-set voice commands |

Rules:

- Download into `models/` or ship as a release asset; never bundle weights in
  the extension.
- Record the model version and licence in the technical note.
- Never load a model from a remote URL at runtime.
- `docs/MODELS.md` is the single reference for provider config, API keys and
  measured latency.
