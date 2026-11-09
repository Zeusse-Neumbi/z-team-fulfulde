# Model test bench

This is the backend's model harness. The point is to compare translation and
speech models for Adamawa Fulfulde without editing code: every provider is
selected by config or by a request field, and every failure is a typed error.

Everything stays on `127.0.0.1`. Cloud providers exist for a **measurement
run only** and are refused unless `ZTEAM_ALLOW_CLOUD=1` is set.

## What runs where

| Kind | Provider | Runs | Licence | Needs |
| --- | --- | --- | --- | --- |
| MT | `stub` | local | project | nothing |
| MT | `ollama` | local | model-dependent | Ollama on `127.0.0.1:11434` |
| MT | `nllb` | local | CC-BY-NC-4.0 | speech extra + model dir |
| MT | `marian` | local | model-dependent | speech extra + CT2 model |
| MT | `google` | cloud | proprietary | `ZTEAM_GOOGLE_TRANSLATE_API_KEY` |
| TTS | `stub` | local | project | nothing |
| TTS | `mms` | local | CC-BY-NC-4.0 | speech extra + `models/mms-tts-ful` |
| TTS | `camb` | cloud | proprietary | `ZTEAM_CAMB_API_KEY` + `ZTEAM_CAMB_VOICE_ID` |
| TTS | `elevenlabs` | cloud | proprietary | `ZTEAM_ELEVENLABS_API_KEY` + voice id |
| ASR | `stub` | local | project | nothing |

Notes that matter for the comparison:

- **NLLB has no `fub` token.** It uses `fuv_Latn` (Nigerian Fulfulde). Treat
  Adamawa output as a proxy until a fine-tune exists.
- **MMS-TTS `ful`** is the macrolanguage checkpoint closest to Fulfulde. It has
  `ɓ ɗ ƴ ŋ` but no `ɲ` or `ꞌ`; the backend normalizes those to `ny` and `'`.
- **Camb.ai** is the only provider that advertises an explicit Adamawa locale
  (`fub-cm`).
- **ElevenLabs** advertises `ff` as Fula/Pulaar, not Adamawa.
- `google` translation supports `ff` (macrolanguage).

## Download the local models

```bash
./scripts/download-models.sh            # MMS-TTS Fulah, ~138 MB
./scripts/download-models.sh mms nllb   # + NLLB-200 600M, ~2.6 GB
```

The script re-resolves the Hugging Face signed URL on every retry and resumes,
because a plain `wget -c` fails with HTTP 403 once the CDN URL expires. It
writes into `models/` (gitignored).

NLLB needs a one-time CTranslate2 conversion:

```bash
uv pip install --python .venv/bin/python ctranslate2 transformers sentencepiece
ct2-transformers-converter \
  --model models/nllb-200-600m \
  --output_dir models/nllb-200-600m-int8 \
  --quantization int8 --force
cp models/nllb-200-600m/{tokenizer.json,tokenizer_config.json,special_tokens_map.json,sentencepiece.bpe.model} \
   models/nllb-200-600m-int8/
```

Use `ZTEAM_MT_RUNTIME=transformers` to skip the conversion and load the raw
checkpoint (slower and more RAM).

## Install the local runtime

```bash
uv sync --project apps/server --extra dev --extra speech
```

`torch` is large. On CPU-only machines, install the CPU wheel first:

```bash
uv pip install --python .venv/bin/python --torch-backend cpu torch torchaudio
```

## API keys

None of these keys are read by the shipped extension. They are development
tooling for a measurement run.

| Provider | Where to create the key | Set |
| --- | --- | --- |
| Google Cloud Translation | <https://console.cloud.google.com/apis/credentials> (enable *Cloud Translation API*) | `ZTEAM_GOOGLE_TRANSLATE_API_KEY` |
| Camb.ai | <https://www.camb.ai/> → dashboard → API keys | `ZTEAM_CAMB_API_KEY`, then `ZTEAM_CAMB_VOICE_ID` from `/list-voices` |
| ElevenLabs | <https://elevenlabs.io/app/settings/api-keys> | `ZTEAM_ELEVENLABS_API_KEY`, then `ZTEAM_ELEVENLABS_VOICE_ID` |
| Hugging Face (model downloads only) | <https://huggingface.co/settings/tokens> | `HF_TOKEN` |

Ollama, NLLB and MMS need no key.

Camb.ai endpoint used: `POST https://client.camb.ai/apis/tts-stream` with
`x-api-key`, `language: "fub-cm"` and `speech_model: "mars-8.1-flash-beta"`.
ElevenLabs endpoint used: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
with `xi-api-key`, `model_id: "eleven_v4"` and `language_code: "ff"`.

