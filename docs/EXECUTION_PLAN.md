# Preselection execution plan

Living checklist for the SAFINUM Innovate Challenge 2026 submission. Tick a
box only when the evidence exists. The public board stays
[`docs/PROJECT_BOARD.md`](PROJECT_BOARD.md); this file is the working order of
battle.

- **Internal submission:** Friday 13 November 2026, 18:00 Africa/Douala.
- **Freeze:** Thursday 12 November 2026, 18:00.
- **Hard deadline:** Saturday 14 November 2026, 23:59 Africa/Douala.
- **Working branch:** one `<type>/<slug>` branch per change set, landed through a
  pull request; `main` is PR-only and never committed to directly.
- **Team:** 3 people, Douala.
- **Form deliverables:** a French PDF of at most 5 pages and under 10 MB, the
  extension ZIP under 10 MB, a video link, and the public GitHub link.

## Status legend

| Mark | Meaning |
| --- | --- |
| `[ ]` | To do |
| `[~]` | In progress |
| `[x]` | Done, evidence linked |
| `[!]` | Blocked, reason written |
| `[-]` | Cut from this submission |

## Decisions locked

- [x] **D1 — Language access is the brief.** The form asks for a Cameroonian
  national language on an existing or simulated FR/EN financial interface,
  without modifying the source code, with simulated operations only.
- [x] **D2 — Adamawa Fulfulde (`fub`) is the language.** Translation memory,
  spoken phrase bank and local voice.
- [x] **D3 — Validation is by listening, not by writing.** A native speaker
  hears the synthesized Fulfulde, gives the French meaning, and rates
  intelligibility. The TTS is both the access layer and the validation
  interface. See [`docs/decisions/0013-oral-validation-by-listening.md`](decisions/0013-oral-validation-by-listening.md).
- [x] **D4 — The extension is the submission artefact.** The examiner unzips
  it, loads it unpacked in Chrome/Edge, opens the live page and sees the page
  translated. The voice is optional and needs the local API.
- [x] **D5 — The PDF is uploaded separately.** Five pages maximum, French,
  under 10 MB, no placeholders.
- [x] **D6 — No real data and no real transfer.** The demo uses fictional
  values only.

## Track A — Language and validation

### A1. Prepare the listening session

- [x] A1.1 Write the oral-validation decision record (ADR 0013).
- [x] A1.2 Update `docs/LINGUISTIC_VALIDATION.md` and the phrasebank rule for
  the oral method.
- [x] A1.3 Add `scripts/generate-listening-pack.mjs` to render the MT candidates
  to WAV and build the two-pass listening page.
- [x] A1.4 Start the local API with `ZTEAM_TTS_BACKEND=mms` and generate the
  full listening pack (80 TM + 35 phrases).
  Evidence: `eval/linguistic/session/index.html`, `manifest.json`.
- [ ] A1.5 Fill the 20 number entries in
  `packages/phrasebank/numbers/numbers.fub.json` with the speaker.
- [ ] A1.6 Record the speaker consent, dialect and session date in
  `docs/LINGUISTIC_VALIDATION.md`.

### A2. Run the session (Thursday 09:00, or today if available)

- [ ] A2.1 Correction pass: French source + Fulfulde audio; speaker says what
  is wrong and the correct spoken form.
- [ ] A2.2 Blind pass: Fulfulde audio only; speaker says the French meaning.
- [ ] A2.3 Fill `eval/linguistic/back-translation.csv` (`target_ff`,
  `back_translation_fr`, meaning, naturalness, critical error, fix).
- [ ] A2.4 Fill `eval/linguistic/tts-mos.csv` (intelligibility, naturalness,
  wrong words, notes).
- [ ] A2.5 Apply corrections to `tm.yaml` and `phrases.yaml`; set
  `validatedBy` and `backTranslationFr`.
