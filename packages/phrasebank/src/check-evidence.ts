/**
 * Print the evidence state of every registered language.
 *
 * `build:release` only enforces evidence for a pack that claims
 * `status: validated` (ADR 0020). This command is the stricter question:
 * "is every shipped language actually validated?" It exits non-zero while any
 * pack is a draft, so a submission can cite the real gate honestly.
 *
 *   pnpm --filter @zteam/phrasebank check:evidence
 *   pnpm --filter @zteam/phrasebank check:evidence -- --warn-only
 */
import { loadAll, releaseErrors } from "./loader";

// The strict check inspects the pack that is actually submitted. Set
// ZTEAM_PHRASEBANK=validated to inspect the empty human pack instead.
if (!process.env.ZTEAM_PHRASEBANK) process.env.ZTEAM_PHRASEBANK = "mt";

const warnOnly = process.argv.includes("--warn-only");
const packs = loadAll();
let incomplete = 0;

for (const code of Object.keys(packs).sort()) {
  const pack = packs[code];
  if (!pack) continue;
  const errors = releaseErrors(pack);
  const targets = pack.translationUnits.length + pack.phrases.length;
  const missing = [...pack.translationUnits, ...pack.phrases].filter(
    (entry) => !entry.target[code]?.text,
  ).length;
  const validators = [...pack.translationUnits, ...pack.phrases].filter(
    (entry) => (entry.target[code]?.validatedBy.length ?? 0) > 0,
  ).length;
  const complete = pack.status === "validated" && errors.length === 0;
  if (!complete) incomplete += 1;
  console.log(
    `[evidence] ${code}: ${pack.status} (${pack.packSource}); ` +
      `${targets - missing}/${targets} targets; ` +
      `${validators} validated; ${errors.length} release error(s)`,
  );
  if (errors.length > 0) {
    for (const error of errors.slice(0, 5)) console.log(`  - ${error}`);
    if (errors.length > 5) console.log(`  ... and ${errors.length - 5} more`);
  }
}

if (incomplete === 0) {
  console.log("[evidence] all registered languages are validated");
  process.exit(0);
}

console.error(
  `[evidence] ${incomplete} language(s) are not validated. ` +
    "A draft may ship only when the panel labels it as a draft.",
);
process.exit(warnOnly ? 0 : 1);
