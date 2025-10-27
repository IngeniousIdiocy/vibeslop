import type { PaintColor } from '@services/graphics/bitmap';
import { normalizeColor } from '@services/graphics/bitmap';
import type { VfsService } from '@services/vfs';
import { basename, dirname, isRoot, join, normalizePath } from '@services/vfs/utils/path';
import {
  createPaintEngine,
  type PaintCommand,
  type PaintEngine,
  type PaintEngineOptions,
  type PaintEngineSnapshot,
  type StrokePoint,
} from './engine';

export interface PaintAppOptions {
  width?: number;
  height?: number;
  background?: PaintColor;
  palette?: PaintColor[];
  engineFactory?: (options: PaintEngineOptions) => PaintEngine;
  vfs?: VfsService;
  defaultDirectory?: string;
}

export interface PaintAppInstance {
  mount(host: HTMLElement): void;
  destroy(): void;
  openDocument(path: string): Promise<void>;
}

const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 320;
const DEFAULT_BACKGROUND: PaintColor = [255, 255, 255, 255];
const DEFAULT_PALETTE: PaintColor[] = [
  [0, 0, 0, 255],
  [255, 255, 255, 255],
  [128, 128, 128, 255],
  [255, 0, 0, 255],
  [255, 128, 0, 255],
  [255, 255, 0, 255],
  [0, 176, 80, 255],
  [0, 112, 192, 255],
  [0, 0, 255, 255],
  [112, 48, 160, 255],
];

const SNAPSHOT_MAGIC = 'W95P';
const SNAPSHOT_VERSION = 1;
const SNAPSHOT_HEADER_BYTES = 16;

interface MenuItemConfig {
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  action?: () => void | Promise<void>;
  type?: 'item' | 'separator';
}

type DialogMode = 'open' | 'save';

function encodeSnapshot(snapshot: PaintEngineSnapshot): Uint8Array {
  const header = new Uint8Array(SNAPSHOT_HEADER_BYTES + snapshot.pixels.length);
  header[0] = SNAPSHOT_MAGIC.charCodeAt(0);
  header[1] = SNAPSHOT_MAGIC.charCodeAt(1);
  header[2] = SNAPSHOT_MAGIC.charCodeAt(2);
  header[3] = SNAPSHOT_MAGIC.charCodeAt(3);
  const view = new DataView(header.buffer);
  view.setUint32(4, SNAPSHOT_VERSION, true);
  view.setUint32(8, snapshot.width, true);
  view.setUint32(12, snapshot.height, true);
  header.set(snapshot.pixels, SNAPSHOT_HEADER_BYTES);
  return header;
}

function decodeSnapshot(payload: Uint8Array): PaintEngineSnapshot {
  if (payload.byteLength < SNAPSHOT_HEADER_BYTES) {
    throw new Error('File is not a valid Win95Sim Paint document.');
  }

  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== SNAPSHOT_MAGIC) {
    throw new Error('Unsupported paint file format.');
  }

  const version = view.getUint32(4, true);
  if (version !== SNAPSHOT_VERSION) {
    throw new Error('Unsupported paint file version.');
  }

  const width = view.getUint32(8, true);
  const height = view.getUint32(12, true);
  const expectedPixels = width * height * 4;
  if (payload.byteLength < SNAPSHOT_HEADER_BYTES + expectedPixels) {
    throw new Error('Paint file appears to be corrupted.');
  }

  const pixels = new Uint8ClampedArray(expectedPixels);
  pixels.set(payload.subarray(SNAPSHOT_HEADER_BYTES, SNAPSHOT_HEADER_BYTES + expectedPixels));
  return { width, height, pixels };
}

function ensurePaintExtension(path: string): string {
  try {
    const normalized = normalizePath(path);
    const name = basename(normalized);
    if (name.toLowerCase().endsWith('.w95p')) {
      return normalized;
    }
    const folder = dirname(normalized);
    const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
    const finalName = `${base || 'Untitled'}.w95p`;
    return folder.endsWith('/') ? `${folder}${finalName}` : `${folder}/${finalName}`;
  } catch {
    if (path.toLowerCase().endsWith('.w95p')) {
      return path;
    }
    return `${path}.w95p`;
  }
}

function describeDocument(path: string | null): string {
  if (!path) {
    return 'Untitled';
  }
  try {
    return basename(normalizePath(path));
  } catch {
    const parts = path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || path;
  }
}

function featurePlaceholder(name: string, setStatus: (text: string) => void) {
  setStatus(`${name} is not yet available.`);
}

