#!/usr/bin/env bash
# Builds the signed universal .app + .dmg + updater payload.
#
# If the "Yeogi Dev Cert" identity exists in the login keychain, codesigning
# uses it (stable sig → TCC grants persist across updates). If not, falls
# back to Tauri's ad-hoc signing with a visible warning so the dev knows
# what they're getting.

set -euo pipefail

DEFAULT_IDENTITY="Yeogi Dev Cert"
# When the caller explicitly passed APPLE_SIGNING_IDENTITY (CI does this
# after importing the cert into a fresh keychain), missing it must be
# fatal — silently falling back to ad-hoc would regress the TCC-grant
# stability the import-keychain dance just paid for. When the env var
# was unset, defaulting to "Yeogi Dev Cert" with a soft fallback to
# ad-hoc is the right shape for a developer's local build.
EXPLICIT_IDENTITY=${APPLE_SIGNING_IDENTITY+1}
APPLE_SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-$DEFAULT_IDENTITY}"

if security find-identity -p codesigning -v 2>/dev/null \
    | grep -q -F "$APPLE_SIGNING_IDENTITY"; then
  export APPLE_SIGNING_IDENTITY
  echo "Signing with identity: $APPLE_SIGNING_IDENTITY"
elif [ -n "${EXPLICIT_IDENTITY:-}" ]; then
  echo "ERROR: APPLE_SIGNING_IDENTITY='$APPLE_SIGNING_IDENTITY' was set" >&2
  echo "       but the identity isn't in any visible keychain. Refusing" >&2
  echo "       to silently fall back to ad-hoc when an explicit identity" >&2
  echo "       was requested." >&2
  exit 1
else
  echo "WARN: '$APPLE_SIGNING_IDENTITY' not in keychain — falling back to ad-hoc."
  echo "      Run 'pnpm release:apple-keygen' to create the stable dev cert."
  unset APPLE_SIGNING_IDENTITY
fi

exec pnpm tauri build --target universal-apple-darwin
