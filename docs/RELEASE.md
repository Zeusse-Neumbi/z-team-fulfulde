# Release

The release is a **preselection pre-release**, not a validated language release.
It ships labelled machine-translation drafts and must not be described as
native-speaker validated.

## Versioning

| Thing | Source | Current |
| --- | --- | --- |
| App and extension | root `package.json` | `0.2.1` |
| Technical note | `scripts/version.mjs` `NOTE_VERSION` | `1.1` |
| Tag | `v<app>-preselection` | `v0.2.1-preselection` |

Everything that names an artifact reads the same source: `package-extension.mjs`,
`size-check.mjs`, `demo.mjs`, `doctor.mjs`, `setup.mjs`, `assemble-submission.mjs`,
`pack-listening.mjs` and the side-panel footer.

## Assets

A public pre-release should carry:

| Asset | Built by | Form upload |
| --- | --- | --- |
| `zteam-fulfulde-extension-v0.2.1.zip` | `pnpm build:submission && pnpm package` | yes |
| `Z-Team_Fulfulde_Assistant_Technical_Note_v1.1.pdf` | `pnpm note:build` | yes |
| `zteam-listening-pack-v0.2.1.zip` | `pnpm pack:listening` (needs the local WAV session) | no |
| `SHA256SUMS.txt` | `pnpm submission` | no |

The listening pack is built from gitignored WAVs, so CI cannot regenerate it.
Build it locally and upload it to the release manually. The extension ZIP and
the note are reproducible from the tag.

## Publish

```bash
pnpm ci:local
pnpm e2e
pnpm note:build
pnpm build:submission
pnpm package
pnpm submission
sha256sum -c submission/SHA256SUMS.txt

git switch main
git pull --ff-only
git tag -a v0.2.1-preselection -m "Z-Team Fulfulde Assistant — preselection 0.2.1"
git push origin v0.2.1-preselection
```

The tag workflow runs the checks, builds the ZIP and the note, writes the
checksums and creates the GitHub pre-release. The listening pack is uploaded
afterwards with:

```bash
gh release upload v0.2.1-preselection dist/zteam-listening-pack-v0.2.1.zip --clobber
```

## What the release notes must say

- Two language packs, both **drafts**; no native-speaker session has run.
- Fulfulde 115/115 and 82 bundled clips; Yemba 103/115 with 12 withheld and an
  API-only voice.
- `pnpm check:evidence` fails by design; `packValidated: false` everywhere.
- The ZIP installs unpacked in Chrome/Edge and needs no model.
- The technical note is French, 5 pages, and separated from the ZIP.

Do not claim a validated pack, a MOS, or a Yemba clip pack.
