# Repository audit

A minimal, executable checklist. The goal is a repository a jury member can read in five
minutes and a new contributor can run from a clean clone.

- [x] 1. `README.md` — description, status, quickstart, repo map, privacy, docs, licence.
- [x] 2. `LICENSE` — MIT for this repository.
- [x] 3. `THIRD_PARTY_NOTICES.md` — dependencies, models, datasets and obligations.
- [x] 4. `SECURITY.md` — reporting and scope.
- [x] 5. `docs/ARCHITECTURE.md`.
- [x] 6. `docs/PRIVACY.md`.
- [x] 7. `docs/LINGUISTIC_VALIDATION.md`.
- [x] 8. `docs/TTS_REPORT.md` (template; not yet run).
- [x] 9. `docs/DEMO.md`.
- [x] 10. `.gitignore` excludes dependencies, builds, data, models, recordings and archives.
- [x] 11. CI: oxlint, typecheck, unit, build, package, size, API tests, secret scan.
- [ ] 12. Public repository, README renders in incognito, tag `v0.1.0-preselection`, checksums.

## Release checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package
pnpm size:check
uv run --project apps/server ruff check apps/server
uv run --project apps/server pytest
```

## Not present by design

ADRs, `CODE_OF_CONDUCT.md`, `CITATION.cff`, `CODEOWNERS`, issue templates, PR templates,
multiple CI workflows, model weights, datasets, the full audio bank and build artifacts.
The project is a six-day hackathon build; the repository should stay reviewable.
