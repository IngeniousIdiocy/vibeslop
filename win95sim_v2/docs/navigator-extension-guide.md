# Navigator Extension Guide

Navigator exposes a set of high level services so add-ons can plug into the
browser without patching core files. The APIs described here are stable for the
Phase 05 release and align with the module contracts documented in
`docs/module-apis-v2.md`.

## Module overview

- **Module ID:** `apps/internet/navigator`
- **Entry point:** `src/apps/internet/navigator/index.ts`
- **Layer:** `apps/`
- **Dependencies:**
  - `@core/kernel/eventBus`
  - `@services/settings`
  - `@services/network`
  - `@services/security`
  - `@services/downloads`

Extensions should depend only on the public exports from
`src/apps/internet/navigator/index.ts`. Direct imports from nested folders are
not considered public API and may change without notice.

## Session management

```ts
import { createNavigatorSession } from '@apps/internet/navigator';
```

`createNavigatorSession` accepts a `SettingsService` and returns a controller for
managing the active tab. The session persists navigation history and per-tab
mode preferences using the `navigator.session` namespace in the settings
service.

### Events

The session exposes an `EventBus` that emits:

- `navigator:navigated` – fired whenever the active URL changes
- `navigator:mode-changed` – fired when the tab switches between iframe, reader,
  or proxy mode

Subscribers receive a snapshot containing the active tab state. Snapshots are
immutable copies so listeners can safely cache them.

## Bookmarks store

```ts
import { createBookmarkStore } from '@apps/internet/navigator';
```

The bookmark store persists entries under `navigator.bookmarks`. It supports
adding, removing, and reordering bookmarks. Consumers should listen to the
`bookmarks:changed` event on the store’s bus to keep UI in sync.

## Security & sanitization

Reader mode and View Source both delegate to
`@services/security/sanitizer.sanitizeHtml`. The sanitizer removes script tags,
inline event handlers, and disallowed URL protocols (only `http`, `https`,
`data`, and `mailto` are allowed by default). Extensions should reuse this helper
when displaying third-party HTML fragments.

## Networking helpers

Navigator ships a configurable iframe policy and proxy validation helpers under
`@services/network`:

- `createIframePolicy` returns sandbox attributes for iframe elements and
  validates target URLs.
- `validateProxyUrl` and `buildProxiedUrl` help extensions integrate with user
  configured HTTP(S) proxies.

## Downloads

The download manager in `@services/downloads` coordinates fetches and persistence
into the virtual file system (VFS). Extensions enqueue downloads through
`createDownloadManager` and listen for lifecycle events (`download:started`,
`download:completed`, `download:failed`) on the returned event bus.

## Compatibility notes

- All APIs are implemented in TypeScript and compiled for tests. Extensions
  should consume the JavaScript emitted by the build pipeline.
- Network-related helpers intentionally reject unsupported protocols to prevent
  security regressions. Validate user input before invoking downloads or proxy
  utilities.
- The module registry manifest is provided in
  `src/apps/internet/navigator/module.json`. Extensions should reference the
  module ID when registering with the shell or Start menu manifests.
