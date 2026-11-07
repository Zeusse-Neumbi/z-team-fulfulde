---
date: 2026-11-07
status: Accepted
---

# ADR 0004: Guard secrets, dependencies, file size and release tags

## Context

The project handles financial-interface text and must never publish page values,
credentials or model weights. A green test suite does not catch a committed
`.env` file, a 200 MiB recording or a vulnerable transitive dependency.

## Decision

Use layered guards:

- **Local hooks** (`.githooks/`) block commits on `main`, staged `.env` files,
  model weights, files over 5 MiB and non-Conventional commit messages. The
  pre-push hook blocks pushes to `main`.
- **CI security job** runs gitleaks over full history and audits npm and Python
  dependencies at `high` severity or above.
- **PR title workflow and commit-msg hook** enforce Conventional Commits; the
  server-side commit-message rule is not available on the current plan.
- **Repository guard job** self-tests the hooks and rejects tracked generated
  directories, environment files, binaries and files over 5 MiB.
- **Server-side rules** protect `main` and `v*` release tags. GitHub's
  file-extension and maximum-file-size rules are not available on the current
  plan, so file size and binary extensions stay guarded locally and in CI.
- **Dependabot** checks npm, uv and GitHub Actions weekly with grouped
  minor/patch, major and security updates. Blocked upgrades get an issue and an
  explicit `ignore` rule instead of a permanently red PR.

## Consequences

A local bypass (`--no-verify`) is still caught by CI: the `Repository guard` job
rejects tracked environment files, binaries, generated directories and files
over 5 MiB. Dependency upgrades arrive as reviewable pull requests through the
same `ci-required` gate. Security findings are fixed or recorded; they are not
muted with a broad ignore.
