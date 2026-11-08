# AI rules index

Before planning or editing, read [`AGENTS.md`](../../AGENTS.md), this index, and
every rule file whose globs cover the paths you will touch. When multiple rows
match, read all of them.

Task-specific workflows live in [`.opencode/skills`](../../.opencode/skills).
MCP servers and reusable commands live in [`opencode.json`](../../opencode.json).
The human overview is [`docs/AI_WORKFLOW.md`](../../docs/AI_WORKFLOW.md).

| Applies to | Rule file |
| --- | --- |
| `**` | [`project.md`](project.md) |
| `apps/extension/**`, `packages/translator/**`, `packages/shared/**` | [`frontend.md`](frontend.md) |
| `apps/server/**` | [`backend.md`](backend.md) |
| `packages/phrasebank/**`, `eval/linguistic/**` | [`phrasebank.md`](phrasebank.md) |
| `**/*.test.ts`, `apps/server/tests/**`, `e2e/**` | [`testing.md`](testing.md) |
| `docs/**`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `LICENSE`, `LICENSING.md` | [`docs.md`](docs.md) |
| `.github/**`, `scripts/**`, `package.json`, `Makefile`, `opencode.json`, `.mcp.json`, `.ai/**`, `.opencode/**` | [`repo.md`](repo.md) |
| `SECURITY.md`, `docs/PRIVACY.md`, `.gitleaks.toml`, `.githooks/**`, `apps/extension/lib/permissions.ts` | [`security.md`](security.md) |

## Precedence

1. The user's explicit instruction for the current task.
2. `AGENTS.md` and the non-negotiables in `project.md`.
3. The matching path-scoped rule file.
4. The matching skill in `.opencode/skills`.
5. The surrounding code and tests.

If two rules conflict, stop and record the conflict in `docs/decisions/` or ask
the user. Do not silently choose one.

## Adding a rule

1. Add the rule file under `.ai/rules/`.
2. Add its path globs to this index.
3. Mention it in `docs/AI_WORKFLOW.md` if the workflow changes.
4. Run `pnpm ai:check` and `pnpm ci:local`.
