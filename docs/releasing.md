# Releasing Yeogi .MD Editor

## Setup state (already done)

- **Repo:** https://github.com/kunsumer/yeogi-md-editor (public).
- **Signing keypair:** generated locally, no passphrase:
  - Private: `~/.tauri/yeogi-update.key`
  - Public (also baked into `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`): `~/.tauri/yeogi-update.key.pub`
- **Updater endpoint** in `tauri.conf.json` points at the GitHub "latest release" URL.

**Never commit the private key file.** If you lose it, you lose the ability to ship updates to existing installs — they verify against the public key baked into the app at build time.

### Build-time signing env var

Each release build needs the private key exposed as an env var:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/yeogi-update.key)"
```

> ⚠️ **Do NOT set** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`**.** The key has **no passphrase**. Setting that variable to *anything* — even a plausible-looking password — makes the signer try to decrypt a key that isn't encrypted, and the build fails at the final step with:
>
> ```
> incorrect updater private key password: Wrong password for that key
> ```
>
> If you see that error, `unset TAURI_SIGNING_PRIVATE_KEY_PASSWORD` and retry. You can add only the `TAURI_SIGNING_PRIVATE_KEY` export to `~/.zshrc` if you prefer it sticky; leave the password var entirely out.

## Cutting a release (automated — primary flow)

For most releases, just push a `v*` tag and the GitHub Actions workflow handles everything: builds the universal bundle, generates `latest.json`, publishes the GitHub Release, and verifies the updater endpoint.

```bash
# 1. Bump the version in all three places (lockstep):
#    - package.json → "version"
#    - src-tauri/Cargo.toml → version
#    - src-tauri/tauri.conf.json → "version"
#    Also add the v0.X.Y entry to CHANGELOG.md.

# 2. Commit + tag + push the tag.
git commit -am "release: v0.X.Y — <one-line summary>"
git tag v0.X.Y
git push origin main
git push origin v0.X.Y
```

The `.github/workflows/release.yml` workflow takes over from there:

- Verifies version lockstep (tag must match all three manifests).
- Builds the universal bundle on `macos-latest` with the `TAURI_SIGNING_PRIVATE_KEY` repo secret loaded.
- Generates `latest.json` with the correct sig + URLs.
- Publishes the GitHub Release with all four artifacts attached.
- Polls the updater endpoint to confirm it resolves to the new version.

End-to-end takes \~10 min on a cold cache, \~5 min when the Cargo target cache hits. Watch progress at `https://github.com/kunsumer/yeogi-md-editor/actions`.

### One-time setup

