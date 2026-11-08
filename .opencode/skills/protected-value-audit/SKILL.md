---
name: Protected Value Audit
description: Prove that amounts, fees, totals, names, phones, accounts, references, dates and user input stay byte-identical through translation.
---

# Protected value audit

Use this skill when a change touches `packages/translator`, the content script,
the value vault, the DOM translator or an action that reads page values.

## Read first

- `.ai/rules/frontend.md`
- `.ai/rules/testing.md`
- `packages/translator/src/protected.ts`
- `packages/translator/src/patterns.ts`
- `packages/translator/src/translator.test.ts`

## Workflow

1. List every affected value class:
   - amount, fee, total, balance;
   - person, phone, account, reference, date;
   - user input.
2. For each class, add a case that runs the real classification and translation
   path, not a mock of the protected check.
3. Add at least one mixed label/value case and one adversarial case:
   - NBSP or narrow NBSP around the value;
   - punctuation, currency or spacing change;
   - a translation plan that tries to rewrite the value.
4. Assert the normalized value is byte-identical. A deliberate mismatch must
   revert the node and abort the plan.
5. Add a DOM integration test when node replacement or `MutationObserver` is
   involved.
6. Run:

```bash
pnpm --filter @zteam/translator test
pnpm test
```

## Evidence

Report the exact test names and the command output. Do not claim invariance from
a code review alone.

## Guardrails

- Do not widen normalization to make a test pass.
- Do not skip the revert path.
- Do not put a real value in a fixture; use fictional data.
- If a case cannot be covered automatically, record the manual evidence in the
  issue and do not mark the audit complete.
