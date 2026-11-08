# 0007 — Browser translation runtime

- Date: 2026-11-08
- Status: Accepted
- Supersedes: the scaffold behaviour described in `docs/ARCHITECTURE.md`

## Context

The browser must translate the visible text of a page in place, never alter a
financial value, survive client-side re-renders, and revert on any integrity
failure. The scaffold classified whole text nodes as values, which prevented
mixed label/value nodes from being translated and made a second pass count its
own output as missing.

## Decision

1. **The vault stores value substrings, never whole mixed sentences.** Amounts,
   phones, accounts, references, dates, error codes, names, user input, brands
   and currencies are extracted from each text node and added individually.
   Overlapping matches are resolved in priority order (amount, account,
   reference, code, phone, date, currency, digit run).
2. **Every text node is classified before it is written.** The classes are
   `protected`, `mixed`, `translatable` and `ignore`. Nodes with no letter are
   ignored so step numbers and separators do not depress coverage.
3. **Mixed nodes need a preserved value.** A mixed node may be rewritten by a
   validated pattern, or by an exact entry whose target contains every required
   vault value byte-for-byte. A missing value aborts the pass.
4. **A translation may not invent a value.** Any amount, phone, account,
   reference, date or long digit run in a target must already exist in the
   source. A free value aborts the pass.
5. **Passes are idempotent.** The translator stores the original, the target and
   the exact written value per text node. A second pass counts an already
   translated node as applied; a page that renders the source again is
   re-translated; a page that renders new text is treated as a new source.
6. **A failure restores the page.** A protected-value change, a missing mixed
   value or a free target value restores every changed node, disconnects the
   observer and reports an abort reason to the panel.
7. **Empty targets are a supported state.** The production pack currently has
   no Fulfulde targets. The page stays in its source language, the panel shows
   `Aucune traduction fulfulde n'est installée`, and the value pipeline remains
   active. No invented Fulfulde is written.
8. **The test fixture is not a product translation.** `pnpm build:test` writes
   `⟦FF:<id>⟧` plus the source strings to a separate `.output-test` build. Every
   protected value remains byte-identical so the mechanics can be tested. The
   production build, package and ZIP contain no fixture token.

## Consequences

- Mixed page strings need a TM pattern with placeholders, or an exact entry that
  preserves the value.
- The panel can show a truthful coverage number and a list of missed sentences.
- The browser work can be completed and tested before the native-speaker pack
  lands; the release gate remains the only source of Fulfulde text.
- Direct action execution is out of scope for this decision; see ADR 0008.
