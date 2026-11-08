# AI development workflow

This repository is set up so an agent can move quickly without drifting from the
product, privacy and language rules.

**Canonical files**

- [`AGENTS.md`](../AGENTS.md) — the short agent contract.
- [`.ai/rules/index.md`](../.ai/rules/index.md) — path-to-rule map.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — branches, commits, merge and
  verification.
- [`docs/PROJECT_BOARD.md`](PROJECT_BOARD.md) — D1–D7 plan and project board.
- [`opencode.json`](../opencode.json) — OpenCode skills, MCP servers and commands.
- [`.mcp.json`](../.mcp.json) — portable MCP catalog for other clients.

## Start sequence

1. Read `AGENTS.md`.
2. Open `.ai/rules/index.md` and read every rule matching the files in scope.
3. Open the matching skill in `.opencode/skills/`.
4. Read the relevant code and tests before writing a new pattern.
5. Run the narrowest check, then `pnpm ci:local` before handing off.

## Rules

| Path | Rule |
| --- | --- |
| `**` | [`.ai/rules/project.md`](../.ai/rules/project.md) |
| Extension, translator, shared | [`.ai/rules/frontend.md`](../.ai/rules/frontend.md) |
| FastAPI service | [`.ai/rules/backend.md`](../.ai/rules/backend.md) |
| Phrasebank, linguistic data | [`.ai/rules/phrasebank.md`](../.ai/rules/phrasebank.md) |
| Tests and e2e | [`.ai/rules/testing.md`](../.ai/rules/testing.md) |
| Documentation and decisions | [`.ai/rules/docs.md`](../.ai/rules/docs.md) |
| Repo, CI, release, AI config | [`.ai/rules/repo.md`](../.ai/rules/repo.md) |
| Security and privacy | [`.ai/rules/security.md`](../.ai/rules/security.md) |

## Skills

Skills are discovered automatically from `.opencode/skills/`. They come from
upstream projects; the pinned source and licence for each are in
[`.opencode/skills/SOURCES.md`](../.opencode/skills/SOURCES.md).

| Skill | Upstream | Use it when |
| --- | --- | --- |
| `webapp-testing` | Anthropic | Testing and debugging the extension against a local page |
| `frontend-design` | Anthropic | Shaping the side panel and demo screens |
| `pdf` | Anthropic | Reading, creating or validating the technical note and submission PDFs |
| `docx` | Anthropic | Authoring or editing the French technical note |
| `react-best-practices` | Vercel | Writing or reviewing React in the side panel |
| `web-design-guidelines` | Vercel | Reviewing UI, accessibility and UX |
| `chrome-devtools` | Chrome DevTools | Inspecting the service worker, network, console and performance |
| `a11y-debugging` | Chrome DevTools | Auditing focus, keyboard, ARIA, tap targets and contrast |
| `github-actions-hardening` | GitHub Awesome Copilot | Reviewing CI permissions, pinning, triggers and injection |
| `git-commit` | GitHub Awesome Copilot | Splitting changes into Conventional Commits |

## MCP servers

| Server | Type | Purpose |
| --- | --- | --- |
| `context7` | Remote | Current library, framework and API documentation |
| `playwright` | Local | Drive the live page and the built extension; writes to `.playwright-mcp/` |
| `chrome-devtools` | Local | Chrome DevTools inspection and performance; usage statistics and CrUX disabled |
| `huggingface` | Remote | Search models and datasets for the Fulfulde speech and language work |
| `github` | Local, disabled | Issues, pull requests, Actions and Projects; needs Docker and `GITHUB_PERSONAL_ACCESS_TOKEN` |

Enable the GitHub server only when needed:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="$(gh auth token)"
# then enable the "github" server in the OpenCode MCP panel or remove disabled:true
```

Never paste a token into `opencode.json`, `.mcp.json`, a skill or a rule. Use
`{env:NAME}` substitution.

The Playwright server uses the Chromium installed by `pnpm setup:e2e`. Install it
once per machine:

```bash
pnpm setup:e2e
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm ai:check` | Validate AI config, rules, skills, MCP files and secret patterns |
| `pnpm ci:local` | Full local web + API CI wall |
| `pnpm audit --audit-level high` | Dependency vulnerability gate |
| `pnpm e2e` | Built-extension Playwright smoke test |
| `node scripts/bootstrap-github-project.mjs` | Reconcile the GitHub Project with `scripts/project-plan.json` |

OpenCode also exposes `/verify`, `/protected-audit`, `/project-sync` and
`/release-check` from `opencode.json`.

## Guardrails

- `main` is PR-only; `ci-required` must be green.
- Protected values are byte-identical; a mismatch reverts and aborts.
- No network egress except `127.0.0.1`.
- No page values in storage, logs, fixtures or screenshots.
- No invented Fulfulde, validators or native-speaker evidence.
- No secrets in AI config. `pnpm ai:check` rejects obvious token patterns.
- No new skill or rule without updating `.ai/rules/index.md` and
  `docs/AI_WORKFLOW.md`.
- The repository is source-available under PolyForm Noncommercial 1.0.0, not
  MIT. Commercial use requires a separate licence.

## Supported clients

- **OpenCode** reads `opencode.json`, `AGENTS.md`, `.ai/rules/` and the pinned
  upstream skills in `.opencode/skills/`.
- **Claude Code** reads `CLAUDE.md`, `AGENTS.md` and `.mcp.json`; the skill
  directory `.opencode/skills` is not discovered, so point it at the same skill
  files if needed.
- **Cursor** reads `.cursor/rules/project.mdc`, which points back to `AGENTS.md`
  and `.ai/rules/index.md`.
- **GitHub Copilot** reads `.github/copilot-instructions.md`, which points back
  to `AGENTS.md` and `.ai/rules/index.md`.
- **Other agents** should treat `AGENTS.md` and `.ai/rules/index.md` as the
  contract, and use `.mcp.json` for the portable MCP servers.

## Adding a skill or rule

**Prefer an existing upstream skill.** Search the [skills.sh leaderboard](https://skills.sh/)
and reputable sources such as `anthropics/skills`, `vercel-labs/agent-skills`,
`ChromeDevTools/chrome-devtools-mcp` and `github/awesome-copilot`. Check the
source, licence, install count and repository reputation before adding one.

To add an upstream skill:

1. Copy the skill directory into `.opencode/skills/<id>/`.
2. Keep its `LICENSE.txt` and add a `SOURCE.md` with the upstream URL, pinned
   commit, licence and reason.
3. Add it to `.opencode/skills/SOURCES.md` and `THIRD_PARTY_NOTICES.md`.
4. Update the skills table above and `.ai/rules/index.md` if the workflow
   changes.
5. Run `pnpm ai:check` and `pnpm ci:local`.

Do not write a new skill silently. If no existing skill covers the need, propose
the skill and its source/reason first. Project-specific constraints belong in
`.ai/rules/`, not in a copy of an upstream skill.
