# Module APIs (V2)

The V2 simulator exposes stable contracts to keep teams productive while working in parallel. The APIs below must remain backward compatible with the original single-file release unless a version bump is coordinated across phases.

## Registry primitives
```ts
import { createModuleRegistry } from '@core/kernel/moduleRegistry';

const registry = createModuleRegistry();

registry.register({
  id: 'shell/taskbar',
  version: '2.0.0',
  factory: () => new TaskbarController(options),
});
```
- `id` follows the pattern `<layer>/<module>` (e.g., `services/filesystem`).
- `version` is semver. Increment minor for backward-compatible additions, major for breaking changes.
- `factory` returns the public surface (object instance or function map) lazily when resolved.

## Core runtime
### `shell/boot`
Phase 01 exposes `createShellSession()` which wires together the registry, window
manager, and DOM viewport. The session stores itself on `window.win95sim` for
legacy automation compatibility.
```ts
import { createShellSession } from '@shell/boot';

const session = createShellSession();
session.mount(document.body);

// Consumers can open additional windows
session.createWindow({
  id: 'apps/demo',
  title: 'Demo window',
  bounds: { x: 120, y: 120, width: 320, height: 240 },
});
```

The session emits a `session:ready` event on the shared kernel event bus and
registers the following module ids:

| Module id | Description |
|-----------|-------------|
| `services/settings` | Reactive key/value store for UI preferences |
| `services/display` | Desktop resolution and scaling helpers |
| `services/windows` | Window descriptors and focus tracking |
| `apps/window-manager` | Window lifecycle APIs |
| `shell/session` | Exposes `{ bus, registry }` for downstream boot flows |

`@shell/boot/session` also exports desktop helpers that mirror the built-in shortcut layout:

```ts
import { DESKTOP_DEFAULT_ENTRIES, DESKTOP_SHORTCUT_COMMANDS } from '@shell/boot/session';

DESKTOP_DEFAULT_ENTRIES.forEach((entry) => console.log(entry.id, entry.icon));
const paintCommand = DESKTOP_SHORTCUT_COMMANDS['desktop/paint']; // -> 'shell:start:paint'
const myComputerCommand = DESKTOP_SHORTCUT_COMMANDS['desktop/computer']; // -> 'shell:start:my-computer'
```

Reuse these constants when seeding additional desktop icons so new surfaces stay aligned with the shell defaults.

### `services/settings`
```ts
interface SettingsService {
  get(key: string, fallback?: SettingValue): SettingValue;
  set(key: string, value: SettingValue): void;
  watch(key: string, handler: (event: SettingsChangeEvent) => void): () => void;
  bus: EventBus;
}
```
Events are dispatched on `settings:changed` with `{ key, value }` payloads.

### `services/display`
```ts
type ScalingMode = 'fit' | 'pixel';

interface DisplayState {
  width: number;
  height: number;
  scalingMode: ScalingMode;
  integerScale: boolean;
}

interface DisplayService {
  getState(): DisplayState;
  setResolution(width: number, height: number): void;
  setScalingMode(mode: ScalingMode): void;
  toggleIntegerScale(enabled: boolean): void;
  bus: EventBus;
}
```

### `services/windows`
```ts
type WindowState = 'normal' | 'minimized' | 'maximized';

interface WindowDescriptor {
  id: string;
  title: string;
  icon?: string;
  bounds: { x: number; y: number; width: number; height: number };
  state?: WindowState;
  zIndex?: number;
}

interface WindowService {
  create(descriptor: WindowDescriptor): WindowDescriptor;
  update(id: string, updates: Partial<WindowDescriptor>): WindowDescriptor;
  get(id: string): WindowDescriptor | undefined;
  all(): WindowDescriptor[];
  focus(id: string): WindowDescriptor | undefined;
  remove(id: string): void;
  getActiveWindow(): WindowDescriptor | undefined;
  bus: EventBus;
}
```

Downstream phases consume these contracts instead of reaching into the DOM directly.

## Shared services
### `services/filesystem`
Phase 02 owner. Phase 01 stubs provide in-memory storage.
```ts
interface FileSystemService {
  read(path: string): Promise<FileNode>;
  write(path: string, contents: Uint8Array | string): Promise<void>;
  list(path: string): Promise<FileNode[]>;
  watch(path: string, handler: (event: FileEvent) => void): () => void;
  registerFileAssociation(
    extension: string,
    association: { appId: string; command?: string },
  ): FileAssociation;
  getFileAssociation(path: string): FileAssociation | undefined;
  listFileAssociations(): FileAssociation[];
}

interface FileAssociation {
  extension: string;
  appId: string;
  command?: string;
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

### `services/print`
Queues jobs for installed printers and writes output to the virtual spooler.
```ts
type PrinterDriver = 'generic-text' | 'virtual-pdf';

interface PrinterDefinition {
  id: string;
  name: string;
  driver: PrinterDriver;
  description?: string;
  isDefault?: boolean;
  capabilities?: string[];
}

type PrintJobStatus = 'queued' | 'printing' | 'paused' | 'completed' | 'cancelled' | 'error';

interface PrintJobRequest {
  printerId: string;
  documentName: string;
  content: string;
  copies?: number;
  contentType?: string;
}

