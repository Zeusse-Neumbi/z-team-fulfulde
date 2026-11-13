# Z-Team Fulfulde Assistant

**A local-first Fulfulde accessibility layer for digital financial services.**

It attaches to an existing web interface as a Chrome extension, translates the visible
interface into **Adamawa Fulfulde (`fub`)** in place, and speaks it. It never modifies the
service's source code, and it never sends page data off the device.

[![CI](https://github.com/Zeusse-Neumbi/z-team-fulfulde/actions/workflows/ci.yml/badge.svg)](https://github.com/Zeusse-Neumbi/z-team-fulfulde/actions/workflows/ci.yml)

**Execution board:** [Z-Team Fulfulde Assistant — Preselection](https://github.com/users/Zeusse-Neumbi/projects/4)

> **Status: browser mechanics, labelled MT draft pack and bundled audio complete; the
> native-speaker session is scheduled and the validated pack is pending.**
> The extension scans FR/EN pages, translates in place from a validated TM, protects values
> byte-for-byte, survives re-renders, restores on Stop and exposes a guided panel with
> read-back. The checked-in TM still has empty Fulfulde targets. The production build can now
> use the local NLLB API as a clearly labelled fallback (`MT local — non validée`), or stay in
> the source language when that mode is off. Machine output is not native-speaker validation.
> The fixture build (`pnpm build:test`) proves the full pipeline with test tokens; it is never
> shipped. The panel switches FR/EN/FF without touching the page; the FF UI is a machine-
> translated draft. It reports both translatable coverage and a per-step page coverage with its
> safe protected-value ceiling, and reads a structured page brief in Fulfulde — never a
> French/English line — instead of a flat sentence list.
> The native-speaker pack, the fine-tuned voice and the closed-set voice classifier are the next
> milestones.

## What it does

1. **Reads the page semantically** — roles, accessible names, form labels and text nodes.
2. **Translates the interface in place** — headings, labels, buttons, sentences, warnings —
   from a native-speaker-validated translation memory, with an optional local-API fallback
   that is always labelled as machine translation.
3. **Never touches financial values** — amounts, fees, totals, balances, account numbers,
   phone numbers, references, names and user input stay byte-identical.
4. **Speaks the page** — a structured brief (page purpose, sections, warnings, primary actions)
   plus click announcements, with recorded phrases and the local voice.
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

Requirements: Node **22+** (24 LTS recommended — pnpm 11 does not support
Node 20), pnpm 11.9+, Python 3.11+ (3.12 tested), uv.

```bash
pnpm bootstrap          # checks the tools, installs JS + Python, builds
# or, manually:
pnpm install
uv sync --project apps/server --extra dev
```

The Windows-first setup, the model downloads and the GPU notes are in
[`docs/SETUP.md`](docs/SETUP.md). To move the demo to another computer, follow
[`docs/TRANSFER.md`](docs/TRANSFER.md). The dated execution checklist is
[`docs/EXECUTION_PLAN.md`](docs/EXECUTION_PLAN.md).

Optional development credentials (GitHub MCP, Hugging Face models and Context7
docs) are documented in [`.env.example`](.env.example). Copy it to `.env` and fill
only what you need. The shipped extension and API never read those keys.

Terminal 1 — local API and models:

```bash
pnpm demo
```

`pnpm demo` starts the local API with the MMS voice and NLLB when the models are
present, waits for `/health`, and prewarms the demo phrases. It reuses a Z-Team
API on `127.0.0.1:8000–8010` or starts on the first free port; the side panel
discovers the same range. Run `pnpm demo -- --check` first to see the models,
device, port and pack state; `--deep` runs a real NLLB `/translate` check. Use
`pnpm demo -- --stub` for a UI-only run without models. The manual command is
still available:

```bash
uv run --project apps/server uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2 — extension dev build:

```bash
pnpm dev
```

Then load `.output/chrome-mv3` in `chrome://extensions` (Developer mode → Load unpacked),
open `https://safinum.cm/hackathon-test`, and click the extension. With the API running and
the default **Repli après la TM** mode, plain labels are translated by NLLB and marked
**MT — non validée**; amounts, names, accounts, phones, references and input stay exact.
Choose **Désactivée** in the panel to return to TM-only, or **API locale d’abord** to try the
other priority. Without the API, the page stays in French or English and the panel says so.
The full walkthrough is in [`docs/MANUAL_DEMO.md`](docs/MANUAL_DEMO.md).

To exercise the translation pipeline before the pack, build the test fixture instead:

```bash
pnpm build:test
pnpm e2e          # local five-step mock
pnpm check:live   # real SAFINUM page, test tokens only
pnpm check:sites  # 30 public pages, canary values, dynamic content, restore
```

The fixture target is `⟦FF:<id>⟧` plus the source string, so every protected value stays
byte-identical. It is written to `apps/extension/.output-test/`, is gitignored and is never
included in the production ZIP.

### Optional heavy dependencies

The scaffold installs the web and API dependencies needed to build, test and run the
extension with the stub speech backend. Two large optional extras are installed on demand:

```bash
# Chromium for Playwright: string extraction, coverage, e2e
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
| `pnpm demo` | Start the local API + models, wait for health, prewarm |
| `pnpm demo:check` | Preflight: models, device, port, pack, ZIP |
| `pnpm demo:stub` | UI-only run without models; voice disabled |
| `pnpm models:download` | Download MMS and NLLB int8 with checksums |
| `pnpm models:verify` | Check the local model sizes and SHA-256 |
| `pnpm doctor` | Print OS, tools, GPU, models, API and ZIP state |
| `pnpm build` | Build the production extension (validated pack, or honest source view) |
| `pnpm build:test` | Build the test-only fixture extension to `.output-test` |
| `pnpm test` | Vitest across packages |
| `pnpm e2e` | Local five-step journey, English page, novel content, a11y |
| `pnpm check:live` | Run the fixture mechanics against the live SAFINUM page |
| `pnpm check:sites` | Run the canary sweep over 30 public pages (network needed) |
| `pnpm serve:eval` | Serve the local mock pages on `127.0.0.1:4173` |
| `pnpm lint` | oxlint |
| `pnpm typecheck` | TypeScript across packages |
| `pnpm package` | Zip the built extension into `dist/` |
| `pnpm size:check` | Fail if the ZIP exceeds 8 MB |
| `pnpm setup:e2e` | Install Chromium for the Playwright smoke test |
| `pnpm e2e` | Load the fixture extension and run the journey, error, novel-content and a11y tests |
| `pnpm audit --audit-level high` | Fail on high or critical JS vulnerabilities |
| `pnpm ci:local` | Run the web and API checks in one command |
| `pnpm hooks` | Enable the repository hooks once per clone |
| `pnpm strings` | Extract visible page strings with Playwright |
| `pnpm coverage` | Compute translation coverage from two text dumps |
| `uv run --project apps/server pytest` | API tests |

## Contributing and repository rules

`main` is PR-only. Work on a `<type>/<slug>` branch, use a Conventional Commit
and open a pull request; `ci-required` must be green against the current base
before merge. Squash is the only merge method and head branches are deleted
automatically.

The full workflow is in [`CONTRIBUTING.md`](CONTRIBUTING.md) and the agent
contract is in [`AGENTS.md`](AGENTS.md). Repository decisions live under
[`docs/decisions/`](docs/decisions/README.md).

The CI wall runs Web (lint, typecheck, unit, build, package, size, audit), API
(Ruff, MyPy, Pytest, audit), E2E/Playwright, workflow linting, secret and
dependency scanning, and a repository guard. The aggregate `ci-required` job is
the only required status check. A nightly workflow repeats the e2e smoke test,
and a `v*` tag publishes the package plus `SHA256SUMS.txt` through the release
workflow.

Local guards are installed with `pnpm hooks`: the hooks block direct commits and
pushes to `main`, staged `.env` files, model weights, files over 5 MiB and
non-Conventional commit messages. Dependabot checks npm, uv and GitHub Actions
weekly; blocked upgrades are tracked with the **Blocked dependency upgrade**
issue template rather than a permanently red pull request.

## Privacy

- The extension talks only to `127.0.0.1:8000–8010`.
- There is no cloud provider, no API key, no telemetry and no remote config.
- When the local API fallback is enabled, translatable labels go to the loopback service.
  Amounts, names, accounts, phones, references, dates, codes and user input never do.
- The value vault lives in memory and is cleared on Stop and when the page unloads.
- `chrome.storage` holds the interface language (FR/EN/FF), playback speed and the local-API
  mode only — never page values or page signatures. The page-coverage baseline lives in memory
  and is cleared on Stop.
- See [`docs/PRIVACY.md`](docs/PRIVACY.md) and [`SECURITY.md`](SECURITY.md).

## AI-assisted development

The repository is set up for agent sessions without giving up the value and
privacy rules:

- [`AGENTS.md`](AGENTS.md) — the short agent contract;
- [`.ai/rules/`](.ai/rules/index.md) — path-scoped rules for the extension,
  translator, API, phrasebank, tests, docs, repo and security;
- [`.opencode/skills/`](.opencode/skills) — upstream skills from Anthropic,
  Vercel, Chrome DevTools and GitHub Awesome Copilot; sources, commits and
  licences are in [`.opencode/skills/SOURCES.md`](.opencode/skills/SOURCES.md);
- [`opencode.json`](opencode.json) — OpenCode MCP servers and `/verify`,
  `/protected-audit`, `/project-sync` and `/release-check` commands;
- [`.mcp.json`](.mcp.json) — portable MCP catalog for other clients;
- [`docs/AI_WORKFLOW.md`](docs/AI_WORKFLOW.md) — start sequence, MCP setup and
  guardrails.

Run `pnpm ai:check` after changing any AI config, rule or skill. It validates the
files and rejects obvious secret patterns. The MCP servers are Context7 (docs),
Playwright (test automation), Chrome DevTools (extension inspection),
Hugging Face (models and datasets) and an optional local GitHub server.

The project does not maintain its own skill collection. Project-specific
constraints live in `.ai/rules/`; skills are pinned copies of established
upstream tools.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — components, data flow, translation pipeline
- [`docs/MANUAL_DEMO.md`](docs/MANUAL_DEMO.md) — build, load in Chrome, run the five-step demo and switch the local API mode
- [`docs/PRIVACY.md`](docs/PRIVACY.md) — data handling and permissions
- [`docs/SETUP.md`](docs/SETUP.md) — Windows/macOS/Linux setup, models, GPU, troubleshooting
- [`docs/TRANSFER.md`](docs/TRANSFER.md) — moving the demo to another computer
- [`docs/ENV.md`](docs/ENV.md) — the two machines and their measurements
- [`docs/LINGUISTIC_VALIDATION.md`](docs/LINGUISTIC_VALIDATION.md) — native-speaker protocol (validation by listening)
- [`docs/TTS_REPORT.md`](docs/TTS_REPORT.md) — voice baseline, speaker evaluation and decision
- [`docs/DEMO.md`](docs/DEMO.md) — 3-minute video and live demo script
- [`docs/REPO_AUDIT.md`](docs/REPO_AUDIT.md) — minimal repository checklist and CI wall
- [`docs/EXECUTION_PLAN.md`](docs/EXECUTION_PLAN.md) — dated checkable plan to submission
- [`docs/PROJECT_BOARD.md`](docs/PROJECT_BOARD.md) — D1–D7 plan, board views and operating cadence
- [`docs/AI_WORKFLOW.md`](docs/AI_WORKFLOW.md) — skills, MCP servers and agent guardrails
- [`docs/decisions/`](docs/decisions/README.md) — squash, protection, CI, guard and licence decisions
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — branches, commits, merge policy and verification
- [`AGENTS.md`](AGENTS.md) — the short contract for agent sessions
- [`docs/SUBMISSION.md`](docs/SUBMISSION.md) — form fields and package
- [`LICENSING.md`](LICENSING.md) — noncommercial and commercial-use terms
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) — components, models and licences

## Language

**Adamawa Fulfulde**, ISO 639-3 `fub`, Cameroon. The sub-variety (Ngaoundéré, Garoua or
Maroua) is confirmed with the speaker and recorded in the validation evidence.

## Team

Z-Team — SAFINUM Innovate Challenge 2026.

## Licence

This repository is **source-available** under the
[PolyForm Noncommercial License 1.0.0](LICENSE). You may use, modify and share it
for noncommercial purposes. Commercial use requires a separate written licence;
see [`LICENSING.md`](LICENSING.md).

Third-party assets and models keep their own licences; see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
