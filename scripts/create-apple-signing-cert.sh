#!/usr/bin/env bash
# Creates a stable self-signed macOS code-signing certificate named
# "Yeogi Dev Cert" and imports it into the login keychain with code-signing
# trust. Idempotent — rerunning first deletes any existing copy.
#
# Why: an ad-hoc-signed .app gets a fresh per-build "Identifier" from
# codesign, so macOS TCC treats each new build (or each auto-update) as a
# *different* app and re-asks for Documents-folder access. Signing with a
# stable local identity fixes that: same identity across builds, TCC grant
# persists across updates.
#
# This doesn't get rid of the "unidentified developer" Gatekeeper warning
# on first install — that needs an Apple Developer ID cert, which costs
# $99/year. End users still right-click → Open once per install.
#
# Requires: openssl, security (ships with macOS).

set -euo pipefail

NAME="Yeogi Dev Cert"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"
WORKDIR="$(mktemp -d -t yeogi-signing)"
TEMP_PASSWORD="temp-import-only"

echo "Creating self-signed code-signing cert in $WORKDIR"

# 1. Private key
openssl genrsa -out "$WORKDIR/yeogi.key" 2048 2>/dev/null

# 2. Self-signed cert with the two extensions codesign requires:
#    - Key Usage: Digital Signature (marked critical)
#    - Extended Key Usage: Code Signing (marked critical)
#    - Basic Constraints: CA:FALSE (critical)
openssl req -new -x509 -days 3650 \
  -key "$WORKDIR/yeogi.key" \
  -out "$WORKDIR/yeogi.crt" \
  -subj "/CN=$NAME/O=Yeogi/C=US" \
  -addext "keyUsage=critical,digitalSignature" \
  -addext "extendedKeyUsage=critical,codeSigning" \
  -addext "basicConstraints=critical,CA:FALSE" 2>/dev/null

# 3. Pack key + cert into a PKCS12 bundle using legacy encryption macOS
# understands (its security CLI chokes on modern PBE2 defaults).
openssl pkcs12 -export -legacy \
  -out "$WORKDIR/yeogi.p12" \
  -inkey "$WORKDIR/yeogi.key" \
  -in "$WORKDIR/yeogi.crt" \
  -name "$NAME" \
  -passout "pass:$TEMP_PASSWORD" \
  -macalg sha1 \
  -keypbe PBE-SHA1-3DES \
  -certpbe PBE-SHA1-3DES 2>/dev/null

# 4. Delete any existing copy so the import is idempotent.
security delete-certificate -c "$NAME" "$KEYCHAIN" 2>/dev/null || true

# 5. Import. `-A` grants all tools access to the private key (no approval
# popup on each codesign invocation).
security import "$WORKDIR/yeogi.p12" \
  -k "$KEYCHAIN" \
  -P "$TEMP_PASSWORD" \
  -A \
  -t agg

# 6. Trust the cert for code signing. Without this the identity shows up
# in keychain-land but codesign rejects it with "Invalid Key Usage for
# policy".
security add-trusted-cert -p codeSign -k "$KEYCHAIN" "$WORKDIR/yeogi.crt"

# 7. Clean up on-disk key material — it lives in the keychain now.
rm -rf "$WORKDIR"

echo ""
echo "Verifying…"
security find-identity -p codesigning -v | grep "$NAME" || {
  echo "FAIL: identity was not imported as valid. Check the keychain manually."
  exit 1
}

echo ""
echo "Done. Future 'pnpm release:build' runs will sign with '$NAME'."
echo "End users will still see the 'unidentified developer' Gatekeeper"
echo "warning on their first install, but subsequent updates won't reset"
echo "TCC (Documents-folder) grants anymore."