export function createPaintApp(options: PaintAppOptions = {}): PaintAppInstance {
  const palette = options.palette && options.palette.length > 0 ? options.palette.slice() : DEFAULT_PALETTE;
  const engineFactory = options.engineFactory ?? createPaintEngine;
  let width = Math.max(32, Math.round(options.width ?? DEFAULT_WIDTH));
  let height = Math.max(32, Math.round(options.height ?? DEFAULT_HEIGHT));
  const initialWidth = width;
  const initialHeight = height;
  const background = options.background ?? DEFAULT_BACKGROUND;
  const vfs = options.vfs;

  let defaultDirectory = 'C:/Documents';
  if (options.defaultDirectory) {
    try {
      defaultDirectory = normalizePath(options.defaultDirectory);
    } catch {
      defaultDirectory = 'C:/Documents';
    }
  }

  let engine = engineFactory({ width, height, background });

  let rootDocument: Document | null = null;
  let rootWindow: (Window & typeof globalThis) | null = null;
  let container: HTMLElement | null = null;
  let menuBar: HTMLElement | null = null;
  let toolbar: HTMLElement | null = null;
  let surface: HTMLElement | null = null;
  let frame: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let overlay: HTMLCanvasElement | null = null;
  let statusBar: HTMLElement | null = null;
  let brushInput: HTMLInputElement | null = null;
  let swatches: HTMLButtonElement[] = [];

  let ctx: CanvasRenderingContext2D | null = null;
  let overlayCtx: CanvasRenderingContext2D | null = null;
  let activeColor: PaintColor = palette[0];
  let brushSize = 2;
  let drawing = false;
  let strokePoints: StrokePoint[] = [];
  let statusMessage = 'Brush ready';
  let dirty = false;
  let currentFilePath: string | null = null;
  let activeMenu: { button: HTMLButtonElement; panel: HTMLElement } | null = null;
  let menuTeardowns: Array<() => void> = [];
  const activeModals = new Set<HTMLElement>();
  const globalTeardowns: Array<() => void> = [];

  function updateStatusBar() {
    if (!statusBar) {
      return;
    }
    const documentLabel = describeDocument(currentFilePath);
    const suffix = dirty ? ' (unsaved)' : '';
    statusBar.textContent = `${statusMessage} — ${documentLabel}${suffix}`;
    statusBar.title = currentFilePath ?? documentLabel;
  }

  function setStatus(text: string) {
    statusMessage = text;
    updateStatusBar();
  }

  function markDirty() {
    dirty = true;
    updateStatusBar();
  }

  function markClean() {
    dirty = false;
    updateStatusBar();
  }

  function toggleClass(element: HTMLElement, token: string, active: boolean) {
    const tokens = new Set((element.className ?? '').split(/\s+/).filter(Boolean));
    if (active) {
      tokens.add(token);
    } else {
      tokens.delete(token);
    }
    element.className = Array.from(tokens).join(' ');
  }

  function getDocument(): Document | null {
    if (rootDocument) {
      return rootDocument;
    }
    if (typeof document !== 'undefined') {
      return document;
    }
    return null;
  }

  function getWindow(): (Window & typeof globalThis) | null {
    if (rootWindow) {
      return rootWindow;
    }
    const doc = getDocument();
    if (doc && doc.defaultView) {
      return doc.defaultView as Window & typeof globalThis;
    }
    if (typeof window !== 'undefined') {
      return window;
    }
    return null;
  }

  function createElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
    const doc = getDocument();
    if (!doc) {
      throw new Error('Paint app is not mounted.');
    }
    return doc.createElement(tag);
  }

  function getCssColor(color: PaintColor): string {
    const [r, g, b, a] = normalizeColor(color);
    const alpha = Math.max(0, Math.min(1, a / 255));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function ensureContexts() {
    if (!canvas || !overlay) {
      return;
    }
    if (!ctx) {
      ctx = (canvas.getContext && canvas.getContext('2d')) || null;
    }
    if (!overlayCtx) {
      overlayCtx = (overlay.getContext && overlay.getContext('2d')) || null;
      if (overlayCtx) {
        overlayCtx.lineCap = 'round';
        overlayCtx.lineJoin = 'round';
      }
    }
  }

  function renderBitmap() {
    ensureContexts();
    if (!ctx) {
      return;
    }
    try {
      const snapshot = engine.export();
      const imageData = ctx.createImageData(snapshot.width, snapshot.height);
      imageData.data.set(snapshot.pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // Ignore rendering errors in environments without full canvas support.
    }
  }

  function clearOverlay() {
    ensureContexts();
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, width, height);
    }
  }

  function updateCanvasDimensions(nextWidth: number, nextHeight: number) {
    width = Math.max(32, Math.round(nextWidth));
    height = Math.max(32, Math.round(nextHeight));

    if (canvas) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    if (overlay) {
      overlay.width = width;
      overlay.height = height;
      overlay.style.width = `${width}px`;
      overlay.style.height = `${height}px`;
    }

    if (frame) {
      frame.style.width = `${width}px`;
      frame.style.height = `${height}px`;
    }

    ctx = null;
    overlayCtx = null;
    clearOverlay();
    ensureContexts();
    renderBitmap();
  }

  function applyCommand(command: PaintCommand) {
    engine.apply(command);
    renderBitmap();
    markDirty();
  }

  function resetEngine() {
    engine = engineFactory({ width, height, background });
    renderBitmap();
    clearOverlay();
    markDirty();
    setStatus('Canvas cleared');
  }

  function clampPoint(point: StrokePoint): StrokePoint {
    return {
      x: Math.max(0, Math.min(width - 1, point.x)),
      y: Math.max(0, Math.min(height - 1, point.y)),
    };
  }

  function getCanvasPoint(event: PointerEvent | MouseEvent): StrokePoint {
    if ('offsetX' in event && typeof event.offsetX === 'number') {
      return clampPoint({ x: Math.round(event.offsetX), y: Math.round(event.offsetY) });
    }
    if (canvas && typeof canvas.getBoundingClientRect === 'function') {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX ?? 0) - rect.left) * (width / rect.width || 1);
      const y = ((event.clientY ?? 0) - rect.top) * (height / rect.height || 1);
      return clampPoint({ x: Math.round(x), y: Math.round(y) });
    }
    return { x: 0, y: 0 };
  }

  function commitStroke() {
    if (strokePoints.length === 0) {
      return;
    }
    const points = strokePoints.map(clampPoint);
    if (points.length === 1) {
      applyCommand({
        type: 'drawPixels',
        pixels: [{ x: points[0].x, y: points[0].y, color: activeColor }],
      });
    } else {
      applyCommand({
        type: 'stroke',
        color: activeColor,
        size: brushSize,
        points,
      });
    }
    strokePoints = [];
    clearOverlay();
    setStatus('Stroke applied');
  }

  function handlePointerDown(event: PointerEvent) {
    if (!overlay) {
      return;
    }
    overlay.setPointerCapture?.(event.pointerId);
    drawing = true;
    strokePoints = [getCanvasPoint(event)];
    ensureContexts();
    if (overlayCtx) {
      overlayCtx.beginPath();
      overlayCtx.strokeStyle = getCssColor(activeColor);
      overlayCtx.lineWidth = Math.max(1, brushSize);
      overlayCtx.moveTo(strokePoints[0].x, strokePoints[0].y);
    }
    setStatus('Drawing…');
  }

  function handlePointerMove(event: PointerEvent) {
    if (!drawing || !overlayCtx) {
      return;
    }
    const point = getCanvasPoint(event);
    strokePoints.push(point);
    overlayCtx.lineTo(point.x, point.y);
    try {
      overlayCtx.stroke();
    } catch {
      // Ignore drawing errors.
    }
  }

  function handlePointerUp(event: PointerEvent) {
    if (!drawing) {
      return;
    }
    drawing = false;
    overlay?.releasePointerCapture?.(event.pointerId);
    if (overlayCtx) {
      try {
        overlayCtx.closePath();
      } catch {
        // ignore
      }
    }
    commitStroke();
  }

  function handlePointerLeave() {
    if (!drawing) {
      return;
    }
    drawing = false;
    if (overlayCtx) {
      try {
        overlayCtx.closePath();
      } catch {
        // ignore
      }
    }
    commitStroke();
  }

  function attachCanvasEvents(layer: HTMLCanvasElement) {
    layer.addEventListener('pointerdown', handlePointerDown);
    layer.addEventListener('pointermove', handlePointerMove);
    layer.addEventListener('pointerup', handlePointerUp);
    layer.addEventListener('pointerleave', handlePointerLeave);
    layer.addEventListener('pointercancel', handlePointerLeave);
    layer.style.touchAction = 'none';
  }

  function detachCanvasEvents(layer: HTMLCanvasElement | null) {
    if (!layer) {
      return;
    }
    layer.removeEventListener('pointerdown', handlePointerDown);
    layer.removeEventListener('pointermove', handlePointerMove);
    layer.removeEventListener('pointerup', handlePointerUp);
    layer.removeEventListener('pointerleave', handlePointerLeave);
    layer.removeEventListener('pointercancel', handlePointerLeave);
  }

  function closeMenu() {
    menuTeardowns.forEach((fn) => fn());
    menuTeardowns = [];
    if (!activeMenu) {
      return;
    }
    activeMenu.button.setAttribute('aria-expanded', 'false');
    activeMenu.panel.remove();
    activeMenu = null;
  }

  function openMenu(button: HTMLButtonElement, itemsFactory: () => MenuItemConfig[]) {
    if (!container) {
      return;
    }
    if (activeMenu && activeMenu.button === button) {
      closeMenu();
      return;
    }

    closeMenu();
    const items = itemsFactory();
    if (items.length === 0) {
      return;
    }

    const doc = getDocument();
    const panel = createElement('div');
    panel.className = 'app-paint__menu';
    const rect = button.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    panel.style.left = `${rect.left - containerRect.left}px`;
    panel.style.top = `${rect.bottom - containerRect.top}px`;

    items.forEach((config) => {
      if (config.type === 'separator') {
        const separator = doc.createElement('div');
        separator.className = 'app-paint__menu-separator';
        panel.appendChild(separator);
        return;
      }

      const entry = doc.createElement('button');
      entry.type = 'button';
      entry.className = 'app-paint__menu-entry';
      entry.textContent = '';
      if (config.disabled) {
        entry.classList.add('app-paint__menu-entry--disabled');
        entry.disabled = true;
      }

      const label = doc.createElement('span');
      label.className = 'app-paint__menu-entry-label';
      label.textContent = config.label ?? '';
      entry.appendChild(label);

      if (config.shortcut) {
        const shortcut = doc.createElement('span');
        shortcut.className = 'app-paint__menu-entry-shortcut';
        shortcut.textContent = config.shortcut;
        entry.appendChild(shortcut);
      }

      entry.addEventListener('click', () => {
        if (config.disabled) {
          return;
        }
        closeMenu();
        try {
          const result = config.action?.();
          if (result instanceof Promise) {
            void result.catch((error: unknown) => {
              if (error instanceof Error) {
                setStatus(error.message);
              }
            });
          }
        } catch (error) {
          if (error instanceof Error) {
            setStatus(error.message);
          }
        }
      });

      panel.appendChild(entry);
    });

    container.appendChild(panel);
    activeMenu = { button, panel };
    button.setAttribute('aria-expanded', 'true');

    const handlePointer = (event: PointerEvent) => {
      if (!panel.contains(event.target as Node) && !button.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const pointerTarget: (Document | HTMLElement) | null =
      doc && typeof doc.addEventListener === 'function'
        ? doc
        : container && typeof container.addEventListener === 'function'
          ? container
          : null;
    pointerTarget?.addEventListener('pointerdown', handlePointer, true);
    if (pointerTarget) {
      menuTeardowns.push(() => pointerTarget.removeEventListener('pointerdown', handlePointer, true));
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };
    const keyTarget = pointerTarget;
    keyTarget?.addEventListener('keydown', handleKey, true);
    if (keyTarget) {
      menuTeardowns.push(() => keyTarget.removeEventListener('keydown', handleKey, true));
    }
  }

  function confirmDiscard(): boolean {
    if (!dirty) {
      return true;
    }
    const view = getWindow();
    if (view && typeof view.confirm === 'function') {
      return view.confirm('Discard unsaved changes?');
    }
    return true;
  }

  function loadSnapshot(snapshot: PaintEngineSnapshot) {
    updateCanvasDimensions(snapshot.width, snapshot.height);
    engine = engineFactory({ width, height, background });
    const bitmap = engine.getBitmap();
    if (bitmap.data.length === snapshot.pixels.length) {
      bitmap.data.set(snapshot.pixels);
    } else {
      const length = Math.min(bitmap.data.length, snapshot.pixels.length);
      bitmap.data.set(snapshot.pixels.subarray(0, length));
    }
    renderBitmap();
    clearOverlay();
    markClean();
  }

  async function persistToPath(path: string): Promise<void> {
    if (!vfs) {
      setStatus('File system integration is unavailable.');
      return;
    }
    const normalized = normalizePath(ensurePaintExtension(path));
    const snapshot = engine.export();
    const payload = encodeSnapshot(snapshot);
    await vfs.writeFile(normalized, payload, { app: 'paint', format: 'win95paint' });
    currentFilePath = normalized;
    markClean();
    setStatus(`Saved ${describeDocument(currentFilePath)}`);
  }

  async function handleSaveDocument(): Promise<void> {
    if (!vfs) {
      setStatus('File system integration is unavailable.');
      return;
    }
    if (!dirty && currentFilePath) {
      setStatus('No changes to save.');
      return;
    }
    if (!currentFilePath) {
      await handleSaveDocumentAs();
      return;
    }
    try {
      await persistToPath(currentFilePath);
    } catch (error) {
      if (error instanceof Error) {
        setStatus(`Save failed: ${error.message}`);
      }
    }
  }

  async function handleSaveDocumentAs(): Promise<void> {
    if (!vfs) {
      setStatus('File system integration is unavailable.');
      return;
    }
    const seed = currentFilePath ?? join(defaultDirectory, 'Untitled.w95p');
    const selected = await promptForPath('save', seed);
    if (!selected) {
      return;
    }
    try {
      await persistToPath(selected);
    } catch (error) {
      if (error instanceof Error) {
        setStatus(`Save failed: ${error.message}`);
      }
    }
  }

  async function openDocumentFromPath(path: string, options: { confirm?: boolean } = {}): Promise<void> {
    if (!vfs) {
      setStatus('File system integration is unavailable.');
      throw new Error('File system integration is unavailable.');
    }
    if (options.confirm !== false && !confirmDiscard()) {
      return;
    }
    try {
      const node = await vfs.read(path);
      if (node.kind !== 'file') {
        throw new Error('Selected item is not a paint document.');
      }
      const snapshot = decodeSnapshot(node.content);
      currentFilePath = node.path;
      loadSnapshot(snapshot);
      setStatus(`Opened ${describeDocument(currentFilePath)}`);
    } catch (error) {
      if (error instanceof Error) {
        setStatus(`Open failed: ${error.message}`);
        throw error;
      }
      setStatus('Open failed.');
      throw new Error('Open failed.');
    }
  }

  async function handleOpenDocument(): Promise<void> {
    if (!vfs) {
      setStatus('File system integration is unavailable.');
      return;
    }
    if (!confirmDiscard()) {
      return;
    }
    const seed = currentFilePath ?? defaultDirectory;
    const selected = await promptForPath('open', seed);
    if (!selected) {
      return;
    }
    await openDocumentFromPath(selected, { confirm: false }).catch(() => undefined);
  }

  function handleNewDocument() {
    if (!confirmDiscard()) {
      return;
    }
    width = initialWidth;
    height = initialHeight;
    updateCanvasDimensions(width, height);
    engine = engineFactory({ width, height, background });
    currentFilePath = null;
    markClean();
    renderBitmap();
    setStatus('New canvas ready');
  }

  function handleCloseWindow() {
    if (!container) {
      return;
    }
    const frameElement = container.closest('.window-frame');
    const closeButton = frameElement?.querySelector('.window-frame__control--close, [data-window-control="close"]');
    if (closeButton instanceof HTMLButtonElement) {
      closeButton.click();
      return;
    }
    if (frameElement) {
      frameElement.dispatchEvent(new CustomEvent('window:close-request', { bubbles: true }));
    }
  }

  function handleUndo() {
    if (engine.undo()) {
      renderBitmap();
      clearOverlay();
      markDirty();
      setStatus('Undo completed');
    } else {
      setStatus('Nothing to undo');
    }
  }

  function handleRedo() {
    if (engine.redo()) {
      renderBitmap();
      clearOverlay();
      markDirty();
      setStatus('Redo completed');
    } else {
      setStatus('Nothing to redo');
    }
  }

  function bindGlobalShortcuts() {
    const doc = getDocument();
    const handler = (event: KeyboardEvent) => {
      if (!container) {
        return;
      }
      if (!event.ctrlKey || event.altKey) {
        return;
      }
      const frameElement = container.closest('.window-frame');
      if (!frameElement || frameElement.getAttribute('data-active') !== 'true') {
        return;
      }
      const key = event.key.toLowerCase();
      switch (key) {
        case 's':
          event.preventDefault();
          void handleSaveDocument();
          break;
        case 'o':
          event.preventDefault();
          void handleOpenDocument();
          break;
        case 'n':
          event.preventDefault();
          handleNewDocument();
          break;
        case 'z':
          event.preventDefault();
          handleUndo();
          break;
        case 'y':
          event.preventDefault();
          handleRedo();
          break;
        default:
          break;
      }
    };
    const target: (Document | HTMLElement) | null =
      doc && typeof doc.addEventListener === 'function'
        ? doc
        : container && typeof container.addEventListener === 'function'
          ? container
          : null;
    if (!target) {
      return;
    }
    target.addEventListener('keydown', handler as EventListener);
    globalTeardowns.push(() => target.removeEventListener('keydown', handler as EventListener));
  }

  function createFileMenuItems(): MenuItemConfig[] {
    return [
      { label: 'New', shortcut: 'Ctrl+N', action: handleNewDocument },
      { label: 'Open…', shortcut: 'Ctrl+O', action: () => void handleOpenDocument(), disabled: !vfs },
      { label: 'Save', shortcut: 'Ctrl+S', action: () => void handleSaveDocument(), disabled: !vfs },
      { label: 'Save As…', action: () => void handleSaveDocumentAs(), disabled: !vfs },
      { type: 'separator' },
      { label: 'Exit', action: handleCloseWindow },
    ];
  }

  function createEditMenuItems(): MenuItemConfig[] {
    return [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: handleUndo, disabled: !engine.canUndo() },
      { label: 'Redo', shortcut: 'Ctrl+Y', action: handleRedo, disabled: !engine.canRedo() },
      { type: 'separator' },
      { label: 'Clear Canvas', action: resetEngine },
    ];
  }

  function createPlaceholderMenu(label: string): MenuItemConfig[] {
    return [
      {
        label: `${label} commands`,
        disabled: true,
      },
      { type: 'separator' },
      {
        label: 'Coming soon…',
        disabled: true,
      },
    ];
  }

  function promptForPath(mode: DialogMode, seed?: string): Promise<string | undefined> {
    if (!container || !vfs) {
      return Promise.resolve(undefined);
    }

    closeMenu();

    return new Promise((resolve) => {
      const overlayElement = createElement('div');
      overlayElement.className = 'app-paint__modal';

      const dialog = createElement('div');
      dialog.className = 'app-paint__dialog';
      overlayElement.appendChild(dialog);

      container.appendChild(overlayElement);
      activeModals.add(overlayElement);

      const header = createElement('div');
      header.className = 'app-paint__dialog-header';
      header.textContent = mode === 'open' ? 'Open Picture' : 'Save Picture';
      dialog.appendChild(header);

      const body = createElement('div');
      body.className = 'app-paint__dialog-body';
      dialog.appendChild(body);

      const directoryRow = createElement('div');
      directoryRow.className = 'app-paint__dialog-directory';
      body.appendChild(directoryRow);

      const directoryLabel = createElement('div');
      directoryLabel.className = 'app-paint__dialog-directory-path';
      directoryRow.appendChild(directoryLabel);

      const upButton = createElement('button');
      upButton.type = 'button';
      upButton.className = 'app-paint__dialog-button';
      upButton.textContent = 'Up';
      directoryRow.appendChild(upButton);

      const list = createElement('div');
      list.className = 'app-paint__dialog-list';
      body.appendChild(list);

      const field = createElement('label');
      field.className = 'app-paint__dialog-field';
      const fieldLabel = createElement('span');
      fieldLabel.textContent = 'File name:';
      const input = createElement('input');
      input.type = 'text';
      input.className = 'app-paint__dialog-input';
      field.appendChild(fieldLabel);
      field.appendChild(input);
      body.appendChild(field);

      const message = createElement('div');
      message.className = 'app-paint__dialog-message';
      body.appendChild(message);

      const footer = createElement('div');
      footer.className = 'app-paint__dialog-footer';
      dialog.appendChild(footer);

      const confirmButton = createElement('button');
      confirmButton.type = 'button';
      confirmButton.className = 'app-paint__dialog-button';
      confirmButton.textContent = mode === 'open' ? 'Open' : 'Save';
      footer.appendChild(confirmButton);

      const cancelButton = createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'app-paint__dialog-button';
      cancelButton.textContent = 'Cancel';
      footer.appendChild(cancelButton);

      let settled = false;
      let currentDirectory = defaultDirectory;
      let renderToken = 0;

      function cleanup() {
        activeModals.delete(overlayElement);
        overlayElement.remove();
      }

      function finish(result: string | undefined) {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(result);
      }

      function showMessage(text: string) {
        message.textContent = text;
      }

      function clearMessage() {
        message.textContent = '';
      }

      function resolveRelative(path: string): string {
        try {
          return normalizePath(path);
        } catch {
          return join(currentDirectory, path);
        }
      }

      function submit(selectedPath?: string) {
        clearMessage();
        let candidate = selectedPath ?? input.value.trim();
        if (!candidate) {
          showMessage('Enter a file name.');
          return;
        }
        try {
          let target = resolveRelative(candidate);
          if (mode === 'save') {
            target = ensurePaintExtension(target);
          } else {
            target = normalizePath(target);
          }
          finish(target);
        } catch {
          showMessage('Enter a valid absolute path (e.g. C:/Pictures/Image.w95p).');
        }
      }

      function applySeed() {
        if (!seed) {
          currentDirectory = defaultDirectory;
          directoryLabel.textContent = currentDirectory;
          return;
        }
        try {
          const normalizedSeed = normalizePath(seed);
          if (mode === 'save') {
            currentDirectory = dirname(normalizedSeed);
            const name = basename(normalizedSeed);
            if (name && !name.endsWith('/')) {
              input.value = name;
            }
          } else {
            currentDirectory = seed.endsWith('/') ? normalizedSeed : dirname(normalizedSeed);
            if (!seed.endsWith('/')) {
              input.value = basename(normalizedSeed);
            }
          }
        } catch {
          currentDirectory = defaultDirectory;
        }
        directoryLabel.textContent = currentDirectory;
      }

      function renderEntries() {
        const token = ++renderToken;
        list.innerHTML = '';
        directoryLabel.textContent = currentDirectory;
        const loading = createElement('div');
        loading.className = 'app-paint__dialog-empty';
        loading.textContent = 'Loading…';
        list.appendChild(loading);

        vfs
          .list(currentDirectory)
          .then((entries) => {
            if (settled || token !== renderToken) {
              return;
            }
            list.innerHTML = '';
            const sorted = entries.slice().sort((a, b) => {
              if (a.kind === b.kind) {
                return a.name.localeCompare(b.name);
              }
              if (a.kind === 'directory') {
                return -1;
              }
              if (b.kind === 'directory') {
                return 1;
              }
              return a.name.localeCompare(b.name);
            });

            if (sorted.length === 0) {
              const empty = createElement('div');
              empty.className = 'app-paint__dialog-empty';
              empty.textContent = 'This folder is empty.';
              list.appendChild(empty);
              return;
            }

            sorted.forEach((entry) => {
              const item = createElement('button');
              item.type = 'button';
              item.className = 'app-paint__dialog-list-item';
              item.dataset.path = entry.path;
              item.textContent = entry.name;
              if (entry.kind === 'directory') {
                item.classList.add('app-paint__dialog-list-item--directory');
                item.addEventListener('click', () => {
                  currentDirectory = entry.path;
                  renderEntries();
                });
                item.addEventListener('dblclick', () => {
                  currentDirectory = entry.path;
                  renderEntries();
                });
              } else {
                item.classList.add('app-paint__dialog-list-item--file');
                item.addEventListener('click', () => {
                  input.value = entry.name;
                  clearMessage();
                });
                item.addEventListener('dblclick', () => submit(entry.path));
              }
              list.appendChild(item);
            });
          })
          .catch(() => {
            if (settled || token !== renderToken) {
              return;
            }
            list.innerHTML = '';
            const failure = createElement('div');
            failure.className = 'app-paint__dialog-empty';
            failure.textContent = 'Unable to open folder.';
            list.appendChild(failure);
          });
      }

      upButton.addEventListener('click', () => {
        try {
          if (isRoot(currentDirectory)) {
            return;
          }
          currentDirectory = dirname(currentDirectory);
          renderEntries();
        } catch {
          // ignore invalid navigation
        }
      });

      confirmButton.addEventListener('click', () => submit());
      cancelButton.addEventListener('click', () => finish(undefined));

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          submit();
        }
      });

      overlayElement.addEventListener('pointerdown', (event) => {
        if (event.target === overlayElement) {
          event.stopPropagation();
          finish(undefined);
        }
      });

      overlayElement.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          finish(undefined);
        }
      });

      applySeed();
      renderEntries();
      setTimeout(() => input.focus(), 0);
    });
  }

  function buildMenuBar(): HTMLElement {
    const bar = createElement('div');
    bar.className = 'app-paint__menubar';

    const createButton = (label: string, factory: () => MenuItemConfig[]) => {
      const button = createElement('button');
      button.type = 'button';
      button.className = 'app-paint__menubar-button';
      button.textContent = label;
      button.addEventListener('click', () => openMenu(button, factory));
      bar.appendChild(button);
      return button;
    };

    createButton('File', createFileMenuItems);
    createButton('Edit', createEditMenuItems);
    createButton('Image', () => createPlaceholderMenu('Image'));
    createButton('Colors', () => createPlaceholderMenu('Colors'));
    createButton('Help', () => [
      {
        label: 'About Paint…',
        action: () => featurePlaceholder('Help', setStatus),
      },
    ]);

    return bar;
  }

  function buildToolbar(): HTMLElement {
    const bar = createElement('div');
    bar.className = 'app-paint__toolbar';

    const paletteContainer = createElement('div');
    paletteContainer.className = 'app-paint__palette';

    swatches = palette.map((color) => {
      const button = createElement('button');
      button.type = 'button';
      button.className = 'app-paint__swatch';
      button.dataset.color = JSON.stringify(color);
      button.style.background = getCssColor(color);
      button.addEventListener('click', () => {
        activeColor = color;
        const encoded = JSON.stringify(color);
        swatches.forEach((entry) => {
          toggleClass(entry, 'app-paint__swatch--active', entry.dataset.color === encoded);
        });
        setStatus('Brush ready');
      });
      paletteContainer.appendChild(button);
      return button;
    });

    const brushGroup = createElement('label');
    brushGroup.className = 'app-paint__brush';
    brushGroup.textContent = 'Brush:';

    brushInput = createElement('input');
    brushInput.type = 'number';
    brushInput.min = '1';
    brushInput.max = '20';
    brushInput.value = String(brushSize);
    brushInput.addEventListener('change', () => {
      const next = Number(brushInput?.value ?? brushSize) || brushSize;
      brushSize = Math.max(1, Math.min(20, Math.round(next)));
      if (brushInput) {
        brushInput.value = String(brushSize);
      }
      setStatus(`Brush size: ${brushSize}`);
    });
    brushGroup.appendChild(brushInput);

    const clearButton = createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'app-paint__button';
    clearButton.textContent = 'Clear';
    clearButton.addEventListener('click', () => resetEngine());

    bar.appendChild(paletteContainer);
    bar.appendChild(brushGroup);
    bar.appendChild(clearButton);

    return bar;
  }

  function buildCanvas(): HTMLElement {
    surface = createElement('div');
    surface.className = 'app-paint__surface';

    frame = createElement('div');
    frame.className = 'app-paint__canvas';
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;

    canvas = createElement('canvas');
    canvas.className = 'app-paint__layer';
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    overlay = createElement('canvas');
    overlay.className = 'app-paint__layer app-paint__layer--overlay';
    overlay.width = width;
    overlay.height = height;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;

    frame.appendChild(canvas);
    frame.appendChild(overlay);
    surface.appendChild(frame);

    attachCanvasEvents(overlay);
    ensureContexts();
    renderBitmap();

    return surface;
  }

  function buildStatus(): HTMLElement {
    const status = createElement('div');
    status.className = 'app-paint__status';
    status.textContent = 'Brush ready — Untitled';
    return status;
  }

  return {
    mount(host) {
      const doc = host.ownerDocument ?? getDocument();
      if (!doc) {
        throw new Error('Cannot mount Paint app without a document context.');
      }
      rootDocument = doc;
      rootWindow = doc.defaultView ?? (typeof window !== 'undefined' ? window : null);

      container = doc.createElement('div');
      container.className = 'app-paint';

      menuBar = buildMenuBar();
      container.appendChild(menuBar);

      toolbar = buildToolbar();
      container.appendChild(toolbar);

      const canvasSurface = buildCanvas();
      container.appendChild(canvasSurface);

      statusBar = buildStatus();
      container.appendChild(statusBar);

      swatches.forEach((button) => {
        toggleClass(button, 'app-paint__swatch--active', button.dataset.color === JSON.stringify(activeColor));
      });

      host.innerHTML = '';
      host.appendChild(container);
      markClean();
      setStatus('Brush ready');
      bindGlobalShortcuts();
    },
    async openDocument(path: string) {
      await openDocumentFromPath(path);
    },
    destroy() {
      closeMenu();
      activeModals.forEach((modal) => modal.remove());
      activeModals.clear();
      globalTeardowns.forEach((teardown) => teardown());
      globalTeardowns.length = 0;
      detachCanvasEvents(overlay);
      if (container && container.parentElement) {
        container.parentElement.removeChild(container);
      }
      container = null;
      menuBar = null;
      toolbar = null;
      surface = null;
      frame = null;
      canvas = null;
      overlay = null;
      statusBar = null;
      brushInput = null;
      swatches = [];
      ctx = null;
      overlayCtx = null;
      strokePoints = [];
      rootDocument = null;
      rootWindow = null;
    },
  };
}
