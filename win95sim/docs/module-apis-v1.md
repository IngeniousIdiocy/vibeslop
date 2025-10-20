# Module & CSS Contract (v1.0)

This document locks the public APIs and CSS tokens that all services, utilities, shell components, and applications must honor. Any breaking change requires bumping the API version.

## Single-File Module Loader
```js
define(id: string, deps: string[], factory: (...deps) => any): void;
require(id: string): any;
require(ids: string[], cb: (...exports) => void): void;
```
- Synchronous resolution; cyclic dependencies supported.
- Synthetic deps: `require`, `exports`, `module`.
- Duplicate module IDs or missing IDs throw.

## Core Types
- `Path` – Windows-style (`"C:\\Folder\\File.txt"`), case-insensitive.
- `DriveLetter` – `"A" | "C" | "D" | "N"`.
- `NodeKind` – `"file" | "dir" | "link" | "virtual"`.
- `Mime` – MIME string (`"text/plain"`).
- `FSNodeMeta` – metadata structure containing `id`, `kind`, `name`, `ext`, `size`, timestamps, attributes, `mime`, and optional shortcut fields.

## core/kernel
```ts
interface Kernel {
  on<T>(evt: string, fn: (payload: T) => void): () => void;
  once<T>(evt: string, fn: (payload: T) => void): void;
  off<T>(evt: string, fn: (payload: T) => void): void;
  emit<T>(evt: string, payload: T): void;
  uid(prefix?: string): string;
  now(): number;
}
```
Standard events: `fs:create|update|delete|move`, `win:focus|close|resize|move|minimize|maximize|restore`, `proc:launch|exit|focus`, `display:change`, `print:job`, `settings:change`.

## svc/settings
```ts
type SettingKey =
  | "theme"
  | "sound.enabled"
  | "display.mode"
  | "display.integerScale"
  | "display.resolution"
  | "display.crt.enabled"
  | "display.crt.intensity"
  | "keyboard.repeatRate"
  | "mouse.pointerSpeed";

interface SettingsSvc {
  get<T>(key: SettingKey): T;
  set<T>(key: SettingKey, value: T): void;
  watch<T>(key: SettingKey, fn: (value: T) => void): () => void;
}
```

## svc/display
```ts
type ScaleMode = "pixel" | "fit" | "integer";
interface Resolution { w: number; h: number; }
interface DisplaySvc {
  getResolution(): Resolution;
  setResolution(r: Resolution): void;
  getScaleMode(): ScaleMode;
  setScaleMode(mode: ScaleMode): void;
  setWallpaper(source: { path?: Path; builtinId?: string; mode: "tile"|"center"|"stretch" }): void;
  setDesktopColor(hex: string): void;
  setColorDepthSim(depth: "truecolor"|"256"|"16"): void;
  getViewport(): { width: number; height: number };
}
```

