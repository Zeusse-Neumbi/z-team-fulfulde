# Team

- **Team:** Z-Team
- **City:** Douala, Cameroon
- **Size:** 3
- **Deadline timezone:** Africa/Douala (UTC+1)
- **Repository:** https://github.com/Zeusse-Neumbi/z-team-fulfulde

## Roles

The plan defines five roles; with three people, the roles are combined.

| Role | Owner | Backup | Scope |
| --- | --- | --- | --- |
| A — Extension | _to fill_ | _to fill_ | Content script, side panel, permissions, e2e |
| B — Backend | _to fill_ | _to fill_ | FastAPI, models, phrasebank API, latency |
| C — Speech | _to fill_ | _to fill_ | MMS voice, ASR stub, TTS report |
| D — Product QA | _to fill_ | _to fill_ | Demo, protected values, accessibility, release |
| E — Linguist / Docs | _to fill_ | _to fill_ | Fulfulde pack, validation, note, submission |

Suggested mapping for three people:

- **Person 1:** A + B (extension and backend).
- **Person 2:** C + D (speech and product QA).
- **Person 3:** E (language, documentation, submission) and form lead.

## Lead

| Item | Value |
| --- | --- |
| Name | _to fill_ |
| Email | _to fill_ |
| Phone/WhatsApp | _to fill_ (+237) |

The lead is the form's responsible person. Use a contact the jury can reach
during the submission window.

## Speaker

| Item | Value |
| --- | --- |
| Pseudonym | `SPK-01` |
| Language | Adamawa Fulfulde (`fub`) |
| Sub-variety | _to confirm: Ngaoundéré / Garoua / Maroua_ |
| Sessions | _to book: correction pass + blind pass_ |
| Consent | _to record: prototype, demo, validation; deletion on request_ |
| Method | Oral validation by listening (ADR 0013) |
| Backup speaker | _to name, or record the risk_ |

The speaker is an evaluator, not a recorded training voice. The oral method is
recorded in
[`docs/decisions/0013-oral-validation-by-listening.md`](decisions/0013-oral-validation-by-listening.md).

## Operating rules

- No real data, no real transfer, no real bank identifier in the demo.
- Protected values are byte-identical before and after translation.
- A machine translation is a draft, never a validator.
- The note states the single-speaker and oral-review limitation.
