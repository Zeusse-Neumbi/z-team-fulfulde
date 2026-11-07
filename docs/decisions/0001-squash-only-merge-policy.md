---
date: 2026-11-07
status: Accepted
---

# ADR 0001: Use squash-only merges

## Context

The repository is solo-maintained, but human and agent contributors need a
predictable merge history. Pull requests are the review unit and the PR title is
the only message a reader sees on `main`.

## Decision

Use squash merges for pull requests. Keep merge commits and rebase merges
disabled. Require a Conventional Commit PR title because it becomes the squash
commit message.

## Consequences

Each pull request lands as one commit on `main`; titles must be accurate and
follow the repository's Conventional Commit format. Head branches are deleted
after merging. See [ADR 0002](0002-main-branch-protection.md) for the related
protection rules.
