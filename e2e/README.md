# End-to-end tests

These tests load the built extension into Chromium. Run them locally:

```bash
pnpm setup:e2e   # once per machine: install Chromium
pnpm build
pnpm e2e
```

The CI `E2E / Playwright` job runs the same flow on every pull request, and the
nightly workflow repeats it to catch regressions from dependency updates. A
failure opens a deduplicated GitHub issue.

The smoke test only proves that the extension loads and the side panel renders.
It does not replace the live-page regression ritual below.

## What to test manually each evening

1. Open `https://safinum.cm/hackathon-test`.
2. Enable the extension.
3. Walk the five steps in French, then in English.
4. Verify the value nodes are unchanged and the coverage is at least 90%.
5. Click Stop and verify the page returns to French.
6. Inject a novel message and verify it is translated or safely handled.
