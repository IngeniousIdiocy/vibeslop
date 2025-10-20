# Architecture Blueprint

## Single-File Layout
```
<!doctype html>
<html>
  <head>
    <!-- Metadata -->
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Win95Sim</title>

    <!-- Fonts -->
    <style id="font-embeds">…</style>

    <!-- CSS Layers -->
    <style id="win95-core-css">…</style>
    <style id="win95-themes-css">…</style>
    <style id="win95-app-css">…</style>

    <!-- SVG sprite -->
    <svg id="icon-sprite" hidden>…</svg>

    <!-- HTML templates -->
    <template id="tpl-window">…</template>
    <template id="tpl-menu">…</template>
    <template id="tpl-dialog">…</template>
    <!-- Additional templates for list/tree rows, taskbar items, etc. -->

    <!-- Boot splash styles -->
    <style id="boot-css">…</style>
  </head>
  <body>
    <div id="monitor">
      <div id="crt">
        <div id="desktop-root"></div>
      </div>
    </div>

    <!-- Sound manifest -->
    <script id="sound-manifest" type="application/json">{…}</script>

    <!-- Third-party libs -->
    <script id="lib-dompurify">…</script>
    <script id="lib-jspdf">…</script>
    <script id="lib-fflate">…</script> <!-- optional -->

    <!-- Module loader + modules -->
    <script id="sfm">…</script>
    <script id="modules">…</script>

    <!-- Bootstrapping -->
    <script id="boot">…</script>
  </body>
</html>
```

All assets, code, and templates are embedded inline. Build tooling may generate the final file, but the runtime assumes this structure.

## Layered System
1. **Kernel** – Event bus, ID factory, time source.
2. **Core Services** – Settings, Display, VFS, Window Manager, UI Toolkit, Process Manager, Clipboard, Sound, Print, Security.
3. **Utilities** – Path, MIME, icon mapping, drag/drop, keyboard, bitmap, virtualization helpers.
4. **Shell** – Desktop, Taskbar, Start menu, window chrome, dialogs.
5. **Applications** – Explorer, Notepad, Navigator, Paint, Calculator, Minesweeper, Media Player, Command Prompt, Control Panel, Utilities.
6. **Assets & Themes** – Icon sprites, fonts, wallpapers, sound schemes, CRT effects.

Each layer depends only on lower layers. Services expose locked APIs (see `module-apis-v1.md`). Applications consume services via the `AppContext` object.

### Implemented to date (Phase 1–2)

- **Kernel / Settings / Display / Window Manager** – Provide the desktop viewport, scaling controls, window chrome (move/resize/min/max), system menu, and in-sim Alt+` task switcher.
- **Virtual File System (`svc/vfs`)** – In-memory drive tree (A:, C:, D:, N:), special folder aliases, shortcut/link nodes, search, move/copy semantics, and watcher notifications (`fs:create`, `fs:update`, `fs:delete`, `fs:move`).
- **Explorer (`app/explorer`)** – Uses the window service directly to render a sidebar tree (Desktop, Documents, drives) and a list view with live refresh, new folder/text document actions, delete, keyboard navigation, and parent traversal.
- **Boot Flow Enhancements** – Seeds sample documents under `C:\Documents` and `C:\Desktop\Projects`, then launches Explorer pointed at the desktop after services initialize.

## Boot Flow
1. Display boot splash while scripts parse.
2. Load SFM, register third-party libraries as modules.
3. Initialize core services in dependency order.
4. Mount shell (desktop, taskbar, start).
5. Register applications with `svc/process`.
6. Seed VFS with default structure, sample files, printers, wallpapers.
   - *Phase 2*: Boot seeding writes `Welcome.txt` in Documents and a `todo.txt` inside `Desktop\Projects`, then opens Explorer.
7. Play startup sound after user gesture and reveal desktop.

## Runtime Interaction
- Shell components react to service events (`fs:*`, `win:*`, `proc:*`, `display:*`).
- Applications obtain window instances through `svc/window.create()` and use UI toolkit for chrome, menus, dialogs.
- VFS operations trigger watchers so Explorer, desktop, and app UIs stay in sync.
- Process Manager tracks window-task mappings for Alt+Tab, taskbar buttons, recent documents.
- Display service manages resolution/scaling; `svc/settings` persists toggles during the session.
- Print service queues jobs and stores outputs within the VFS spool folder.
- Security service sanitizes external HTML and sandboxes iframes.

## Deployment Considerations
- The final HTML file can be served statically from any host (GitHub Pages, S3, etc.).
- No server-side code required.
- CI ensures minified build matches the architectural template and bundles licenses in an About dialog.

## Future Extensibility
- Additional apps can be registered by defining new modules and calling `svc/process.register` without altering core layers.
- Optional persistence (localStorage) can hook into `svc/settings` and `svc/vfs` without breaking existing APIs.
- Theme packs can extend the token set by appending CSS to `win95-themes-css`.