- [ ] A2.6 `pnpm --filter @zteam/phrasebank build:release` passes.
- [ ] A2.7 `pnpm build` and `pnpm package` produce the validated extension.
- [ ] A2.8 Record the single-speaker, oral-review limitation in the note.

### A3. TTS report

- [~] A3.1 Complete `docs/TTS_REPORT.md` with the MMS baseline, latency,
  speaker ratings and the ship/do-not-ship decision.
- [x] A3.2 State clearly that no fine-tune was attempted and why.
- [x] A3.3 Record the CC-BY-NC-4.0 licence and the noncommercial restriction.

## Track B — Repository and Windows portability

### B1. Fix the blockers

- [x] B1.1 Raise `engines.node` to `>=22` (pnpm 11 requirement) and update the
  README.
- [x] B1.2 Replace the `HOST=... PORT=...` Playwright command with
  `webServer.env` so `pnpm e2e` runs on Windows.
- [x] B1.3 Add a cross-platform model downloader
  (`scripts/download-models.mjs`) with resume and SHA-256.
- [x] B1.4 Add `models/manifest.json` with sizes, checksums and licences.
- [x] B1.5 Add `scripts/doctor.mjs` (`pnpm doctor`) for OS, tools, GPU,
  models and port checks.
- [x] B1.6 Add `scripts/setup.mjs` (`pnpm bootstrap`) for a one-command setup.
- [x] B1.7 Add `INSTALL.md` inside the extension ZIP.

### B2. Documentation

- [x] B2.1 Write `docs/SETUP.md` (Windows first, macOS/Linux appendices).
- [x] B2.2 Write `docs/TRANSFER.md` (what to copy, what to re-download).
- [x] B2.3 Write `docs/ENV.md` (this machine and the Windows machine).
- [x] B2.4 Link the setup from the README and `docs/MODELS.md`.

### B3. Verify on this machine

- [x] B3.1 `pnpm doctor` prints the expected state.
- [x] B3.2 `pnpm models:verify` passes.
- [x] B3.3 `pnpm ci:local` passes.
- [x] B3.4 `pnpm e2e` passes after the Playwright fix.
- [x] B3.5 `pnpm build`, `pnpm package`, `pnpm size:check` pass.
- [x] B3.6 `pnpm demo -- --check`, `--deep`, `--stub` and the reuse path work.
- [x] B3.7 `--port auto` reuses or starts on 8000–8010; the panel discovers the
  range (ADR 0014, unit test).

### B4. Transfer to Windows 11

- [ ] B4.1 Run `pnpm doctor` on the Windows machine and send the GPU line.
- [ ] B4.2 If NVIDIA: CUDA 12.x + cuDNN 8 + `cu126` torch wheel; test
  `torch.cuda.is_available()`.
- [ ] B4.3 If AMD/Intel/unknown: CPU path; do not block on CUDA.
- [ ] B4.4 Run `pnpm ci:local`, `pnpm e2e`, `pnpm check:live`.
- [ ] B4.5 Capture `docs/ENV.md`, `/providers`, `eval/latency/*.csv`, and the
  clean-profile screenshots.

## Track C — Documentation and the 5-page note

- [x] C1.1 Create the French note skeleton (`docs/note/note.fr.html`,
  `docs/note/note.css`) with five sections.
- [x] C1.2 Add `scripts/build-note.mjs` (`pnpm note:build`) using Playwright
  Chromium; fail on placeholders and on a PDF over 10 MB.
- [~] C1.3 Fill page 1: problem, persona, form compliance table, sourced
  statistics.
- [~] C1.4 Fill page 2: architecture, privacy, no source modification.
- [~] C1.5 Fill page 3: translation layer, protected values, oral validation.
- [~] C1.6 Fill page 4: MMS voice, latency, speaker ratings, decision.
- [~] C1.7 Fill page 5: 14/14 security matrix, accessibility, limits,
  reproducibility, licence.
- [ ] C1.8 Remove every `[[...]]` placeholder; build the final PDF.
- [ ] C1.9 Proofread the French and check the 5-page limit.

