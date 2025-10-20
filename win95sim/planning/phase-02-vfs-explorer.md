# Phase 2 – Virtual File System & Explorer

## Objectives
- Deliver fully functional in-memory VFS with drives, recycle bin, shortcuts, search, import/export stubs.
- Build Explorer shell with tree/list/details views, context menus, properties dialog, New menu, drag/drop semantics, Find window.
- Integrate VFS with desktop icons and window manager from Phase 1.

## Deliverables
1. `svc/vfs` implementation matching locked API, including special folders and watcher system.
2. Path, MIME, icon utilities providing associations for Explorer.
3. Explorer app registered with `svc/process`, featuring navigation pane, list view virtualization, multi-select, sorting, properties dialogs.
4. Recycle bin semantics: delete to bin, restore, empty.
5. File import/export hooks (input type="file", download) with placeholder UI for later improvements.

### Status – 2024-Phase2 Drop
- ✅ `svc/vfs` core (drives, special folders, shortcuts, search, move/copy/remove, watchers) implemented alongside supporting `util/path` helpers.
- ✅ Explorer window launched from boot with sidebar tree, list view, new folder/text document, delete, parent navigation, live refresh.
- ✅ Node-based unit coverage added in `tests/phase2.test.js` for path normalization, file CRUD, move/copy, watchers, and search.
- ⚠️ Remaining work: recycle bin UX, icon registry/file type presentation, context menus, drag/drop modifiers, properties dialog, import/export UI, process registration, integration/visual tests.

## Engineering Tasks
- Implement tree data structure with metadata store and binary/blob handling for files.
- Implement watchers broadcasting changes to Explorer/desktop.
- Implement search indexing with wildcard support and text content scanning.
- Create Explorer UI components: tree view, list view (icons/list/details), preview/status bar, toolbar/menus.
- Implement drag/drop between tree/list/desktop with modifier keys for move/copy/shortcut.
- Implement file dialogs using UI toolkit for New/Rename/Delete/Properties flows.
- Integrate Recycle Bin UI with confirm/restore/empty actions.

## Testing
- **Unit**: VFS path normalization, mkdir/write/read/move/copy/remove, shortcut resolution, recycle bin metadata, search filters. *(Initial subset implemented via `tests/phase2.test.js` covering normalization, CRUD, watchers, search.)*
- **Integration**: Playwright scenario creating nested folders, renaming, dragging between panes, deleting/restoring; verify watchers update desktop icons.
- **Visual**: Snapshots for Explorer large icons, details view, properties dialog.
- **Performance**: Automated test generating 10k files and measuring list virtualization frame time.

## Manual QA Checklist
- Context menus reflect selection (Open, Edit, Print, Copy, Paste, Create Shortcut, Delete, Properties).
- Drag file with Ctrl (copy), Shift (move), Alt (shortcut) results in correct operation.
- Double-click drives, special folders; ensure Control Panel/Printers open placeholders.
- Empty Recycle Bin prompts confirmation, clears items; restore returns to original path.
- Import local file, confirm metadata, open associated app (if available placeholder).

## Dependencies
- Requires Phase 1 services stable.

## Exit Criteria
- All unit/integration/performance tests passing.
- Manual QA complete and logged.
- Feature parity matrix updated for Explorer and VFS entries.
