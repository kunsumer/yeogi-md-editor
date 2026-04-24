use tauri::menu::{
    CheckMenuItemBuilder, Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder,
};
use tauri::{AppHandle, Runtime};

/// An entry in the File → Open Recent submenu. `path` is the absolute path we
/// hand back to the frontend as part of the menu event id. `display` is the
/// basename shown to the user.
pub struct RecentFile {
    pub path: String,
    pub display: String,
}

/// Which radio in the View → Appearance submenu should carry the check mark.
/// "system" / "light" / "dark". Kept as a &str to avoid an enum round-trip —
/// the frontend's preference is already the source of truth.
pub type ThemeMode<'a> = &'a str;

/// Build the native menu for the main window. Mirrors Meva's layout plus a
/// "+" accelerator for Zoom In that Meva is missing.
///
/// `recent_files` drives the File → Open Recent submenu. When empty, the
/// entry is shown as a disabled item. When non-empty, it becomes a submenu
/// of one item per file plus a trailing "Clear Menu".
///
/// `theme` sets which of "Follow System / Light / Dark" carries the
/// checkmark in View → Appearance.
pub fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    recent_files: &[RecentFile],
    theme: ThemeMode<'_>,
) -> tauri::Result<Menu<R>> {
    let app_name = "Yeogi .MD Editor";

    // App submenu (macOS puts this first; other platforms ignore or merge).
    let app_menu = SubmenuBuilder::new(app, app_name)
        .item(&PredefinedMenuItem::about(app, None, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    // Build "Open Recent" — submenu when we have entries, plain disabled
    // menu item when we don't.
    let mut open_recent_builder = SubmenuBuilder::new(app, "Open Recent");
    if recent_files.is_empty() {
        // Ensures the submenu is still created but displays a single
        // disabled placeholder so users see why it's grayed out.
        open_recent_builder = open_recent_builder.item(
            &MenuItemBuilder::with_id("file:recent:placeholder", "(No recent files)")
                .enabled(false)
                .build(app)?,
        );
    } else {
        for rf in recent_files {
            open_recent_builder = open_recent_builder.item(
                &MenuItemBuilder::with_id(
                    format!("file:recent:{}", rf.path),
                    rf.display.clone(),
                )
                .build(app)?,
            );
        }
        open_recent_builder = open_recent_builder
            .separator()
            .item(&MenuItemBuilder::with_id("file:recent-clear", "Clear Menu").build(app)?);
    }
    let open_recent = open_recent_builder.build()?;

    let file = SubmenuBuilder::new(app, "File")
        .item(
            &MenuItemBuilder::with_id("file:open", "Open…")
                .accelerator("CmdOrCtrl+O")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("file:open-folder", "Open Folder…")
                .accelerator("Alt+CmdOrCtrl+O")
                .build(app)?,
        )
        .item(&open_recent)
        .separator()
        .item(
            &MenuItemBuilder::with_id("file:save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("file:save-as", "Save As…")
                .accelerator("Shift+CmdOrCtrl+S")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("file:export-html", "Export to HTML…")
                .accelerator("Shift+CmdOrCtrl+E")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("file:print", "Print / Export to PDF…")
                .accelerator("CmdOrCtrl+P")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("file:close-tab", "Close Tab")
                .accelerator("CmdOrCtrl+W")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("file:close-folder", "Close Folder")
                .build(app)?,
        )
        .build()?;

    let edit = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("edit:find", "Find…")
                .accelerator("CmdOrCtrl+F")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("edit:find-replace", "Find and Replace…")
                .accelerator("Alt+CmdOrCtrl+F")
                .build(app)?,
        )
        .build()?;

    let view = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id("view:toggle-folder-panel", "Toggle Folder Panel")
                .accelerator("Alt+CmdOrCtrl+1")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view:toggle-toc-panel", "Outline")
                .accelerator("Alt+CmdOrCtrl+2")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view:hide-all-sidebars", "Hide Both Sidebars")
                .accelerator("CmdOrCtrl+Backslash")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("view:toggle-edit-mode", "Toggle Edit / WYSIWYG")
                .accelerator("CmdOrCtrl+E")
                .build(app)?,
        )
        .separator()
        .item(&{
            // Appearance submenu: Follow System + grouped light/dark themes.
            // Each named theme's id becomes part of the menu event id
            // (`view:theme:<id>`), which App.tsx routes straight into
            // usePreferences.setTheme. Check marks follow `theme` so the
            // submenu rebuild on pref change shows the new selection.
            let mut b = SubmenuBuilder::new(app, "Appearance");
            b = b.item(
                &CheckMenuItemBuilder::with_id("view:theme:system", "Follow System")
                    .checked(theme == "system")
                    .build(app)?,
            );
            b = b.separator();
            // LIGHT group. Order mirrors THEME_GROUPS in src/lib/themes.ts.
            for (id, label) in &[
                ("light", "Light"),
                ("atom-one-light", "Atom One Light"),
                ("solarized-light", "Solarized Light"),
                ("ayu-light", "Ayu Light"),
                ("alabaster", "Alabaster"),
            ] {
                b = b.item(
                    &CheckMenuItemBuilder::with_id(format!("view:theme:{}", id), *label)
                        .checked(theme == *id)
                        .build(app)?,
                );
            }
            b = b.separator();
            // DARK group.
            for (id, label) in &[("dark", "Dark"), ("dracula", "Dracula")] {
                b = b.item(
                    &CheckMenuItemBuilder::with_id(format!("view:theme:{}", id), *label)
                        .checked(theme == *id)
                        .build(app)?,
                );
            }
            b.build()?
        })
        .separator()
        .item(
            &MenuItemBuilder::with_id("view:zoom-in", "Zoom In")
                .accelerator("CmdOrCtrl+=")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view:zoom-out", "Zoom Out")
                .accelerator("CmdOrCtrl+-")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view:zoom-reset", "Reset Zoom")
                .accelerator("CmdOrCtrl+0")
                .build(app)?,
        )
        .build()?;

    let window = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let help = SubmenuBuilder::new(app, "Help")
        .item(
            &MenuItemBuilder::with_id("help:show-tutorial", "Show Tutorial")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("help:check-for-updates", "Check for Updates…")
                .build(app)?,
        )
        .build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file, &edit, &view, &window, &help])
        .build()
}
