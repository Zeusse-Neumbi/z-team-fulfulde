# Models

Model weights are **not** committed.

| Model | Licence | Use |
|---|---|---|
| `facebook/mms-tts-ful` | CC-BY-NC-4.0 | TTS base; fine-tune optional |
| Fine-tuned MMS/VITS | CC-BY-NC-4.0 (inherits) | Optional demo voice |
| `flagship-ai/francais-fufulde` | CC-BY-4.0 | Optional local FR→FF fallback |
| `DS4H-ICTU/linguo_mt_en_fub` | Apache-2.0 | Optional local EN→FUB fallback |
| Intent classifier | Project licence | Closed-set voice commands |

Rules:

- Download models into `models/` (gitignored) or a release asset.
- Record the model version and licence in the technical note.
- Never bundle model weights in the extension ZIP.
- Never load a model from a remote URL at runtime.
