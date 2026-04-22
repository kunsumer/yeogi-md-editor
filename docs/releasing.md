# Releasing Yeogi .MD Editor

## One-time setup

### 1. Generate a Tauri signing key pair

The updater verifies each new bundle with a detached signature. You need a key pair:

```bash
pnpm tauri signer generate -w ~/.tauri/yeogi-update.key
```

When prompted, set a passphrase (any string — you'll need it at build time). The command prints a public key. Paste it into `src-tauri/tauri.conf.json`:

```json
"plugins": {
  "updater": {
    "pubkey": "<the printed public key goes here>",
    "endpoints": [
      "https://github.com/<your-owner>/<your-repo>/releases/latest/download/latest.json"
    ]
  }
}
```

**Replace `<your-owner>/<your-repo>`** with the slug of the public repo where you'll publish releases.

**Never commit the private key** (`~/.tauri/yeogi-update.key`). If you lose it, you lose the ability to ship updates to existing installs — they verify against the public key baked into the app at build time.

### 2. Expose the key to the build

```bash
# Add to ~/.zshrc or pass inline on the build command:
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/yeogi-update.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<passphrase>"
```

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

3. **Write `latest.json`** — the manifest the updater polls. Template:
   ```json
   {
     "version": "0.1.1",
     "notes": "Bug fixes and polish. See changelog for details.",
     "pub_date": "2026-04-22T18:00:00Z",
     "platforms": {
       "darwin-x86_64": {
         "signature": "<paste contents of Yeogi .MD Editor.app.tar.gz.sig>",
         "url": "https://github.com/<owner>/<repo>/releases/download/v0.1.1/Yeogi.MD.Editor_universal.app.tar.gz"
       },
       "darwin-aarch64": {
         "signature": "<same .sig file>",
         "url": "https://github.com/<owner>/<repo>/releases/download/v0.1.1/Yeogi.MD.Editor_universal.app.tar.gz"
       }
     }
   }
   ```
   The same universal artifact serves both platform keys — Tauri's updater matches on the target string.

4. **Publish a GitHub Release** tagged `v0.1.1`. Upload three assets:
   - `Yeogi.MD.Editor_universal.app.tar.gz` (rename the produced `.tar.gz` for a spaces-free URL)
   - `Yeogi.MD.Editor_universal.app.tar.gz.sig`
   - `latest.json`

   Also upload the DMG (`Yeogi .MD Editor_0.1.1_universal.dmg`) so new users can do a fresh install.

5. **Point users at the DMG for the first install** (one-time, per the README). Subsequent versions install automatically: the app checks `latest.json` ~3 s after launch, shows a banner if the remote `version` beats the local one, and on Install + Restart verifies `.sig` against the baked-in pubkey before swapping the `.app` in place.

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
