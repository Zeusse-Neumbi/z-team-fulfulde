# Submission

## Form fields

The form is the SAFINUM Innovate Challenge — Soumission des prototypes. It asks
for the team, the lead, the presentation link, the documentation and the
extension. The documentation and the extension are uploaded separately.

| Field | Value | Limit |
|---|---|---|
| Nom du prototype | Z-Team Fulfulde Assistant | — |
| Nom de l'équipe | Z-Team | — |
| Ville de l'équipe | Douala | — |
| Nombre de membres | 3 | 3–5 |
| Nom des membres | _to fill_ | — |
| Nom et prénom du responsable | _to fill_ | — |
| Adresse e-mail du responsable | _to fill_ | — |
| Téléphone/WhatsApp du responsable | _to fill_ (+237) | — |
| Lien de la vidéo de présentation | _to upload_ | ≤ 3:00 |
| Documentation | `dist/Z-Team_Fulfulde_Assistant_Technical_Note_v1.0.pdf` | **≤ 5 pages, ≤ 10 MB** |
| Lien du dépôt GitHub | https://github.com/Zeusse-Neumbi/z-team-fulfulde | public |
| Extension | `dist/zteam-fulfulde-extension-v0.1.0.zip` | ≤ 10 MB |
| Licence | PolyForm Noncommercial 1.0.0 (source-available; commercial use requires a separate licence) | — |

The brief, from the form itself: enable a user to access the information and
features of a digital financial service **in a Cameroonian national language**,
from an **existing or simulated FR/EN interface**, **without modifying the
source code**, with **simulated operations only** and no real bank data.

## Deliverables

```
submission/
├── Z-Team_Fulfulde_Assistant_Technical_Note_v1.0.pdf
├── zteam-fulfulde-extension-v0.1.0.zip
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

The validated page translation is bundled and works without the local API.
Without the API, uncovered strings stay in the source language. The optional
local API adds the labelled NLLB machine-translation fallback and the voice; see
[`SETUP.md`](SETUP.md). The ZIP contains `INSTALL.md` with the same steps.

## Before submitting

- [ ] `pnpm ci:local` passes.
- [ ] `pnpm audit --audit-level high` reports no high or critical vulnerabilities.
- [ ] `pnpm e2e` passes against the built extension.
- [ ] `sh scripts/tests/test-githooks.sh` and `bash scripts/check-repo-hygiene.sh` pass
      (Git Bash or WSL on Windows).
- [ ] `pnpm verify:node` passes (Windows-friendly) or `pnpm verify` on Unix.
- [ ] The extension installs from the ZIP in a clean Chrome profile.
- [ ] The validated Fulfulde pack is installed and
      `pnpm --filter @zteam/phrasebank build:release` passes.
- [ ] The full journey works on the live test page in French; the EN path is
      covered by e2e.
- [ ] The fixture journey and live check pass (`pnpm build:test`, `pnpm e2e`,
      `pnpm check:live`).
- [ ] Protected values are unchanged; coverage is at least 90% of translatable
      text.
- [ ] If the local API fallback is enabled for the demo, the panel shows
      **MT — non validée** and the output is not presented as validated Fulfulde.
- [ ] The production ZIP contains no `⟦FF:` or `FF:tm` fixture token.
- [ ] Stop restores the page.
- [ ] The novel-content path works without a reload.
- [ ] The technical note is French, **5 pages maximum**, **10 MB maximum**, no
      `[[...]]` placeholders.
- [ ] The video is ≤ 3:00 with French subtitles and plays in an incognito window.
- [ ] The repository is public and the README renders without login.
- [ ] The licence is stated as PolyForm Noncommercial 1.0.0, not MIT or OSI open source.
- [ ] No secrets, no real data, no models, no large binaries in git.
- [ ] Form dry-run done: the documentation accepts the PDF and the extension
      accepts the ZIP; no required field is hidden below **Extension**.
- [ ] Form screenshot and confirmation email are stored.

## Deadline

Saturday 14 November 2026, 23:59 Africa/Douala (UTC+1), per the organiser email.
Internal target: Friday 13 November 2026, 18:00.
