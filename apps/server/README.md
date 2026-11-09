# Z-Team local API

Local-only speech and translation services for the Fulfulde assistant. It binds
to `127.0.0.1` and makes no outbound network call unless a cloud provider is
selected for a measurement run.

See [`docs/MODELS.md`](../../docs/MODELS.md) for the model matrix, API key
locations, download commands and measured latency.

## Run

```bash
uv sync --project apps/server --extra dev
uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` for the OpenAPI UI. The server also starts
from `apps/server`; relative model and phrasebank paths resolve from the
repository root when the file is not found in the current directory.

## Backends

| Variable | Values | Default | Notes |
|---|---|---|---|
| `ZTEAM_MT_BACKEND` | `stub`, `ollama`, `nllb`, `marian`, `google` | `stub` | `google` needs `ZTEAM_ALLOW_CLOUD=1` and a key |
| `ZTEAM_TTS_BACKEND` | `stub`, `mms`, `camb`, `elevenlabs` | `stub` | `camb`/`elevenlabs` need the cloud switch |
| `ZTEAM_ASR_BACKEND` | `stub` | `stub` | Intent classifier is a later milestone |

A request can override the configured provider:

```bash
curl -s localhost:8000/translate -H 'content-type: application/json' \
  -d '{"text":"Votre solde est de 250 000 FCFA.","provider":"ollama"}'
```

`GET /providers` lists every provider with `ready`, `reason`, `detail`,
`licence` and the credential variable to set. `POST /providers/reload` drops
cached model instances after a download.

## Endpoints

| Route | Purpose |
|---|---|
| `GET /health` | liveness, active backends, readiness and reasons |
| `GET /version` | versions and the cloud switch |
| `GET /providers` | provider matrix and readiness |
| `POST /providers/reload` | clear model caches |
| `POST /translate` | text translation with provider/latency metadata |
| `POST /tts` | text to WAV/MP3, with `X-ZTeam-*` provenance headers |
| `POST /asr` | audio to closed-set intent (stub today) |
| `GET /phrasebank` | TM/phrase counts, warnings and release gate |
| `GET /phrasebank?full=true` | the parsed entries |
| `POST /phrasebank/reload` | re-read the YAML after an edit |
| `GET /metrics` | request counts and latency |
| `POST /demo/reset` | clear metrics |

## Errors

Providers raise a typed error that the API returns as:

```json
{ "detail": { "code": "credentials_missing", "message": "Set ZTEAM_CAMB_VOICE_ID.", "provider": "camb" } }
```

Codes: `provider_unknown`, `cloud_disabled`, `credentials_missing`,
`model_missing`, `model_incomplete`, `dependency_missing`, `model_load_failed`,
`provider_unavailable`, `upstream_timeout`, `upstream_rate_limited`,
`credentials_rejected`, `unsupported_language`, `upstream_error`,
`text_too_long`, `phrasebank_missing`, `phrasebank_invalid`.

The stub TTS returns a 0.2 s silent WAV marked `X-ZTeam-Stub: 1`; it is never
presented as Fulfulde speech. The stub translation returns the source unchanged
with `translated: false`; the project never invents a translation.

## Tests and checks

```bash
uv run --project apps/server ruff check .
uv run --project apps/server ruff format --check .
uv run --project apps/server mypy app
uv run --project apps/server pytest
```

## Privacy

- Binds to loopback only.
- No telemetry, no external provider by default, no API key at runtime.
- Request logs contain route names and durations, never page text or values.
- Cloud providers are refused unless `ZTEAM_ALLOW_CLOUD=1`; the response
  header `X-ZTeam-Local: 0` makes that egress explicit.
