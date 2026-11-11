# 0011 — Configurable model providers for the test bench

- Date: 2026-11-09
- Status: Accepted

## Context

The scaffold had one hard-coded path per modality: `stub | mms` for TTS,
`stub | marian` for translation, and a stub intent classifier. Comparing the
available Fulfulde models required editing and redeploying the service, and a
missing model or key surfaced as a generic HTTP error. The phrasebank was only
read by the extension build, so the API could not report whether the release
gate would pass.

## Decision

1. **One provider catalogue.** `app/provider_catalog.py` is the single source of
   truth for names, runtime, locality, licence, credential variable, model path
   and readiness. `GET /providers` exposes it; `/health` reports the active
   provider with `ready`, `reason` and `detail`.
2. **Selection by config or by request.** `ZTEAM_MT_BACKEND` and
   `ZTEAM_TTS_BACKEND` set the default; `provider` (and `model` for MT,
   `voice_id`/`language` for TTS) override it per request. Model instances are
   cached by a key that includes every setting that changes behaviour, and
   `POST /providers/reload` drops them.
3. **Local first.** `stub`, `ollama`, `nllb`, `marian` and `mms` are local. The
   local Ollama provider talks only to `127.0.0.1:11434`.
4. **Cloud is opt-in and explicit.** `google`, `camb` and `elevenlabs` are
   refused with `cloud_disabled` (HTTP 403) unless `ZTEAM_ALLOW_CLOUD=1`.
   Responses carry `X-ZTeam-Local: 0` and `X-ZTeam-Speech-Source: cloud`.
   No page value is ever required to test a provider; the probe uses public,
   fictional strings.
5. **Typed failures.** Every provider raises `ProviderError(code, message,
   provider)`; the API returns `{"detail": {...}}` with a stable code. The panel
   maps codes to localized copy and keeps the play button disabled when the
   voice is not ready.
6. **The phrasebank is an API resource.** `GET /phrasebank` reports versions,
   counts, warnings and `release_ready`; `?full=true` returns the entries;
   `POST /phrasebank/reload` re-reads the YAML. The API resolves the same
   warnings and release errors as `packages/phrasebank/src/loader.ts`.
7. **Paths resolve from the repository root.** Relative model and phrasebank
   paths are tried from the working directory first, then from the repository
   root, so the service starts from either the root or `apps/server`.

## Consequences

- A new model provider is a new class plus one catalogue entry; no route change.
- A missing model, missing key, missing dependency and disabled cloud are
  distinguishable without reading a stack trace.
- The product still defaults to `stub`/`stub`; the pack and the privacy contract
  are unchanged. Shipping a cloud provider would need a new ADR, a privacy
  update and a host-permission review.
- MMS-TTS `ful` is a macrolanguage checkpoint, not validated Adamawa speech;
  the UI must keep labelling it and high-risk values still need recorded clips.
- The download script re-resolves the Hugging Face redirect on every attempt,
  because a signed CDN URL expires during a long resume.