## svc/vfs
```ts
interface WriteOpts { mime?: Mime; attrib?: Attrib; overwrite?: boolean; }
interface ListOpts { showHidden?: boolean; }
interface MoveCopyOpts { overwrite?: boolean; }
interface SearchOpts {
  path?: Path | "::virtual";
  namePattern?: string;
  contentIncludes?: string;
  exts?: string[];
  recursive?: boolean;
  maxResults?: number;
}
interface VfsWatchPayload {
  type: "create" | "update" | "delete" | "move";
  path: Path;
  from?: Path;
  meta?: FSNodeMeta;
}
interface VfsSvc {
  stat(path: Path): FSNodeMeta | null;
  exists(path: Path): boolean;
  list(path: Path, opts?: ListOpts): FSNodeMeta[];
  read(path: Path, as?: "text"|"bytes"|"json"|"dataURL"): Promise<string|Uint8Array|any>;
  write(path: Path, data: string|Uint8Array|Blob|any, opts?: WriteOpts): Promise<FSNodeMeta>;
  mkdir(path: Path): FSNodeMeta;
  move(src: Path, dst: Path, opts?: MoveCopyOpts): FSNodeMeta;
  copy(src: Path, dst: Path, opts?: MoveCopyOpts): FSNodeMeta;
  remove(path: Path, toRecycleBin?: boolean): void;
  createShortcut(target: Path, shortcutPath: Path, iconId?: string): FSNodeMeta;
  resolve(pathOrShortcut: Path): Path;
  search(opts: SearchOpts): FSNodeMeta[];
  watch(pathOrRoot: Path | "::all", cb: (payload: VfsWatchPayload) => void): () => void;
  download(path: Path): void;
  mountZip?(buffer: Uint8Array, mountPoint: Path): Promise<void>;
  special: {
    desktop: "::desktop";
    controlPanel: "::controlpanel";
    printers: "::printers";
    recycleBin: "::recyclebin";
    network: "::network";
  };
}
```
Errors: `E_EXISTS`, `E_NOENT`, `E_ISDIR`, `E_NOTDIR`, `E_DENIED`, `E_BUSY`, `E_BADNAME`, `E_TOOLARGE`, `E_UNSUPPORTED` (with `.code` property).

## svc/process
```ts
type AppCapability = "open" | "print" | "dragTarget" | "multipleWindows";
type Protocol = "http" | "https" | "file" | "data";
interface LaunchArgs { file?: Path; url?: string; cwd?: Path; [k: string]: any; }
interface AppContext { /* services injected */ }
interface AppInstance {
  pid: string;
  appId: string;
  mainWindow?: WindowRef;
  focus(): void;
  close(): Promise<void>;
  send?(channel: string, payload: any, targetPid?: string): void;
}
interface AppDescriptor {
  id: string;
  name: string;
  version: string;
  author?: string;
  icon: string;
  entry(ctx: AppContext, args?: LaunchArgs): Promise<AppInstance> | AppInstance;
  fileTypes?: string[];
  mimes?: Mime[];
  protocols?: Protocol[];
  singleton?: boolean;
  startMenuPath?: string[];
  desktopShortcut?: boolean;
  defaultWindow?: Partial<WindowCreateOptions>;
  capabilities?: AppCapability[];
}
interface ProcessSvc {
  register(desc: AppDescriptor): void;
  launch(appId: string, args?: LaunchArgs): Promise<AppInstance>;
  instances(appId?: string): AppInstance[];
  kill(pid: string): void;
  focus(pid: string): void;
  associate(extOrMime: string, appId: string): void;
  open(pathOrUrl: string): Promise<AppInstance>;
  recentDocuments(): { path: Path; openedAt: number }[];
  registry(): AppDescriptor[];
}
```
Events: `proc:launch`, `proc:exit`, `proc:focus`, `proc:recent:add`.

## svc/window
```ts
interface WindowCreateOptions {
  title: string;
  icon?: string;
  width: number; height: number;
  x?: number; y?: number;
  resizable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  modal?: boolean;
  menu?: MenuModel;
  statusBar?: boolean;
  toolbar?: ToolbarModel;
  content?: (container: HTMLElement) => void;
}
interface WindowRef {
  id: string;
  element: HTMLElement;
  content: HTMLElement;
  show(): void;
  hide(): void;
  focus(): void;
  close(): void;
  moveTo(x: number, y: number): void;
  resizeTo(width: number, height: number): void;
  minimize(): void;
  maximize(): void;
  restore(): void;
  setTitle(title: string): void;
  setIcon(iconId: string): void;
  on(evt: "focus"|"close"|"resize"|"move"|"minimize"|"maximize"|"restore", fn: (w: WindowRef) => void): () => void;
}
interface WindowSvc {
  create(opts: WindowCreateOptions): WindowRef;
  all(): WindowRef[];
  top(): WindowRef | null;
}
```

