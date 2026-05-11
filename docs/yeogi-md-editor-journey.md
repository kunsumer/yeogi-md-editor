# I Built a Notarized macOS App in Three Weeks With AI-Assisted Coding. Here's the Honest Version.

*35 releases, 214 commits, seven Apple-signing attempts, and one Markdown editor I actually use.*

---

> [Hero screenshot]
> Yeogi .MD Editor open with a real document — left pane in WYSIWYG mode (rendered headings, a table, a Mermaid flowchart), right pane in source mode showing the same content. Folder explorer with multiple roots open on the far left. Caption: *"Yeogi .MD Editor — what I write everything in now."*

## The gap I kept hitting

I write a lot of Markdown. Notes, specs, blog drafts, meeting recaps. For years I've been bouncing between editors and never settling, because each one missed at least one thing I cared about:

- **Obsidian** — beautiful folder vault, great wiki-links. But the live-preview is half-rendered: headings stay as `# Heading` until you click off the line, tables stay as pipe-separated source until you exit the cell. You're always one keystroke from looking at syntax.
- **Bear** — gorgeous, native, but no folder tree (tags only), no side-by-side, and Markdown is a stylistic choice rather than a first-class file format.
- **Typora** — the *actual* WYSIWYG-Markdown editor that works. But no folder explorer, no tabs, no side-by-side. One file at a time, very 2015.
- **VS Code + a Markdown extension** — pro tools for prose, but the rendered side is always a separate preview window. You spend the day reading source.
- **iA Writer** — beautiful typography, lousy at structured documents. No tables, no real folder UI.

What I actually wanted was a single editor that gave me **all** of:

1. A rendered view that's still editable — tables are tables, headings are heading-sized, code blocks are syntax-highlighted, but I can put my cursor in the middle of a paragraph and just type.
2. Side-by-side panes.
3. A real folder tree (not tags, not "recent files").
4. Multiple folders open at once.
5. Drag-and-drop tab reordering. It's 2026.
6. Search across everything.
7. Right-click context menus that do real work — Open in Finder, Open in Terminal, Rename, Duplicate, Delete with a proper confirmation.

None of that is exotic. Each individual feature exists somewhere. The mistake every existing tool makes is *picking three of seven*.

## The bet: build it, with an AI pair, in real life

