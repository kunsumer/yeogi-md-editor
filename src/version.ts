// Single source of truth for the app version. We import from package.json
// (Vite + tsconfig both support JSON modules) so bumping the release in
// package.json automatically flows into the UI labels, About dialog, etc.
//
// Keep the three version fields in lockstep whenever you cut a release:
//   - package.json              "version"   ← source of truth, read here
//   - src-tauri/Cargo.toml      version     ← the Rust crate / bundle
//   - src-tauri/tauri.conf.json version     ← the Tauri bundle metadata
import pkg from "../package.json";

export const APP_VERSION: string = pkg.version;

// Semver leading with a 0. is conventionally pre-1.0 / beta. We surface this
// as a label next to the version so users know they're on an in-development
// build. Flip to "stable" once we ship 1.0.
export const APP_CHANNEL: "beta" | "stable" = APP_VERSION.startsWith("0.")
  ? "beta"
  : "stable";

/** Human-readable version label, e.g. "v0.1.0 · beta". */
export const APP_VERSION_LABEL = `v${APP_VERSION}${
  APP_CHANNEL === "stable" ? "" : " · beta"
}`;
