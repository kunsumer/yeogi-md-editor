# Welcome to Evhan .MD Editor

## How We Use Claude

Based on usage over the last 30 days (1 session — a long, multi-phase implementation run of the Tauri markdown editor you're about to install):

Work Type Breakdown:
  Build Feature     ████████████░░░░░░░░  50%
  Debug Fix         █████░░░░░░░░░░░░░░░  25%
  Plan Design       ██░░░░░░░░░░░░░░░░░░  10%
  Improve Quality   ██░░░░░░░░░░░░░░░░░░  10%
  Write Docs        █░░░░░░░░░░░░░░░░░░░   5%

Top Skills & Commands:
  _None — all work was in open prompts, driven by the spec/status files in `docs/claude-code/specs/`._

Top MCP Servers:
  _None in use._

## Your Setup Checklist

### Codebases
- [ ] evhan-md-editor — macOS Markdown editor (Tauri 2 + React 18 + TypeScript). Local path: `/Users/peter/Documents/evhan-md-editor`

### MCP Servers to Activate
_None — skip this section._

### Skills to Know About
_None captured — see Team Tips below for the spec-driven workflow we actually use._

## Team Tips

- **Spec-driven workflow.** Everything this repo builds is described in `docs/claude-code/specs/2026-04-21-markdown-editor/`:
  - `PLAN.md` — the full phase-by-phase implementation plan
  - `STATUS.md` — where we are now; always reads "Phase X complete, resume at Phase Y" at the top
  - `SPEC.md` — the product spec
  The idiom to resume work is: "Resume the implementation plan at docs/claude-code/specs/2026-04-21-markdown-editor/PLAN.md. Read STATUS.md in that same folder first. We're at Phase N."

- **CLAUDE.md owns the operating contract.** Read it before you touch anything — it covers the non-negotiables (never lose user edits, accessibility is correctness, explicit UX states), the verification contract, and the mandatory read order for any change.

- **Tests are the contract, not a checkbox.** `pnpm test` for TypeScript, `cargo test --manifest-path src-tauri/Cargo.toml` for Rust. `pnpm lint` is `tsc --noEmit`. Don't claim a phase is done without all three green.

- **Dev loop rhythm.** Frontend changes hot-reload through Vite. Rust-side changes (new commands, capability tweaks, `tauri.conf.json`) need a full `⌃C` + `pnpm tauri dev` restart. Port 1420 getting stuck is the usual first hiccup — `lsof -ti :1420 | xargs kill` frees it.

- **WKWebView console quirk.** The embedded Safari Web Inspector (Tauri's DevTools on macOS) does NOT allow top-level `await`. Wrap diagnostic snippets in an async IIFE or a `.then(...)` chain.

## Get Started

**Install the app:**

1. Clone the repo and install deps:
   ```bash
   git clone <repo-url> evhan-md-editor
   cd evhan-md-editor
   pnpm install
   ```

2. Build a signed-for-dev `.dmg`:
   ```bash
   pnpm tauri build
   ```
   Output lands at `src-tauri/target/release/bundle/dmg/Evhan .MD Editor_0.1.0_aarch64.dmg` (the filename varies by version / arch).

3. Double-click the `.dmg`, drag **Evhan .MD Editor** into Applications, and launch it from there. The first launch seeds a `Welcome.md` into `~/Documents/Evhan .MD Editor/` and opens it for you — it's a tour of everything the editor supports (headings, tables, GFM, Mermaid, KaTeX, fenced code, etc.). Edit it freely; your changes persist to disk just like any other file.

4. To work on the app itself instead of using it, run `pnpm tauri dev` from the repo root.

**First ticket:** work through `docs/claude-code/specs/2026-04-21-markdown-editor/PLAN.md` starting from the phase `STATUS.md` says is next. Each phase has tests and a checkpoint; don't skip the verification.

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome. Then: "Your teammate uses Claude Code for Build
Feature, Debug Fix, Plan Design, Improve Quality, and Write Docs work. Let's
get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