The honest version of "I built a Markdown editor" is: **I worked with Claude (Anthropic's coding assistant) as a pair-programmer for three weeks, while also doing my day job.** I made every product decision and architecture call. Claude wrote most of the code, ran most of the commands, debugged most of the failures, and never got tired of doing the boring parts (typing tests, plumbing prop drilling, exporting cert chains).

I want to write about it honestly because the hype-vs-skepticism takes on AI coding are both wrong. AI didn't "build the app for me" — that framing is misleading and disrespectful to actual product work. But pretending the AI didn't dramatically change what was possible would be equally dishonest. Here's what actually happened.

## The numbers

| | |
|---|---|
| Calendar days from first commit to v0.4.14 (notarized, on the App Store-ish) | **21 days** |
| Public releases shipped (v0.2.0 → v0.4.14) | **35** |
| Total commits | **214** |
| Source files (TS / TSX / Rust) | **~140** |
| Lines of code (incl. CSS) | **~19,700** |
| Tests passing | **216** |
| Hours I spent on this per day, average | **~2** |

> [Timeline diagram — Mermaid, renders natively on Medium]
>
> ```mermaid
> gantt
>     title Three Weeks, Compressed Product Lifecycle
>     dateFormat YYYY-MM-DD
>     axisFormat %b %d
>     section v0.2 — first usable
>     Tauri scaffold + WYSIWYG    :2026-04-21, 1d
>     Folder explorer + tabs      :2026-04-22, 2d
>     Wiki-links + auto-updater   :2026-04-24, 1d
>     section v0.3 — daily-driver
>     Side-by-side panes          :2026-04-25, 1d
>     Dark mode + 9 themes        :2026-04-26, 1d
>     Round-trip cleanup          :2026-04-27, 1d
>     section v0.4 — polish + alpha
>     Multi-folder explorer       :2026-04-27, 1d
>     Drag-reorder tabs           :2026-04-28, 1d
>     Right-click menus + Delete  :2026-04-28, 1d
>     File→New, ChatGPT paste fix :2026-04-30, 2d
>     Mermaid LLM-output fixes    :2026-05-07, 1d
>     section signing saga
>     Self-signed CI (v0.4.8)     :2026-05-04, 1d
>     Apple Developer + notarize  :2026-05-11, 1d
> ```

## How the pair actually worked

> [Screenshot suggestion]
> A side-by-side: my notes / scratch document on the left (e.g. "Today: tab drag-and-drop is unreliable in WKWebView, need to swap to pointer events"), and the Yeogi editor on the right rendering it. Caption: *"My job: decide what was wrong. Claude's job: make the wrongness go away."*

A typical interaction loop, roughly:

1. **I notice something annoying.** "When I press ⌘F twice the search input doesn't re-focus on the second press."
2. **Claude reads the relevant code**, names the cause ("`setSearchOpen(true)` is a no-op when it's already true — no re-render, no focus"), proposes a fix (a focus-sequence counter that bumps on every press), and writes the patch.
3. **I review.** Sometimes I push back ("don't add a useEffect for that, the existing handler should just call focus directly"). Sometimes I ratify and move on.
4. **Claude runs the tests, commits, runs the next round.**

Multiply by a few hundred. The asymmetry was: **I was the product manager, the designer, and the architect. Claude was the engineer who could read 19,000 lines of code in a heartbeat and never resented being asked to find the source of a parse error.**

That asymmetry matters for what AI-assisted coding is actually good at. Tasks where the AI dominated:

- **Reading code I didn't write recently.** "Where does conflict-banner reload go?" Claude finds it in three seconds.
- **Boilerplate.** Test fixtures, type signatures, prop drilling through three components, IPC command registration in five files. Tedious work that I would procrastinate but Claude just does.
- **Debugging across abstraction layers.** Mermaid throws an `[object Object]` error in WYSIWYG mode — find out where Mermaid's parser produced it, why our error handler is stringifying poorly, and patch both. Claude can trace this in ten minutes; I'd take an hour.
- **Knowing the platform.** I don't sign macOS apps for a living. Claude knew `security export -t identities -f pkcs12 -P <password>`, `xcrun notarytool submit --apple-id ... --team-id ... --password ... --wait`, `xcrun stapler staple`, and how they fit together.

Tasks where I dominated:

- **Knowing what to build.** "Add drag-reorder tabs like Chrome" comes from a human. Claude wouldn't have suggested it.
- **Saying no.** "Don't add plugins. Don't add a graph visualization. Don't real-time-collab this." Discipline is product work.
- **Catching when the AI overdoes it.** Claude has a habit of writing too-elaborate error handling, too-defensive guards, too-elegant abstractions for what should be three lines. I had to push back: "That doesn't need a factory pattern. Just inline it."
- **Recognizing when the AI was confidently wrong.** This happened maybe 5% of the time. Claude would propose a fix that sounded right but missed something — e.g. it once tried to fix a Mermaid bug by adding more preprocessing when the real bug was that we were using `String(err)` to print errors. I caught it by asking "wait, do we know what the actual error message is?" before approving more preprocessor code.

## Week 1 — v0.2, the smallest version that earned a place on my dock

> [Screenshot suggestion]
> v0.2-era Yeogi: folder explorer on the left with one folder open, a single doc tab, the outline panel on the right, the WYSIWYG toolbar visible. Plain UI. Caption: *"v0.2 — small but honest. Folder explorer, outline, WYSIWYG editing, tabs."*

Tauri 2 + React 18 + Tiptap (WYSIWYG editor) + CodeMirror 6 (source mode) + Zustand (state). I shipped the smallest possible app first — open one file, render it, edit it, save it — then committed to using *only* Yeogi as my Markdown editor for one weekend. Most honest dogfooding test there is: if you can't use it, nobody else can.

I lasted about two hours before I needed something the v0.1 didn't have. That something turned out to be **side-by-side panes**, because I was writing notes about a doc and wanted both visible.

## Week 2 — v0.3, side-by-side and the moment I trusted it

> [Screenshot suggestion]
> Two panes, one in WYSIWYG mode rendering a complex doc (table + Mermaid + LaTeX), the other in source mode showing the same content. The user is in the middle of editing. Caption: *"⌘\\ to open the same doc in a second pane. ⌘E to toggle each pane independently between rendered and source."*

Side-by-side was the unlock. Two panes, each with its own toggle between rendered and source view. Suddenly I could write notes in pane 1 while referencing source in pane 2, or read in WYSIWYG while editing in CodeMirror — whichever flow my brain wanted.

Same release added dark mode (with nine themes that each pair a Shiki code-block theme matching the UI palette — most editors get this wrong and have a dark UI with a light syntax-highlighted code block, which looks like a glow stick on a black t-shirt). The auto-updater also landed in v0.3, which made everything else faster: from this point on, every push I made reached my alpha cohort within minutes.

## Week 3 — alpha cohort + the polish push

> [Screenshot suggestion]
> The auto-update banner: "Update available — v0.4.6 — Right-click file management + tab drag-reorder. [Install & Restart]". Caption: *"Tauri's signed updater meant my alpha cohort was on the latest build within minutes of every push."*

I gave the v0.3 build to a small group of teammates. Three things happened, in roughly this order:

1. **Bugs I'd never have found alone.** Someone pasted a table containing inline math (`$\LaTeX$`) into a doc. The serializer crashed on every keystroke. (`TypeError: No default value`, deep inside Tiptap.) Fixed in the next release. Real workflows expose edge cases synthetic testing doesn't.

2. **Features I hadn't thought of.** "Can I open more than one folder at once? I keep work and personal notes in different vaults." Hadn't considered it. Shipped multi-folder explorer with per-folder collapse the next day.

3. **Workflow asks I had to push back on.** "Can you add a Daily Notes plugin like Obsidian?" No. The whole point is to keep the surface small. Plugins fork the product into a thousand half-supported features. v1 doesn't do plugins. (Saying no is product work. Claude wouldn't have said no by itself.)

