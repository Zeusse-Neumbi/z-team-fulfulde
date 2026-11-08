# Repository and release rules

Applies to `.github/**`, `scripts/**`, `package.json`, `Makefile`,
`opencode.json`, `.mcp.json`, `.ai/**` and `.opencode/**`.

## Branch and merge

- `main` is PR-only. Never commit, amend, merge or push to it directly.
- Branch names: `<type>/<short-slug>`.
- Conventional Commit messages and PR titles.
- Squash is the only merge method; `ci-required` must pass against the current
  base.
- Do not weaken, skip or delete a CI job to make a change pass.

## CI wall

`ci-required` aggregates `Web`, `API`, `E2E / Playwright`, `Workflows`,
`Security` and `Repository guard`. The `Repository guard` job also runs
`node scripts/check-ai-config.mjs`.

## Local hooks

```bash
pnpm hooks
```

The hooks block direct commits and pushes to `main`, staged `.env` files, model
weights, files over 5 MiB and non-Conventional commit messages. Do not use
`--no-verify`.

## Dependencies

- Dependabot checks npm, uv and GitHub Actions weekly.
- Major JS toolchain jumps are ignored until issue #47 is resolved.
- A blocked upgrade gets a **Blocked dependency upgrade** issue and an explicit
  Dependabot `ignore`; it does not stay as a permanently red PR.
- Update `THIRD_PARTY_NOTICES.md` and the lockfile with any dependency change.

## Project board

- The public board is https://github.com/users/Zeusse-Neumbi/projects/4.
- `scripts/project-plan.json` is the source of truth for issues, fields and
  views; `node scripts/bootstrap-github-project.mjs` creates what is missing.
- Do not delete project items or issues without explicit approval.
- Update the board when a gate, scope or priority changes.

## Release

- Freeze: 12 November 2026, 18:00.
- Internal submission: 13 November 2026, 18:00.
- Hard deadline: 14 November 2026, 23:59 Africa/Douala.
- The release workflow publishes the ZIP and `SHA256SUMS.txt` for a `v*` tag.

## AI workspace

- `opencode.json` is the OpenCode config; `.mcp.json` is the portable MCP
  catalog.
- Skills are pinned upstream copies in `.opencode/skills/<id>/SKILL.md`; their
  sources and licences are in `.opencode/skills/SOURCES.md`.
- Do not write or edit a skill in place. Prefer an upstream skill; put project
  constraints in `.ai/rules/`.
- Path-scoped rules live in `.ai/rules/`; update `index.md` when adding one.
- Run `pnpm ai:check` after any AI config change.
