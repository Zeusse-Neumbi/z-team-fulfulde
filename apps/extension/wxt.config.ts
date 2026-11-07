import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Z-Team Fulfulde Assistant",
    description:
      "A local-first Fulfulde accessibility layer for digital financial services. Translates the page in place and speaks it, without modifying the service.",
    version: "0.1.0",
    permissions: ["sidePanel", "storage", "activeTab", "scripting"],
    host_permissions: [
      "http://127.0.0.1:8000/*",
      "https://safinum.cm/*",
      "http://localhost/*",
      "http://127.0.0.1/*",
    ],
    optional_host_permissions: ["https://*/*", "http://*/*"],
    side_panel: {
      default_path: "sidepanel.html",
    },
    action: {
      default_title: "Open Fulfulde assistant",
    },
  },
});
