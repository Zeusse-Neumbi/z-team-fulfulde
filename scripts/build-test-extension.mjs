import { execFileSync } from "node:child_process";

if (process.env.NODE_ENV === "production") {
  console.error("[build:test] refusing to build the fixture extension in production mode");
  process.exit(1);
}

execFileSync("pnpm", ["--filter", "@zteam/phrasebank", "build:fixture"], {
  stdio: "inherit",
  env: process.env,
});

execFileSync("pnpm", ["--filter", "@zteam/extension", "build"], {
  stdio: "inherit",
  env: { ...process.env, ZTEAM_TEST_TM: "1" },
});

console.log("[build:test] fixture extension written to apps/extension/.output-test/chrome-mv3");