## Switch models

Server default (one provider each, no code change):

```bash
ZTEAM_MT_BACKEND=nllb ZTEAM_TTS_BACKEND=mms \
  uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Per request, without a restart:

```bash
curl -s localhost:8000/translate -H 'content-type: application/json' \
  -d '{"text":"Votre solde est de 250 000 FCFA.","provider":"ollama"}'

curl -s localhost:8000/tts -H 'content-type: application/json' \
  -d '{"text":"Jam waali.","provider":"mms"}' --output out.wav
```

Use `GET /providers` to see what is installed, what is missing and why.
`POST /providers/reload` drops the cached model instances after a download or a
config change.

## Configuration reference

| Variable | Default | Meaning |
| --- | --- | --- |
| `ZTEAM_MT_BACKEND` | `stub` | default MT provider |
| `ZTEAM_MT_MODEL` | `models/nllb-200-600m-int8` | NLLB/Marian model dir |
| `ZTEAM_MT_TOKENIZER` | `models/nllb-200-600m-tokenizer` | tokenizer dir (falls back to the model dir) |
| `ZTEAM_MT_RUNTIME` | `ct2` | `ct2` or `transformers` |
| `ZTEAM_MT_DEVICE` | `cpu` | `cpu` or `cuda` |
| `ZTEAM_MT_COMPUTE_TYPE` | `int8` | CTranslate2 compute type |
| `ZTEAM_MT_BEAM_SIZE` | `2` | beam width |
| `ZTEAM_MT_MAX_INPUT_CHARS` | `1000` | request guard |
| `ZTEAM_MT_SOURCE_LANGS` | `fr,en` | accepted source languages |
| `ZTEAM_MT_TARGET_LANG` | `fuv_Latn` | NLLB target token |
| `ZTEAM_OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | loopback only |
| `ZTEAM_OLLAMA_MODEL` | `gemma4:12b-it-qat` | any installed Ollama model |
| `ZTEAM_OLLAMA_TIMEOUT_S` | `90` | per-request timeout |
| `ZTEAM_OLLAMA_NUM_PREDICT` | `256` | output cap |
| `ZTEAM_OLLAMA_TEMPERATURE` | `0.0` | determinism |
| `ZTEAM_GOOGLE_TRANSLATE_API_KEY` | empty | cloud test key |
| `ZTEAM_GOOGLE_TRANSLATE_TARGET` | `ff` | Google target code |
| `ZTEAM_TTS_BACKEND` | `stub` | default TTS provider |
| `ZTEAM_TTS_MODEL` | `models/mms-tts-ful` | MMS model dir |
| `ZTEAM_TTS_DEVICE` | `cpu` | `cpu` or `cuda` |
| `ZTEAM_TTS_MAX_CHARS` | `500` | request guard |
| `ZTEAM_TTS_CACHE_SIZE` | `32` | in-memory audio cache entries |
| `ZTEAM_CAMB_API_KEY` | empty | cloud test key |
| `ZTEAM_CAMB_VOICE_ID` | empty | voice from the Camb.ai library |
| `ZTEAM_CAMB_LANGUAGE` | `fub-cm` | Adamawa locale |
| `ZTEAM_CAMB_MODEL` | `mars-8.1-flash-beta` | MARS model |
| `ZTEAM_ELEVENLABS_API_KEY` | empty | cloud test key |
| `ZTEAM_ELEVENLABS_VOICE_ID` | empty | voice from the library |
| `ZTEAM_ELEVENLABS_LANGUAGE` | `ff` | Pulaar, not Adamawa |
| `ZTEAM_ALLOW_CLOUD` | `false` | explicit opt-in for a cloud run |
| `ZTEAM_CLOUD_TIMEOUT_S` | `20` | cloud HTTP timeout |
| `ZTEAM_PHRASEBANK_DIR` | `packages/phrasebank/entries` | TM + phrases |
| `ZTEAM_PHRASEBANK_NUMBERS` | `packages/phrasebank/numbers/numbers.fub.json` | number lexicon |

Relative paths resolve from the current directory first, then from the
repository root, so the API starts from either the root or `apps/server`.

## The phrasebank

The API reads the same YAML the extension builds from, and reports the state the
release gate uses:

```bash
curl -s localhost:8000/phrasebank | jq
curl -s localhost:8000/phrasebank?full=true | jq '.tm_units[0]'
curl -s -X POST localhost:8000/phrasebank/reload | jq
```

`release_ready: false` means at least one medium/high-risk entry lacks a target,
a validator or a back-translation. Editing the YAML and calling
`/phrasebank/reload` is enough; no restart.

## Run the comparison

