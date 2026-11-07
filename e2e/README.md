# End-to-end tests

These tests load the built extension into Chromium. Run them locally:

```bash
pnpm build
pnpm e2e
```

They are intentionally not part of the default CI job: the live test page can change,
and extension tests need a bundled Chromium. The CI job covers unit, contract, build and
package size; e2e is the evening regression ritual.

## What to test manually each evening

1. Open `https://safinum.cm/hackathon-test`.
2. Enable the extension.
3. Walk the five steps in French, then in English.
4. Verify the value nodes are unchanged and the coverage is at least 90%.
5. Click Stop and verify the page returns to French.
6. Inject a novel message and verify it is translated or safely handled.
