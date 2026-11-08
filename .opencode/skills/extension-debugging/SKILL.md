---
name: Extension Debugging
description: Debug the WXT extension, content script, side panel or Playwright smoke test without sending page data off the device.
---

# Extension debugging

Use this skill for `apps/extension`, the built `.output/chrome-mv3` bundle, the
side panel, the content script or the Playwright smoke test.

## Read first

- `.ai/rules/frontend.md`
- `.ai/rules/security.md`
- `apps/extension/wxt.config.ts`
- `e2e/smoke.spec.ts`

## Workflow

1. Reproduce with fictional data on `https://safinum.cm/hackathon-test` or a
   local mock. Never use a real bank page or real personal data.
2. Build and load the extension:

```bash
pnpm build
# chrome://extensions -> Developer mode -> Load unpacked -> apps/extension/.output/chrome-mv3
```

3. For the dev loop:

```bash
pnpm dev
```

4. Inspect the service worker, content script console and side panel. Do not
   paste page values into logs, issues or chat.
5. Run the automated smoke test:

```bash
pnpm e2e
```

6. For live-page inspection, use the Playwright MCP server from `opencode.json`.
   The server is headless Chromium and writes artifacts to `.playwright-mcp/`.
7. If the bug is in translation, switch to `protected-value-audit`.

## Guardrails

- The extension talks only to `127.0.0.1:8000`.
- Do not add a remote font, analytics, telemetry or a new host permission.
- Stop must restore the original page.
- No auto-submit and no bypassed confirmation.
- The stub TTS is not Fulfulde speech; mark it clearly.
