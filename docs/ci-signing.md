# Stable code-signing in CI

> **Status:** Active. The release workflow imports the `Yeogi Dev Cert`
> from a GitHub Secret on every run. This document describes the setup
> for future reference (rotating the cert, debugging signing failures,
> handing the project to someone else).

## Why

Before this was wired up, the release workflow ran `pnpm release:build` on
a fresh GitHub-hosted macOS runner without the `Yeogi Dev Cert` identity
in its keychain, so `release-build.sh` fell back to **ad-hoc** signing
(with a printed warning that's invisible in the rolled-up CI log).

Ad-hoc-signed binaries get a fresh per-build identifier
(`yeogi_md_editor-<hash>` where the hash is the CDHash of the binary).
macOS TCC keys the "you have access to ~/Documents" grant by that
identifier, so every release is treated as a fundamentally different
app — Documents-folder permission has to be re-granted on first launch
of every version.

This proposal: **export the local "Yeogi Dev Cert" once, store it as a
GitHub secret, import it into the runner's keychain at the start of each
release.** Same identifier across all builds → TCC grant persists.

This is **not** an Apple Developer ID. End users still see the
"unidentified developer" Gatekeeper warning on first install (right-click
→ Open). Solving Gatekeeper requires the $99/yr Apple Developer Program;
solving TCC churn does not.

## One-time setup (already done — kept here for cert rotation)

The original setup happened on 2026-05-04. The steps below are what to
run if you ever need to **rotate the cert** (key compromised, expiry
approaching, etc.) — same flow as the original setup, just overwriting
the existing GitHub Secrets with a fresh export.


```bash
# 1. Export the existing dev cert + private key as a password-protected
#    PKCS#12 from your login keychain. Pick any export password — you'll
#    paste it as a GitHub secret in step 3.
security export \
  -k ~/Library/Keychains/login.keychain-db \
  -t identities \
  -f pkcs12 \
  -o /tmp/yeogi-dev-cert.p12 \
  -P "<choose-an-export-password>"
# Note: `security export` prompts interactively for the password if -P is
# omitted. Use whichever you prefer.

# 2. Base64-encode the .p12 so it survives GitHub Secrets storage as text.
base64 -i /tmp/yeogi-dev-cert.p12 -o /tmp/yeogi-dev-cert.p12.b64

# 3. Open the contents and copy them. Paste them into the secret in step 4.
cat /tmp/yeogi-dev-cert.p12.b64 | pbcopy
```

Then in GitHub: **Settings → Secrets and variables → Actions → New
repository secret**, add two secrets:

| Name | Value |
|---|---|
| `APPLE_SIGNING_CERT_P12_BASE64` | the base64 from step 3 |
| `APPLE_SIGNING_CERT_PASSWORD` | the export password from step 1 |

Then locally, **shred the temp files**:

```bash
rm -f /tmp/yeogi-dev-cert.p12 /tmp/yeogi-dev-cert.p12.b64
```

## Workflow shape (`.github/workflows/release.yml`)

The workflow has two macOS-signing-relevant steps. The first imports the
cert into a fresh keychain on the runner; the second runs the build
with `APPLE_SIGNING_IDENTITY` set so `release-build.sh` refuses to fall
back to ad-hoc.

```yaml
      - name: Import Apple signing identity
        # Re-creates a temporary keychain on the runner, imports the
        # exported PKCS#12, and unlocks it for the duration of the build.
        # The keychain is wiped along with the runner image when the job
        # ends — no persistence across runs.
        env:
          CERT_B64: ${{ secrets.APPLE_SIGNING_CERT_P12_BASE64 }}
          CERT_PASSWORD: ${{ secrets.APPLE_SIGNING_CERT_PASSWORD }}
        run: |
          set -euo pipefail
          KEYCHAIN_PATH="$RUNNER_TEMP/yeogi-build.keychain-db"
          KEYCHAIN_PASSWORD=$(uuidgen)

          # Decode the cert.
          CERT_PATH="$RUNNER_TEMP/yeogi-dev-cert.p12"
          echo "$CERT_B64" | base64 --decode --output "$CERT_PATH"

          # Create + unlock + add to search list so codesign sees it.
          security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security list-keychains -d user -s "$KEYCHAIN_PATH" $(security list-keychains -d user | xargs)

          # Import. -A grants codesign access without an interactive prompt.
          security import "$CERT_PATH" \
            -k "$KEYCHAIN_PATH" \
            -P "$CERT_PASSWORD" \
            -A \
            -t agg

          # Allow codesign to use the key without a UI prompt during the build.
          security set-key-partition-list \
            -S apple-tool:,apple:,codesign: \
            -s -k "$KEYCHAIN_PASSWORD" \
            "$KEYCHAIN_PATH"

          # Sanity check.
          security find-identity -p codesigning -v "$KEYCHAIN_PATH"

          # Wipe the cert from disk now that it's in the keychain.
          rm -f "$CERT_PATH"

      - name: Build signed universal bundle
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          # Force release-build.sh to use the imported identity. If this
          # variable is set, the script skips its `find-identity` check
          # and trusts the value, which means a misnamed cert fails
          # loudly at the codesign step instead of silently going ad-hoc.
          APPLE_SIGNING_IDENTITY: "Yeogi Dev Cert"
        run: pnpm release:build
```

## Verification (after first signed release)

On a Mac with the new release installed:

```bash
codesign -dv --verbose=2 "/Applications/Yeogi .MD Editor.app" 2>&1 \
  | grep -E "Identifier|Authority|Signature"
```

Expected output:

```
Identifier=com.yeogi.mdeditor             ← stable, no hash suffix
Authority=Yeogi Dev Cert
Signature size=...                        ← NOT "Signature=adhoc"
```

If those three lines look right, the next release after this one (and
every subsequent release) will preserve the user's Documents-folder TCC
grant.

## What this DOESN'T fix

- **Gatekeeper "unidentified developer" warning** on first install. Self-
  signed certs aren't trusted by Gatekeeper's notarization check. Users
  still right-click → Open the first time.
- **Already-installed v0.4.6 (ad-hoc).** TCC has already keyed the prompt
  to the ad-hoc identifier. The first signed release after this change
  will appear as a "new app" one more time (because the identifier
  changes from `yeogi_md_editor-<hash>` to `com.yeogi.mdeditor`). After
  that, all subsequent releases share the same identifier and TCC sticks.

## Debugging signing failures

If a release CI run fails at the `Build signed universal bundle` step:

1. Check the `Import Apple signing identity` step's output. The final
   `security find-identity -p codesigning -v` line should list
   `"Yeogi Dev Cert"` and `1 valid identities found`. If it lists zero
   identities, the import step failed — usually a wrong password or a
   corrupted base64 secret.
2. `release-build.sh` errors out with `APPLE_SIGNING_IDENTITY=... was set
   but the identity isn't in any visible keychain.` — that's the script
   refusing to fall back to ad-hoc. Same root cause as #1.
3. The workflow uses `RUNNER_TEMP` for the keychain path; that gets
   wiped at job-end automatically. There's no cleanup step needed.

## Cert expiry

The self-signed cert from `pnpm release:apple-keygen` is valid for
**3650 days (10 years)**. If you ever rotate to a shorter-lived cert,
add a calendar reminder for renewal — codesign will start failing
silently in CI before the old cert hits the actual expiry date.
