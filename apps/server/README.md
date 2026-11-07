# Z-Team local API

Local-only speech and translation services for the Fulfulde assistant. It binds to
`127.0.0.1` and makes no outbound network calls.

## Run

```bash
cd apps/server
uv sync --extra dev
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` for the OpenAPI UI.

## Backends

| Variable | Values | Default | Notes |
|---|---|---|---|
| `ZTEAM_TTS_BACKEND` | `stub`, `mms` | `stub` | `mms` needs the `speech` extra and `facebook/mms-tts-ful` |
| `ZTEAM_ASR_BACKEND` | `stub` | `stub` | Intent classifier is a later milestone |
| `ZTEAM_MT_BACKEND` | `stub`, `marian` | `stub` | `marian` needs CTranslate2 and a local model |

The stub TTS returns a 0.2 s silent WAV. It exists so the extension, tests and
demo plumbing work before the speech extras are installed. It is clearly marked
with `X-ZTeam-Stub: 1` and must never be presented as Fulfulde speech.

The stub translation returns the source unchanged with `translated: false`. The
project never invents an untranslated string.

## Tests

```bash
uv run pytest
```

## Privacy

- Binds to loopback only.
- No telemetry, no external provider, no API key.
- Request logs contain route names and durations, never page text or values.
