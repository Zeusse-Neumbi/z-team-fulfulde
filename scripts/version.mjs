import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

/** The application and extension version, read from the root package.json. */
export const APP_VERSION = pkg.version;

/** The French technical-note document version (independent of the app semver). */
export const NOTE_VERSION = "1.1";

/** Preselection release tag; the GitHub release uses the same string. */
export const RELEASE_TAG = `v${APP_VERSION}-preselection`;
