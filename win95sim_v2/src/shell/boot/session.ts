import { createModuleRegistry } from '@core/kernel/moduleRegistry';
import { createEventBus } from '@core/kernel/eventBus';
import { createSettingsService } from '@services/settings';
import { createDisplayService } from '@services/display';
import { createLayoutService } from '@services/layout';
import { createWindowService, type WindowDescriptor, type WindowEvent } from '@services/window';
import { createDiagnosticsService } from '@services/diagnostics';
import { createWindowManager } from '@apps/shell/window-manager';
import { createTaskbarController, type TaskButton } from '@apps/shell/taskbar';
import { createStartMenuModel, type StartMenuManifestSection } from '@apps/shell/start-menu';
import { createDesktopModule, type DesktopEntry } from '@apps/shell/desktop';
import { createExplorerApp, type ExplorerInstance } from '@apps/explorer';
import { createPaintApp, type PaintAppInstance } from '@apps/creative/paint';
import { createNotepadApp } from '@apps/accessories/notepad';
import { createNotepadWindow, type NotepadWindowInstance } from '@apps/accessories/notepad/ui';
import { createNavigatorApp, type NavigatorAppInstance } from '@apps/internet/navigator';
import { createRecentDocumentsService } from '@services/recent-documents';
import { createDialogStateService } from '@services/dialog-state';
import { createCrtViewport } from '@ui/components/crtViewport';
import { createWindowFrame } from '@ui/components/windowFrame';
import { createTaskbarView } from '@ui/components/taskbar';
import { createStartMenuView } from '@ui/components/startMenu';
import { createDesktopView, type DesktopDragEvent } from '@ui/components/desktopIcons';
import { createVfsService } from '@services/vfs';
import { createWindowInteractionController } from '@features/window-interactions';
import { createPrintService } from '@services/print';

export interface ShellSession {
  mount(root: HTMLElement): void;
  createWindow(descriptor: WindowDescriptor): WindowDescriptor;
  listWindows(): WindowDescriptor[];
}

type WindowContentSource =
  | string
  | HTMLElement
  | (() => HTMLElement | string);

interface ShellWindowOptions {
  id?: string;
  title: string;
  icon?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  content?: WindowContentSource;
}

const DEFAULT_WINDOW_WIDTH = 360;
const DEFAULT_WINDOW_HEIGHT = 260;
const WINDOW_CASCADE_STEP = 24;
const DESKTOP_SURFACE_ID = '::desktop';
const DEFAULT_EXPLORER_HOME = 'C:/';
const DEFAULT_NAVIGATOR_HOME = 'https://www.example.com/';
const STARTUP_FOLDER_PATH = 'C:/Start Menu/Programs/StartUp';
const WINDOW_ICONS = {
  defaultApp: 'icons/w2k_default_application.ico',
  welcome: 'icons/w98_windows.ico',
  myComputer: 'icons/w98_computer.ico',
  recycleBin: 'icons/w98_recycle_bin_empty.ico',
  internetExplorer: 'icons/w98_msie1.ico',
  paint: 'icons/w98_paint.ico',
  notepad: 'icons/w98_notepad.ico',
  explorer: 'icons/w98_directory_explorer.ico',
  minesweeper: 'icons/w98_minesweeper.ico',
  msdos: 'icons/w98_ms-dos.ico',
  internetMail: 'icons/w98_mailbox_world.ico',
  internetNews: 'icons/w98_newspaper.ico',
  controlPanel: 'icons/w98_directory_control_panel.ico',
  taskbar: 'icons/w2k_taskbar.ico',
  findFiles: 'icons/w2k_search.ico',
  help: 'icons/w98_help_book_cool.ico',
  run: 'icons/w2k_run.ico',
  startup: 'icons/w2k_folder_open.ico',
  shutdown: 'icons/w2k_shutdown.ico',
  documents: 'icons/w2k_folder_closed.ico',
} as const;
const DEFAULT_VFS_SEED: Array<{ path: string; kind: 'directory' | 'file' | 'shortcut'; content?: string; target?: string }> = [
  { path: 'C:/Documents', kind: 'directory' },
  {
    path: 'C:/Documents/Welcome to Win95Sim.txt',
    kind: 'file',
    content: 'Thanks for trying the Windows 95 simulator!\nExplore the Start menu to launch classic experiences.',
  },
  { path: 'C:/Projects', kind: 'directory' },
  {
    path: 'C:/Projects/Win95Sim Roadmap.txt',
    kind: 'file',
    content: '- Polish the Start menu icons\n- Hook up Explorer integration\n- Emulate taskbar tray icons',
  },
  { path: 'C:/Downloads', kind: 'directory' },
  { path: 'C:/Start Menu', kind: 'directory' },
  { path: 'C:/Start Menu/Programs', kind: 'directory' },
  { path: 'C:/Start Menu/Programs/Accessories', kind: 'directory' },
  { path: 'C:/Start Menu/Programs/Accessories/Games', kind: 'directory' },
  { path: STARTUP_FOLDER_PATH, kind: 'directory' },
  {
    path: `${STARTUP_FOLDER_PATH}/Readme.txt`,
    kind: 'file',
    content: 'Place shortcuts in this folder to launch applications automatically when Win95Sim boots.',
  },
];

