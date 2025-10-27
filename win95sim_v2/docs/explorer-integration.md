# Explorer Integration Notes

Phase 02 introduces a modular Virtual File System (VFS) service and the Explorer
application. The notes below summarise extension points and expectations for
teams integrating with the new modules.

## Services
- **Module id:** `services/vfs`
- **Factory:** `createVfsService(options?: CreateVfsServiceOptions)`
- **Surface:**
  - CRUD helpers (`writeFile`, `makeDirectory`, `remove`, `move`).
  - Watchers via `watch(path, handler)` returning an unsubscribe function.
  - Text-aware search (`search(query, { includeContent?: boolean })`).
  - Recycle bin APIs exposed through `service.recycleBin` with `list`,
    `restore`, and `empty` helpers.
  - Shortcut resolution using `resolveShortcut(path)`.
  - File association registry (`registerFileAssociation`,
    `getFileAssociation`, `listFileAssociations`) for wiring extensions to
    application handlers.
  - Event bus (`service.bus`) emitting `vfs:*` events for cross-service
    listeners.

Consumers should prefer the high-level API instead of mutating internal state.
Paths are normalised (`C:/Folder/File.txt`) and drives are case insensitive.

## Explorer app
- Declared via `src/apps/explorer/explorer.app.json` so the process service can
  discover and spawn Explorer windows.
- Runtime entry point `createExplorerApp({ vfs, startPath, onOpenNode })` renders tree and
  details panes. The app listens to VFS watchers so desktop icons and other apps
  can share the same service instance without refreshing the view manually.
- Optional `onOpenNode` callback fires when users double-click a file in the
  details pane so the shell can delegate to associated applications.
- Breadcrumb navigation emits `setPath` calls that downstream tooling can hook
  into for automation or testing.

## Recycle Bin app
- Mounted from `src/apps/system/recycle-bin/index.ts` and consumes the shared
  VFS recycle bin surface to stay in sync with deletions and restores.
- Presents a Win95-style chrome including File/Edit/View/Help menus, a command
  toolbar, and a status bar with live object/size totals so QA scripts can match
  the legacy simulator layout.
- Emits the same `vfs:recycle-bin:*` events as Explorer, allowing desktop icons
  and other apps to refresh when the bin changes state.

## Fixtures
`tests/fixtures/vfs/sampleTree.js` exports a helper that returns a seed array
compatible with `createVfsService({ seed })`. Other phases can reuse the fixture
for deterministic test data without touching Explorer internals.

## Compatibility
- The VFS service keeps string-based path APIs to align with the single-file
  simulator. Any new binary/file abstractions should be additive.
- Watch events follow the pattern `{ type, node, previousPath? }` and mirror
  Windows Explorer semantics (`created`, `updated`, `moved`, `deleted`,
  `restored`).

Please update this document when introducing new public hooks or behaviours.
