import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { defineConfig } from "wxt";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

const fixtureTm = process.env.ZTEAM_TEST_TM === "1";
const fixtureEntry = fileURLToPath(
  new URL("../../packages/phrasebank/src/fixture.ts", import.meta.url),
);
const fixtureAlias: Record<string, string> = fixtureTm
  ? { "@zteam/phrasebank": fixtureEntry }
  : {};

const hostPermissions = fixtureTm
  ? ["<all_urls>"]
  : [
      "http://127.0.0.1:8000/*",
      "https://safinum.cm/*",
      "http://localhost/*",
      "http://127.0.0.1/*",
    ];

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  outDir: fixtureTm ? ".output-test" : ".output",
  vite: () => ({
    define: {
      __ZTEAM_FIXTURE__: JSON.stringify(fixtureTm),
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: fixtureAlias,
    },
  }),
  manifest: {
    name: "Z-Team Fulfulde Assistant",
    description:
      "A local-first Cameroonian-language accessibility layer for digital financial services. Translates the page in place and speaks it, without modifying the service.",
    version: pkg.version,
    permissions: ["sidePanel", "storage", "activeTab", "scripting"],
    host_permissions: hostPermissions,
    optional_host_permissions: ["https://*/*", "http://*/*"],
    side_panel: {
      default_path: "sidepanel.html",
    },
    action: {
      default_title: "Open Fulfulde assistant",
    },
  },
});
