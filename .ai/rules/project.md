# Project rule

## What this is

Z-Team Fulfulde Assistant is a local-first Chrome MV3 extension plus a loopback
FastAPI service. It translates the visible interface of a financial web page
into a selected Cameroonian language pack in place, speaks it when a voice is
available, and never changes a financial value. Fulfulde (`fub`) is the
demonstrated language; Yemba (`ybb`) is the second draft.

## Non-negotiables

1. **Protected values are byte-identical** before and after translation.
   Amounts, fees, totals, balances, names, phones, accounts, references, dates
   and user input are protected. A mismatch reverts the node and aborts the plan.
2. **In-page translation is the primary output.** Audio is the accessibility
   layer on top, not a replacement for the translated page.
3. **No network egress** except `127.0.0.1`. No cloud LLM, no API key, no
   telemetry, no remote config.
4. **No auto-submit** and no bypassed confirmation. The user taps to confirm.
5. **Translations come from the selected pack**, never an invented target.
   Each language is validated separately; medium/high-risk entries need a
   validator and a French back-translation. A draft is always labelled.
6. **Native-speaker validation is evidence**, not a claim. No session has run
   for Fulfulde or Yemba.

## Licence

The repository is source-available under PolyForm Noncommercial 1.0.0. Do not
remove the licence, relicense the work, or add a dependency whose licence is
incompatible with noncommercial distribution. Commercial use needs a separate
written licence. See `LICENSE`, `LICENSING.md` and `THIRD_PARTY_NOTICES.md`.

## Where to look

- `AGENTS.md` — agent contract and hard rules.
- `CONTRIBUTING.md` — branches, commits, merge policy and verification.
- `docs/PROJECT_BOARD.md` — D1–D7 plan, board views and operating cadence.
- `docs/decisions/` — dated decisions.
- `docs/REPO_AUDIT.md` — repository and CI checklist.

## Commands

```bash
pnpm ai:check
pnpm ci:local
pnpm audit --audit-level high
pnpm e2e
node scripts/bootstrap-github-project.mjs
```

## Done when

- The change has a test or evidence that proves the behaviour.
- `pnpm ci:local` passes.
- Protected values are unchanged.
- Docs, decisions and the project board are updated when the change affects
  scope, contracts or release.
