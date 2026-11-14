# Z-Team Fulfulde Assistant — preselection 0.2.0

Two Cameroonian language packs, one local-first engine. This is a **labelled
machine-translation draft release**, not a native-speaker-validated release.

## What is in the ZIP

- **Fulfulde (`fub`)** — NLLB-200 int8 draft, 115/115 units, 82 playable MMS
  clips (33 withheld because a spoken warning, error or ambiguous control cannot
  be re-read).
- **Yemba (`ybb`)** — cameroon-int8 Marian draft, 103/115 units. Twelve units are
  withheld because the draft lost a protected placeholder or was marked unsafe;
  they stay in French and are counted as missed. The Yemba voice is **API-only**
  and no Yemba clips are bundled.
- The extension installs unpacked in Chrome or Edge and needs no model. The page
  is translated in place; amounts, fees, totals, balances, names, phones,
  accounts, references and user input remain byte-identical.

## What is not claimed

- No native-speaker session has run for Fulfulde or Yemba.
- No pack is `validated`; `packValidated` is false and the panel says
  **MT — non validée**.
- `pnpm check:evidence` fails by design while either pack is a draft.
  `build:release` only enforces evidence for a language that claims
  `status: validated` (ADR 0020).
- A Fulfulde clip is never played under a Yemba label. Without the local API,
  Yemba Play is disabled and the panel explains why.

## Assets

- `zteam-fulfulde-extension-v0.2.0.zip` — load unpacked; install steps in
  `INSTALL.md`.
- `Z-Team_Fulfulde_Assistant_Technical_Note_v1.1.pdf` — French, 5 pages.
- `zteam-listening-pack-v0.2.0.zip` — the Fulfulde oral-validation instrument,
  when uploaded locally.
- `SHA256SUMS.txt` — checksums for the form files.

## Documentation

- <https://github.com/Zeusse-Neumbi/z-team-fulfulde/blob/main/docs/LANGUAGES.md>
- <https://github.com/Zeusse-Neumbi/z-team-fulfulde/blob/main/docs/LINGUISTIC_VALIDATION.md>
- <https://github.com/Zeusse-Neumbi/z-team-fulfulde/blob/main/docs/PRIVACY.md>

Licence: PolyForm Noncommercial 1.0.0. Commercial use requires a separate
written licence.
