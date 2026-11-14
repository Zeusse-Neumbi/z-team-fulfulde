# Agent rules

This file is the short contract for an agent session in this repository. Read it
before planning or editing.

## Project context

Z-Team Fulfulde Assistant is a local-first Chrome MV3 extension plus a loopback
FastAPI service. It translates the visible interface of a web page into a selected
Cameroonian language pack in place — Adamawa Fulfulde (`fub`) is the
demonstrated language; Yemba (`ybb`) is the second draft — and speaks it when a
voice is available. It never modifies the service, never
sends page data off the device and never changes financial values.

The non-negotiable invariant: **protected nodes are byte-identical before and
after translation**. Amounts, fees, totals, balances, account numbers, phone
numbers, references, dates, names and user input are protected. A mismatch
reverts the node and aborts the plan.

## Start here

1. Read `CONTRIBUTING.md`.
2. Read `.ai/rules/index.md` and every rule matching the files in scope.
3. Read `docs/ARCHITECTURE.md`, `docs/PRIVACY.md` and `docs/REPO_AUDIT.md`.
4. Read the relevant decision record under `docs/decisions/`.
5. Load the matching skill from `.opencode/skills/` when the task has one.
6. Inspect the existing code and tests before writing a new pattern.

## Hard rules

- Never commit, amend, merge or push to `main`. Work on `<type>/<slug>` and open
  a pull request.
- Use Conventional Commit messages and PR titles.
- Keep the `ci-required` gate green. Do not weaken, skip or delete a check to
  make a change pass.
- Do not add a dependency without updating the lockfile and
  `THIRD_PARTY_NOTICES.md`.
- Do not add network egress, telemetry, analytics, remote configuration or an
  API key.
- Do not store page values in `chrome.storage`, logs, fixtures or screenshots.
- Do not commit `.env` files, model weights, audio recordings, datasets or build
  artifacts.
- Do not change a schema or phrasebank contract without a matching test.
- Record a product, contract or repository decision in `docs/decisions/`; do not
  leave it only in chat.
- Do not remove the noncommercial licence or relicense the work. The repository
  is source-available under PolyForm Noncommercial 1.0.0; commercial use needs a
  separate written licence.
- Do not put a secret in `opencode.json`, `.mcp.json`, a skill or a rule. Use
  `{env:NAME}` substitution.
- Never commit `.env`; use `.env.example` placeholders. `GH_TOKEN`,
  `GITHUB_PERSONAL_ACCESS_TOKEN`, `HF_TOKEN` and `CONTEXT7_API_KEY` are
  development tooling only. The extension and API must not read them at runtime.

## Commands

```bash
pnpm hooks                  # enable the repository hooks once
pnpm ai:check               # validate AI config, rules, skills, MCP and secrets
pnpm ci:local               # lint, typecheck, unit, build, package, API checks
pnpm audit --audit-level high
pnpm e2e                    # built extension smoke test; needs Chromium
sh scripts/tests/test-githooks.sh
bash scripts/check-repo-hygiene.sh
bash scripts/verify-submission.sh
node scripts/bootstrap-github-project.mjs
```

## AI workspace

- Path-scoped rules live in `.ai/rules/`; the index maps files to rules.
- Upstream skills live in `.opencode/skills/<id>/SKILL.md`; their pinned sources
  and licences are in `.opencode/skills/SOURCES.md`. Do not write a new skill
  silently; propose it and prefer an established upstream skill.
- MCP servers and slash commands live in `opencode.json`; `.mcp.json` is the
  portable catalog for other clients.
- The optional GitHub MCP server is disabled by default and needs Docker plus
  `GITHUB_PERSONAL_ACCESS_TOKEN`.
- `docs/AI_WORKFLOW.md` is the human overview; keep it in sync when you add a
  rule, skill or command.

`pnpm setup:e2e` installs Chromium once per machine. The optional speech stack
is installed with `uv sync --project apps/server --extra speech`; it is not
needed for the default CI gate.

## Change discipline

- Prefer the smallest change that covers the request.
- Add tests for behaviour and failure modes, not for copy or layout.
- Run the narrowest check first, then the full set before handing off.
- If a check fails, fix the cause; do not silence it with a broad ignore.
- Leave the repository cleaner than you found it: no generated files, no
  secrets, no dead configuration.
