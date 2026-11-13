#!/usr/bin/env node
/**
 * Build the extension that is actually submitted.
 *
 * The submission ships the **labelled machine-translation draft pack**: it is
 * the only pack that contains Fulfulde targets before the native-speaker
 * session, and `package-extension.mjs` refuses to zip a build with empty
 * targets. The panel reads `packSource` and shows "MT — non validée".
 *
 * This is not a release build. `pnpm --filter @zteam/phrasebank build:release`
 * stays the linguistic gate and still fails while entries are unvalidated.
 */
import { execFileSync } from "node:child_process";

const env = { ...process.env, ZTEAM_PHRASEBANK: "mt" };

execFileSync("pnpm", ["-r", "build"], { stdio: "inherit", env });

console.log("[build:submission] draft (MT) pack built into apps/extension/.output/chrome-mv3");
