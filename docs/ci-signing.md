# CI code-signing & notarization

> **Status:** Active since v0.4.14 (2026-05-11). The release workflow signs
> with an Apple Developer ID Application identity and submits each build
> to Apple's notarytool service. This document covers how the pipeline
> works, what secrets it depends on, and how to maintain / debug it.

## Why this exists

Two problems get solved by this pipeline, and they're independent:

| Problem | Solved by |
|---|---|
| macOS TCC's "Yeogi can access your Documents" grant being re-prompted on **every release** because the ad-hoc-signed binary had a different identifier each build | Using *any* stable signing identity (originally a self-signed cert; now Apple Developer ID) so the bundle identifier stays `com.yeogi.mdeditor` across releases |
| Gatekeeper's first-install **"unidentified developer"** warning + required right-click → Open | Apple Developer ID + notarization specifically — self-signed certs don't satisfy Gatekeeper |

The first was fixed in v0.4.8 with a self-signed cert ("Yeogi Dev Cert"). The second was fixed in v0.4.14 by switching to a real Apple Developer ID Application identity and adding notarization.

## Required GitHub Secrets

Repo secrets at <https://github.com/kunsumer/yeogi-md-editor/settings/secrets/actions>:

| Secret | Purpose |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri's own minisign key for auto-updater signature verification. Has been in place since v0.2.x; unrelated to Apple signing. |
| `APPLE_SIGNING_CERT_P12_BASE64` | Base64-encoded `.p12` containing the "Developer ID Application: Kun Soo Han (USZUQ9Y8ZN)" identity. Imported into a fresh keychain on the runner each release. |
| `APPLE_SIGNING_CERT_PASSWORD` | Password for the `.p12` above. Random per-rotation. |
| `APPLE_ID` | Apple ID email associated with the Apple Developer Program membership. Used for notarization auth. |
| `APPLE_TEAM_ID` | `USZUQ9Y8ZN` — the 10-character team identifier. Visible in `security find-identity -p codesigning -v` output as the parenthesized suffix on the Developer ID Application row. |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password generated at <https://account.apple.com/>. Used for notarization — Apple won't accept the regular account password. |

The first three handle **signing**. The last three handle **notarization**. Tauri's bundler reads them via env vars during `tauri build` and auto-runs `xcrun notarytool submit --wait` + `xcrun stapler staple` on the .app.

## Workflow shape (`.github/workflows/release.yml`)

