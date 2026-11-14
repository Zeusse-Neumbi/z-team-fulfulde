# Lamnso data-only proof

This folder keeps the generated data from a scratch `pnpm lang:add lns` run. It
is **evidence for the extension point**, not a shipped language. It is not under
`languages/`, so the loader and the submission ZIP ignore it.

| File | What it is |
| --- | --- |
| `lns.yaml` | generated registry row (draft, API-only voice) |
| `tm.yaml` | 80 empty human TM targets with the fub IDs |
| `phrases.yaml` | 35 empty human phrase targets |
| `numbers.lns.json` | empty number lexicon |

## Reproduce

On a scratch worktree:

```bash
node scripts/add-language.mjs lns --model facebook/mms-tts-lns --mt francais-lamnso --name Lamnso
git status --short
pnpm --filter @zteam/phrasebank test
```

The generated files above land in `languages/`, `packages/phrasebank/entries/lns/`,
`packages/phrasebank/numbers/lns.json`, `models/manifest.json` and a generated
`language-lns.test.ts`. No existing `.ts` or `.py` file is edited. The generated
test stays red until a native speaker supplies targets, validators and French
back-translations.

The first run exposed two hardcoded-language gaps (fixed on `main`): tests
expected exactly `["fub","ybb"]`, and `speech.substitutions` was parsed but not
applied. The runtime path is now data-only. Validation is still gated.

Do not merge this folder into `languages/`. Do not claim a validated Lamnso pack.