interface PrintJob extends PrintJobRequest {
  id: string;
  status: PrintJobStatus;
  outputPath?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface PrintService {
  listPrinters(): PrinterDefinition[];
  getPrinter(id: string): PrinterDefinition | undefined;
  installPrinter(printer: PrinterDefinition): PrinterDefinition;
  removePrinter(id: string): PrinterDefinition | undefined;
  submitJob(request: PrintJobRequest): PrintJob;
  getJob(id: string): PrintJob | undefined;
  listJobs(printerId?: string): PrintJob[];
  pauseJob(id: string): PrintJob | undefined;
  resumeJob(id: string): PrintJob | undefined;
  cancelJob(id: string): PrintJob | undefined;
  processNextJob(): PrintJob | undefined;
  processAllJobs(): PrintJob[];
  bus: EventBus;
}
```
`processNextJob()` and `processAllJobs()` are primarily used by automated tests
to step through the queue deterministically. Runtime callers typically rely on
the auto-processing behaviour provided by the default service implementation.
### `services/layout`
Persists icon and surface geometry for desktop-aligned experiences.
```ts
interface LayoutPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface LayoutSnapshot {
  surfaceId: string;
  items: Record<string, LayoutPosition>;
  gridSize?: number;
}

interface LayoutService {
  getSnapshot(surfaceId: string): LayoutSnapshot;
  setItem(surfaceId: string, itemId: string, position: LayoutPosition, options?: { snapToGrid?: boolean }): LayoutSnapshot;
  removeItem(surfaceId: string, itemId: string): LayoutSnapshot;
  clear(surfaceId: string): LayoutSnapshot;
  setGridSize(surfaceId: string, size: number): void;
  bus: EventBus;
}
```

### `services/recent-documents`
Tracks recently opened documents for surfacing in the Start menu and Explorer.
```ts
interface RecentDocumentEntry {
  id: string;
  title: string;
  path: string;
  openedAt: number;
  metadata?: Record<string, unknown>;
}

interface RecentDocumentsService {
  add(entry: Omit<RecentDocumentEntry, 'openedAt'> & { openedAt?: number }): RecentDocumentEntry;
  list(): RecentDocumentEntry[];
  clear(): void;
  bus: EventBus;
}
```

### `apps/internet/navigator`
High-level Navigator services and UI wrapper.

```ts
import {
  createNavigatorSession,
  createBookmarkStore,
  createNavigatorApp,
} from '@apps/internet/navigator';

const session = createNavigatorSession({ settings, homeUrl: 'https://example.com' });
const bookmarks = createBookmarkStore({ settings });

const app = createNavigatorApp({ settings });
app.mount(hostElement);
```

- `createNavigatorSession` handles tab state, navigation history, and emits `navigator:*` events.
- `createBookmarkStore` persists favorites under the `navigator.bookmarks` namespace.
- `createNavigatorApp` renders the Win95-style Internet Explorer chrome (menus, toolbar, address bar, iframe viewport, status bar) and returns `{ mount, destroy, navigate }` for hosts embedding the browser UI.

### `apps/creative/paint`
UI shell for the paint engine.

```ts
import { createPaintApp } from '@apps/creative/paint';

const { vfs } = services;

const paint = createPaintApp({
  width: 480,
  height: 320,
  background: [255, 255, 255, 255],
  vfs,
  defaultDirectory: 'C:/Documents',
});
paint.mount(canvasHost);
```

The instance exposes `{ mount(host), destroy() }`. It mounts palette swatches, brush controls, layered `<canvas>` surfaces, menus, and a status bar while delegating undo/redo to `@apps/creative/paint/engine`. When supplied with a VFS service the File menu activates Open/Save commands that serialise `.w95p` snapshots.

## UI primitives
### CSS tokens (`ui/tokens.css`)
```css
:root {
  --win95-color-window: #c3c7cb;
  --win95-color-windowframe: #000000;
  --win95-color-highlight: #0a64ad;
  --win95-color-highlight-text: #ffffff;
  --win95-color-desktop: #008080;
  --win95-font-ui: 'MS Sans Serif', 'Segoe UI', sans-serif;
  --win95-border-size: 2px;
  --win95-radius: 0;
  --motion-duration-fast: 70ms;
  --motion-duration-standard: 150ms;
}
```
All UI code must consume these tokens through CSS custom properties. Additional
values should be added in future phases instead of inlining raw colors or sizes.

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

### `apps/control-panel`
Loads applets from `src/apps/system/control-panel/control-panel.manifest.json`
and registers each module as `apps/control-panel/<id>`.
```ts
interface ControlPanelContext {
  display: DisplayService;
  settings: SettingsService;
  print: PrintService;
}

interface ControlPanelApplet {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  manifest: ControlPanelManifestEntry;
  open(): ControlPanelAppletSession;
}

interface ControlPanelAppletSession {
  tabs: string[];
  dispose(): void;
}
```
Applets implement `createApplet(context, manifest)` and expose pure controller
APIs so downstream features can unit test behaviour without rendering UI.

## Telemetry & diagnostics
Phase 10 introduces optional telemetry via `services/diagnostics`. The concrete implementation
integrates with the shared settings service and exposes an opt-in workflow:
```ts
interface DiagnosticsEvent {
  event: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

interface DiagnosticsFlushResult {
  events: DiagnosticsEvent[];
  dropped: number;
  optedIn: boolean;
}

type DiagnosticsTransport = (events: DiagnosticsEvent[]) => Promise<void> | void;

interface DiagnosticsService {
  log(event: string, payload?: Record<string, unknown>): void;
  flush(): Promise<DiagnosticsFlushResult>;
  isOptedIn(): boolean;
  configureTransport(transport: DiagnosticsTransport | undefined): void;
  bus: EventBus;
}
```
The service monitors the `telemetry.optIn` flag in `services/settings`. Events are queued only when
the user has opted in; otherwise they are counted as dropped for observability.

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
