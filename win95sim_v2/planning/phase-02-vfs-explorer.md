# Phase 2 – Virtual File System & Explorer (Modular Apps)

**Status:** 🚧 Planned. With the multi-file baseline in place, this phase focuses on delivering the VFS service and Explorer app as isolated packages that depend only on the Phase 1 contracts. All work lands in their dedicated folders to ensure future features can branch independently without rebasing on unrelated UI code.

## Objectives
- Deliver fully functional in-memory VFS under `src/services/vfs/` with drives, recycle bin, shortcuts, search, and import/export stubs.
- Build Explorer shell under `src/apps/explorer/` with tree/list/details views, context menus, properties dialog, New menu, drag/drop semantics, and Find window.
- Integrate VFS with desktop icons and window manager through published service interfaces (`@services/vfs`, `@apps/shell/taskbar`).
- Document boundaries so later app teams (Paint, Control Panel, etc.) can reuse file APIs without modifying Explorer internals.

## Deliverables
1. `src/services/vfs/index.ts` implementation matching locked API, including special folders, watcher system, and `.d.ts` contract.
2. Path, MIME, and icon utilities under `src/services/vfs/utils/` providing associations for Explorer.
3. Explorer app registered with `src/services/process/` via manifest file (`src/apps/explorer/explorer.app.json`) to keep wiring declarative.
4. Recycle bin semantics (delete, restore, empty) encapsulated in `src/services/vfs/recycle-bin.ts` with unit coverage and service events.
5. File import/export hooks implemented through shared `src/ui/dialogs/file-transfer/` components with placeholder UI for later improvements.
6. Storybook/Chromatic stories for Explorer components stored in `src/apps/explorer/__stories__/` to aid isolated development.

## Concurrency & Integration Boundaries
- Define ownership file `src/services/vfs/OWNERS` and `src/apps/explorer/OWNERS` so only the Explorer team touches those directories.
- Provide mock fixtures in `tests/fixtures/vfs/` enabling other teams to simulate file operations without depending on Explorer code.
- Export read-only TypeScript interfaces for VFS watchers to prevent downstream mutation.
- Document extension points in `docs/explorer-integration.md` enumerating APIs safe for future phases.

## Engineering Tasks
- Implement tree data structure with metadata store and binary/blob handling for files (split into `store`, `adapters`, `search` modules).
- Implement watchers broadcasting changes via typed events consumed by Explorer and desktop icons.
- Implement search indexing with wildcard support and text content scanning running in a Web Worker (`src/workers/vfs-search.ts`).
- Create Explorer UI components: tree view, list view (icons/list/details), preview/status bar, toolbar/menus backed by component library tokens.
- Implement drag/drop between tree/list/desktop with modifier keys for move/copy/shortcut using shared drag service from Phase 1.
- Implement file dialogs using UI toolkit for New/Rename/Delete/Properties flows, ensuring forms live under `src/ui/dialogs/`.
- Integrate Recycle Bin UI with confirm/restore/empty actions, broadcasting telemetry events for analytics pipeline.

## Testing
- **Unit**: VFS path normalization, mkdir/write/read/move/copy/remove, shortcut resolution, recycle bin metadata, search filters using Jest suites in `tests/services/vfs/`.
- **Integration**: Playwright scenario creating nested folders, renaming, dragging between panes, deleting/restoring; verify watchers update desktop icons via public API mocks.
- **Visual**: Snapshots for Explorer large icons, details view, properties dialog using Storybook/Chromatic.
- **Performance**: Automated test generating 10k files and measuring list virtualization frame time executed via `yarn test:perf` and running in CI nightly.

## Manual QA Checklist
- Context menus reflect selection (Open, Edit, Print, Copy, Paste, Create Shortcut, Delete, Properties).
- Drag file with Ctrl (copy), Shift (move), Alt (shortcut) results in correct operation.
- Double-click drives, special folders; ensure Control Panel/Printers open placeholders.
- Empty Recycle Bin prompts confirmation, clears items; restore returns to original path.
- Import local file, confirm metadata, open associated app (if available placeholder).
- Validate that Explorer build artifacts (JS, styles, stories) are confined to `src/apps/explorer/` and tree-shake correctly.

## Dependencies
- Requires Phase 1 services and build pipeline stable; no changes to shared kernel APIs allowed without change request.

## Exit Criteria
- All unit/integration/performance tests passing.
- Manual QA complete and logged.
- Feature parity matrix updated for Explorer and VFS entries, including documentation of integration boundaries.
- Dependency graph lint (`yarn lint:dep`) shows no forbidden cross-folder imports.
