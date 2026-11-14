# Submission

## Form fields

The form is the SAFINUM Innovate Challenge — Soumission des prototypes. It asks
for the team, the lead, the presentation link, the documentation and the
extension. The documentation and the extension are uploaded separately.

| Field | Value | Limit |
|---|---|---|
| Nom du prototype | Z-Team Lingua | — |
| Nom de l'équipe | Z-Team | — |
| Ville de l'équipe | Douala | — |
| Nombre de membres | 3 | 3–5 |
| Nom des membres | private form field; not stored in the repository | — |
| Nom et prénom du responsable | private form field; not stored in the repository | — |
| Adresse e-mail du responsable | private form field; not stored in the repository | — |
| Téléphone/WhatsApp du responsable | private form field; not stored in the repository | — |
| Lien de la vidéo de présentation | to record and upload | ≤ 3:00 |
| Documentation | `dist/Z-Team_Lingua_Technical_Note_v2.0_FR.pdf` (FR form upload); `_EN.pdf` companion | **≤ 5 pages, ≤ 10 MB** |
| Lien du dépôt GitHub | https://github.com/Zeusse-Neumbi/z-team-lingua | public |
| Release | https://github.com/Zeusse-Neumbi/z-team-lingua/releases/tag/v0.3.0-preselection | public pre-release |
| Extension | `dist/zteam-lingua-extension-v0.3.0.zip` | ≤ 10 MB |
| Licence | PolyForm Noncommercial 1.0.0 (source-available; commercial use requires a separate licence) | — |

The brief, from the form itself: enable a user to access the information and
features of a digital financial service **in a Cameroonian national language**,
from an **existing or simulated FR/EN interface**, **without modifying the
source code**, with **simulated operations only** and no real bank data.

## Deliverables

```
submission/
├── Z-Team_Lingua_Technical_Note_v2.0_FR.pdf
├── Z-Team_Lingua_Technical_Note_v2.0_EN.pdf
├── zteam-lingua-extension-v0.3.0.zip
├── video-link.txt
├── github-link.txt
├── SHA256SUMS.txt
├── screenshot-form.png
└── confirmation-email.pdf
```

`pnpm submission` assembles the PDF, the ZIP, `SHA256SUMS.txt` and a local
`README.md`. The Google Form upload is still manual.

## Extension install (for the examiner)

1. Unzip the ZIP into a folder.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.
5. Open https://safinum.cm/hackathon-test
6. Click the extension icon, then **Activer sur ce site**.

The ZIP carries the **labelled MT draft packs**: NLLB-200 for Fulfulde
(115/115 units) and cameroon-int8 Marian for Yemba (103/115; 12 units withheld
because the draft lost a protected value). It also carries 82 playable Fulfulde
Opus clips. The panel shows **Fulfulde** or **Yemba** with **MT — non validée**
at all times; no native-speaker session has been run yet, and the note says so.
The Yemba voice is **API-only** and no Yemba clips are bundled: without the
local API, Play is disabled and the panel says why. A Fulfulde clip is never
played under a Yemba label. For Fulfulde, two action labels whose draft would
read the same stay in French on purpose. Without the API, Yemba strings outside
the pack stay in the source language. The optional local API adds the live
translation fallback and live speech for sentences without a clip; see
[`SETUP.md`](SETUP.md). The ZIP contains `INSTALL.md` and `LICENSE` with the
same steps and the licence.

## Before submitting

- [ ] `pnpm ci:local` passes.
- [ ] `pnpm audit --audit-level high` reports no high or critical vulnerabilities.
- [ ] `pnpm e2e` passes against the built extension.
- [ ] `sh scripts/tests/test-githooks.sh` and `bash scripts/check-repo-hygiene.sh` pass
      (Git Bash or WSL on Windows).
- [ ] `pnpm verify:node` passes (Windows-friendly) or `pnpm verify` on Unix.
- [ ] The extension installs from the ZIP in a clean Chrome profile.
- [ ] `pnpm build:submission` was the last build, so the ZIP carries both draft
      packs. `pnpm package` refuses an empty Fulfulde demo pack; Yemba's 12
      withheld units are labelled and counted.
- [ ] `node scripts/build-audio-pack.mjs --check` passes.
- [ ] `node scripts/check-draft.mjs` passes against the local demo page.
- [ ] The note states that no native-speaker session has run.
- [ ] `pnpm check:evidence` fails with both packs still `draft`; this is expected and recorded.
- [ ] The full journey works on the live test page in French; the EN path is
      covered by e2e.
- [ ] Switching to Yemba translates the demo page; Play is disabled without the
      API and no Fulfulde clip is heard under the Yemba label.
- [ ] The fixture journey and live check pass (`pnpm build:test`, `pnpm e2e`,
      `pnpm check:live`).
- [ ] Protected values are unchanged; coverage is at least 90% of translatable
      text.
- [ ] If the local API fallback is enabled for the demo, the panel shows
      **MT — non validée** and the output is not presented as validated.
- [ ] The production ZIP contains no `⟦<code>:` fixture token.
- [ ] Stop restores the page.
- [ ] The novel-content path works without a reload.
- [ ] Both technical notes are **5 pages maximum**, **10 MB maximum**, no
      `[[...]]` placeholders; the French one is the form upload.
- [ ] The video is ≤ 3:00 with French subtitles and plays in an incognito window.
- [ ] The repository is public and the README renders without login.
- [ ] The licence is stated as PolyForm Noncommercial 1.0.0, not MIT or OSI open source.
- [ ] No secrets, no real data, no models, no large binaries in git.
- [ ] Form dry-run done: the documentation accepts the PDF and the extension
      accepts the ZIP; no required field is hidden below **Extension**.
- [ ] Form screenshot and confirmation email are stored.

## Deadline

Saturday 14 November 2026, 23:59 Africa/Douala (UTC+1), per the organiser email.

Status on 14 November 2026: the draft repository, ZIP, PDF, checksums and
public pre-release are ready. The video is **not recorded**; the native-speaker sessions have **not**
run. Those are open items, not claims.
