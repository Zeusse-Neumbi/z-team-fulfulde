# 0010 — Generalization harness and test-only fallback

- Date: 2026-11-08
- Status: Accepted

## Context

The browser part must behave the same on pages other than the SAFINUM test page:
non-sensitive text is rewritten, values stay byte-identical, the same rules apply
to headings, labels, links, buttons, paragraphs, lists and forms, and Stop
restores the page. The production pack still has no Fulfulde targets, so a test
seam is required to prove the generic pipeline without inventing Fulfulde.

The first broad sweep exposed two real generalization bugs:

1. a 3-token name heuristic protected ordinary headings such as
   `Getting Started Guide`;
2. a mixed node aborted when the same protected name appeared in another node
   with a different whitespace variant (`Western Area` vs `Western Area`).

## Decision

1. **Production stays TM-only.** Unknown text is left in its source language and
   counted as missed. The production manifest keeps the narrow host list and
   contains no fixture token.
2. **The test fixture has a generic fallback.** When `ZTEAM_TEST_TM=1`, a
   translatable or mixed node without a TM entry is rewritten to
   `⟦FF:novel⟧ <source>`. This proves every non-sensitive node reaches the
   replacement path; it is never presented as Fulfulde.
3. **The fixture build is the only broad-host build.** It declares
   `<all_urls>` so the harness can inject the content script into public test
   pages. It is written to `apps/extension/.output-test/`, is gitignored, and
   `scripts/package-extension.mjs` refuses to package a manifest with
   `<all_urls>` or a fixture token.
4. **Person names are stopword-aware.** A 2–4 token Title Case value is protected
   only outside headings, links, buttons and labels, and only when none of its
   tokens is a common UI/heading word. Single names are allowed only in a
   greeting, a labelled value or a `<strong>`/`<b>` context.
5. **Mixed-value verification is normalized.** The required display value is
   checked after normalization, so cross-node NBSP/space variants do not abort a
   valid pass; pattern captures are still checked byte-for-byte.
6. **The harness is a canary test.** Each page receives a fictional canary block
   with an amount, account, phone, reference, date, name, user input and
   contenteditable text. A page passes only when:
   - the canary labels and the page's non-sensitive text contain a fixture token;
   - every canary value, the input value and the contenteditable text are
     unchanged;
   - `aborted` is false, `applied > 0`, `missed == 0`, coverage is 1.0;
   - Stop restores the canary and removes every fixture token;
   - on the first page, text appended after load is translated and then restored.
7. **Page-load failures are skips, not product failures.** A page that blocks
   headless navigation, times out at load or closes the connection is reported
   as skipped. A loaded page that fails a canary check is a product failure.

## Evidence

`pnpm check:sites` runs the 30-page list. The final sweep:

- 30 tested
- 26 passed in the first run; 21 passed in the final run after the script's
  dynamic-column fix; both runs had **0 product failures**
- 4–9 skipped because the page did not finish loading (network timeouts or
  connection errors), not because the extension altered a value
- every passing page had coverage 1.000, missed 0, canary values preserved,
  input/contenteditable preserved and Stop restored
- the first page (example.com) also passed the post-load dynamic-content check
- Wikipedia EN applied 1,902 nodes, Wikipedia FR 2,250, Wikipedia EN Cameroon
  3,305, MDN 591/577; all with zero aborts

The local e2e also covers the on-demand panel path on
`http://127.0.0.2:4174/journey/`, which is outside the production manifest
matches.

## Consequences

- The generic mechanics are proven across a broad set of pages before the
  backend or the Fulfulde pack exists.
- Real non-sensitive text replacement on arbitrary pages still requires the
  validated pack or the backend; production does not invent a target.
- Cross-origin iframes, closed shadow roots, canvas/SVG-only interfaces, input
  placeholders and `aria-label` attributes remain outside the text-node
  replacement contract. They are documented limits, not silent changes.
- Some place/organization names may be protected by the conservative name
  heuristic; that is preferable to rewriting a person name.