> [Screenshot suggestion]
> A 2×2 grid of polish features. Top-left: drag-reorder tabs mid-motion, one tab translucent and tilted. Top-right: file-tree right-click menu showing New File / New Folder / Open in Finder / Open in Terminal / Rename / Duplicate / Delete. Bottom-left: Delete confirmation dialog reading *"This will permanently delete `notes` and the 27 items inside it. This cannot be undone."* Bottom-right: dark-mode rendering of a Mermaid quadrantChart with the auto-quote fix making `KR->JP pilot` work. Caption: *"v0.4 polish — each one of these was one or two paired sessions."*

## Stories from the trenches

These are the ones worth telling — moments where the collaboration was the story.

### The Mermaid LLM-output saga

If you paste Mermaid diagrams generated by an LLM (ChatGPT, Claude, anything) into a Markdown editor, **most of them won't render**. LLMs almost always produce diagrams with at least one of:

- Unquoted multi-word labels that contain `->` or hyphens (Mermaid's quadrantChart lexer chokes)
- `{job_id}` inside a flowchart rectangle label (Mermaid reads `{` as a rhombus shape opener)
- `;<br/>` as a phrase separator (Mermaid reads `;` as a statement terminator, splits your transition into ghost nodes)
- Self-closing `<br/>` in a `Note over` (some Mermaid versions trip on the slash)
- A standalone `;` inside a note body (same root cause)

I hit each of these in turn while writing a real architecture doc. Across about four releases (v0.4.10 – v0.4.12) Claude and I built up a **render-only preprocessor** that auto-fixes each pattern: quotes the labels, drops the semicolons, normalizes the line breaks. The user's saved Markdown is untouched — the fixes happen on the way to Mermaid only. Source-mode (⌘E) shows what they wrote.

The collaboration shape: I'd paste a broken diagram, see Mermaid's parse error, and ask "fix it." Claude would diagnose the specific grammar quirk, write a regex-based preprocessor, add tests for the failing input, ship a release. Then I'd find the next pattern and we'd iterate. **Six diagram types, four release cycles, twenty-five tests for the preprocessor specifically.** All the iterations are visible in the git history.

A thing the AI did well: when I sent a screenshot with `[object Object]` as the error, Claude didn't just propose a preprocessor — it noticed that the error display was *also* broken (`String(err)` on a Jison parser object produces literal `[object Object]`) and fixed both the message and the underlying parse issue in the same session.

### The Apple signing saga — 7 attempts to ship one release

This was the most painful sequence. I'd been signing releases with a self-signed cert ("Yeogi Dev Cert") since v0.4.8 to keep TCC happy — but Gatekeeper still demanded right-click → Open on first install. I wanted Apple Developer ID signing + notarization.

The plan looked simple: enroll in Apple Developer ($99), export the cert, push it to GitHub Secrets, update the workflow. Seven attempts later I had a notarized release. Each attempt failed in a *different* way:

1. **Trust step missing** — find-identity reported 0 valid identities because self-signed certs need explicit `add-trusted-cert` on the runner's keychain.
2. **openssl `-legacy` flag missing on LibreSSL** — the GitHub runner uses LibreSSL, not OpenSSL 3; the cert extraction script we used locally didn't work on CI.
3. **add-trusted-cert hung on a UI prompt** — turns out macOS shows a "do you want to trust this?" dialog when modifying trust settings. Headless runner. No dialog answerer. Job timed out after 6 minutes.
4. **Switched to apple-actions/import-codesign-certs@v3** — community action that handles all this correctly. Now `find-identity -v` reported 0 valid identities even on the explicit keychain, *even though* `find-certificate -p` could see the cert. Apparently a macOS-version-specific cert/key-pairing visibility quirk.
5. **Relaxed `release-build.sh`'s sanity check** — let codesign be the source of truth. Build succeeded! Then notarization timed out (Apple's queue was slow, our 30-min job timeout fired).
6. **Bumped job timeout to 75 min.** Notarization ran for 24 min, then the runner lost DNS to `appstoreconnect.apple.com` mid-poll. `NSURLErrorDomain Code=-1009 "The Internet connection appears to be offline."`
7. **Re-ran on a fresh runner.** Worked. 8 minutes end-to-end.

