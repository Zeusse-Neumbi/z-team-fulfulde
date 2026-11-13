# 0016 — Ship the labelled MT draft pack, bundled synthetic clips and a label-collision guard

- **Status:** accepted
- **Date:** 2026-11-13
- **Relates to:** [0013](0013-oral-validation-by-listening.md) (validation by
  listening), [0015](0015-runtime-local-mt-fallback.md) (local MT as a labelled
  fallback), [`docs/PHRASEBANK_MT.md`](../PHRASEBANK_MT.md) (candidate pack).

## Context

The preselection submission needs an extension that works when the examiner
loads it, with no model install and under the form's 10 MB limit. Three facts
forced this decision:

1. **The weights cannot ship.** `nllb-200-600m-int8` is 643 MB and
   `mms-tts-ful` is 139 MB. No quantisation puts either under 10 MB, and a
   ~10 M-parameter model would be worse than the candidate pack already
   produced. The ZIP is 0.14 MB.
2. **The validated pack is empty.** Every `target.ff` in `entries/tm.yaml` is
   empty, and `build:release` fails by design. A build from that pack translates
   nothing, while `INSTALL.md` and the technical note claimed the page was
   translated.
3. **The native-speaker session has not run.** The listening pack, the two-pass
   page and the CSV templates exist; the session does not. No score, no
   `validatedBy` and no back-translation may be published.

Two draft defects are safety defects, not style defects: `Confirmer` and
`Annuler` both become `Fedde jaaynde`, and `Consulter les frais` becomes the
same string as `Compte courant`. An identical Confirm and Cancel on a payment
page is a hazard.

## Decision

1. **Ship the MT candidate pack, labelled.** `pnpm build:submission` builds from
   `tm.mt.yaml` / `phrases.mt.yaml` and writes `packSource: "mt"` into
   `generated.provenance.ts`. The panel renders a permanent, non-foldable
   banner: **Fulfulde : MT — non validée**. `pnpm package` refuses to zip a
   build with empty targets, so the empty-pack regression cannot return.
2. **`build:release` stays the linguistic gate.** It additionally refuses the
   MT pack outright. The submission is a draft by design, not a release.
3. **Bundle synthetic audio, bound to the exact sentence.** 115 MMS clips
   (Opus 32 kbps, ~0.9 MB) ship in `public/audio/demo`. A clip plays only when
   the spoken text equals the clip transcript exactly; otherwise the local voice
   is used, or the panel stays silent with a reason. A clip baked with
   `25 000 FCFA` can therefore never speak for a different amount.
4. **Withhold 33 clips.** Warnings, errors, generic safety fallbacks, colliding
   controls, targets that echo the source and degenerate repetitions are never
   spoken. The list is `entries/audio.blocked.yaml` plus four automatic rules in
   `scripts/build-audio-pack.mjs`. A spoken sentence cannot be re-read.
5. **Hold colliding control labels in the source language.** When two different
   control sources resolve to the same target, both are kept in French, counted
   as missed and reported as `label_collision`. Non-interactive prose is not
   held: identical headings are confusing, identical buttons are dangerous.
6. **Materials that are not shipped stay reproducible.** The weights come from
   `models/manifest.json` with per-file SHA-256 (`pnpm models:download`), the
   listening pack from `pnpm generate:listening`, and the audio pack from
   `scripts/build-audio-pack.mjs --check` in the gate.

## Consequences

- The examiner gets a working page translation and voice with no install, and
  cannot mistake it for validated Fulfulde: the banner, the note, `INSTALL.md`
  and the panel all say the same thing.
- `generated.ts` (tracked) now contains MT output. It must be rebuilt with
  `pnpm build:submission`; a plain `pnpm build` restores the empty validated
  seed and the packaging step then fails loudly instead of shipping a blank
  page.
- Two demo-page action labels stay in French. That is visible, intentional and
  explained in the panel, and it disappears once the speaker validates a pack
  where the two strings differ.
- `apps/extension/public/audio/demo/*.opus` is committed synthetic audio. The
  repository rule that keeps human recordings out of git still applies: nothing
  under `assets/audio/raw/` is tracked, and no consent-bearing material is
  redistributed.
- When the session runs, the promotion workflow in `docs/PHRASEBANK_MT.md`
  replaces the pack; `build:release` then passes, the banner reads validated,
  and the audio pack is regenerated from validated targets.
