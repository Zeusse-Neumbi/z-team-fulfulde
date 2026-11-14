# 0009 — French/English first, Fulfulde pack behind the release gate

- Date: 2026-11-08
- Status: Accepted
- **Amended by:** [0015](0015-runtime-local-mt-fallback.md) — production may
  now use a labelled local-API fallback for plain strings. The validated pack
  remains the only validated source, and the fixture rules are unchanged.

## Context

The browser mechanics can be built before the native-speaker translation pack
exists. The checked-in TM and phrase bank currently have empty Fulfulde targets;
filling them with guesses, machine translation or placeholder text would violate
the product and repository rules.

## Decision

1. **FR and EN are supported page sources now.** The TM looks up both source
   languages. The panel UI is French or English, switchable locally.
2. **Fulfulde remains the target.** The product does not become a FR↔EN
   translator. When the validated pack lands, the same runtime writes Fulfulde.
3. **Production with empty targets is honest.** The page stays in its source
   language; the panel says no pack is installed; the value pipeline still runs
   and reports protected/missed counts.
4. **The test fixture is separate.** `pnpm build:test` generates
   `packages/phrasebank/src/generated.fixture.ts` with `⟦FF:<id>⟧` targets and
   copies the source strings so every value stays byte-identical. The build goes
   to `apps/extension/.output-test/`, which is gitignored and never packaged.
5. **The release gate is unchanged.** `pnpm --filter @zteam/phrasebank
   build:release` fails for a `validated` language while a medium/high-risk entry lacks a target, validator
   or French back-translation. The fixture build does not weaken it.
6. **The fixture must never appear in a demo as Fulfulde.** It is a mechanics
   harness. The final video waits for the validated pack.

## Consequences

- The browser track is not blocked by the linguist, but the demo is.
- The panel and e2e can prove translation, idempotence, protection, read-back and
  restore with the fixture.
- The real site is checked in two modes: production (source preserved, warning
  shown) and fixture (mechanics, tokens visible).
