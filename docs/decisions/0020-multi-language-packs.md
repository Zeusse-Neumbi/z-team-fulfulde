# 0020 — Make language packs data-driven

- **Status:** accepted
- **Date:** 2026-11-13
- **Note:** the multi-language plan named this ADR 0015, but 0015–0019 were
  already accepted on `main`. This is the next free number.

## Context

The phrasebank was single-language by construction:

```ts
target: z.object({ ff: z.string() });
validatedBy: z.array(z.string()); // whose validator? ambiguous with two languages
```

Adding a language needed schema, loader, build, server and panel changes. The
multi-language plan makes a language a registry row plus a pack directory. Track
A (`0017`/`0019`) is already merged; this record covers Track B.

## Decision

1. **The registry is data.** `languages/<code>.yaml` is the only registration.
   The loader validates every row, asserts unique codes, checks the pack and
   numbers paths, and requires the registry and `entries/` directories to stay
   in bijection.
2. **Validation is per (entry, language).** `target: Record<code,
   LanguageTarget>` carries `text`, `origin` (`human` | `mt` | `seed`),
   `validatedBy` and `backTranslationFr`. The old top-level fields are gone, so
   evidence can no longer be attributed to the wrong language.
3. **A draft is not a validated pack.** `build:release` refuses a language with
   `status: validated` and a missing validator/back-translation, and `scripts/
   package-extension.mjs` refuses empty targets for a validated language. A
   `draft` or `text-only` language may ship empty or machine targets, but every
   pack carries `packValidated: false` and the panel labels it as a draft.
4. **The measured default does not move.** Fulfulde remains on NLLB per `0019`.
   `cameroon-int8` stays opt-in; when `marian` is selected, the model directory
   is resolved per target language from the registry. No cloud provider, no API
   key, no network egress beyond `127.0.0.1`.
5. **Yemba ships as a labelled draft.** The human pack has the fub ids and empty
   targets (`origin: human`); the local Marian run produced a separate candidate
   pack (`origin: mt`, no validators). There is no native-speaker evidence, so
   `status: draft` and `packValidated: false`.
6. **The panel and the worker carry the language.** `targetLang` is persisted,
   sent with `START_TRANSLATION`/`RESCAN`, used in the TM lookup, the MT request
   body and its cache key. Switching language rebuilds the TM and clears the MT
   cache.

## Consequences

- `build:release` can pass with drafts. That is deliberate: the ZIP ships a
  labelled draft, not a false claim. The panel's draft badge, the
  `packValidated` flag and the packaging warning are the compensating controls.
  `pnpm check:evidence` is the stricter check and fails while any language is a
  draft, so the submission can cite the real gate.
- `pnpm package` refuses an empty Fulfulde demo pack even when its status is
  `draft`; Yemba's withheld units are allowed and labelled.
- `0016`'s blanket "refuse the MT candidate as release" is superseded for
  **draft** languages only. A language that claims `validated` still fails on
  the first missing validator.
- The tokenizer guard runs over the registry, so a new voice is measured against
  its own `letters` inventory instead of a single hardcoded fub string.
- Adding a language is `pnpm lang:add <code> --model <hf-repo> [--mt pair]`; the
  scaffolder creates data and a failing validation test, not code changes.
- The low-risk exemption in `releaseErrors()` is unchanged.

## Evidence

- `pnpm --filter @zteam/phrasebank test` — registry/pack isolation, unknown
  target rejection, release-gate scoping, codemod round-trip.
- `uv run --project apps/server pytest` — unknown target 422, per-language
  Marian/MMS resolution, typed `model_missing`, cache separation.
- `pnpm build` — emits both packs with `packValidated: false`.
- `pnpm check:tokenizer:warn` — one registry row per language.

## Reversal conditions

- Revert to the single-language gate if a draft pack is ever presented as
  validated, or if a validated language ships without recorded evidence.
- Revert the registry-driven model resolution if it overrides an explicit
  operator setting; `mt_marian_model` and `tts_model` stay explicit overrides.
- Drop a language from the registry if its pack cannot be kept in bijection with
  the directories; the loader fails instead of silently shipping an empty pack.