Two macOS-signing-relevant steps. The first imports the cert via the [`apple-actions/import-codesign-certs@v3`](https://github.com/apple-actions/import-codesign-certs) action (the hand-rolled `security` script we originally used had macOS-version-specific quirks that this action handles correctly). The second runs the build with the signing + notarization env vars set.

```yaml
      - name: Import Apple signing identity
        uses: apple-actions/import-codesign-certs@v3
        with:
          p12-file-base64: ${{ secrets.APPLE_SIGNING_CERT_P12_BASE64 }}
          p12-password: ${{ secrets.APPLE_SIGNING_CERT_PASSWORD }}

      - name: Build signed universal bundle
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          APPLE_SIGNING_IDENTITY: "Developer ID Application: Kun Soo Han (USZUQ9Y8ZN)"
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: pnpm release:build
```

Note: Tauri's bundler reads the env var `APPLE_PASSWORD`. The GitHub Secret is called `APPLE_APP_SPECIFIC_PASSWORD` for clarity; the workflow maps it to the env var the bundler expects.

If any of `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` is unset, the bundler **silently skips notarization** with a printed warning. The .app would still be signed (so TCC is fine), but Gatekeeper would reject it on first install. The workflow doesn't fail in that case — watch for the warning in the build log.

Job timeout is **75 minutes** (was 30 originally). Notarization typically completes in 3–15 min but Apple's queue can spike to 30–60 min during peak load. 75 leaves plenty of headroom without letting a genuinely-stuck job run for hours.

## Verification (after a release lands on your Mac)

```bash
codesign -dv --verbose=2 "/Applications/Yeogi .MD Editor.app" 2>&1 \
  | grep -E "Identifier|Authority|TeamIdentifier|Signature"
spctl -a -v "/Applications/Yeogi .MD Editor.app"
xcrun stapler validate "/Applications/Yeogi .MD Editor.app"
```

Expected output:

```
Identifier=com.yeogi.mdeditor
Authority=Developer ID Application: Kun Soo Han (USZUQ9Y8ZN)
Authority=Developer ID Certification Authority
Authority=Apple Root CA
TeamIdentifier=USZUQ9Y8ZN
Signature size=8973                     ← signed, NOT "Signature=adhoc"

/Applications/Yeogi .MD Editor.app: accepted
source=Notarized Developer ID

Processing: /Applications/Yeogi .MD Editor.app
The validate action worked!
```

Three things to check:
1. `Authority` chain shows Apple's chain of trust (3 lines, ending in Apple Root CA).
2. `spctl` says **accepted, source=Notarized Developer ID** (not "rejected", not "accepted, source=Developer ID").
3. `xcrun stapler validate` says **"The validate action worked!"**.

If `spctl` says only `source=Developer ID` (without `Notarized`), the signing worked but notarization didn't — check the build log for the notarization warning.

## Annual maintenance

- **Apple Developer Program membership: $99 USD/yr.** Apple emails ~30 days before lapse. Renew via <https://developer.apple.com/account>. No config changes needed — same Team ID, same cert, same secrets.
- **App-specific password** never expires automatically, but you can rotate it any time at <https://account.apple.com/> → Sign-In and Security → App-Specific Passwords. If you rotate, just update the `APPLE_APP_SPECIFIC_PASSWORD` GitHub Secret.
- **The Developer ID Application cert** is valid **5 years** from issue (2026-05-11 → renewed by 2031-05-10). Apple Developer Program membership lapsing does NOT invalidate the cert — but if the membership lapses you can't issue new certs or submit new notarizations.

## Cert rotation (e.g., key compromise)

If you suspect the private key has leaked or you just want to rotate:

```bash
# 1. Revoke the existing Developer ID cert at developer.apple.com → Certificates.

# 2. Create a new Developer ID Application cert in Xcode:
#    Xcode → Settings → Accounts → Manage Certificates → + → Developer ID Application

# 3. Export the new identity to a temporary .p12.
PASS=$(openssl rand -hex 24)
P12=$(mktemp -t yeogi-cert).p12
B64=$(mktemp -t yeogi-cert).b64
security export \
  -k ~/Library/Keychains/login.keychain-db \
  -t identities -f pkcs12 \
  -P "$PASS" -o "$P12"
base64 -i "$P12" -o "$B64"

# 4. (Optional) Smoke-test by importing into a throwaway keychain.
TEST=$(mktemp -t test-kc).db
KCPASS=$(uuidgen)
security create-keychain -p "$KCPASS" "$TEST"
security unlock-keychain -p "$KCPASS" "$TEST"
security import "$P12" -k "$TEST" -P "$PASS" -A -t agg
security find-identity -v "$TEST"
security delete-keychain "$TEST"

# 5. Push the new .p12 + password to GitHub Secrets.
gh secret set APPLE_SIGNING_CERT_P12_BASE64 \
  --body "$(cat $B64)" --repo kunsumer/yeogi-md-editor
gh secret set APPLE_SIGNING_CERT_PASSWORD \
  --body "$PASS" --repo kunsumer/yeogi-md-editor

# 6. Wipe local artifacts.
rm -f "$P12" "$B64"
```

The next release will use the new cert. The bundle identifier stays `com.yeogi.mdeditor`, so TCC continues to work without re-prompting.

## Debugging signing failures

If a release CI run fails at the **Build signed universal bundle** step:

1. **`Import Apple signing identity` output**: should end with the import action printing the imported identity. If it says "0 identities imported" or errors on the import command, the `.p12` is corrupt or the password is wrong.
2. **`release-build.sh` errors with `APPLE_SIGNING_IDENTITY=... was set but the identity isn't in any visible keychain`** — the cert imported, but find-identity can't see it as a valid codesigning identity. For Apple Developer ID certs this shouldn't happen (the chain validates naturally), so if it does, the import probably failed silently. Re-export the cert and update the secret.
3. **`failed to notarize app: HTTPError ... Internet connection appears to be offline`** — transient network blip between the runner and Apple's notarytool service. Just rerun the workflow (`gh run rerun <run-id> --repo kunsumer/yeogi-md-editor`); a fresh runner typically has a working network path.
4. **`failed to notarize app: Status: Invalid`** — Apple rejected the submission. Run `xcrun notarytool log <submission-uuid> --apple-id … --team-id … --password …` (UUID is in the failure log) to fetch the rejection reason. Common causes: missing hardened runtime, embedded binary without proper signing, entitlements issue.
5. **Job hits the 75-min timeout** — Apple's notary queue is unusually slow (rare but does happen during peak load). Wait a few hours, then rerun.

## Historical: the self-signed era (v0.4.8 – v0.4.13)

For reference, releases v0.4.8 through v0.4.13 were signed with a self-signed cert called **"Yeogi Dev Cert"** created locally via `scripts/create-apple-signing-cert.sh`. That kept the bundle identifier stable (so TCC didn't re-prompt) but Gatekeeper still demanded right-click → Open on first install. v0.4.14 swapped in the Apple Developer ID and added notarization. The old `Yeogi Dev Cert` is still in the local login keychain (harmless — codesign picks via `APPLE_SIGNING_IDENTITY`) but no longer used by CI.

The `scripts/create-apple-signing-cert.sh` script is kept for reference + local-developer-build use cases where someone wants a self-signed cert without an Apple Developer Program membership.
