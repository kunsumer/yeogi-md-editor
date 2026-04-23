# Releasing Yeogi .MD Editor

## Setup state (already done)

- **Repo:** https://github.com/kunsumer/yeogi-md-editor (public).
- **Signing keypair:** generated locally, no passphrase:
  - Private: `~/.tauri/yeogi-update.key`
  - Public (also baked into `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`): `~/.tauri/yeogi-update.key.pub`
- **Updater endpoint** in `tauri.conf.json` points at the GitHub "latest release" URL.

**Never commit the private key file.** If you lose it, you lose the ability
to ship updates to existing installs — they verify against the public key
baked into the app at build time.

### Build-time signing env var

Each release build needs the private key exposed as an env var:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/yeogi-update.key)"
```

No password was set on the key, so `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is
not required. You can add the export to `~/.zshrc` if you prefer it sticky.

## Cutting a release

1. **Bump the version** in all three places (lockstep):
   - `package.json` → `"version"`
   - `src-tauri/Cargo.toml` → `version`
   - `src-tauri/tauri.conf.json` → `"version"`

2. **Build the universal bundle:**
   ```bash
   pnpm tauri build --target universal-apple-darwin
   ```
   Because `createUpdaterArtifacts: true` is set, the bundle step also writes:
   - `src-tauri/target/universal-apple-darwin/release/bundle/macos/Yeogi .MD Editor.app.tar.gz`
   - `src-tauri/target/universal-apple-darwin/release/bundle/macos/Yeogi .MD Editor.app.tar.gz.sig`

3. **Write `latest.json`** — the manifest the updater polls. Template (swap the version, tag, date, and `.sig` contents each release):
   ```json
   {
     "version": "0.2.1",
     "notes": "Bug fixes and polish. See CHANGELOG.md for details.",
     "pub_date": "2026-04-23T12:00:00Z",
     "platforms": {
       "darwin-x86_64": {
         "signature": "<paste contents of Yeogi.MD.Editor_universal.app.tar.gz.sig>",
         "url": "https://github.com/kunsumer/yeogi-md-editor/releases/download/v0.2.1/Yeogi.MD.Editor_universal.app.tar.gz"
       },
       "darwin-aarch64": {
         "signature": "<same .sig contents>",
         "url": "https://github.com/kunsumer/yeogi-md-editor/releases/download/v0.2.1/Yeogi.MD.Editor_universal.app.tar.gz"
       }
     }
   }
   ```
   The same universal artifact serves both platform keys — Tauri's updater matches on the target string.

4. **Publish a GitHub Release** tagged `v0.2.1`. Rename the built `Yeogi .MD Editor.app.tar.gz` to `Yeogi.MD.Editor_universal.app.tar.gz` (spaces in a URL are misery). Upload:
   - `Yeogi.MD.Editor_universal.app.tar.gz`
   - `Yeogi.MD.Editor_universal.app.tar.gz.sig`
   - `latest.json`
   - `Yeogi .MD Editor_0.2.1_universal.dmg` (for fresh installs)

   The `gh release create` one-liner:
   ```bash
   gh release create v0.2.1 \
     --repo kunsumer/yeogi-md-editor \
     --title "v0.2.1" \
     --notes-file <(sed -n '/^## v0.2.1/,/^## /p' CHANGELOG.md | sed '$d') \
     "path/to/Yeogi.MD.Editor_universal.app.tar.gz" \
     "path/to/Yeogi.MD.Editor_universal.app.tar.gz.sig" \
     "path/to/latest.json" \
     "path/to/Yeogi .MD Editor_0.2.1_universal.dmg"
   ```

5. **Point users at the DMG for the first install** (one-time). Subsequent versions install automatically: the app checks `latest.json` on launch, shows a banner if the remote `version` beats the local one, and on Install + Restart verifies `.sig` against the baked-in pubkey before swapping the `.app` in place.

## What users see

- **First install:** double-click the DMG, drag to `/Applications`, right-click → Open the first time (Gatekeeper — gone once you sign with an Apple Developer cert).
- **Subsequent updates:** silent check on app launch. If an update is available, an accent-colored banner appears above the editor:
  > **Update available — v0.1.1** · Bug fixes and polish. **[Later]** **[Install & Restart]**
- **Manual check:** Help → Check for Updates… → the banner reports "Checking…" → "You're on the latest version" or "Update available".

## Troubleshooting

- **Banner never appears** → the private key wasn't set at build time (`TAURI_SIGNING_PRIVATE_KEY` env var), so the artifact has no `.sig` and the updater rejects the manifest. Or the pubkey in `tauri.conf.json` is still the `REPLACE_WITH_YOUR_PUBLIC_KEY` placeholder.
- **"Failed to verify signature"** → the private key used to sign this release doesn't match the pubkey baked into installed apps. Never rotate the key unless you're willing to orphan all existing installs.
- **"Update check failed" on macOS behind a proxy** → the updater uses the system proxy via reqwest; check `networksetup -getwebproxy`.

## Future work

- Code-sign + notarize with an Apple Developer cert so the Gatekeeper first-launch dance goes away. Configure `bundle.macOS.signingIdentity` and add a notarization step to the build.
- Move to GitHub Actions for automated releases — the signing private key goes in `TAURI_SIGNING_PRIVATE_KEY` repo secret, the workflow builds and uploads on every git tag.
