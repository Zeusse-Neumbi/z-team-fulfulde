# 0008 — Panel action scope

- Date: 2026-11-08
- Status: Accepted

## Context

The challenge treats an altered amount, fee, total, beneficiary, reference or
security warning as a major defect. The page has two confirmation checkboxes and
a final confirmation button. A browser extension that clicks them for the user
would remove the user's deliberate confirmation and create a financial-safety
risk.

## Decision

1. **Guided mode is the only mode in v1.** The panel lists the page actions with
   their original accessible names and a risk label. `Montrer` scrolls the action
   into view and focuses it. It never clicks it.
2. **Confirmation checkboxes are locked.** The panel shows
   `À cocher par vous`; the extension never checks or unchecks them.
3. **The final confirmation is a page tap.** The panel can read back the exact
   amount, fee, total, beneficiary, phone, reference and operation, and then
   point the user to the page button. The extension does not submit.
4. **No `EXECUTE_ACTION` message exists.** The old scaffold message was removed
   so there is no dormant click path.
5. **Read-back is verbatim.** Values are read from the displayed page and shown
   without reformatting. The existing user checklist and the final confirmation
   checkbox remain user actions.
6. **Action names are captured before translation.** The accessible name used
   for risk classification and display is the original name, stored per element.
   A translated button can never turn a high-risk action into a low-risk one.
7. **Stale actions are rejected.** Every action list has a snapshot id; the
   highlight request must match it.

## Consequences

- The demo shows a user in control; the extension is an accessibility layer, not
  an autonomous agent.
- The voice flow, when added, may open the read-back and confirmation state but
  still requires a user tap on the page.
- Low-risk navigation is also guided in v1. Direct execution can be reconsidered
  only with an ADR, a confirmation gate and a new security review.