## svc/ui
Menu, toolbar, dialog contracts:
```ts
interface MenuItem {
  id?: string;
  label?: string;
  accelerator?: string;
  enabled?: boolean;
  checked?: boolean;
  role?: MenuRole;
  submenu?: MenuItem[];
  type?: "separator"|"checkbox"|"radio"|"normal";
}
interface UISvc {
  createListView(container: HTMLElement, model: ListViewModel): ListViewHandle;
  createTreeView(container: HTMLElement, model: TreeModel): TreeHandle;
  showContextMenu(model: MenuModel, at: {x:number,y:number}): Promise<string|undefined>;
  setMenu(window: WindowRef, menu: MenuModel): void;
  setToolbar(window: WindowRef, model: ToolbarModel, onClick: (id: string) => void): void;
  setStatus(window: WindowRef, text: string): void;
  openFile(opts: OpenFileOpts): Promise<Path[]|null>;
  saveFile(opts: SaveFileOpts): Promise<Path|null>;
  messageBox(opts: { title?: string; message: string; buttons?: MsgBoxButtons; icon?: MsgBoxIcon }): Promise<"ok"|"cancel"|"yes"|"no">;
  fontDialog(initial?: { family?: string; size?: number; bold?: boolean; italic?: boolean }): Promise<{ family: string; size: number; bold: boolean; italic: boolean }|null>;
  colorDialog(initialHex?: string): Promise<string|null>;
  printDialog(initial?: { printerId?: string; copies?: number }): Promise<{ printerId: string; copies: number }|null>;
}
```
ListView/TreeView model contracts as defined in the planning notes are canonical.

## svc/clipboard
```ts
interface ClipboardSvc {
  writeText(text: string): Promise<void>;
  readText(): Promise<string|null>;
  writeFiles(paths: Path[]): void;
  readFiles(): Path[];
  clear(): void;
}
```

## svc/sound
```ts
type SoundId = "startup"|"shutdown"|"asterisk"|"exclamation"|"default"|"minimize"|"maximize"|"menu-popup"|"menu-command";
interface SoundSvc {
  play(id: SoundId): void;
  enable(enabled: boolean): void;
  isEnabled(): boolean;
  setScheme(schemeId: "classic"|"none"): void;
}
```

## svc/print
```ts
type PrintJobStatus = "queued"|"printing"|"completed"|"error"|"canceled";
interface PrintJob { id: string; printerId: string; docName: string; submittedAt: number; status: PrintJobStatus; progress: number; outputPath?: Path; error?: string; }
interface PrintContentText { kind: "text"; text: string; font?: { family: string; size: number }; }
interface PrintContentImage { kind: "image"; dataURL: string; width: number; height: number; }
type PrintPage = (PrintContentText | PrintContentImage)[];
interface PrintSvc {
  registerPrinter(printer: { id: string; name: string; kind: "generic-text"|"virtual-pdf"; print(pages: PrintPage[], copies: number): Promise<{ outputPath: Path }> }): void;
  printers(): { id: string; name: string; kind: string }[];
  print(opts: { printerId: string; docName: string; pages: PrintPage[]; copies?: number }): Promise<PrintJob>;
  jobs(): PrintJob[];
  cancel(jobId: string): void;
  onStatus(fn: (job: PrintJob) => void): () => void;
}
```

## svc/security
```ts
interface SecuritySvc {
  sanitize(html: string, opts?: SanitizeOpts): DocumentFragment;
  createSandboxedIframe(url: string, opts?: { allowSameOrigin?: boolean }): HTMLIFrameElement;
}
```

## Utilities
- `util/path`, `util/mime`, `util/icon`, `util/drag`, `util/bitmap`, `util/keyboard`, `util/virtualize` follow the signatures captured in the planning notes. These are considered stable.

## Shell Modules
- `shell/desktop`, `shell/taskbar`, `shell/start` expose the interfaces listed in the planning notes (mounting desktops, controlling tray icons, command callbacks).

