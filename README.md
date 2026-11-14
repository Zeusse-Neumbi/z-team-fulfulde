# Z-Team Lingua

**A local-first Cameroonian-language accessibility layer for digital financial services.**

It attaches to an existing web interface as a Chrome extension, translates the visible
interface into a selected Cameroonian language in place, and speaks it when a voice is
available. **Fulfulde (`fub`) is the demonstrated language; Yemba (`ybb`) is the second,
data-only pack.** It never modifies the service's source code, and it never sends page data
off the device.

[![CI](https://github.com/Zeusse-Neumbi/z-team-lingua/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Zeusse-Neumbi/z-team-lingua/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Zeusse-Neumbi/z-team-lingua?include_prereleases&sort=semver&label=release)](https://github.com/Zeusse-Neumbi/z-team-lingua/releases)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A522-339933?logo=node.js&logoColor=white)](package.json)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)](apps/extension)

**Execution board:** [Z-Team Lingua — Preselection](https://github.com/users/Zeusse-Neumbi/projects/4)

**Latest release:** [v0.3.0-preselection](https://github.com/Zeusse-Neumbi/z-team-lingua/releases/tag/v0.3.0-preselection) — extension ZIP, French and English 5-page notes, listening pack and checksums.

> **Status: preselection draft. Two language packs ship as labelled machine-translation
> drafts: Fulfulde 115/115 units and Yemba 103/115 (12 withheld when the draft lost a
> protected value). No native-speaker session has run; `pnpm check:evidence` fails by
> design and every pack reports `packValidated: false`.**
> The extension scans FR/EN pages, translates in place, protects values byte-for-byte,
> survives re-renders, restores on Stop and exposes a guided panel with read-back. The ZIP
> bundles the Fulfulde voice (82 playable clips out of 115; 33 are withheld). The Yemba
> voice is **API-only** and is never replaced by a Fulfulde clip. Machine output is not
> native-speaker validation. The fixture build (`pnpm build:test`) proves the pipeline with
> test tokens; it is never shipped.

## What it does

1. **Reads the page semantically** — roles, accessible names, form labels and text nodes.
2. **Translates the interface in place** — headings, labels, buttons, sentences, warnings —
   from a translation memory and, for the submission build, a pack labelled as machine
   translation. It never presents a draft as validated.
3. **Never touches financial values** — amounts, fees, totals, balances, account numbers,
   phone numbers, references, names and user input stay byte-identical.
4. **Speaks the page** — a structured brief (page purpose, sections, warnings, primary actions)
   plus click announcements, with bundled phrases and the local voice when the selected
   language has one. Fulfulde ships 82 playable clips; the Yemba voice is API-only.
5. **Handles new content** — a `MutationObserver` detects text added after load and
   translates it or falls back to a validated safe message.
6. **Runs entirely locally** — no cloud LLM, no API key, no page data leaving the machine.

## Two languages, one engine

| Language | Code | Pack | Targets | Voice in the ZIP |
| --- | --- | --- | --- | --- |
| Adamawa Fulfulde | `fub` | NLLB-200 int8 draft | 115/115 | 82 playable MMS clips |
| Yemba | `ybb` | cameroon-int8 Marian draft | 103/115 (12 withheld) | API-only |

Both packs are **drafts**: `packValidated: false`, no validators, no
back-translations. Yemba is the proof that a language is data, not code. See
[`docs/LANGUAGES.md`](docs/LANGUAGES.md) for the status table, the withheld
IDs and the validation rules. A Fulfulde clip is never played under a Yemba
label; the panel resolves `speech.voice` per language.

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

Terminal 2 — submission build:

```bash
pnpm build:submission
```

Then load `.output/chrome-mv3` in `chrome://extensions` (Developer mode → Load unpacked),
open `https://safinum.cm/hackathon-test`, and click the extension. The submission build
carries the labelled Fulfulde and Yemba drafts, so the page is translated without the API.
The panel marks every draft **MT — non validée**; amounts, names, accounts, phones,
references and input stay exact. The Fulfulde voice plays from the bundled clips. Choose
**Yemba** to see the second pack; its voice needs the local API and is disabled otherwise.
`pnpm dev` is the hot-reload development loop; run `pnpm build:submission` again after a
pack change. The full walkthrough is in [`docs/MANUAL_DEMO.md`](docs/MANUAL_DEMO.md).

To exercise the translation pipeline before the pack, build the test fixture instead:

```bash
pnpm build:test
pnpm e2e          # local five-step mock
pnpm check:live   # real SAFINUM page, test tokens only
pnpm check:sites  # 30 public pages, canary values, dynamic content, restore
```

The fixture target is `⟦<code>:<id>⟧` plus the source string, so every protected value stays
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
| `pnpm build` | Build the validated-pack extension; refuses to package an empty Fulfulde demo pack |
| `pnpm build:submission` | Build the labelled MT draft ZIP (Fulfulde + Yemba) |
| `pnpm build:test` | Build the test-only fixture extension to `.output-test` |
| `pnpm test` | Vitest across packages |
| `pnpm e2e` | Local five-step journey, English page, novel content, a11y |
| `pnpm check:draft` | Run the submission draft against the local demo page |
| `pnpm check:evidence` | Report which language packs are validated; fails on drafts |
| `pnpm check:live` | Run the fixture mechanics against the live SAFINUM page |
| `pnpm check:sites` | Run the canary sweep over 30 public pages (network needed) |
| `pnpm serve:eval` | Serve the local mock pages on `127.0.0.1:4173` |
| `pnpm lint` | oxlint |
| `pnpm typecheck` | TypeScript across packages |
| `pnpm package` | Zip the built extension into `dist/` |
| `pnpm size:check` | Fail if the ZIP exceeds 8 MB |
| `pnpm note:build` | Build the French technical note PDF |
| `pnpm note:build:en` | Build the English technical note PDF |
| `pnpm submission` | Assemble the local submission folder and checksums |
| `pnpm setup:e2e` | Install Chromium for the Playwright smoke test |
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

**Product**

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — components, language registry, data flow, translation pipeline
- [`docs/LANGUAGES.md`](docs/LANGUAGES.md) — Fulfulde and Yemba status, withheld units, validation rules
- [`docs/MANUAL_DEMO.md`](docs/MANUAL_DEMO.md) — build, load in Chrome, run the five-step demo and switch language
- [`docs/DEMO.md`](docs/DEMO.md) — 3-minute video and live demo script
- [`docs/PRIVACY.md`](docs/PRIVACY.md) — data handling and permissions
- [`docs/ADD_A_LANGUAGE.md`](docs/ADD_A_LANGUAGE.md) — data-only language checklist
- [`docs/ADD_A_LANGUAGE_PROOF.md`](docs/ADD_A_LANGUAGE_PROOF.md) — the Lamnso reproducibility run

**Language and evidence**

- [`docs/LINGUISTIC_VALIDATION.md`](docs/LINGUISTIC_VALIDATION.md) — native-speaker protocol (validation by listening)
- [`docs/PHRASEBANK_MT.md`](docs/PHRASEBANK_MT.md) — candidate generation and promotion
- [`docs/MODELS.md`](docs/MODELS.md) — providers, models, licences and measurements
- [`docs/TTS_REPORT.md`](docs/TTS_REPORT.md) — voice baseline, speaker evaluation and decision
- [`docs/evidence/`](docs/evidence/) — Yemba MT comparison and model evidence

**Run and release**

- [`docs/SETUP.md`](docs/SETUP.md) — Windows/macOS/Linux setup, models, GPU, troubleshooting
- [`docs/TRANSFER.md`](docs/TRANSFER.md) — moving the demo to another computer
- [`docs/ENV.md`](docs/ENV.md) — development machine and measurements
- [`docs/EXECUTION_PLAN.md`](docs/EXECUTION_PLAN.md) — final submission runbook
- [`docs/PROJECT_BOARD.md`](docs/PROJECT_BOARD.md) — D1–D7 plan, board views and operating cadence
- [`docs/REPO_AUDIT.md`](docs/REPO_AUDIT.md) — repository checklist and CI wall
- [`docs/SUBMISSION.md`](docs/SUBMISSION.md) — form fields and package
- [`docs/note/note.fr.html`](docs/note/note.fr.html) · [`note.en.html`](docs/note/note.en.html) — bilingual 5-page note sources
- [`docs/RELEASE.md`](docs/RELEASE.md) — versioning, assets and release checks

**Contributing and decisions**

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — branches, commits, merge policy and verification
- [`AGENTS.md`](AGENTS.md) — the short contract for agent sessions
- [`docs/AI_WORKFLOW.md`](docs/AI_WORKFLOW.md) — skills, MCP servers and agent guardrails
- [`docs/decisions/`](docs/decisions/README.md) — dated decisions
- [`LICENSING.md`](LICENSING.md) — noncommercial and commercial-use terms
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) — components, models and licences

## Languages

- **Adamawa Fulfulde (`fub`)** — demonstrated language; NLLB-200 int8 MT draft;
  115/115 units; 82 bundled MMS clips; no native validation yet.
- **Yemba (`ybb`)** — second pack; cameroon-int8 Marian MT draft; 103/115 units
  (12 withheld); API-only voice; no native validation yet.
- The sub-variety for Fulfulde (Ngaoundéré, Garoua or Maroua) and the Yemba
  speaker are recorded only when a session runs. Neither has run.

## Team

Z-Team — SAFINUM Innovate Challenge 2026.

## Licence

This repository is **source-available** under the
[PolyForm Noncommercial License 1.0.0](LICENSE). You may use, modify and share it
for noncommercial purposes. Commercial use requires a separate written licence;
see [`LICENSING.md`](LICENSING.md).

Third-party assets and models keep their own licences; see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
