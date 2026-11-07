---
date: 2026-11-07
status: Accepted
---

# ADR 0003: Require the ci-required aggregate check

## Context

The CI workflow has several independent jobs. Requiring each job name in the
branch ruleset means every new job needs a settings change, and a renamed job
silently stops being required.

## Decision

Add a final `ci-required` job that depends on every blocking job, runs with
`if: always()` and fails when any dependency did not succeed. Require only that
one context in the `main protection` ruleset.

The blocking jobs are `Web`, `API`, `E2E / Playwright`, `Workflows`, `Security`
and `Repository guard`.

## Consequences

A skipped, cancelled or failed job blocks the merge. New checks must be added to
the `needs` list and to this ADR. The aggregate job is cheap; all real work stays
in the independent jobs so failures are easy to locate.
