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
import { createNavigatorApp, type NavigatorAppInstance } from '@apps/internet/navigator';
import { createRecentDocumentsService } from '@services/recent-documents';
import { createCrtViewport } from '@ui/components/crtViewport';
import { createWindowFrame } from '@ui/components/windowFrame';
import { createTaskbarView } from '@ui/components/taskbar';
import { createStartMenuView } from '@ui/components/startMenu';
import { createDesktopView } from '@ui/components/desktopIcons';
import { createVfsService } from '@services/vfs';

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

export function createShellSession(): ShellSession {
  const registry = createModuleRegistry();
  const bus = createEventBus();

  const settings = createSettingsService({ theme: 'classic' });
  const display = createDisplayService();
  const windows = createWindowService();
  const windowManager = createWindowManager({ display, windows, bus });
  const diagnostics = createDiagnosticsService({ settings });
  const vfs = createVfsService({ seed: DEFAULT_VFS_SEED });
  const recentDocuments = createRecentDocumentsService();
  const startMenuModel = createStartMenuModel({ recentDocuments });
  const taskbar = createTaskbarController({ windows, bus });
  const layout = createLayoutService({ defaultGridSize: 48 });
  const desktopEntries: DesktopEntry[] = [
    {
      id: 'desktop/computer',
      title: 'My Computer',
      resource: '::desktop/computer',
      type: 'folder',
      icon: 'icons/w98_computer.ico',
    },
    {
      id: 'desktop/recycle-bin',
      title: 'Recycle Bin',
      resource: '::desktop/recycle-bin',
      type: 'folder',
      icon: 'icons/w98_recycle_bin_empty.ico',
    },
  ];
  const desktopModule = createDesktopModule({
    layout,
    resolveEntries: () => desktopEntries,
    gridSize: 48,
  });

  layout.setItem(DESKTOP_SURFACE_ID, 'desktop/computer', { x: 15, y: 10 }, { snapToGrid: false });
  layout.setItem(DESKTOP_SURFACE_ID, 'desktop/recycle-bin', { x: 15, y: 78 }, { snapToGrid: false });

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
  registry.register({ id: 'apps/window-manager', version: '2.0.0', factory: () => windowManager });
  registry.register({ id: 'services/diagnostics', version: '2.0.0', factory: () => diagnostics });
  registry.register({ id: 'shell/session', version: '2.0.0', factory: () => ({ bus, registry }) });

  const frames = new Map<string, ReturnType<typeof createWindowFrame>>();
  const pendingContent = new Map<string, HTMLElement>();
  const appTeardowns = new Map<string, () => void>();

  let viewport: ReturnType<typeof createCrtViewport> | undefined;
  let workspace: HTMLElement | undefined;
  let windowsLayer: HTMLElement | undefined;
  let desktopView: ReturnType<typeof createDesktopView> | undefined;
  let taskbarView: ReturnType<typeof createTaskbarView> | undefined;
  let startMenuView: ReturnType<typeof createStartMenuView> | undefined;
  let currentTaskButtons: TaskButton[] = taskbar.listButtons();

  let cascadeOffset = 0;
  let windowSequence = 1;

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

    desktopView = createDesktopView({
      onOpen: (id) => handleDesktopOpen(id),
      onSelect: (id, additive) => handleDesktopSelection(id, additive),
      onClearSelection: () => {
        desktopModule.clearSelection();
        renderDesktop();
      },
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
      const target = event.target as HTMLElement | null;
      if (target?.closest('.window-frame') || target?.closest('.desktop-icon')) {
        return;
      }
      handleStartCommand('shell:start:blank');
    });

    const updateDisplayDimensions = () => {
      if (!workspace) {
        return;
      }
      let width = DEFAULT_WINDOW_WIDTH;
      let height = DEFAULT_WINDOW_HEIGHT;
      if (typeof workspace.getBoundingClientRect === 'function') {
        const rect = workspace.getBoundingClientRect();
        if (rect && typeof rect.width === 'number' && typeof rect.height === 'number') {
          width = rect.width || width;
          height = rect.height || height;
        }
      } else {
        const state = display.getState();
        width = state.width;
        height = state.height;
      }
      if (width > 0 && height > 0) {
        display.setResolution(Math.round(width), Math.round(height));
      }
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

  const desktopActions: Record<string, () => void> = {
    'desktop/computer': () =>
      launchExplorerWindow({
        id: 'app:explorer:my-computer',
        title: 'My Computer',
        startPath: DEFAULT_EXPLORER_HOME,
      }),
    'desktop/recycle-bin': () =>
      openWindow({
        id: 'shell:window:recycle-bin',
        title: 'Recycle Bin',
        width: 340,
        height: 280,
        content: () => createPlaceholderContent('Recycle Bin', 'No deleted items to show right now.'),
      }),
  };

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

  function handleDesktopOpen(id: string) {
    const action = desktopActions[id];
    if (action) {
      action();
    } else {
      openWindow({
        title: 'Win95Sim',
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

  function createNotepadContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'app-notepad';

    const textarea = document.createElement('textarea');
    textarea.className = 'app-notepad__editor';
    textarea.value = 'Welcome to Notepad!\n\nThis lightweight editor is just a demo, but feel free to type.';
    container.appendChild(textarea);

    return container;
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

  function launchExplorerWindow(options: { id?: string; title?: string; startPath?: string } = {}) {
    let explorerInstance: ExplorerInstance | undefined;
    const descriptor = openWindow({
      id: options.id,
      title: options.title ?? 'Windows Explorer',
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

  function launchNavigatorWindow(options: { id?: string; title?: string } = {}) {
    let navigatorInstance: NavigatorAppInstance | undefined;
    const descriptor = openWindow({
      id: options.id,
      title: options.title ?? 'Internet Explorer',
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
        content: () => createPlaceholderContent('Empty Window', 'A blank canvas for your retro dreams.'),
      }),
    'shell:start:notepad': () =>
      openWindow({
        id: `app:notepad:${windowSequence}`,
        title: 'Notepad',
        width: 520,
        height: 340,
        content: () => createNotepadContent(),
      }),
    'shell:start:paint': () =>
      openWindow({
        title: 'Paint',
        width: 520,
        height: 360,
        content: () =>
          createPlaceholderContent('Paint', 'The art studio is under construction. Grab your virtual brushes soon!'),
      }),
    'shell:start:minesweeper': () =>
      openWindow({
        title: 'Minesweeper',
        width: 360,
        height: 320,
        content: () =>
          createPlaceholderContent('Minesweeper', 'Careful! The mines are still being planted in this preview build.'),
      }),
    'shell:start:internet-explorer': () => launchNavigatorWindow(),
    'shell:start:internet-mail': () =>
      openWindow({
        title: 'Internet Mail',
        width: 460,
        height: 320,
        content: () =>
          createPlaceholderContent('Internet Mail', 'Mail and news clients are still being wired up for this demo.'),
      }),
    'shell:start:internet-news': () =>
      openWindow({
        title: 'Internet News',
        width: 460,
        height: 320,
        content: () =>
          createPlaceholderContent('Internet News', 'Newsreader integration will arrive alongside the mail client.'),
      }),
    'shell:start:msdos': () =>
      openWindow({
        title: 'MS-DOS Prompt',
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
        width: 420,
        height: 320,
        content: () => createPlaceholderContent('Control Panel', 'Settings are not yet configurable in this demo.'),
      }),
    'shell:start:taskbar-settings': () =>
      openWindow({
        title: 'Taskbar & Start Menu',
        width: 360,
        height: 220,
        content: () =>
          createPlaceholderContent('Taskbar Settings', 'Customization options will arrive in a future update.'),
      }),
    'shell:start:find-files': () =>
      openWindow({
        title: 'Find Files',
        width: 420,
        height: 280,
        content: () =>
          createPlaceholderContent('Find Files', 'Search is nearly ready—use Windows Explorer to browse for now.'),
      }),
    'shell:start:help': () =>
      openWindow({
        title: 'Windows Help',
        width: 420,
        height: 320,
        content: () =>
          createPlaceholderContent('Help', 'Need assistance? For now, exploration is the best teacher.'),
      }),
    'shell:start:run': () =>
      openWindow({
        title: 'Run',
        width: 360,
        height: 210,
        content: () => createRunDialogContent(),
      }),
    'shell:start:startup-folder': () =>
      launchExplorerWindow({
        id: 'app:explorer:startup',
        title: 'StartUp',
        startPath: STARTUP_FOLDER_PATH,
      }),
    'shell:start:explorer': () =>
      launchExplorerWindow({
        id: 'app:explorer:root',
        title: 'Windows Explorer',
        startPath: DEFAULT_EXPLORER_HOME,
      }),
    'shell:start:shutdown': () =>
      openWindow({
        title: 'Shut Down Windows',
        width: 360,
        height: 220,
        content: () =>
          createPlaceholderContent('Shut Down', 'Use your browser controls to leave the simulation when you are ready.'),
      }),
  };

  function handleStartCommand(command: string) {
    if (command.startsWith('shell:open:recent:')) {
      const recentId = command.slice('shell:open:recent:'.length);
      const entry = recentDocuments.list().find((item) => item.id === recentId);
      if (entry) {
        openWindow({
          title: entry.title,
          width: 420,
          height: 260,
          content: () =>
            createPlaceholderContent(entry.title, `Win95Sim cannot open "${entry.path}" yet, but it's on the roadmap.`),
        });
        closeStartMenu();
        return;
      }
    }

    const action = commandHandlers[command];
    if (action) {
      action();
    } else {
      openWindow({
        title: 'Win95Sim',
        width: 360,
        height: 220,
        content: () =>
          createPlaceholderContent('Coming Soon', `Command "${command}" is not available in this build.`),
      });
    }
    closeStartMenu();
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
