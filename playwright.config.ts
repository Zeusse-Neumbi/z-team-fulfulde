import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node scripts/serve-eval.mjs",
      url: "http://127.0.0.1:4173/journey/",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { HOST: "127.0.0.1", PORT: "4173" },
    },
    {
      command: "node scripts/serve-eval.mjs",
      url: "http://127.0.0.2:4174/journey/",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { HOST: "127.0.0.2", PORT: "4174" },
    },
  ],
});