export const DESKTOP_DEFAULT_ENTRIES: DesktopEntry[] = [
  {
    id: 'desktop/computer',
    title: 'My Computer',
    resource: '::desktop/computer',
    type: 'folder',
    icon: WINDOW_ICONS.myComputer,
  },
  {
    id: 'desktop/recycle-bin',
    title: 'Recycle Bin',
    resource: '::desktop/recycle-bin',
    type: 'folder',
    icon: WINDOW_ICONS.recycleBin,
  },
  {
    id: 'desktop/internet-explorer',
    title: 'Internet Explorer',
    resource: '::desktop/internet-explorer',
    type: 'shortcut',
    icon: WINDOW_ICONS.internetExplorer,
  },
  {
    id: 'desktop/paint',
    title: 'Paint',
    resource: '::desktop/paint',
    type: 'shortcut',
    icon: WINDOW_ICONS.paint,
  },
  {
    id: 'desktop/notepad',
    title: 'Notepad',
    resource: '::desktop/notepad',
    type: 'shortcut',
    icon: WINDOW_ICONS.notepad,
  },
  {
    id: 'desktop/explorer',
    title: 'Windows Explorer',
    resource: '::desktop/explorer',
    type: 'shortcut',
    icon: WINDOW_ICONS.explorer,
  },
  {
    id: 'desktop/minesweeper',
    title: 'Minesweeper',
    resource: '::desktop/minesweeper',
    type: 'shortcut',
    icon: WINDOW_ICONS.minesweeper,
  },
  {
    id: 'desktop/msdos',
    title: 'MS-DOS Prompt',
    resource: '::desktop/msdos',
    type: 'shortcut',
    icon: WINDOW_ICONS.msdos,
  },
];

export const DESKTOP_SHORTCUT_COMMANDS: Record<string, string> = {
  'desktop/computer': 'shell:start:my-computer',
  'desktop/recycle-bin': 'shell:start:recycle-bin',
  'desktop/internet-explorer': 'shell:start:internet-explorer',
  'desktop/paint': 'shell:start:paint',
  'desktop/notepad': 'shell:start:notepad',
  'desktop/explorer': 'shell:start:explorer',
  'desktop/minesweeper': 'shell:start:minesweeper',
  'desktop/msdos': 'shell:start:msdos',
};

