#!/usr/bin/env bash
# Builds the signed universal .app + .dmg + updater payload.
#
# If the "Yeogi Dev Cert" identity exists in the login keychain, codesigning
# uses it (stable sig → TCC grants persist across updates). If not, falls
# back to Tauri's ad-hoc signing with a visible warning so the dev knows
# what they're getting.

set -euo pipefail

DEFAULT_IDENTITY="Yeogi Dev Cert"
APPLE_SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-$DEFAULT_IDENTITY}"

if security find-identity -p codesigning -v 2>/dev/null \
    | grep -q -F "$APPLE_SIGNING_IDENTITY"; then
  export APPLE_SIGNING_IDENTITY
  echo "Signing with identity: $APPLE_SIGNING_IDENTITY"
else
  echo "WARN: '$APPLE_SIGNING_IDENTITY' not in keychain — falling back to ad-hoc."
  echo "      Run 'pnpm release:apple-keygen' to create the stable dev cert."
  unset APPLE_SIGNING_IDENTITY
fi

exec pnpm tauri build --target universal-apple-darwin
