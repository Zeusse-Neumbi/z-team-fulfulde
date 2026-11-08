# Backend rules

Applies to `apps/server/**`.

## Runtime

- FastAPI service binds to `127.0.0.1` only. Do not add a public bind without an
  ADR and a security review.
- Settings come from `ZTEAM_*` environment variables through
  `apps/server/app/config.py`. Keep defaults safe and local.
- The `stub` TTS/ASR/MT backends must stay clearly marked; never present stub
  silence as Fulfulde speech.
- Optional speech dependencies stay behind the `speech` extra.

## Contracts

- Request and response models live in `apps/server/app/models.py` and must stay
  aligned with the schemas in `packages/shared`.
- `/health` reports the active backend versions and must not expose secrets.
- `/tts`, `/asr`, `/translate` and the analyzer never persist page values.
- Logs contain route names, durations and sanitized errors only.

## Tests

```bash
uv run --project apps/server ruff check apps/server
uv run --project apps/server ruff format --check apps/server
uv run --project apps/server mypy apps/server/app --config-file apps/server/pyproject.toml
uv run --project apps/server pytest
```

Add a test for every new route, status code and failure mode. Use fictional
data; never a real account, phone number or document.

## Do not

- Add a cloud provider or an API key.
- Return page text in an error payload or log.
- Make a model call in a unit test; use the stub or a fixture.
- Change a response schema without updating `packages/shared` and its tests.
