# Z-Team Fulfulde Assistant

**A local-first Fulfulde accessibility layer for digital financial services.**

It attaches to an existing web interface as a Chrome extension, translates the visible
interface into **Adamawa Fulfulde (`fub`)** in place, and speaks it. It never modifies the
service's source code, and it never sends page data off the device.

[![CI](https://github.com/Zeusse-Neumbi/z-team-fulfulde/actions/workflows/ci.yml/badge.svg)](https://github.com/Zeusse-Neumbi/z-team-fulfulde/actions/workflows/ci.yml)

> **Status: scaffold.** The translation engine, translation-memory pipeline, extension
> shell, local backend and tests are in place. The native-speaker data, the fine-tuned
> voice and the closed-set voice classifier are the next milestones. The backend's `stub`
> TTS returns silence and is clearly marked; it must never be presented as Fulfulde speech.

## What it does

1. **Reads the page semantically** — roles, accessible names, form labels and text nodes.
2. **Translates the interface in place** — headings, labels, buttons, sentences, warnings —
   from a native-speaker-validated translation memory.
3. **Never touches financial values** — amounts, fees, totals, balances, account numbers,
   phone numbers, references, names and user input stay byte-identical.
4. **Speaks the page** — recorded phrases and, later, a fine-tuned MMS/VITS voice.
5. **Handles new content** — a `MutationObserver` detects text added after load and
   translates it or falls back to a validated safe message.
6. **Runs entirely locally** — no cloud LLM, no API key, no page data leaving the machine.

## Why the value rule matters

The challenge's protocol treats an altered amount, fee, total, beneficiary or reference as
a major defect. The translator therefore classifies every text node:

- **protected** — exact value, name, phone, account, reference, date, user input;
- **mixed** — a label plus a value; only rewritten through a validated pattern that
  preserves the value substring byte-for-byte;
- **translatable** — everything else;
- **ignore** — scripts, styles, code, hidden content.

After every translation pass, the protected nodes are compared against their originals. A
mismatch reverts the node and aborts the plan.

## Quickstart

Requirements: Node 20+, pnpm 9+, Python 3.11+, uv.

```bash
pnpm install
uv sync --project apps/server --extra dev
```

Terminal 1 — local API:

```bash
uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2 — extension dev build:

```bash
pnpm dev
```

Then load `.output/chrome-mv3` in `chrome://extensions` (Developer mode → Load unpacked),
open `https://safinum.cm/hackathon-test`, and click the extension.

### Optional heavy dependencies

The scaffold installs the web and API dependencies needed to build, test and run the
extension with the stub speech backend. Two large optional extras are installed on demand:

```bash
# Playwright + Chromium: string extraction, coverage, e2e
pnpm setup:e2e

# PyTorch, Transformers, CTranslate2: real TTS / local MT (large download)
uv sync --project apps/server --extra speech
```

The `stub` TTS returns a short silent WAV and is marked with `X-ZTeam-Stub: 1`. It is a
plumbing placeholder, not Fulfulde speech.

## Repository map

```
apps/extension/          Chrome MV3 side panel, content script, scanner
apps/server/             Local FastAPI: /tts /asr /translate /health
packages/shared/         Types, Zod schemas, versions
packages/translator/     Normalization, protected nodes, TM lookup, DOM translator
packages/phrasebank/     YAML TM + spoken phrases + build/release validation
scripts/                 String extraction, coverage, prewarm, packaging, size check
eval/                    Live-page fixtures, mock B, linguistic and latency evidence
docs/                    Architecture, privacy, validation, TTS report, demo
e2e/                     Playwright smoke test
```

## Common commands

| Command | What it does |
|---|---|
| `pnpm install` | Install JS dependencies |
| `uv sync --project apps/server --extra dev` | Install Python dependencies |
| `pnpm dev` | WXT dev server with HMR |
| `pnpm build` | Build all packages and the extension |
| `pnpm test` | Vitest across packages |
| `pnpm lint` | oxlint |
| `pnpm typecheck` | TypeScript across packages |
| `pnpm package` | Zip the built extension into `dist/` |
| `pnpm size:check` | Fail if the ZIP exceeds 8 MB |
| `pnpm setup:e2e` | Install Playwright on demand (large download) |
| `pnpm strings` | Extract visible page strings with Playwright |
| `pnpm coverage` | Compute translation coverage from two text dumps |
| `uv run --project apps/server pytest` | API tests |

## Privacy

- The extension talks only to `127.0.0.1:8000`.
- There is no cloud provider, no API key, no telemetry and no remote config.
- The value vault lives in memory and is cleared on navigation, Stop, or 10 minutes idle.
- `chrome.storage` holds settings and page signatures only — never page values.
- See [`docs/PRIVACY.md`](docs/PRIVACY.md) and [`SECURITY.md`](SECURITY.md).

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — components, data flow, translation pipeline
- [`docs/PRIVACY.md`](docs/PRIVACY.md) — data handling and permissions
- [`docs/LINGUISTIC_VALIDATION.md`](docs/LINGUISTIC_VALIDATION.md) — native-speaker protocol
- [`docs/TTS_REPORT.md`](docs/TTS_REPORT.md) — voice track (template, not yet run)
- [`docs/DEMO.md`](docs/DEMO.md) — 3-minute video and live demo script
- [`docs/REPO_AUDIT.md`](docs/REPO_AUDIT.md) — minimal repository checklist
- [`docs/SUBMISSION.md`](docs/SUBMISSION.md) — form fields and package
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) — components, models and licences

## Language

**Adamawa Fulfulde**, ISO 639-3 `fub`, Cameroon. The sub-variety (Ngaoundéré, Garoua or
Maroua) is confirmed with the speaker and recorded in the validation evidence.

## Team

Z-Team — SAFINUM Innovate Challenge 2026.

## Licence

MIT for this repository. Third-party assets and models keep their own licences; see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
