---
date: 2026-11-08
status: Accepted
---

# ADR 0005: Use a noncommercial source-available licence

## Context

The repository was MIT-licensed. The owner wants the source to remain free to
read, use, modify and share for personal, educational, research and
public-interest work, while reserving commercial use for a separate agreement.

MIT would allow any commercial use, including resale, without a separate
agreement. A proprietary "all rights reserved" licence would block the
noncommercial collaboration the project wants.

## Decision

Use the **PolyForm Noncommercial License 1.0.0** for the repository.

- Noncommercial use, modification and distribution are permitted under the
  licence.
- Commercial use requires a separate written licence from the copyright holder.
- Contributions are accepted under the same licence unless explicitly stated
  otherwise.
- Third-party libraries, models, datasets and assets keep their own licences;
  `THIRD_PARTY_NOTICES.md` remains authoritative for them.
- `package.json` uses `SEE LICENSE IN LICENSE`; the Python package declares the
  same licence text.

The full text is in `LICENSE`; the commercial-use note is in `LICENSING.md`.

## Consequences

- The repository is **source-available**, not OSI open source. Documentation,
  badges and the submission form must not call it MIT or open source.
- A commercial user must contact the copyright holder before commercial use.
- The noncommercial restriction is compatible with the current dependency set
  and the CC-BY-NC speech assets, but every new dependency or asset must still
  be checked and added to `THIRD_PARTY_NOTICES.md`.
- If the project later needs an OSI licence, that is a new decision and must
  update `LICENSE`, `LICENSING.md`, the package metadata and this record.