```bash
# terminal 1
ZTEAM_MT_BACKEND=ollama ZTEAM_TTS_BACKEND=stub \
  uv run --project apps/server uvicorn app.main:app --port 8000

# terminal 2 — public fictional strings only
uv run --project apps/server python scripts/probe-models.py \
  --mt stub ollama nllb google --tts stub mms camb --health \
  --out eval/latency/models.csv
```

The probe prints one row per request and exits non-zero only on an *unexpected*
failure. A missing model, a missing key or a disabled cloud provider is a
configured state, not a crash.

To include a cloud run, set the key and `ZTEAM_ALLOW_CLOUD=1`, restart, and use
the same command. The `x-zteam-local` response header and the provider record
make the egress explicit.

## Measured on this machine

4-core i7-1165G7, no GPU, 9 November 2026.

| Provider | Request | Latency | Note |
| --- | --- | --- | --- |
| `stub` MT | FR/EN sentence | < 1 ms | returns the source |
| `ollama` `gemma4:12b-it-qat` | FR sentence | 11–24 s | kept `250 000 FCFA` and `0 FCFA` byte-identical |
| `ollama` | EN sentence | 17–24 s | slower than FR on the same text |
| `stub` TTS | any | 2–4 ms | silent WAV, marked `X-ZTeam-Stub: 1` |
| `mms` cold | `Jam waali.` | 10.8 s | first request includes the model load |
| `mms` warm | `Jam waali.` | 1.4–1.8 s for 1.3–1.5 s audio | RTF 1.1–1.9 on 4 CPU threads |
| `mms` warm | `Ko ɗum woni solde maa.` | 2.2 s for 1.5 s audio | RTF ≈ 1.4 |
| `mms` cache | repeat of the same text | 6.6 ms | in-memory audio cache |
| `mms` `speed=0.8` | `Jam waali.` | 1.0 s for 0.97 s audio | scipy resample, no pitch shift |
| `google`, `camb` | any | 2 ms | `cloud_disabled` without `ZTEAM_ALLOW_CLOUD=1` |

MMS verification: `model.safetensors` is 145,229,816 bytes and its SHA-256
matches the Hugging Face `x-linked-etag`
(`ab724e06…86021c`). `Jam waali.`, `Ko ɗum woni solde maa.` and
`Ɓe njahii haa wuro.` produced 1.26–1.34 s of non-silent 16 kHz mono audio with
**0 unknown tokens**, so `ɓ` and `ɗ` are in the vocab.

**The base MMS model is slower than real time on this CPU** (RTF > 1). The
`< 1 s first audio` target is not met without an optimisation pass: ONNX/int8
export, `torch.set_num_threads(4)`, or pre-synthesised clips for the demo
phrases. Do not describe a warm 2 s synthesis as smooth speech.

NLLB latency is still unmeasured: the 2.6 GB checkpoint does not fit the
observed link speed in one sitting. The provider is wired and covered by a
fake-model test; `./scripts/download-models.sh nllb` and
`ZTEAM_MT_RUNTIME=transformers` are ready for the measurement.

## Failure codes

Every provider error returns `{"detail": {"code", "message", "provider"}}`.

| Code | HTTP | Meaning |
| --- | --- | --- |
| `provider_unknown` | 400 | not in the catalogue |
| `cloud_disabled` | 403 | cloud provider without `ZTEAM_ALLOW_CLOUD=1` |
| `credentials_missing` | 503 | key or voice id not set |
| `model_missing` | 503 | model directory absent |
| `model_incomplete` | 503 | `config.json` present but no non-empty weight file |
| `dependency_missing` | 503 | speech extra not installed |
| `model_load_failed` | 503 | corrupt or incomplete model files |
| `provider_unavailable` | 503 | loopback runtime not running |
| `upstream_timeout` | 504 | provider did not answer |
| `upstream_rate_limited` | 503 | provider quota |
| `credentials_rejected` | 502 | provider rejected the key |
| `unsupported_language` | 422 | provider cannot speak the locale |
| `upstream_error` | 502 | provider error or bad payload |
| `text_too_long` | 422 | request guard |
| `phrasebank_missing` | 503 | YAML directory absent |
| `phrasebank_invalid` | 500 | unparsable YAML/JSON |

The panel maps these to user messages instead of showing a raw status code, and
keeps the play button disabled when the voice is not ready.

## Boundaries

- No provider is contacted unless it is explicitly selected.
- Cloud runs are a measurement tool, not a product path. Shipping one would
  require a change to `docs/PRIVACY.md`, the host permissions and a new ADR.
- Models are never loaded from a remote URL at runtime.
- Model weights are never committed or bundled in the extension ZIP.
