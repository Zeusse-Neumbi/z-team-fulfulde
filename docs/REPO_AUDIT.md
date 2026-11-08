# Repository audit

A minimal, executable checklist. The goal is a repository a jury member can read in five
minutes, a new contributor can run from a clean clone, and an agent can change without
weakening the value or privacy rules.

## Contents

- [x] 1. `README.md` — description, status, quickstart, repo map, privacy, docs, licence.
- [x] 2. `LICENSE` — MIT for this repository.
- [x] 3. `THIRD_PARTY_NOTICES.md` — dependencies, models, datasets and obligations.
- [x] 4. `SECURITY.md` — reporting, scope and private advisory link.
- [x] 5. `CONTRIBUTING.md` — branches, commits, merge policy, verification and hooks.
- [x] 6. `AGENTS.md` — the short contract for agent sessions.
- [x] 7. `docs/ARCHITECTURE.md`.
- [x] 8. `docs/PRIVACY.md`.
- [x] 9. `docs/LINGUISTIC_VALIDATION.md`.
- [x] 10. `docs/TTS_REPORT.md` (template; not yet run).
- [x] 11. `docs/DEMO.md`.
- [x] 12. `docs/decisions/` — dated decision records with an index.
- [x] 13. `.gitignore` excludes dependencies, builds, data, models, recordings and archives.

## Repository rules

- [x] 14. `main` is PR-only; direct commits and pushes are blocked by local hooks and
      the `main protection` ruleset.
- [x] 15. Squash is the only merge method; head branches are deleted automatically.
- [x] 16. `ci-required` is the single required status check and must pass against the
      current base.
- [x] 17. Release tags matching `v*` are protected from deletion, force pushes and updates.
- [x] 18. `.githooks/` blocks `main`, staged `.env` files, model weights, files over
      5 MiB and non-Conventional commit messages; `pnpm hooks` installs the hooks.
      The `Repository guard` CI job rechecks tracked files after a `--no-verify` bypass.
- [x] 19. `.github/dependabot.yml` checks npm, uv and GitHub Actions weekly.
- [x] 20. `.github/ISSUE_TEMPLATE/` and `.github/pull_request_template.md` record
      verification and blocked upgrades.
- [x] 21. `scripts/apply-repo-settings.sh` reapplies the settings and rulesets as code.

## CI wall

- [x] 22. Web: oxlint, typecheck, Vitest, build, package, size limit, npm audit.
- [x] 23. API: Ruff lint and format, MyPy, Pytest, Python audit.
- [x] 24. E2E: Playwright loads the built extension and checks the side panel.
- [x] 25. Workflows: `actionlint` over every workflow.
- [x] 26. Security: gitleaks secret scan over full history, npm and Python audits.
- [x] 27. Repository guard: git-hook self-test and tracked-file hygiene.
- [x] 28. `ci-required` aggregates every blocking job.
- [x] 29. A nightly e2e workflow repeats the extension smoke test and opens a
      deduplicated issue on failure.
- [x] 30. A tag-driven release workflow re-runs the checks, packages the extension,
      writes `SHA256SUMS.txt` and creates the GitHub release.
- [x] 31. A public GitHub Project tracks the D1–D7 plan, milestones, risks and
      submission; `scripts/bootstrap-github-project.mjs` recreates it from
      `scripts/project-plan.json`.

## Release checks

```bash
pnpm hooks
pnpm ci:local
pnpm audit --audit-level high
pnpm e2e
sh scripts/tests/test-githooks.sh
bash scripts/check-repo-hygiene.sh
bash scripts/verify-submission.sh
```

`pnpm ci:local` covers lint, typecheck, unit tests, build, package, size, Ruff,
MyPy and Pytest. `pnpm e2e` needs Chromium from `pnpm setup:e2e`.

## Not present by design

`CODE_OF_CONDUCT.md`, `CITATION.cff`, model weights, datasets, the full audio
bank and build artifacts. The project is a six-day hackathon build; the
repository should stay reviewable.
