---
date: 2026-11-07
status: Accepted
---

# ADR 0002: Protect main with a repository ruleset

## Context

`main` is the authoritative, releasable branch. The repository previously had no
enforced protection: direct pushes, force pushes, merge commits and red checks
were technically possible.

## Decision

Protect `main` with the `main protection` ruleset:

- no branch deletion and no force pushes;
- linear history only;
- pull requests required, with squash as the only allowed merge method;
- `ci-required` must pass against an up-to-date base.

Conventional Commit messages are enforced by the `PR title` workflow and the
local `commit-msg` hook. File-extension, maximum-file-size and commit-message
rules are not available on the current GitHub plan, so they are enforced by the
local hooks and the `Repository guard` CI job instead.

Release tags matching `v*` are protected from deletion, force pushes and
updates by the `release tag protection` ruleset.

The rules are committed under `.github/rulesets/` and applied with
`scripts/apply-repo-settings.sh`, so the repository can be rebuilt after a
settings drift.

## Consequences

Contributors must use pull requests and update stale branches before merge. CI
is an enforced merge gate, not an advisory convention. The owner cannot bypass
the rules by pushing directly; settings can still be changed by an administrator
through the GitHub API or UI.