## AppContext Injection
Each application receives:
```ts
interface AppContext {
  kernel: Kernel;
  vfs: VfsSvc;
  window: WindowSvc;
  ui: UISvc;
  process: ProcessSvc;
  clipboard: ClipboardSvc;
  print: PrintSvc;
  sound: SoundSvc;
  security: SecuritySvc;
  display: DisplaySvc;
  settings: SettingsSvc;
  assets: AssetRegistry;
}
```

Apps may optionally expose `openFile`, `printFile`, or `canHandle` helpers; these should comply with the descriptors registered via `svc/process`.

## Asset Registry
```ts
interface AssetRegistry {
  icon(id: string): string;
  sound(id: SoundId): string;
  wallpaper(id: string): string;
  font(id: string): string;
}
```
Identifiers are stable (e.g., `ico-notepad`, `ico-explorer`, `ico-folder`, `ico-recycle`).

## CSS Tokens (scoped to `#crt`)
```css
--w95-face: #c0c0c0;
--w95-light: #dfdfdf;
--w95-hilight: #ffffff;
--w95-shadow: #808080;
--w95-darkshadow: #000000;
--w95-window: #ffffff;
--w95-windowtext: #000000;
--w95-btntext: #000000;
--w95-graytext: #808080;
--w95-highlight: #000080;
--w95-highlighttext: #ffffff;
--w95-link: #0000ff;
--w95-visitedlink: #800080;
--w95-appworkspace: #808080;
--w95-desktop: #008080;
--w95-font-ui: "W95Sans", Tahoma, "MS Sans Serif", Arial, sans-serif;
--w95-font-mono: "W95Fixed", "Courier New", monospace;
--w95-font-size: 12px;
--w95-title-font-size: 12px;
--w95-menu-font-size: 12px;
--w95-status-font-size: 11px;
--w95-border: 1px;
--w95-edge: 2px;
--w95-caption-height: 18px;
--w95-menu-height: 18px;
--w95-status-height: 18px;
--w95-scrollbar: 16px;
--w95-icon: 32px;
--w95-icon-small: 16px;
--w95-focus-outline: 1px dotted #000;
--w95-caret-width: 1px;
--z-desktop: 0;
--z-window: 100;
--z-taskbar: 1000;
--z-startmenu: 2000;
--z-menu: 3000;
--z-tooltip: 3500;
--z-modal: 4000;
--z-screensaver: 5000;
--z-bsod: 6000;
--crt-scanline-opacity: 0.15;
--crt-glow: 0.04;
--crt-vignette: 0.08;
--w95-pad-xs: 2px;
--w95-pad-sm: 4px;
--w95-pad-md: 6px;
--w95-pad-lg: 8px;
```
State selectors:
- `#crt[data-scale="pixel|fit|integer"]`
- `#crt[data-theme="standard|desert|high-contrast"]`
- `#crt[data-crt="on|off"]`
- `.w95-window[aria-active="true|false"]`
- `.w95-button[aria-pressed="true"]`
- `.w95-listview[data-view="icons|list|details"]`

## Standard Command IDs
- `cmd.file.*`, `cmd.edit.*`, `cmd.view.*`, `cmd.help.about`
- `start.run`, `start.find`, `start.documents`, `start.shutdown`
- `win.minimize`, `win.maximize`, `win.restore`, `win.close`, `win.move`, `win.size`

## Default File Associations
- `.txt`, `.log` → `app.notepad`
- `.bmp`, `.png` → `app.paint`
- `.wav`, `.mp3`, `.ogg` → `app.media`
- `.mp4`, `.webm` → `app.media`
- `.url` → `app.navigator`
- `.lnk` → Shell shortcut resolver
- Folders → `app.explorer`

## Versioning
- Contract version: **v1.0** (locked).
- Additive, backward-compatible changes stay in 1.x.
- Breaking changes require new document and module version bump.
