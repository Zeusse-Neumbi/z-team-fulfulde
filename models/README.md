# Models

Model weights are **not** committed and never bundled in the extension ZIP.
They are downloaded into `models/` (gitignored) with the cross-platform
[`scripts/download-models.mjs`](../scripts/download-models.mjs).

```bash
pnpm models:download              # MMS-TTS Fulah, ~145 MB
pnpm models:download mt-fub       # Cameroonian FR→Fufulde, ~78 MB
pnpm models:download mt-ybb mms-ybb # optional Yemba text + API voice
pnpm models:download mms nllb-ct2 # + NLLB-200 600M int8, ~647 MB
pnpm models:verify                # size + SHA-256 from models/manifest.json
```

The sizes, SHA-256 and licences are in
[`models/manifest.json`](manifest.json). The Windows/macOS/Linux setup and the
GPU notes are in [`docs/SETUP.md`](../docs/SETUP.md).

| Model | Licence | Use |
|---|---|---|
| `facebook/mms-tts-ful` | CC-BY-NC-4.0 | TTS baseline; fine-tune optional |
| `facebook/nllb-200-distilled-600M` | CC-BY-NC-4.0 | FR/EN → Fulfulde baseline (fp32) |
| `JustFrederik/nllb-200-distilled-600M-ct2-int8` | CC-BY-NC-4.0 | Community int8 conversion; loads with CTranslate2 |
| Fine-tuned MMS/VITS | CC-BY-NC-4.0 (inherits) | Optional demo voice |
| `flagship-ai/cameroon-int8` (`francais-fufulde`) | CC-BY-NC-4.0 (fp32 originals CC-BY-4.0) | Optional FR→Fufulde candidate, opt-in (failed the value-preservation head-to-head) |
| `DS4H-ICTU/linguo_mt_en_fub` | Apache-2.0 | Optional local EN→FUB fallback |
| `flagship-ai/cameroon-int8` (`francais-yemba`) | CC-BY-NC-4.0 | Optional FR→Yemba draft (API/registry) |
| `facebook/mms-tts-ybb` | CC-BY-NC-4.0 | Optional Yemba API voice; no clips bundled |
| Intent classifier | Project licence | Closed-set voice commands |

Rules:

- Download into `models/` or ship as a release asset; never bundle weights in
  the extension.
- Record the model version and licence in the technical note.
- Never load a model from a remote URL at runtime.
- `docs/MODELS.md` is the single reference for provider config, API keys and
  measured latency.
