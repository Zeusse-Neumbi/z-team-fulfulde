# Release

The release is a **preselection pre-release**, not a validated language release.
It ships labelled machine-translation drafts and must not be described as
native-speaker validated.

## Versioning

| Thing | Source | Current |
| --- | --- | --- |
| App and extension | root `package.json` | `0.3.0` |
| Technical note | `scripts/version.mjs` `NOTE_VERSION` | `1.1` |
| Tag | `v<app>-preselection` | `v0.3.0-preselection` |

Everything that names an artifact reads the same source: `package-extension.mjs`,
`size-check.mjs`, `demo.mjs`, `doctor.mjs`, `setup.mjs`, `assemble-submission.mjs`,
`pack-listening.mjs` and the side-panel footer.

## Assets

A public pre-release should carry:

| Asset | Built by | Form upload |
| --- | --- | --- |
| `zteam-lingua-extension-v0.3.0.zip` | `pnpm build:submission && pnpm package` | yes |
| `Z-Team_Lingua_Technical_Note_v2.0_FR.pdf` | `pnpm note:build` | yes |
| `Z-Team_Lingua_Technical_Note_v2.0_EN.pdf` | `pnpm note:build:en` | companion |
| `zteam-lingua-listening-pack-v0.3.0.zip` | `pnpm pack:listening` (needs the local WAV session) | no |
| `SHA256SUMS.txt` | `pnpm submission` | no |

The listening pack is built from gitignored WAVs, so CI cannot regenerate it.
Build it locally and upload it to the release manually. The extension ZIP and
the note are reproducible from the tag.

## Publish

```bash
pnpm ci:local
pnpm e2e
pnpm note:build
pnpm note:build:en
pnpm build:submission
pnpm package
pnpm submission
sha256sum -c submission/SHA256SUMS.txt

git switch main
git pull --ff-only
git tag -a v0.3.0-preselection -m "Z-Team Lingua — preselection 0.3.0"
git push origin v0.3.0-preselection
```

The tag workflow runs the checks, builds the ZIP and both notes, writes the
checksums and creates the GitHub pre-release. The listening pack is uploaded
afterwards with:

```bash
gh release upload v0.3.0-preselection dist/zteam-lingua-listening-pack-v0.3.0.zip --clobber
```

## What the release notes must say

- Two language packs, both **drafts**; no native-speaker session has run.
- Fulfulde 115/115 and 82 bundled clips; Yemba 103/115 with 12 withheld and an
  API-only voice.
- `pnpm check:evidence` fails by design; `packValidated: false` everywhere.
- The ZIP installs unpacked in Chrome/Edge and needs no model.
- The technical notes are French and English, 5 pages each, and separated from the ZIP.

Do not claim a validated pack, a MOS, or a Yemba clip pack.
