## What

<!-- One paragraph: what changes and why. -->

## Verification

<!-- Paste the result of each command you ran. Never tick a box you did not run. -->

| Check | Result |
| --- | --- |
| `pnpm lint` | |
| `pnpm typecheck` | |
| `pnpm test` | |
| `pnpm build` | |
| `pnpm package` | |
| `pnpm size:check` | |
| `pnpm audit --audit-level high` | |
| `uv run --project apps/server ruff check apps/server` | |
| `uv run --project apps/server ruff format --check apps/server` | |
| `uv run --project apps/server mypy apps/server/app --config-file apps/server/pyproject.toml` | |
| `uv run --project apps/server pytest` | |
| `pnpm e2e` (when the extension shell changes) | |
| `sh scripts/tests/test-githooks.sh` | |

## Risk and privacy

- Protected financial values remain byte-identical: <!-- yes / not applicable -->
- New network egress: <!-- no / describe -->
- New dependency or asset added to `THIRD_PARTY_NOTICES.md`: <!-- yes / no / not applicable -->
- Contract, schema or phrasebank change: <!-- yes / no -->

## Notes for the reviewer

<!-- Migrations, data changes, model calls, release impact, follow-up work. -->
