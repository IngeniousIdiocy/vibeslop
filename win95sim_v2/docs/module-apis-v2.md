# Module APIs (V2)

The V2 simulator exposes stable contracts to keep teams productive while working in parallel. The APIs below must remain backward compatible with the original single-file release unless a version bump is coordinated across phases.

## Registry primitives
```ts
import { createModuleRegistry } from 'core/runtime/registry';

const registry = createModuleRegistry();

registry.register({
  id: 'shell/taskbar',
  version: '2.0.0',
  exports: () => new TaskbarController(options)
});
```
- `id` follows the pattern `<layer>/<module>` (e.g., `services/filesystem`).
- `version` is semver. Increment minor for backward-compatible additions, major for breaking changes.
- `exports` returns the public surface (object instance or function map).

## Core runtime
### `core/runtime/session`
Responsible for boot orchestration and window focus management.
```ts
interface SessionService {
  boot(): Promise<void>;
  openApp(manifestId: string, params?: Record<string, unknown>): Promise<AppHandle>;
  getActiveWindow(): WindowHandle | null;
  subscribe(listener: (event: SessionEvent) => void): () => void;
}
```
Events include `session:ready`, `window:activated`, `window:closed`, `app:error`.

### `core/runtime/windows`
Controls window lifecycle and layout.
```ts
interface WindowManager {
  create(config: WindowConfig): WindowHandle;
  move(handle: WindowHandle, position: DOMRectInit): void;
  resize(handle: WindowHandle, dimensions: { width: number; height: number }): void;
  focus(handle: WindowHandle): void;
  close(handle: WindowHandle): void;
}
```

## Shared services
### `services/filesystem`
Phase 02 owner. Phase 01 stubs provide in-memory storage.
```ts
interface FileSystemService {
  read(path: string): Promise<FileNode>;
  write(path: string, contents: Uint8Array | string): Promise<void>;
  list(path: string): Promise<FileNode[]>;
  watch(path: string, handler: (event: FileEvent) => void): () => void;
}
```

### `services/processes`
Coordinates background tasks and shell processes.
```ts
interface ProcessService {
  spawn(manifestId: string, args?: Record<string, unknown>): Promise<ProcessHandle>;
  kill(pid: string): Promise<void>;
  subscribe(handler: (event: ProcessEvent) => void): () => void;
}
```

### `services/localization`
Provides translation catalogs and locale helpers.
```ts
interface LocalizationService {
  setLocale(locale: string): Promise<void>;
  translate(key: string, params?: Record<string, string>): string;
  subscribe(handler: (event: { locale: string }) => void): () => void;
}
```

## UI primitives
### CSS tokens (`ui/tokens.css`)
```css
:root {
  --win95-color-window: #c3c7cb;
  --win95-color-windowframe: #000000;
  --win95-color-highlight: #0a64ad;
  --win95-color-highlight-text: #ffffff;
  --win95-font-ui: 'MS Sans Serif', 'Segoe UI', sans-serif;
  --win95-border-size: 2px;
  --win95-radius: 0;
  --motion-duration-fast: 70ms;
  --motion-duration-standard: 150ms;
}
```
All UI code must consume these tokens through CSS custom properties or the helper functions provided in `ui/styles.ts` (Phase 01).

### Window chrome helpers (`features/window-chrome`)
```ts
interface WindowChromeAPI {
  attach(handle: WindowHandle, host: HTMLElement): void;
  detach(handle: WindowHandle): void;
  enableResize(handle: WindowHandle, options?: ResizeOptions): void;
  enableDrag(handle: WindowHandle, options?: DragOptions): void;
}
```

## App lifecycle
Apps are declared via manifests under `apps/<name>/module.json`:
```json
{
  "id": "apps/notepad",
  "name": "Notepad",
  "entry": "./index.ts",
  "icon": "./icons/notepad.png",
  "permissions": ["filesystem.read", "filesystem.write"],
  "windows": [
    {
      "id": "main",
      "title": "Untitled - Notepad",
      "size": { "width": 480, "height": 320 }
    }
  ]
}
```
The build pipeline validates manifests for conflicting IDs and missing permissions during Phase 01.

## Telemetry & diagnostics
Phase 10 introduces optional telemetry via `services/diagnostics`. Until then, the interface is stubbed:
```ts
interface DiagnosticsService {
  log(event: string, payload?: Record<string, unknown>): void;
  flush(): Promise<void>;
}
```

## Compatibility layer
`core/compat/v1-adapter` exposes shims that mimic the original global functions:
```ts
interface LegacyAdapter {
  openWindow(id: string, opts?: Record<string, unknown>): Promise<WindowHandle>;
  closeWindow(id: string): void;
}
```
Use the adapter only for existing automation. New code must use the typed interfaces above.

## Versioning & change control
- Breaking changes require a major version bump and a changelog entry in `docs/architecture.md`.
- Additive changes should ship alongside updated unit tests and QA checklist entries.
- Deprecations must remain operable for at least two release cycles and be tracked in the risk log.
