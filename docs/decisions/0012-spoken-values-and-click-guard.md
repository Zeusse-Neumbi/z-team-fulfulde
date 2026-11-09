# 0012 — Spoken values and the page click guard

- Date: 2026-11-09
- Status: Accepted

## Context

Two gaps remained in the accessibility layer:

1. the spoken summary dropped every sentence containing a protected value, so
   the balance, fee and total — the reason the user opened the page — were never
   read aloud;
2. clicking a consequential page button did nothing special: the extension only
   announced an action when the user first pressed `Vérifier` in the panel.

The privacy rule says page values never leave the device. The TTS backend is
local (`127.0.0.1`) and the values are already processed in memory by the
content script. Refusing to speak them protects nothing on the loopback path,
but it makes the assistant useless for the main task.

## Decision

### Spoken values

1. **Opt-in, local only.** `PanelSettings.speakValues` defaults to `false`. The
   panel enables it only when `/health` reports `tts.local === true`. A cloud
   voice can never receive a page value: the panel forces the option off.
2. **Amounts and fees only.** The plan adds up to three `amount` / `fee` values
   as dedicated items. Account numbers, phones, references, names and user input
   are still excluded, even with the option on.
3. **Exact bytes.** The value is copied from the protected-value view without
   normalization, so the audio request contains the same NBSP and digits as the
   page. A Playwright test compares the `/tts` body with the value shown in the
   panel.
4. **No storage, no log.** The value goes to `/tts` in the request body; the API
   does not log bodies or persist audio beyond the in-memory cache. The cache is
   keyed by the full text and cleared on reload.

### Page click guard

1. A capture-phase `click` listener pauses **high-risk** actions only
   (confirm/send/pay/validate/delete/checkbox semantics). Navigation and form
   fields keep their native behaviour.
2. The paused click is reported in `TranslationStatus.pendingPageAction`; the
   panel announces the button's accessible name and asks for confirmation.
3. `Confirmer` arms that action for a 20-second window; the user clicks the page
   button again. The extension never dispatches a click, never checks a box and
   never submits. After a validation error the same action can be retried inside
   the window without a second announcement.
4. `Annuler` clears the guard; the page action never runs.

## Consequences

- The summary can now read `Montant 175 000 FCFA` when the user opts in, through
  the local MMS voice.
- A cloud TTS provider remains a measurement tool; it cannot speak values.
- The click guard changes page behaviour for high-risk buttons while the
  extension is active. It is a deliberate confirmation step, not an auto-click,
  and it is covered by `e2e/click-guard.spec.ts`.
- The privacy statement now distinguishes "no value leaves the device" from "a
  value is sent to the loopback speech service".
