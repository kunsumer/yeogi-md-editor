# Markdown Editor — macOS

A focused Claude Code scaffold for building a small, reliable **macOS desktop application to read and edit `.md` files**.

Stack is intentionally undecided at this level of the scaffold. The operating contract, rules, agents, commands, hooks, and spec layout apply whether you build with:
- Swift / SwiftUI (native)
- Tauri (Rust + webview)
- Electron (Node + webview)

## First setup
1. Fill in `docs/claude-code/PROJECT_PROFILE.md` once a stack is chosen.
2. Replace the placeholder CI with real install / lint / typecheck / test / build steps for that stack.
3. Add the first spec under `docs/claude-code/specs/<feature>/` using `_template/` and point `specs/_active.md` at it.
4. Run `/plan-ui-change` before coding anything user-visible.

## Releasing — Yeogi .MD Editor (macOS)

The app auto-updates via Tauri's own signature-verified channel. First time only:

```bash
pnpm release:keygen          # generates ~/.tauri/yeogi-update.key; prints public key
#   → paste the public key into src-tauri/tauri.conf.json → plugins.updater.pubkey
#   → replace YOUR_OWNER/YOUR_REPO in the endpoint with your GitHub slug
```

For every release:

```bash
pnpm release:steps           # prints the version-bump + signing + upload checklist
pnpm release:build           # produces a universal (arm64 + Intel) .dmg + .app.tar.gz + .sig
```

Full walkthrough, manifest template, and troubleshooting: [`docs/releasing.md`](docs/releasing.md).

Signing env vars (export before `release:build`):
- `TAURI_SIGNING_PRIVATE_KEY` — `$(cat ~/.tauri/yeogi-update.key)`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the passphrase you chose in `release:keygen`