export function createShellSession(): ShellSession {
  const registry = createModuleRegistry();
  const bus = createEventBus();

  const settings = createSettingsService({ theme: 'classic' });
  const display = createDisplayService();
  const windows = createWindowService();
  const windowManager = createWindowManager({ display, windows, bus });
  const diagnostics = createDiagnosticsService({ settings });
  const dialogState = createDialogStateService();
  const print = createPrintService();
  const vfs = createVfsService({ seed: DEFAULT_VFS_SEED });
  const recentDocuments = createRecentDocumentsService();
  const startMenuModel = createStartMenuModel({ recentDocuments });
  const taskbar = createTaskbarController({ windows, bus });
  const layout = createLayoutService({ defaultGridSize: 48 });
  const desktopEntries: DesktopEntry[] = DESKTOP_DEFAULT_ENTRIES.map((entry) => ({ ...entry }));
  const desktopModule = createDesktopModule({
    layout,
    resolveEntries: () => desktopEntries,
    gridSize: 48,
  });

  layout.setItem(DESKTOP_SURFACE_ID, 'desktop/computer', { x: 30, y: 10 }, { snapToGrid: false });
  layout.setItem(DESKTOP_SURFACE_ID, 'desktop/recycle-bin', { x: 30, y: 78 }, { snapToGrid: false });
  layout.setItem(DESKTOP_SURFACE_ID, 'desktop/internet-explorer', { x: 30, y: 146 }, { snapToGrid: false });
  layout.setItem(DESKTOP_SURFACE_ID, 'desktop/paint', { x: 30, y: 214 }, { snapToGrid: false });
  layout.setItem(DESKTOP_SURFACE_ID, 'desktop/notepad', { x: 30, y: 282 }, { snapToGrid: false });
  layout.setItem(DESKTOP_SURFACE_ID, 'desktop/explorer', { x: 30, y: 350 }, { snapToGrid: false });
  layout.setItem(DESKTOP_SURFACE_ID, 'desktop/minesweeper', { x: 30, y: 418 }, { snapToGrid: false });
  layout.setItem(DESKTOP_SURFACE_ID, 'desktop/msdos', { x: 30, y: 486 }, { snapToGrid: false });

  layout.bus.on('layout:updated', ({ surfaceId }) => {
    if (surfaceId === DESKTOP_SURFACE_ID) {
      renderDesktop();
    }
  });

  registry.register({ id: 'services/settings', version: '2.0.0', factory: () => settings });
  registry.register({ id: 'services/display', version: '2.0.0', factory: () => display });
  registry.register({ id: 'services/windows', version: '2.0.0', factory: () => windows });
  registry.register({ id: 'services/layout', version: '2.0.0', factory: () => layout });
  registry.register({ id: 'services/vfs', version: '2.0.0', factory: () => vfs });
  registry.register({ id: 'services/dialog-state', version: '2.0.0', factory: () => dialogState });
  registry.register({ id: 'services/print', version: '2.0.0', factory: () => print });
  registry.register({ id: 'apps/window-manager', version: '2.0.0', factory: () => windowManager });
  registry.register({ id: 'services/diagnostics', version: '2.0.0', factory: () => diagnostics });
  registry.register({ id: 'shell/session', version: '2.0.0', factory: () => ({ bus, registry }) });

  const frames = new Map<string, ReturnType<typeof createWindowFrame>>();
  const windowControllers = new Map<string, ReturnType<typeof createWindowInteractionController>>();
  const pendingContent = new Map<string, HTMLElement>();
  const appTeardowns = new Map<string, () => void>();
  const notepadWindows = new Map<string, NotepadWindowInstance>();

  let viewport: ReturnType<typeof createCrtViewport> | undefined;
  let workspace: HTMLElement | undefined;
  let windowsLayer: HTMLElement | undefined;
  let desktopView: ReturnType<typeof createDesktopView> | undefined;
  let taskbarView: ReturnType<typeof createTaskbarView> | undefined;
  let startMenuView: ReturnType<typeof createStartMenuView> | undefined;
  let currentTaskButtons: TaskButton[] = taskbar.listButtons();
  let desktopDragState:
    | {
        pointerId: number;
        ids: string[];
        origins: Map<string, { x: number; y: number }>;
      }
    | undefined;

  let cascadeOffset = 0;
  let windowSequence = 1;

  function resolveWorkspaceBounds(): { width: number; height: number } | undefined {
    if (workspace && typeof workspace.getBoundingClientRect === 'function') {
      const rect = workspace.getBoundingClientRect();
      if (rect) {
        const width = typeof rect.width === 'number' ? rect.width : 0;
        const height = typeof rect.height === 'number' ? rect.height : 0;
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
    }

    const state = display.getState();
    if (state.width && state.height) {
      return { width: state.width, height: state.height };
    }
    return undefined;
  }

  function ensureViewport(root: HTMLElement) {
    if (viewport) {
      return viewport;
    }

    viewport = createCrtViewport();
    root.appendChild(viewport.element);

    const desktop = document.createElement('div');
    desktop.className = 'desktop-root';

    workspace = document.createElement('div');
    workspace.className = 'desktop-root__workspace';

    // Add build version badge
    const versionBadge = document.createElement('div');
    versionBadge.className = 'desktop-version-badge';
    
    // Build metadata is injected at build time
    try {
      const metadata = typeof __BUILD_METADATA__ !== 'undefined' ? __BUILD_METADATA__ : null;
      if (metadata) {
        versionBadge.textContent = `${metadata.version} (${metadata.commitShort})`;
        versionBadge.title = `Build: ${metadata.buildNumber}\nCommit: ${metadata.commitSha}\nBranch: ${metadata.branch}\nBuilt: ${metadata.timestamp}`;
      } else {
        versionBadge.textContent = 'dev';
      }
    } catch {
      versionBadge.textContent = 'dev';
    }
    
    workspace.appendChild(versionBadge);

    desktopView = createDesktopView({
      onOpen: (id) => handleDesktopOpen(id),
      onSelect: (id, additive) => handleDesktopSelection(id, additive),
      onClearSelection: () => {
        desktopModule.clearSelection();
        renderDesktop();
      },
      onDragStart: (event) => handleDesktopDragStart(event),
      onDrag: (event) => handleDesktopDrag(event),
      onDragEnd: (event) => handleDesktopDragEnd(event),
    });
    workspace.appendChild(desktopView.element);

    windowsLayer = document.createElement('div');
    windowsLayer.className = 'desktop-root__windows';
    workspace.appendChild(windowsLayer);
    desktop.appendChild(workspace);

    renderDesktop();

    startMenuView = createStartMenuView({
      onCommand: (command) => handleStartCommand(command),
    });
    desktop.appendChild(startMenuView.element);

    taskbarView = createTaskbarView({
      onStartToggle: () => {
        toggleStartMenu();
      },
      onTaskSelected: (id) => {
        const button = currentTaskButtons.find((entry) => entry.id === id);
        closeStartMenu();
        if (!button) {
          return;
        }
        if (button.state === 'active') {
          taskbar.toggleMinimize(id);
        } else {
          taskbar.activateWindow(id);
        }
      },
    });
    taskbarView.setButtons(currentTaskButtons);
    taskbarView.setStartMenuOpen(false);
    desktop.appendChild(taskbarView.element);

    viewport.mount(desktop);

    workspace.addEventListener('dblclick', (event) => {
      const rawTarget = event.target as EventTarget | null;
      let targetElement: HTMLElement | null = null;

      if (typeof HTMLElement !== 'undefined' && rawTarget instanceof HTMLElement) {
        targetElement = rawTarget;
      } else if (rawTarget && typeof (rawTarget as { parentElement?: unknown }).parentElement === 'object') {
        targetElement =
          ((rawTarget as { parentElement?: HTMLElement | null }).parentElement as HTMLElement | null) ?? null;
      }

      const isWithinClass = (element: HTMLElement | null, className: string) => {
        let current: HTMLElement | null = element;
        while (current) {
          const classValue = typeof current.className === 'string' ? current.className : '';
          const classes = classValue.split(/\s+/).filter(Boolean);
          if (classes.includes(className)) {
            return true;
          }
          current = current.parentElement as HTMLElement | null;
        }
        return false;
      };

      if (targetElement) {
        if (typeof (targetElement as { closest?: unknown }).closest === 'function') {
          const elementWithClosest = targetElement as { closest: (selector: string) => Element | null };
          if (elementWithClosest.closest('.window-frame') || elementWithClosest.closest('.desktop-icon')) {
            return;
          }
        } else if (isWithinClass(targetElement, 'window-frame') || isWithinClass(targetElement, 'desktop-icon')) {
          return;
        }
      }

      handleStartCommand('shell:start:blank');
    });

    const updateDisplayDimensions = () => {
      const bounds = resolveWorkspaceBounds();
      if (!bounds) {
        return;
      }
      const width = Math.max(0, Math.round(bounds.width));
      const height = Math.max(0, Math.round(bounds.height));
      if (width === 0 || height === 0) {
        return;
      }
      display.setResolution(width, height);
      windowControllers.forEach((controller) => {
        controller.setWorkspaceBounds({ width, height });
      });
    };
    updateDisplayDimensions();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', updateDisplayDimensions);
    }

    bus.on('taskbar:buttons-changed', (buttons: TaskButton[]) => {
      currentTaskButtons = buttons;
      taskbarView?.setButtons(buttons);
    });

    windows.bus.on<WindowEvent>('window:created', ({ descriptor }) => {
      if (!windowsLayer) {
        return;
      }

      const frame = createWindowFrame({
        title: descriptor.title,
        icon: descriptor.icon,
        onClose: () => windowManager.closeWindow(descriptor.id),
        onMinimize: () => windowManager.minimizeWindow(descriptor.id),
        onMaximize: () => {
          const current = windows.get(descriptor.id);
          if (!current) {
            return;
          }

          if (current.state === 'maximized') {
            windowManager.restoreWindow(descriptor.id);
          } else {
            windowManager.maximizeWindow(descriptor.id);
          }
        },
      });

      frame.element.addEventListener('mousedown', () => {
        windows.focus(descriptor.id);
      });

      const content = pendingContent.get(descriptor.id);
      if (content) {
        frame.content.appendChild(content);
        pendingContent.delete(descriptor.id);
      }

      frames.set(descriptor.id, frame);
      windowsLayer.appendChild(frame.element);
      const bounds = resolveWorkspaceBounds();
      const controller = createWindowInteractionController({
        windowId: descriptor.id,
        frame,
        windowManager,
        windows,
        display,
        workspaceBounds: bounds,
      });
      windowControllers.set(descriptor.id, controller);
      renderWindow(descriptor.id, descriptor);
    });

    const updateWindow = ({ descriptor }: WindowEvent) => {
      renderWindow(descriptor.id, descriptor);
    };

    windows.bus.on<WindowEvent>('window:updated', updateWindow);
    windows.bus.on<WindowEvent>('window:activated', updateWindow);
    windows.bus.on<WindowEvent>('window:removed', ({ id }) => {
      const frame = frames.get(id);
      if (frame) {
        frame.element.remove();
        frames.delete(id);
      }
      const controller = windowControllers.get(id);
      if (controller) {
        controller.destroy();
        windowControllers.delete(id);
      }
      pendingContent.delete(id);
      const teardown = appTeardowns.get(id);
      if (teardown) {
        teardown();
        appTeardowns.delete(id);
      }
    });

    viewport.setStatus('ready');
    bus.emit('session:ready', { registry });

    return viewport;
  }

  function renderDesktop() {
    if (!desktopView) {
      return;
    }
    desktopView.render(desktopModule.list());
  }

  function handleDesktopSelection(id: string, additive: boolean) {
    const current = new Set(desktopModule.getSelection());
    if (additive) {
      if (current.has(id)) {
        current.delete(id);
      } else {
        current.add(id);
      }
    } else {
      current.clear();
      current.add(id);
    }
    desktopModule.setSelection(Array.from(current));
    renderDesktop();
  }

  function handleDesktopDragStart(event: DesktopDragEvent) {
    const currentSelection = new Set(desktopModule.getSelection());
    if (!currentSelection.has(event.id)) {
      currentSelection.clear();
      currentSelection.add(event.id);
      desktopModule.setSelection(Array.from(currentSelection));
      renderDesktop();
    }

    const snapshot = layout.getSnapshot(DESKTOP_SURFACE_ID);
    const trackedIds = Array.from(currentSelection);
    const origins = new Map<string, { x: number; y: number }>();

    trackedIds.forEach((itemId) => {
      const position = snapshot.items[itemId];
      if (position) {
        origins.set(itemId, { x: position.x, y: position.y });
      }
    });

    if (!origins.has(event.id)) {
      const fallback = snapshot.items[event.id];
      if (fallback) {
        origins.set(event.id, { x: fallback.x, y: fallback.y });
      }
    }

    if (origins.size === 0) {
      desktopDragState = undefined;
      return;
    }

    desktopDragState = {
      pointerId: event.pointerId,
      ids: Array.from(origins.keys()),
      origins,
    };
  }

  function handleDesktopDrag(event: DesktopDragEvent) {
    if (!desktopDragState || desktopDragState.pointerId !== event.pointerId) {
      return;
    }

    desktopDragState.ids.forEach((id) => {
      const origin = desktopDragState?.origins.get(id);
      if (!origin) {
        return;
      }
      desktopModule.move(
        id,
        {
          x: origin.x + event.delta.x,
          y: origin.y + event.delta.y,
        },
        { snapToGrid: false },
      );
    });
  }

  function handleDesktopDragEnd(event: DesktopDragEvent) {
    if (!desktopDragState || desktopDragState.pointerId !== event.pointerId) {
      return;
    }

    desktopDragState.ids.forEach((id) => {
      const origin = desktopDragState?.origins.get(id);
      if (!origin) {
        return;
      }
      desktopModule.move(
        id,
        {
          x: origin.x + event.delta.x,
          y: origin.y + event.delta.y,
        },
        { snapToGrid: true },
      );
    });

    desktopDragState = undefined;
  }

  function handleDesktopOpen(id: string) {
    const command = DESKTOP_SHORTCUT_COMMANDS[id];
    if (command) {
      executeCommand(command);
    } else {
      openWindow({
        title: 'Win95Sim',
        icon: WINDOW_ICONS.defaultApp,
        width: 320,
        height: 240,
        content: () =>
          createPlaceholderContent('Desktop Item', 'This shortcut is not active in this build.'),
      });
    }
  }

  function renderWindow(id: string, descriptor: WindowDescriptor) {
    const frame = frames.get(id);
    if (!frame) {
      return;
    }

    if (descriptor.state === 'maximized') {
      frame.element.style.left = '0';
      frame.element.style.top = '0';
      frame.element.style.width = '';
      frame.element.style.height = '';
    } else {
      frame.element.style.left = `${descriptor.bounds.x}px`;
      frame.element.style.top = `${descriptor.bounds.y}px`;
      frame.element.style.width = `${descriptor.bounds.width}px`;
      frame.element.style.height = `${descriptor.bounds.height}px`;
    }

    frame.element.style.zIndex = String(descriptor.zIndex ?? 1);
    frame.element.dataset.state = descriptor.state ?? 'normal';
    frame.element.toggleAttribute('hidden', descriptor.state === 'minimized');

    const activeId = windows.getActiveWindow()?.id;
    if (activeId === id) {
      frame.element.dataset.active = 'true';
    } else {
      delete frame.element.dataset.active;
    }
  }

  function cloneSections(): StartMenuManifestSection[] {
    const base = startMenuModel.getSections();
    const documents = base.find((section) => section.id === 'documents');
    if (documents) {
      const recents = startMenuModel.getRecentDocuments();
      if (recents.length) {
        documents.items = recents.map((entry) => ({
          id: `recent/${entry.id}`,
          label: entry.title,
          type: 'command',
          command: `shell:open:recent:${entry.id}`,
        }));
      } else {
        documents.items = [];
      }
    }

    const win95Section: StartMenuManifestSection = {
      id: 'win95sim',
      label: 'Win95Sim',
      items: [
        { id: 'win95sim/welcome', label: 'Windows 95', type: 'command', command: 'shell:start:welcome' },
        { id: 'win95sim/blank', label: 'New Empty Window', type: 'command', command: 'shell:start:blank' },
      ],
    };

    return [win95Section, ...base];
  }

  function refreshStartMenu() {
    if (!startMenuView) {
      return;
    }
    startMenuView.render(cloneSections());
  }

  function openStartMenu() {
    if (!startMenuView || !taskbarView) {
      return;
    }
    startMenuModel.open();
    refreshStartMenu();
    startMenuView.setOpen(true);
    taskbarView.setStartMenuOpen(true);
  }

  function closeStartMenu() {
    if (startMenuModel.isOpen()) {
      startMenuModel.close();
    }
    startMenuView?.setOpen(false);
    taskbarView?.setStartMenuOpen(false);
  }

  function toggleStartMenu() {
    if (startMenuModel.isOpen()) {
      closeStartMenu();
    } else {
      openStartMenu();
    }
  }

  function createContentElement(source?: WindowContentSource): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'window-content';

    const resolve = (value?: WindowContentSource): HTMLElement => {
      if (typeof value === 'function') {
        return resolve(value());
      }
      if (typeof value === 'string') {
        const paragraph = document.createElement('p');
        paragraph.textContent = value;
        return paragraph;
      }
      if (value && typeof value === 'object') {
        const candidate = value as { tagName?: unknown; appendChild?: unknown };
        const isDomElement = (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) ||
          typeof candidate.tagName === 'string' ||
          typeof candidate.appendChild === 'function';
        if (isDomElement) {
          return value as HTMLElement;
        }
      }
      const fallback = document.createElement('div');
      fallback.textContent = '';
      return fallback;
    };

    const node = resolve(source);
    wrapper.appendChild(node);
    return wrapper;
  }

  function constrainPosition(value: number, max: number) {
    return Math.max(0, Math.min(value, Math.max(0, max)));
  }

  function openWindow(options: ShellWindowOptions): WindowDescriptor {
    const displayState = display.getState();
    const width = Math.min(options.width ?? DEFAULT_WINDOW_WIDTH, displayState.width || DEFAULT_WINDOW_WIDTH);
    const height = Math.min(options.height ?? DEFAULT_WINDOW_HEIGHT, displayState.height || DEFAULT_WINDOW_HEIGHT);
    const icon = options.icon ?? WINDOW_ICONS.defaultApp;

    const baseX = options.x ?? (80 + cascadeOffset);
    const baseY = options.y ?? (60 + cascadeOffset);
    const x = constrainPosition(baseX, (displayState.width ?? width) - width);
    const y = constrainPosition(baseY, (displayState.height ?? height) - height);

    cascadeOffset = (cascadeOffset + WINDOW_CASCADE_STEP) % 160;

    const id = options.id ?? `shell:window:${windowSequence++}`;

    if (windows.get(id)) {
      windowManager.restoreWindow(id);
      windows.focus(id);
      return windows.get(id)!;
    }

    const contentElement = createContentElement(options.content);
    pendingContent.set(id, contentElement);

    try {
      return windowManager.createWindow({
        id,
        title: options.title,
        icon,
        bounds: {
          x,
          y,
          width,
          height,
        },
      });
    } catch (error) {
      pendingContent.delete(id);
      throw error;
    }
  }

  function createWelcomeContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'app-welcome';

    const heading = document.createElement('h1');
    heading.textContent = 'Welcome to Win95Sim';
    container.appendChild(heading);

    const intro = document.createElement('p');
    intro.textContent = 'Use the Start button to launch apps, or double-click the desktop to open a new window.';
    container.appendChild(intro);

    const list = document.createElement('ul');
    ['Start menu with demo programs', 'Taskbar buttons for switching windows', 'Maximize, minimize, and restore support'].forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    container.appendChild(list);

    return container;
  }

  function createPlaceholderContent(title: string, message: string): HTMLElement {
    const container = document.createElement('div');
    container.className = 'app-placeholder';

    const heading = document.createElement('h2');
    heading.textContent = title;
    container.appendChild(heading);

    const paragraph = document.createElement('p');
    paragraph.textContent = message;
    container.appendChild(paragraph);

    return container;
  }

  function createNotepadContent(windowId: string): HTMLElement {
    const appInstance = createNotepadApp({ settings, dialogState, print });
    const instance = createNotepadWindow({
      app: appInstance,
      vfs,
      recentDocuments,
      onRequestClose: () => {
        windowManager.closeWindow(windowId);
      },
      onTitleChange: (title) => {
        try {
          windowManager.update(windowId, { title });
        } catch {
          // Ignore errors if the window was already closed.
        }
      },
    });
    notepadWindows.set(windowId, instance);
    return instance.element;
  }

  function createRunDialogContent(): HTMLElement {
    const form = document.createElement('form');
    form.className = 'app-run';

    const label = document.createElement('label');
    label.className = 'app-run__label';
    label.textContent = 'Open:';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'app-run__input';
    input.placeholder = 'Type the name of a program, folder, or document';

    const actions = document.createElement('div');
    actions.className = 'app-run__actions';

    const okButton = document.createElement('button');
    okButton.type = 'button';
    okButton.textContent = 'OK';
    okButton.addEventListener('click', () => {
      const message = input.value.trim() ? `Win95Sim cannot run "${input.value}" yet.` : 'Please enter a command to run.';
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(message);
      } else {
        console.log(message);
      }
    });

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
      const frame = form.closest('.window-frame');
      if (!frame) {
        return;
      }
      const id = Array.from(frames.entries()).find(([, value]) => value.element === frame)?.[0];
      if (id) {
        windowManager.closeWindow(id);
      }
    });

    label.appendChild(input);
    actions.appendChild(okButton);
    actions.appendChild(cancelButton);
    form.appendChild(label);
    form.appendChild(actions);

    return form;
  }

  function launchExplorerWindow(options: { id?: string; title?: string; startPath?: string; icon?: string } = {}) {
    let explorerInstance: ExplorerInstance | undefined;
    const descriptor = openWindow({
      id: options.id,
      title: options.title ?? 'Windows Explorer',
      icon: options.icon ?? WINDOW_ICONS.explorer,
      width: 640,
      height: 480,
      content: () => {
        const host = document.createElement('div');
        explorerInstance = createExplorerApp({
          vfs,
          startPath: options.startPath ?? DEFAULT_EXPLORER_HOME,
        });
        explorerInstance.mount(host);
        return host;
      },
    });
    if (explorerInstance) {
      const windowId = descriptor.id;
      const teardown = appTeardowns.get(windowId);
      if (teardown) {
        teardown();
      }
      appTeardowns.set(windowId, () => {
        explorerInstance?.destroy();
      });
    }
    return descriptor;
  }

  function launchPaintWindow(options: { id?: string; title?: string; icon?: string } = {}) {
    let paintInstance: PaintAppInstance | undefined;
    const descriptor = openWindow({
      id: options.id,
      title: options.title ?? 'Paint',
      icon: options.icon ?? WINDOW_ICONS.paint,
      width: 620,
      height: 520,
      content: () => {
        const host = document.createElement('div');
        paintInstance = createPaintApp({
          width: 480,
          height: 320,
        });
        paintInstance.mount(host);
        return host;
      },
    });
    if (paintInstance) {
      const windowId = descriptor.id;
      const teardown = appTeardowns.get(windowId);
      if (teardown) {
        teardown();
      }
      appTeardowns.set(windowId, () => {
        paintInstance?.destroy();
      });
    }
    return descriptor;
  }

  function launchNavigatorWindow(options: { id?: string; title?: string; icon?: string } = {}) {
    let navigatorInstance: NavigatorAppInstance | undefined;
    const descriptor = openWindow({
      id: options.id,
      title: options.title ?? 'Internet Explorer',
      icon: options.icon ?? WINDOW_ICONS.internetExplorer,
      width: 760,
      height: 560,
      content: () => {
        const host = document.createElement('div');
        navigatorInstance = createNavigatorApp({
          settings,
          homeUrl: DEFAULT_NAVIGATOR_HOME,
        });
        navigatorInstance.mount(host);
        return host;
      },
    });
    if (navigatorInstance) {
      const windowId = descriptor.id;
      const teardown = appTeardowns.get(windowId);
      if (teardown) {
        teardown();
      }
      appTeardowns.set(windowId, () => {
        navigatorInstance?.destroy();
      });
    }
    return descriptor;
  }

  function openWelcomeWindow() {
    const existing = windows.get('shell:welcome');
    if (existing) {
      windowManager.restoreWindow(existing.id);
      windows.focus(existing.id);
      return existing;
    }
    return openWindow({
      id: 'shell:welcome',
      title: 'Windows 95',
      icon: WINDOW_ICONS.welcome,
      width: 360,
      height: 260,
      content: () => createWelcomeContent(),
    });
  }

  const commandHandlers: Record<string, () => void> = {
    'shell:start:welcome': () => openWelcomeWindow(),
    'shell:start:blank': () =>
      openWindow({
        title: 'Empty Window',
        icon: WINDOW_ICONS.defaultApp,
        content: () => createPlaceholderContent('Empty Window', 'A blank canvas for your retro dreams.'),
      }),
    'shell:start:my-computer': () =>
      launchExplorerWindow({
        id: 'app:explorer:my-computer',
        title: 'My Computer',
        startPath: DEFAULT_EXPLORER_HOME,
        icon: WINDOW_ICONS.myComputer,
      }),
    'shell:start:recycle-bin': () =>
      openWindow({
        id: 'shell:window:recycle-bin',
        title: 'Recycle Bin',
        icon: WINDOW_ICONS.recycleBin,
        width: 340,
        height: 280,
        content: () => createPlaceholderContent('Recycle Bin', 'No deleted items to show right now.'),
      }),
    'shell:start:notepad': () => {
      const id = `app:notepad:${windowSequence++}`;
      const descriptor = openWindow({
        id,
        title: 'Notepad',
        icon: WINDOW_ICONS.notepad,
        width: 520,
        height: 340,
        content: () => createNotepadContent(id),
      });
      const teardown = appTeardowns.get(descriptor.id);
      if (teardown) {
        teardown();
      }
      appTeardowns.set(descriptor.id, () => {
        const instance = notepadWindows.get(descriptor.id);
        if (instance) {
          instance.dispose();
          notepadWindows.delete(descriptor.id);
        }
      });
      return descriptor;
    },
    'shell:start:paint': () =>
      launchPaintWindow({
        id: `app:paint:${windowSequence}`,
        title: 'Paint',
      }),
    'shell:start:minesweeper': () =>
      openWindow({
        title: 'Minesweeper',
        icon: WINDOW_ICONS.minesweeper,
        width: 360,
        height: 320,
        content: () =>
          createPlaceholderContent('Minesweeper', 'Careful! The mines are still being planted in this preview build.'),
      }),
    'shell:start:internet-explorer': () => launchNavigatorWindow(),
    'shell:start:internet-mail': () =>
      openWindow({
        title: 'Internet Mail',
        icon: WINDOW_ICONS.internetMail,
        width: 460,
        height: 320,
        content: () =>
          createPlaceholderContent('Internet Mail', 'Mail and news clients are still being wired up for this demo.'),
      }),
    'shell:start:internet-news': () =>
      openWindow({
        title: 'Internet News',
        icon: WINDOW_ICONS.internetNews,
        width: 460,
        height: 320,
        content: () =>
          createPlaceholderContent('Internet News', 'Newsreader integration will arrive alongside the mail client.'),
      }),
    'shell:start:msdos': () =>
      openWindow({
        title: 'MS-DOS Prompt',
        icon: WINDOW_ICONS.msdos,
        width: 520,
        height: 340,
        content: () =>
          createPlaceholderContent(
            'MS-DOS Prompt',
            'A fully functional command shell is planned for a future update.',
          ),
      }),
    'shell:start:control-panel': () =>
      openWindow({
        title: 'Control Panel',
        icon: WINDOW_ICONS.controlPanel,
        width: 420,
        height: 320,
        content: () => createPlaceholderContent('Control Panel', 'Settings are not yet configurable in this demo.'),
      }),
    'shell:start:taskbar-settings': () =>
      openWindow({
        title: 'Taskbar & Start Menu',
        icon: WINDOW_ICONS.taskbar,
        width: 360,
        height: 220,
        content: () =>
          createPlaceholderContent('Taskbar Settings', 'Customization options will arrive in a future update.'),
      }),
    'shell:start:find-files': () =>
      openWindow({
        title: 'Find Files',
        icon: WINDOW_ICONS.findFiles,
        width: 420,
        height: 280,
        content: () =>
          createPlaceholderContent('Find Files', 'Search is nearly ready—use Windows Explorer to browse for now.'),
      }),
    'shell:start:help': () =>
      openWindow({
        title: 'Windows Help',
        icon: WINDOW_ICONS.help,
        width: 420,
        height: 320,
        content: () =>
          createPlaceholderContent('Help', 'Need assistance? For now, exploration is the best teacher.'),
      }),
    'shell:start:run': () =>
      openWindow({
        title: 'Run',
        icon: WINDOW_ICONS.run,
        width: 360,
        height: 210,
        content: () => createRunDialogContent(),
      }),
    'shell:start:startup-folder': () =>
      launchExplorerWindow({
        id: 'app:explorer:startup',
        title: 'StartUp',
        startPath: STARTUP_FOLDER_PATH,
        icon: WINDOW_ICONS.startup,
      }),
    'shell:start:explorer': () =>
      launchExplorerWindow({
        id: 'app:explorer:root',
        title: 'Windows Explorer',
        startPath: DEFAULT_EXPLORER_HOME,
        icon: WINDOW_ICONS.explorer,
      }),
    'shell:start:shutdown': () =>
      openWindow({
        title: 'Shut Down Windows',
        icon: WINDOW_ICONS.shutdown,
        width: 360,
        height: 220,
        content: () =>
          createPlaceholderContent('Shut Down', 'Use your browser controls to leave the simulation when you are ready.'),
      }),
  };

  function executeCommand(command: string, options: { closeStartMenu?: boolean } = {}) {
    const shouldCloseStartMenu = options.closeStartMenu ?? false;
    if (command.startsWith('shell:open:recent:')) {
      const recentId = command.slice('shell:open:recent:'.length);
      const entry = recentDocuments.list().find((item) => item.id === recentId);
      if (entry) {
        openWindow({
          title: entry.title,
          icon: WINDOW_ICONS.documents,
          width: 420,
          height: 260,
          content: () =>
            createPlaceholderContent(entry.title, `Win95Sim cannot open "${entry.path}" yet, but it's on the roadmap.`),
        });
        if (shouldCloseStartMenu) {
          closeStartMenu();
        }
        return;
      }
    }

    const action = commandHandlers[command];
    if (action) {
      action();
    } else {
      openWindow({
        title: 'Win95Sim',
        icon: WINDOW_ICONS.defaultApp,
        width: 360,
        height: 220,
        content: () =>
          createPlaceholderContent('Coming Soon', `Command "${command}" is not available in this build.`),
      });
    }
    if (shouldCloseStartMenu) {
      closeStartMenu();
    }
  }

  function handleStartCommand(command: string) {
    executeCommand(command, { closeStartMenu: true });
  }

  return {
    mount(root) {
      ensureViewport(root);
      if (!windows.get('shell:welcome')) {
        openWelcomeWindow();
      }
    },
    createWindow(descriptor) {
      const enhanced = descriptor as WindowDescriptor & { content?: WindowContentSource };
      if (enhanced.content) {
        pendingContent.set(enhanced.id, createContentElement(enhanced.content));
      }
      const { content, ...rest } = enhanced;
      try {
        return windowManager.createWindow(rest);
      } catch (error) {
        pendingContent.delete(enhanced.id);
        throw error;
      }
    },
    listWindows() {
      return windowManager.listWindows();
    },
  };
}
