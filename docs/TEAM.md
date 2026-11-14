# Team

- **Team:** Z-Team
- **City:** Douala, Cameroon
- **Size:** 3
- **Deadline timezone:** Africa/Douala (UTC+1)
- **Repository:** https://github.com/Zeusse-Neumbi/z-team-fulfulde

## Roles

The plan defines five roles; with three people, the roles are combined. The
team names, lead name, email and phone are **form fields only** and are not
published in this repository.

| Role | Scope |
| --- | --- |
| A — Extension | Content script, side panel, permissions, e2e |
| B — Backend | FastAPI, models, phrasebank API, latency |
| C — Speech | MMS voices, ASR stub, TTS report |
| D — Product QA | Demo, protected values, accessibility, release |
| E — Linguist / Docs | Fulfulde and Yemba packs, validation, note, submission |

Suggested mapping for three people:

- **Person 1:** A + B (extension and backend).
- **Person 2:** C + D (speech and product QA).
- **Person 3:** E (language, documentation, submission) and form lead.

## Speaker

No native-speaker session has run. Fulfulde and Yemba require separate
speakers; neither is booked. Do not record a pseudonym, dialect or consent as
evidence until the session happens.

| Item | Value |
| --- | --- |
| Pseudonym | not assigned |
| Languages | Fulfulde `fub` and Yemba `ybb`, separate sessions |
| Sessions | not booked |
| Consent | not recorded |
| Method | Oral validation by listening (ADR 0013) |

The speaker is an evaluator, not a recorded training voice. The oral method is
recorded in
[`docs/decisions/0013-oral-validation-by-listening.md`](decisions/0013-oral-validation-by-listening.md).

## Operating rules

- No real data, no real transfer, no real bank identifier in the demo.
- Protected values are byte-identical before and after translation.
- A machine translation is a draft, never a validator.
- A language pack is validated per language, with its own speaker and evidence.
- The note states the single-speaker and oral-review limitation if a session runs.
