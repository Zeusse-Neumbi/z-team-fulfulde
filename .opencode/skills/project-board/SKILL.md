---
name: Project Board
description: Keep the public GitHub Project, milestones, labels, issues and field values in sync with the repository plan.
---

# Project board

Use this skill when the task changes scope, priorities, gates, issues or the
plan. The live board is
https://github.com/users/Zeusse-Neumbi/projects/4.

## Read first

- `docs/PROJECT_BOARD.md`
- `scripts/project-plan.json`
- `.ai/rules/repo.md`

## Workflow

1. Update `scripts/project-plan.json` first. It is the source of truth for
   issues, milestones, labels, fields and views.
2. Run the idempotent bootstrap:

```bash
node scripts/bootstrap-github-project.mjs
```

3. Check the result:

```bash
gh project item-list 4 --owner Zeusse-Neumbi --limit 100 --format json
gh project field-list 4 --owner Zeusse-Neumbi --format json
```

4. Set the status, priority, area, phase, size, role, risk, target and blocker
   fields on new items. A blocked item must have a concrete `Blocker` text.
5. Keep issue titles in Conventional Commit style (`feat(...)`, `fix:`,
   `test:`, `docs:`, `chore:`).
6. Update the status update when a gate moves.

## Guardrails

- The project is public. Never add secrets, page values, personal data or private
  URLs.
- Do not delete issues, milestones or project items without explicit approval.
- Do not mark an item Done without evidence in the issue.
- GitHub's built-in workflows (item closed → Done, PR merged → Done, auto-add,
  auto-archive) are enabled in the UI; the API cannot create them. The steps are
  in `docs/PROJECT_BOARD.md`.
- Run `pnpm ai:check` after changing AI config or the plan.
