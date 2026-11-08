# GitHub Copilot instructions

This repository is an AI-assisted, local-first Fulfulde accessibility layer.

Before changing code, read these canonical files:

1. `AGENTS.md` — the short agent contract and hard rules.
2. `.ai/rules/index.md` — the path-to-rule map.
3. The rule file matching the files you will touch.
4. `CONTRIBUTING.md` — branches, commits, merge policy and verification.
5. `docs/PROJECT_BOARD.md` — the D1–D7 plan and gates.

## Hard rules

- Never commit, amend, merge or push to `main`. Work on a feature branch and open
  a pull request.
- Never change a protected financial value. Amounts, fees, totals, balances,
  names, phones, accounts, references, dates and user input are byte-identical.
- No network egress except `127.0.0.1`; no telemetry, cloud LLM or API key.
- Do not translate a protected value or store page values in `chrome.storage`,
  logs, fixtures or screenshots.
- Use a Conventional Commit PR title; `ci-required` must be green.
- Do not weaken, skip or delete a CI job to make a change pass.
- The repository is source-available under PolyForm Noncommercial 1.0.0, not
  MIT. Commercial use requires a separate licence.

## Verification

```bash
pnpm ai:check
pnpm ci:local
pnpm audit --audit-level high
pnpm e2e
```

See `docs/AI_WORKFLOW.md` for skills, MCP servers and the full workflow.
