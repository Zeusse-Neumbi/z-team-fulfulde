# 0014 — Discover the local API on the loopback range 8000–8010

- **Status:** accepted
- **Date:** 2026-11-11

## Context

The side panel originally used a single constant,
`http://127.0.0.1:8000`. The demo can fail to start on 8000 when another
service already owns the port, and the user asked for a smart port switch
instead of a manual stop.

The production manifest already grants `http://127.0.0.1/*` beside
`http://127.0.0.1:8000/*`, so a second loopback port does not widen the origin
or add a host permission.

## Decision

- `scripts/demo.mjs` defaults to `--port auto`: reuse a running Z-Team API on
  8000–8010, otherwise start on the first free port in that range.
- `apps/extension/lib/backend.ts` exports `discoverApiBaseUrl()`. It probes
  `GET http://127.0.0.1:<port>/health` for ports 8000–8010, accepts the first
  response whose `service` is `zteam-server`, and returns that base URL.
- The panel uses the discovered base URL for `/health` and `/tts`. If discovery
  finds nothing, it keeps the default `http://127.0.0.1:8000`.
- The probe is local, sequential, `cache: "no-store"`, with a 300 ms abort per
  port. It never reads page data and never contacts a non-loopback host.

## Consequences

- `pnpm demo` can start on 8001 when 8000 is occupied by another service; the
  panel finds it without a rebuild.
- When no API is running, the panel spends up to ~3.3 s probing in the
  background once per mount. The initial health check may show offline until
  discovery finishes; the health poll corrects it.
- The port is not persisted. If the API restarts on a different port after the
  panel is open, the user reloads the panel.
- The manifest needs no change: `http://127.0.0.1/*` already covers the range.
- The discovery logic is unit-tested with a mocked `fetch`; the e2e journey
  still runs against 8000.

## Evidence

- `apps/extension/lib/backend.ts` — `discoverApiBaseUrl()`
- `apps/extension/lib/backend.test.ts` — 4 discovery cases
- `apps/extension/entrypoints/sidepanel/App.tsx` — panel uses the discovered URL
- `scripts/demo.mjs` — `--port auto`
- `docs/DEMO.md` — runbook
