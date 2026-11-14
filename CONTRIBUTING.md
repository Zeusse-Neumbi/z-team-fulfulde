# Contributing

This repository is a solo-maintained hackathon project, but the merge rules are
written down so a human and an agent session follow the same path. Read
[`AGENTS.md`](AGENTS.md), [`docs/REPO_AUDIT.md`](docs/REPO_AUDIT.md) and the
[`docs/decisions/`](docs/decisions/README.md) index before changing code.

## Branches

- `main` is always releasable and **PR-only**. Never commit, amend, merge or
  push to it directly.
- Branch names: `<type>/<short-slug>`, for example
  `feat/protected-value-fuzz` or `chore/harden-repository`.
- One branch per reviewable slice, not one branch per phase.
- If changes are already sitting on `main`, create a branch before committing:
  `git switch -c <type>/<slug>`. Uncommitted changes move with you.

## Commits and pull request titles

Use Conventional Commits:

```
feat(translator): keep protected values byte-identical
fix(extension): restore the page after Stop
docs: record the privacy boundary
chore(deps): bump zod
```

The pull-request title becomes the squash commit message, so it must be correct.
The `PR title` workflow and the local `commit-msg` hook enforce the format.

## Merging

- Squash is the only allowed merge method.
- `main` is protected by the `main protection` ruleset: no direct pushes, no
  force pushes, no deletions, linear history, and `ci-required` must pass against
  the current base. A stale green check is not enough; update the branch first.
  Conventional Commit messages are enforced by the `PR title` workflow and the
  local `commit-msg` hook.
- A pull request merges only when `ci-required` is green. Merging with a red
  check is never acceptable, even when GitHub technically allows it.
- Head branches are deleted automatically after merge.
- Release tags matching `v*` are protected by the `release tag protection`
  ruleset. Do not delete or move a published tag.

The repository settings and rulesets are committed as code:

```bash
bash scripts/apply-repo-settings.sh
```

The script requires a GitHub token with admin access to the repository. It sets
squash-only merges, auto-delete of head branches, read-only workflow tokens,
Dependabot security updates, vulnerability alerts and both rulesets.

## CI wall

`ci-required` is the single required status check. It aggregates:

| Job | What it proves |
| --- | --- |
| `Web` | lint, typecheck, unit tests, build, extension package, size limit, JS audit |
| `API` | Ruff lint and format, MyPy, Pytest, Python audit |
| `E2E / Playwright` | the built extension loads and the side panel renders |
| `Submission pack` | the labelled draft translates the demo page, keeps values, and the FR/EN notes are 5 pages |
| `Workflows` | every workflow passes `actionlint` |
| `Security` | gitleaks secret scan, JS and Python dependency audits |
| `Repository guard` | git-hook self-test and tracked-file hygiene |

Do not weaken a job to make a pull request pass. Fix the code, the dependency or
the workflow.

## Verification

Run the narrowest check that covers the change, then the full set before
merging:

```bash
pnpm hooks
pnpm ai:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package
pnpm size:check
pnpm audit --audit-level high
uv run --project apps/server ruff check apps/server
uv run --project apps/server ruff format --check apps/server
uv run --project apps/server mypy apps/server/app --config-file apps/server/pyproject.toml
uv run --project apps/server pytest
pnpm build:test
pnpm e2e
sh scripts/tests/test-githooks.sh
bash scripts/check-repo-hygiene.sh
```

`pnpm ci:local` runs the web and API checks in one command. `pnpm e2e` uses the
test-only fixture build and needs Chromium: run `pnpm setup:e2e` once per
machine. `pnpm check:live` is the manual live-site check; `pnpm check:sites` is the
30-page canary sweep. Neither is part of `ci:local`; both need network. The
fixture build is the only broad-host build and is never packaged.

## Git hooks

Enable the repository hooks with:

```bash
pnpm hooks
```

- `pre-commit` refuses commits on `main`/`master`, staged `.env` files, model
  weights and any staged file over 5 MiB.
- `commit-msg` enforces a Conventional Commit subject.
- `pre-push` refuses pushes to `refs/heads/main` and `refs/heads/master`.

Do not bypass a hook with `--no-verify` and do not force-push `main`.

## Blocked dependency upgrades

When an upgrade cannot merge as a routine bump:

1. Comment on the pull request with the concrete blocker.
2. Close the pull request.
3. Open a **Blocked dependency upgrade** issue and link the closed PR.
4. Add an `ignore` rule in `.github/dependabot.yml` so it is not recreated
   weekly.

An upgrade is only "routine" when the dependency stays inside its declared
range and CI exercises the code path. A major model or runtime upgrade needs a
real smoke test, not only a green CI run.

## Dependabot

Dependabot checks npm, uv and GitHub Actions weekly. Dependency PRs use the
`chore(deps)` prefix and the `dependencies` label. They merge through the same
`ci-required` gate as any other change.

## Licence

The repository is source-available under the PolyForm Noncommercial License
1.0.0. Noncommercial use, modification and sharing are permitted. Commercial
use requires a separate written licence; see [`LICENSING.md`](LICENSING.md).

Unless you explicitly state otherwise, contributions are accepted under the same
licence. Do not contribute code you cannot license on those terms. Do not
describe the project as MIT or OSI open source.

## AI workspace

Agent sessions share the same rules:

- [`AGENTS.md`](AGENTS.md) — the short contract;
- [`.ai/rules/index.md`](.ai/rules/index.md) — path-scoped rules;
- [`.opencode/skills/SOURCES.md`](.opencode/skills/SOURCES.md) — upstream
  skills, pinned commits and licences;
- [`opencode.json`](opencode.json) — OpenCode MCP servers and commands;
- [`docs/AI_WORKFLOW.md`](docs/AI_WORKFLOW.md) — the full workflow.

Prefer an established upstream skill over a local rewrite. Do not add a new
skill without recording its source, licence and reason in
`.opencode/skills/SOURCES.md` and `THIRD_PARTY_NOTICES.md`.

Development credentials are in [`.env.example`](.env.example): GitHub MCP/CLI,
Hugging Face and Context7. Copy it to `.env`, which is gitignored. These keys are
for local tooling only; the shipped extension and API never read them.

Run `pnpm ai:check` after changing a rule, skill, MCP server or command. The
check validates the config, skill frontmatter, rule index, licence metadata and
obvious secret patterns. Do not put a token in a config file; use
`{env:NAME}`.

## Privacy and the value rule

Every change must preserve the core promise:

- no network egress except `127.0.0.1`;
- page values, names, amounts, references and user input stay byte-identical;
- no page data in logs, storage or telemetry;
- a failed translation reverts rather than guessing.

If a change touches `packages/translator`, the content script or the value
vault, add a regression test that proves protected values are unchanged.

## Decisions

Record product, contract and repository decisions in `docs/decisions/` with a
date and a source. Do not change a schema or phrasebank contract without
updating the matching tests in the same change.
