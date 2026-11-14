# Demo audio

Clips in this directory are bundled into the extension ZIP. This pack is
**Fulfulde (`fub`) only**; `manifest.json` carries `"language": "fub"` and the
panel refuses to use it for another target. They are generated
by `node scripts/build-audio-pack.mjs` from the listener pack in
`eval/linguistic/session` and committed together with `manifest.json`.

Rules:

- **Synthetic voice only.** Every clip comes from `facebook/mms-tts-ful`
  (VITS, CC-BY-NC-4.0) rendered by the local API. No human recording is
  committed; recordings of a speaker stay in `assets/audio/raw/` (gitignored)
  and are never redistributed.
- Opus, mono, 24 kHz, 32 kbps. The build script encodes with ffmpeg.
- Total size of this directory ≤ 4 MB (currently ~0.9 MB for 115 clips).
- File names are stable IDs: `<kind>-<id>.opus`, e.g. `phrase-BALANCE_IS.opus`.
- No real names, phone numbers, account numbers or references. The transcripts
  use the fictional demo values only.
- A clip is played **only** when the spoken sentence equals `manifest.json`'s
  `text` exactly, so a clip can never read a value that is not on screen.
- Clips with `"blocked": true` keep their transcript but are never played: the
  draft is a warning, an error, a colliding control, a source echo or a
  degenerate repetition. See `packages/phrasebank/entries/fub/audio.blocked.yaml`.
- Rebuild and verify with:

  ```bash
  node scripts/build-audio-pack.mjs
  node scripts/build-audio-pack.mjs --check
  ```