What the AI handled: every diagnostic step. "Here's the failure log. What does it mean? Here's the next fix." I provided judgment on when to give up on an approach (e.g. "stop trying to make add-trusted-cert work, try the action") and when to wait it out (the Apple queue blip). Without the AI I would have spent days on this; with it I spent a few hours total across two evenings.

What the AI did *not* handle: deciding it was worth $99 to fix. That's a product call.

### The "Reload from disk doesn't reload the page" thing

> [Screenshot suggestion]
> The tab right-click menu showing "Open to the Right Side" and "Reload from disk". Caption: *"Sounds simple. Took two releases to get right."*

I added a per-document "Reload from disk" right-click action. It worked: the file was re-read, the content was replaced. Except when the on-disk content was already byte-identical to what was rendered (the common case for non-dirty docs), it visually did nothing. Users — me — would click Reload and see no change and think it was broken.

I asked Claude to fix it. The initial pass was a more aggressive content sync. Didn't help. Then it added a `reloadEpoch` counter on each Document, bumped only by the explicit user "Reload from disk" right-click — not by the watcher's silent reload. The WYSIWYG editor's React key is `${doc.id}-${reloadEpoch}`, so every click force-remounts the editor, which remounts every NodeView (Mermaid, math, etc.), which re-runs all the preprocessing. Now Reload actually reloads.

The detail I want to highlight: **the AI distinguished between "watcher reload" (don't disturb cursor + undo history) and "user-initiated reload" (the user is explicitly signaling they want a fresh render).** Without that distinction, every external file change would have wiped the cursor position. That's the kind of design judgment I'd have wanted from a senior engineer pair, and got from this one too.

## What I'd do differently

A few honest notes:

- **Set up CI on day one.** I didn't wire up GitHub Actions until v0.4.3. Until then every release was a manual `pnpm release:build` ceremony.
- **Don't optimize what isn't slow.** I spent time on the markdown pipeline's bundle split before knowing whether the bundle size mattered. It did, eventually, but I should have measured before refactoring.
- **The AI is too patient.** Claude will rewrite a function five times when the right answer is "leave it alone." I had to learn to say "good enough, move on" more aggressively. Especially on tests — Claude wants to write comprehensive coverage; I sometimes wanted *less* coverage so the test suite stayed fast.
- **Pair on architecture; solo on judgment.** The big decisions (no plugins, no graph, no real-time collab) needed me alone. The implementation of those decisions was the pair-coding work. Confusing the two is where AI-assisted projects go sideways.

## What's next

> [Screenshot suggestion]
> A roadmap-style sketch (hand-drawn or a clean bullet list rendered as an image). Caption: *"What's actually planned vs. what I'll resist adding."*

The features I think v1.0 needs:

- **Full-text search across all open folders** (currently only filename search).
- **A proper backlinks panel** (there's a lightweight one; needs to be more useful).
- **Better large-file handling** — past about 50 KB the WYSIWYG editor gets noticeably laggy on syntax-highlighting-heavy content.

Features I'm explicitly *not* adding:

- Plugins. Ever.
- A note-graph visualization. Pretty, never used after day one.
- Real-time collaboration. Different product.
- LLM integration baked into the editor. The whole point is that the surface is small.

## Takeaways

If I had to pull out three things that made three weeks work where a properly-scoped quarter would have failed:

1. **Ship small, ship often, ship real.** 35 releases in three weeks. Each one was a real release — version-bumped, tagged, code-signed, notarized, distributed via auto-updater. Not "v0.1 the prototype" — v0.1 the real thing, just small.

2. **Eat your own cooking from day one.** The moment I committed to using Yeogi as my only Markdown editor, the priority list wrote itself. Every annoying gap got promoted to "next release" within an hour.

3. **The AI does the unglamorous work; you do the judgment work.** Tests, plumbing, debugging, platform plumbing — let the AI take it. Product decisions, scope discipline, "this is good enough" — those have to be human. Mixing the two up is where AI-assisted projects either produce slop (too much AI in the wrong places) or stall (too little AI in the right places).

Yeogi .MD Editor is open source. If you've been bouncing between Markdown editors looking for the one that does all seven of those things at once: try it. And if you're thinking about whether AI-assisted coding is "real" — it is, but probably not in the way the hype or the skepticism would have you believe.

---

*Yeogi .MD Editor is a macOS Markdown editor. Currently v0.4.14: signed with Apple Developer ID, notarized, auto-updating. Built with Tauri 2, React 18, Tiptap, CodeMirror 6, and a lot of conversations with Claude.*

*[Repo link] · [Latest release] · [Download]*
