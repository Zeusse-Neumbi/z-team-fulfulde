# Evaluation pages

- `mock-b/index.html` — a hand-written French banking page with a deliberately different
  DOM structure from the live test page: tables instead of cards, a serif layout, different
  class names, different account values. It is used to prove that the scanner and the
  translator rely on semantics, not selectors.

The live test page is the primary target:
`https://safinum.cm/hackathon-test`.

## String extraction

```bash
pnpm strings -- --url https://safinum.cm/hackathon-test --out eval/linguistic/strings.csv
```

The script walks visible text nodes in a real browser and writes unique strings. It does
not use any application hook.

## Coverage

```bash
pnpm coverage -- --before eval/linguistic/strings.csv --after eval/linguistic/strings.ff.csv
```

Coverage is the share of baseline text nodes that are no longer present verbatim after
translation. It is computed from two text dumps and does not depend on a particular
harness.