- **Required secret:** `TAURI_SIGNING_PRIVATE_KEY` in repo settings → Secrets and variables → Actions. Paste the full contents of `~/.tauri/yeogi-update.key` verbatim.
- **Do NOT add** `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the key has no passphrase. Setting it triggers a "Wrong password for that key" build failure (see Troubleshooting).

### Apple code-signing in CI

Currently the workflow falls back to ad-hoc signing because the "Yeogi Dev Cert" identity isn't injected into the runner's keychain. That works for auto-update + Gatekeeper, but each CI-built release has a different ad-hoc identifier — so macOS may re-prompt for Files & Folders permission on the first launch after upgrade. Local builds via `pnpm release:build` still pick up the dev cert if present.

To eliminate the TCC re-prompt: set up `APPLE_CERTIFICATE_P12_BASE64`and `APPLE_CERTIFICATE_PASSWORD` secrets, add a "Setup Apple keychain" step that imports the cert before `pnpm release:build`. Tracked informally as future work — not urgent until users complain.

## Cutting a release (manual fallback)

Use this when the GitHub Actions workflow can't run (CI down, you need to test a build locally before publishing, etc.). Steps mirror what the workflow does.

1. **Bump the version** in all three places (lockstep):

   - `package.json` → `"version"`
   - `src-tauri/Cargo.toml` → `version`
   - `src-tauri/tauri.conf.json` → `"version"`

2. **Build the universal bundle:**

   ```bash
   pnpm release:build
   ```

   (Wraps `tauri build --target universal-apple-darwin` with the right env; see `scripts/release-build.sh`.) Because `createUpdaterArtifacts: true` is set, the bundle step also writes:

   - `src-tauri/target/universal-apple-darwin/release/bundle/macos/Yeogi .MD Editor.app.tar.gz`
   - `src-tauri/target/universal-apple-darwin/release/bundle/macos/Yeogi .MD Editor.app.tar.gz.sig`

   **If only the** `.sig` **step failed** (e.g. you had a stale `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` exported and the rest of the bundle is otherwise good), you don't need to rebuild from scratch — re-sign just the tarball:

   ```bash
   pnpm tauri signer sign \
     "src-tauri/target/universal-apple-darwin/release/bundle/macos/Yeogi .MD Editor.app.tar.gz"
   ```

   That produces a fresh `.app.tar.gz.sig` in \~1 second and you can pick the pipeline up from step 3.

3. **Write** `latest.json` — the manifest the updater polls. Template (swap the version, tag, date, and `.sig` contents each release):

   ```json
   {
     "version": "0.X.Y",
     "notes": "One-line summary. See CHANGELOG.md for details.",
     "pub_date": "2026-MM-DDTHH:MM:SSZ",
     "platforms": {
       "darwin-aarch64": {
         "signature": "<paste contents of Yeogi .MD Editor.app.tar.gz.sig>",
         "url": "https://github.com/kunsumer/yeogi-md-editor/releases/download/v0.X.Y/Yeogi.MD.Editor.app.tar.gz"
       },
       "darwin-x86_64": {
         "signature": "<same .sig contents>",
         "url": "https://github.com/kunsumer/yeogi-md-editor/releases/download/v0.X.Y/Yeogi.MD.Editor.app.tar.gz"
       }
     }
   }
   ```

   The same universal artifact serves both platform keys — Tauri's updater matches on the target string.

   > **Filename quirk:** we upload the tarball as literally `Yeogi .MD Editor.app.tar.gz` (with spaces). GitHub normalizes spaces to dots on the download URL, so the URL in `latest.json` must use `Yeogi.MD.Editor.app.tar.gz` (dots, no `_universal`). On-disk filename ≠ URL filename — don't add `_universal` to the local filename to match; it breaks the URL mapping.

4. **(If working from a firewalled network)** Squash-push the tree to remote `main` via `scripts/api-push.py`. This is a workaround for networks that block git-over-ssh/https — it uses GitHub's Git Data API to upload every tracked file as a blob, assembles a tree, and fast-forwards `main`:

   ```bash
   python3 scripts/api-push.py                    # commit message from HEAD
   python3 scripts/api-push.py <release-sha>      # use a specific commit's message
   ```

   If `HEAD` is the commit you want to publish, no args needed. If `HEAD` is a follow-up (e.g. a Cargo.lock bump) and you want the earlier release commit's message on the remote, pass its SHA.

   Skip this step entirely on networks where native `git push` works.

5. **Publish a GitHub Release** tagged `v0.X.Y`. Upload the three bundle artifacts + `latest.json` in one `gh release create` call — `gh` handles the dot-normalization of spaces automatically, so you can pass the on-disk paths verbatim:

   ```bash
   BUNDLE="src-tauri/target/universal-apple-darwin/release/bundle"
   gh release create v0.X.Y \
     --repo kunsumer/yeogi-md-editor \
     --title "v0.X.Y" \
     --notes-file <(sed -n '/^## v0.X.Y/,/^## /p' CHANGELOG.md | sed '$d') \
     "$BUNDLE/dmg/Yeogi .MD Editor_0.X.Y_universal.dmg" \
     "$BUNDLE/macos/Yeogi .MD Editor.app.tar.gz" \
     "$BUNDLE/macos/Yeogi .MD Editor.app.tar.gz.sig" \
     /tmp/latest.json
   ```

   **Verify the updater endpoint** resolves to the new version before declaring the release done:

   ```bash
   curl -sL "https://github.com/kunsumer/yeogi-md-editor/releases/latest/download/latest.json" | jq .version
   ```

   Should echo `"0.X.Y"`. If it echoes a stale version, the release probably isn't marked latest yet — `gh release edit v0.X.Y --latest`.

6. **Point users at the DMG for the first install** (one-time). Subsequent versions install automatically: the app checks `latest.json` on launch, shows a banner if the remote `version` beats the local one, and on Install + Restart verifies `.sig` against the baked-in pubkey before swapping the `.app` in place.

## What users see

- **First install:** double-click the DMG, drag to `/Applications`, right-click → Open the first time (Gatekeeper — gone once you sign with an Apple Developer cert).

- **Subsequent updates:** silent check on app launch. If an update is available, an accent-colored banner appears above the editor:

  > **Update available — v0.1.1** · Bug fixes and polish. **\[Later\]** **\[Install & Restart\]**

- **Manual check:** Help → Check for Updates… → the banner reports "Checking…" → "You're on the latest version" or "Update available".

## Troubleshooting

- **Build fails with** `incorrect updater private key password: Wrong password for that key` → you have `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` exported in your shell. The key has no passphrase; `unset TAURI_SIGNING_PRIVATE_KEY_PASSWORD` and retry. (Tests in zsh: `echo "PASS=${TAURI_SIGNING_PRIVATE_KEY_PASSWORD-<unset>}"` — should print `PASS=<unset>`.)
- **Banner never appears** → the private key wasn't set at build time (`TAURI_SIGNING_PRIVATE_KEY` env var), so the artifact has no `.sig` and the updater rejects the manifest. Or the pubkey in `tauri.conf.json` is still the `REPLACE_WITH_YOUR_PUBLIC_KEY` placeholder.
- **"Failed to verify signature"** → the private key used to sign this release doesn't match the pubkey baked into installed apps. Never rotate the key unless you're willing to orphan all existing installs.
- **"Update check failed" on macOS behind a proxy** → the updater uses the system proxy via reqwest; check `networksetup -getwebproxy`.
- **Saving** `src-tauri/resources/welcome.md` **in the dev app looks like a crash** → it isn't. `commands.rs` does `include_str!("../resources/welcome.md")`, so Cargo tracks that file as a build dependency — saving it from the running dev app triggers a Rust recompile + restart. For edits to the seed content, edit it outside the running dev app (VS Code, etc.). To iterate on the *content* against the current build without re-seeding, open a copy elsewhere (e.g. `~/Documents/Yeogi .MD Editor/welcome-test.md`).

## Future work

- Code-sign + notarize with an Apple Developer cert so the Gatekeeper first-launch dance goes away. Configure `bundle.macOS.signingIdentity` and add a notarization step to the build.
- Move to GitHub Actions for automated releases — the signing private key goes in `TAURI_SIGNING_PRIVATE_KEY` repo secret, the workflow builds and uploads on every git tag.