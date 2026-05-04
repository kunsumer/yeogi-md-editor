#!/usr/bin/env bash
# Builds the signed universal .app + .dmg + updater payload.
#
# If the "Yeogi Dev Cert" identity exists in the login keychain, codesigning
# uses it (stable sig → TCC grants persist across updates). If not, falls
# back to Tauri's ad-hoc signing with a visible warning so the dev knows
# what they're getting.

set -euo pipefail

DEFAULT_IDENTITY="Yeogi Dev Cert"
EXPLICIT_IDENTITY=${APPLE_SIGNING_IDENTITY+1}
APPLE_SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-$DEFAULT_IDENTITY}"

if [ -n "${EXPLICIT_IDENTITY:-}" ]; then
  # Caller explicitly set the identity (CI). Trust them — `codesign`
  # is the source of truth for whether the identity is usable, and
  # it produces an actionable error message on failure. We deliberately
  # don't `find-identity` here because its results are inconsistent
  # across macOS versions for self-signed identities (the GitHub
  # runner's macOS 15 reports 0 valid identities for an imported .p12
  # that find-certificate clearly sees in the same keychain — a
  # cert/key pairing visibility quirk we can't fix from this side).
  export APPLE_SIGNING_IDENTITY
  echo "Signing with explicitly-requested identity: $APPLE_SIGNING_IDENTITY"
elif security find-identity -p codesigning -v 2>/dev/null \
    | grep -q -F "$APPLE_SIGNING_IDENTITY"; then
  # Local developer build with the cert installed via
  # pnpm release:apple-keygen — keychain has full trust + linkage so
  # find-identity is reliable here.
  export APPLE_SIGNING_IDENTITY
  echo "Signing with identity: $APPLE_SIGNING_IDENTITY"
else
  echo "WARN: '$APPLE_SIGNING_IDENTITY' not in keychain — falling back to ad-hoc."
  echo "      Run 'pnpm release:apple-keygen' to create the stable dev cert."
  unset APPLE_SIGNING_IDENTITY
fi

exec pnpm tauri build --target universal-apple-darwin
