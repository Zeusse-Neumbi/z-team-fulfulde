# Documentation rules

Applies to `docs/**`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `LICENSE` and
`LICENSING.md`.

## Style

- Write for a jury member, a new contributor and an agent in that order.
- Keep the README short: description, status, quickstart, commands, privacy,
  contributing, licence.
- Put durable decisions in `docs/decisions/` with a date and a status.
- Put execution plans in `docs/PROJECT_BOARD.md`; keep `scripts/project-plan.json`
  in sync with the live GitHub Project.
- The technical note is French, 4–6 pages and PDF ≤8 MB.

## Truth rules

- Every external number is traceable to a source.
- Label unverified claims as unverified and name the test that will settle them.
- Do not claim native validation that has not happened.
- Do not claim a Fulfulde voice when the backend is the stub.
- Do not paste page values, credentials, personal data or local secrets.

## Licence

The repository is source-available under PolyForm Noncommercial 1.0.0. Do not
describe it as MIT or OSI open source. Commercial use needs a separate licence.

## Verification

```bash
pnpm ai:check
pnpm ci:local
bash scripts/check-repo-hygiene.sh
```
