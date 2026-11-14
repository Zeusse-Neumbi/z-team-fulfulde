# Testing rules

Applies to `**/*.test.ts`, `apps/server/tests/**` and `e2e/**`.

## Test pyramid

- Unit tests for normalization, patterns, protected nodes and phrasebank loading.
- DOM integration tests for translation, revert and `MutationObserver` paths.
- API tests for every route, status code and failure mode.
- Playwright smoke tests for the built extension and side panel.
- Manual evidence for the live five-step journey and native validation.

## Non-negotiable regressions

Every change that touches translation must cover, for every registered
language it affects:

- amount, fee, total, balance, name, phone, account, reference, date and user
  input;
- a mixed label/value node;
- a failed translation that reverts;
- a second pass that is idempotent;
- novel content added after load;
- target-language switching and the per-language voice policy (a bundled clip
  never plays for another language).

Use fictional values only. Never copy a real account, phone number, document or
page value into a fixture.

## Running

```bash
pnpm --filter @zteam/translator test
pnpm --filter @zteam/phrasebank test
pnpm test
pnpm e2e
uv run --project apps/server pytest
```

## Do not

- Delete a failing test instead of fixing the cause.
- Add a broad `skip`, `only`, `passWithNoTests` or `--forceExit` to hide a
  failure.
- Compare protected values with a lossy normalization.
- Use a live model or network call in a unit test.