## Track D — Submission package

- [x] D1.1 Write the submission checklist and the form fields in
  `docs/SUBMISSION.md`.
- [x] D1.2 Add `scripts/assemble-submission.mjs` (`pnpm submission`).
- [x] D1.10 Decide what the ZIP carries before the speaker session
  ([ADR 0016](decisions/0016-ship-labelled-mt-pack-and-audio.md)): the labelled
  MT draft pack, 115 bundled Opus clips, a permanent "MT — non validée" banner
  and a control-label collision guard. Evidence: `pnpm ci:local` green,
  `node scripts/check-draft.mjs` PASS (92 % coverage, 11 protected values
  unchanged, 2 held labels).
- [x] D1.11 Rewrite the note's validation sections as not-yet-executed and
  remove every placeholder; `pnpm note:build` produces 5 pages, 0.11 MB.
- [x] D1.12 Package the listening pack (`pnpm pack:listening`, 0.72 MB) and
  attach it to a draft release as the instrument for the speaker session.
- [ ] D1.3 Run the form dry-run: PDF and ZIP accepted, no field below
  `Extension`, team/lead details correct.
- [ ] D1.4 Build the final ZIP, install it in a clean Chrome profile, capture
  the screenshot.
- [ ] D1.5 Record the 3-minute video with French subtitles; upload unlisted.
- [ ] D1.6 Assemble `submission/` with the PDF, ZIP, `SHA256SUMS.txt`,
  form screenshot and confirmation email.
- [ ] D1.7 Verify every link in an incognito window.
- [ ] D1.8 Tag the submitted commit and publish the release.
- [ ] D1.9 Submit before Friday 18:00.

## Track E — Board and repository hygiene

- [x] E1.1 Record the done issues and their evidence.
- [ ] E1.2 Close the done issues and move the post-hackathon issues on the
  GitHub Project.
- [x] E1.3 Fix the remaining truth defects in `README.md`,
  `docs/E2E_REPORT.md` and `docs/REPO_AUDIT.md`.
- [x] E1.4 Run `pnpm ai:check`, `pnpm ci:local`, `bash scripts/check-repo-hygiene.sh`.
- [ ] E1.5 Open the pull request with the Conventional Commit title.

## Blocked — waiting on you

| Item | Why it blocks | What is needed |
| --- | --- | --- |
| Team names and lead contact | Form fields and `docs/TEAM.md` | 3 names, lead name, email, WhatsApp |
| Form file filter | ZIP must be accepted for the extension | Click **Add file**, check `.zip`, screenshot the fields below **Extension** |
| Video host | Form link must work in incognito | YouTube unlisted or Drive link |
| Speaker session | The validated pack and the final demo | Date/time; today or Thursday morning |
| Windows machine | GPU numbers and final measurements | `pnpm doctor` / `nvidia-smi` output |

## Cut from this submission

- `[-]` ASR closed-set classifier (#27, #28).
- `[-]` TTS fine-tune (#41).
- `[-]` Cross-page memory (#42), on-device TTS (#45), open ASR (#43).
- `[-]` EN parity and mock B (#44); the live page and the 30-page sweep are
  the genericity evidence.
- `[-]` TypeScript 7 / Vitest 5 migration (#47).

## Definition of done

- [ ] The release gate passes on the validated pack.
- [ ] The production ZIP translates the live page, and the panel shows it.
- [ ] Protected values are byte-identical; the 14/14 matrix is attached.
- [ ] The voice works through the local API and is evaluated by the speaker.
- [ ] The note is French, 5 pages, under 10 MB, with no placeholders.
- [ ] The video is under 3:00 with French subtitles and plays in incognito.
- [ ] The ZIP is under 10 MB and installs in a clean Chrome profile.
- [ ] The tag points at the submitted commit and the release is public.
- [ ] The form is submitted before Friday 18:00.
