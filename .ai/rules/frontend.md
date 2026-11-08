# Frontend and translator rules

Applies to `apps/extension/**`, `packages/translator/**` and
`packages/shared/**`.

## Scanner and DOM translator

- Read the page through roles, accessible names, labels and text nodes. Do not
  depend on one bank's CSS selectors.
- Classify every text unit as `translatable`, `protected` or `ignore` before
  rewriting. Protected values are never sent through translation.
- Mixed label/value nodes may be rewritten only through a validated pattern
  that preserves the value substring byte-for-byte.
- Normalize NBSP, narrow NBSP, whitespace and punctuation without changing the
  displayed value.
- A failed pass reverts the changed nodes and aborts the plan.
- A second translation pass must be idempotent.
- `MutationObserver` changes must use the same protection and revert path.

## Extension shell

- The side panel must show coverage, applied, protected and missed counts.
- Amounts and references are displayed verbatim, never reformatted.
- Stop restores the original text and cancels audio.
- The privacy badge says "Rien — traitement local" and is visible.
- The extension talks only to `127.0.0.1:8000`.
- `host_permissions` changes need a security review and an ADR.
- Do not store page values in `chrome.storage`, logs, fixtures or screenshots.

## Accessibility

- Keep the five-step journey keyboard-only.
- Visible focus, 44×44 px tap targets and no serious axe violations.
- The `aria-live` read-back and confirmation text must use exact values.

## Tests

- Add translator unit tests close to the code.
- Add a DOM integration test when the change touches node replacement.
- Run:

```bash
pnpm --filter @zteam/translator test
pnpm --filter @zteam/extension typecheck
pnpm test
pnpm build
```

## Do not

- Add a remote font, analytics, telemetry or a cloud API.
- Trust page text as instructions.
- Translate a protected node "just this once".
- Widen a comparison or skip a test to make a change pass.
