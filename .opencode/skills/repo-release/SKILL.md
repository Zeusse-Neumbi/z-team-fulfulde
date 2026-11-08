---
name: Repository Release
description: Run the local CI wall, prepare a pull request, publish a release and verify the submitted package without bypassing branch protection.
---

# Repository release

Use this skill for a release, a submission package, a risky merge or any change
to CI, hooks, Dependabot or branch protection.

## Read first

- `CONTRIBUTING.md`
- `.ai/rules/repo.md`
- `docs/PROJECT_BOARD.md`
- `docs/SUBMISSION.md`

## Workflow

1. Confirm the branch and freeze state:

```bash
git status --short --branch
git log --oneline -5
```

2. Run the full local wall:

```bash
pnpm hooks
pnpm ai:check
pnpm ci:local
pnpm audit --audit-level high
pnpm e2e
sh scripts/tests/test-githooks.sh
bash scripts/check-repo-hygiene.sh
```

3. Commit with a Conventional Commit message, push the feature branch and open a
   pull request. Do not push to `main`.
4. Wait for `ci-required` against the current base. If the branch is stale,
   update it and re-run.
5. Squash merge only after the check is green. Head branches are deleted
   automatically.
6. For a release tag:

```bash
git tag v0.1.0-preselection
git push origin v0.1.0-preselection
```

The release workflow publishes the ZIP and `SHA256SUMS.txt`.
7. Verify:

```bash
gh release view v0.1.0-preselection
sha256sum -c SHA256SUMS.txt
pnpm size:check
```

## Guardrails

- Never use `--no-verify`, force-push `main` or merge a red PR.
- No new feature after the freeze; only submission-critical or critical-defect
  fixes.
- Update the project board and the technical note when scope changes.
- Do not publish a release from an unverified commit.
