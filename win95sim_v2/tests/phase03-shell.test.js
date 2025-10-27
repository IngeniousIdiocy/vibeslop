const test = require('node:test');
const assert = require('node:assert/strict');

const { withFakeDom } = require('./helpers/fakeDom');
const { loadModule } = require('./helpers/loadModule');

function createMemoryAdapter() {
  let snapshot;
  const saves = [];
  return {
    load() {
      return snapshot;
    },
    save(surfaceId, next) {
      snapshot = JSON.parse(JSON.stringify(next));
      saves.push(snapshot);
    },
    read() {
      return snapshot;
    },
    history() {
      return saves.slice();
    },
  };
}

test('desktop module persists layout positions and selection state', () => {
  const { createLayoutService } = loadModule('src/services/layout/index.ts');
  const { createDesktopModule } = loadModule('src/apps/shell/desktop/index.ts');

  const adapter = createMemoryAdapter();
  const layout = createLayoutService({ adapter, defaultGridSize: 32 });

  const entries = [
    { id: 'desktop/computer', title: 'My Computer', resource: '::desktop/computer', type: 'folder' },
    { id: 'desktop/trash', title: 'Recycle Bin', resource: '::desktop/trash', type: 'folder' },
    { id: 'desktop/notepad', title: 'Notepad', resource: '::desktop/notepad.lnk', type: 'shortcut' },
  ];

  let renameLog = null;
  const desktop = createDesktopModule({
    layout,
    resolveEntries: () => entries,
    onRename: (entry, nextTitle) => {
      renameLog = { id: entry.id, nextTitle };
      entry.title = nextTitle;
    },
  });

  const initial = desktop.list();
  assert.equal(initial.length, 3);
  initial.forEach((icon, index) => {
    assert.ok(icon.position.x % 32 === 0, 'expected x to align to grid');
    assert.ok(icon.position.y % 32 === 0, 'expected y to align to grid');
    assert.equal(icon.selected, false);
    assert.ok(icon.position.y >= 0, 'expected non-negative coordinates');
  });

  desktop.move('desktop/notepad', { x: 45, y: 83 });
  const snapshot = layout.getSnapshot('::desktop');
  const notepadPosition = snapshot.items['desktop/notepad'];
  assert.equal(notepadPosition.x, 32);
  assert.equal(notepadPosition.y, 96);

  desktop.setSelection(['desktop/computer', 'desktop/notepad']);
  assert.deepEqual(desktop.getSelection().sort(), ['desktop/computer', 'desktop/notepad']);
  desktop.clearSelection();
  assert.deepEqual(desktop.getSelection(), []);

  const renamed = desktop.rename('desktop/notepad', 'Notepad (1)');
  assert.equal(renamed.title, 'Notepad (1)');
  assert.deepEqual(renameLog, { id: 'desktop/notepad', nextTitle: 'Notepad (1)' });

  desktop.arrange();
  const arranged = layout.getSnapshot('::desktop');
  const persisted = adapter.read();
  assert.ok(persisted);
  const persistedItems = persisted.items ?? persisted;
  const arrangedIds = Object.keys(arranged.items);
  assert.deepEqual(arrangedIds.sort(), Object.keys(persistedItems).sort());
  arrangedIds.forEach((id) => {
    assert.equal(arranged.items[id].x, persistedItems[id].x);
    assert.equal(arranged.items[id].y, persistedItems[id].y);
  });
  assert.ok(adapter.history().length > 0);
});

test('taskbar controller mirrors window lifecycle events', () => {
  const { createTaskbarController } = loadModule('src/apps/shell/taskbar/index.ts');
  const { createWindowService } = loadModule('src/services/window/index.ts');
  const { createEventBus } = loadModule('src/core/kernel/eventBus.ts');

  const windows = createWindowService();
  const bus = createEventBus();
  let clock = 0;
  const taskbar = createTaskbarController({
    windows,
    bus,
    clock: () => ++clock,
  });

  const events = [];
  bus.on('taskbar:buttons-changed', (payload) => events.push(payload));

  const alpha = windows.create({
    id: 'apps/alpha',
    title: 'Alpha',
    bounds: { x: 10, y: 10, width: 200, height: 140 },
  });
  windows.create({
    id: 'apps/beta',
    title: 'Beta',
    bounds: { x: 30, y: 30, width: 200, height: 140 },
  });

  assert.equal(events.length >= 2, true, 'expected button change events');
  let buttons = taskbar.listButtons();
  assert.equal(buttons.length, 2);
  const activeWindow = windows.getActiveWindow();
  assert.ok(activeWindow);
  const active = buttons.find((button) => button.id === activeWindow.id);
  assert.equal(active.state, 'active');

  windows.update(alpha.id, { state: 'minimized' });
  buttons = taskbar.listButtons();
  assert.equal(buttons.find((btn) => btn.id === alpha.id).state, 'minimized');

  taskbar.toggleMinimize(alpha.id);
  assert.equal(taskbar.listButtons().find((btn) => btn.id === alpha.id).state, 'active');

  taskbar.activateWindow('apps/beta');
  buttons = taskbar.listButtons();
  const beta = buttons.find((btn) => btn.id === 'apps/beta');
  assert.equal(beta.state, 'active');
  assert.ok(beta.lastActivated > 0);

  windows.remove(alpha.id);
  assert.equal(taskbar.listButtons().length, 1);
});

test('start menu exposes manifest sections and recent documents', () => {
  const { createStartMenuModel } = loadModule('src/apps/shell/start-menu/index.ts');
  const { createRecentDocumentsService } = loadModule('src/services/recent-documents/index.ts');

  const recentDocuments = createRecentDocumentsService({ capacity: 5, clock: (() => {
    let value = 0;
    return () => (value += 1);
  })() });

  const startMenu = createStartMenuModel({ recentDocuments });
  const sections = startMenu.getSections();
  const programsSection = sections.find((section) => section.id === 'programs');
  assert.ok(programsSection);
  assert.ok(sections.some((section) => section.id === 'documents'));

  const accessoriesManifest = programsSection.items.find((item) => item.id === 'programs/accessories');
  assert.ok(accessoriesManifest);
  const paintManifest = accessoriesManifest.items?.find((item) => item.id === 'programs/accessories/paint');
  assert.ok(paintManifest);
  assert.equal(paintManifest.icon, 'icons/w98_paint.ico');
  assert.equal(paintManifest.command, 'shell:start:paint');

  recentDocuments.add({ id: 'doc-1', title: 'Budget.xls', path: 'C:/Docs/Budget.xls' });
  recentDocuments.add({ id: 'doc-2', title: 'Letter.doc', path: 'C:/Docs/Letter.doc' });
  assert.deepEqual(startMenu.getRecentDocuments().map((entry) => entry.id), ['doc-2', 'doc-1']);

  const schema = startMenu.getMenuSchema('programs');
  const accessories = schema.items.find((item) => item.id === 'programs/accessories');
  assert.ok(accessories);
  assert.equal(accessories.children.some((child) => child.id.endsWith('notepad')), true);

  const results = startMenu.search('paint');
  assert.ok(results.length >= 1);
  assert.equal(results[0].path.includes('Programs'), true);
  assert.equal(results[0].command, 'shell:start:paint');

  assert.equal(startMenu.isOpen(), false);
  startMenu.open();
  assert.equal(startMenu.isOpen(), true);
  startMenu.toggle();
  assert.equal(startMenu.isOpen(), false);
});

test('windows help app renders tabbed viewer with default content', () => {
  withFakeDom(() => {
    const { createWindowsHelpApp } = loadModule('src/apps/system/help/index.ts');

    const host = document.createElement('div');
    const app = createWindowsHelpApp();
    app.mount(host);

    const rootElement = host.children[0];
    const collectByClass = (className) => {
      const results = [];
      const stack = rootElement ? [rootElement] : [];
      while (stack.length) {
        const node = stack.pop();
        if (!node) {
          continue;
        }
        if (typeof node.className === 'string') {
          const tokens = node.className.split(/\s+/).filter(Boolean);
          if (tokens.includes(className)) {
            results.push(node);
          }
        }
        if (Array.isArray(node.children)) {
          for (let index = node.children.length - 1; index >= 0; index -= 1) {
            stack.push(node.children[index]);
          }
        }
      }
      return results;
    };

    const menuItems = collectByClass('app-help__menubar-item').map((item) => item.textContent?.trim());
    assert.deepEqual(menuItems, ['File', 'Edit', 'Bookmark', 'Options', 'Help']);

    const tabs = collectByClass('app-help__tab').map((tab) => tab.textContent?.trim());
    assert.deepEqual(tabs, ['Contents', 'Index', 'Find']);

    const topics = collectByClass('app-help__tree-button--topic');
    assert.ok(topics.length >= 6, 'expected multiple help topics in contents tab');

    const activeTopic = collectByClass('app-help__tree-button--active')[0];
    assert.ok(activeTopic, 'expected a default active help topic');
    assert.ok(/Windows 95/i.test(activeTopic.textContent ?? ''), 'expected initial topic to mention Windows 95');

    const viewerTitle = collectByClass('app-help__viewer-title')[0];
    assert.ok(viewerTitle);
    assert.ok(/Windows/i.test(viewerTitle.textContent ?? ''));

    const viewerBody = collectByClass('app-help__viewer-body')[0];
    assert.ok(viewerBody);
    const paragraphs = Array.from(viewerBody.children).map((child) => child.textContent ?? '').join(' ');
    assert.ok(/Start menu|taskbar/i.test(paragraphs), 'expected details to describe Windows features');

    const actionLabels = collectByClass('app-help__action-button').map((button) => button.textContent?.trim());
    assert.deepEqual(actionLabels, ['Display', 'Print...', 'Cancel']);

    app.destroy();
    assert.equal(host.children.length, 0);
  });
});

test('menu command registry composes declarative menu schemas', () => {
  const { createMenuCommandRegistry, realizeMenu } = loadModule('src/ui/menus/index.ts');

  const registry = createMenuCommandRegistry();
  const executed = [];

  registry.register({
    id: 'desktop:refresh',
    label: 'Refresh',
    run: (context) => executed.push(context.source),
  });

  const schema = {
    id: 'desktop-context',
    items: [
      { id: 'refresh', label: 'Refresh', command: 'desktop:refresh' },
      { id: 'separator-1', type: 'separator' },
      {
        id: 'new',
        label: 'New',
        items: [{ id: 'new/folder', label: 'Folder', command: 'desktop:new-folder' }],
      },
    ],
  };

  const menu = realizeMenu(schema, registry);
  menu.execute('desktop:refresh', { source: 'desktop' });

  assert.deepEqual(executed, ['desktop']);
  assert.throws(() => registry.execute('unknown'), /unknown command/i);

  registry.register({
    id: 'desktop:new-folder',
    label: 'Folder',
    run: () => executed.push('new-folder'),
  });

  assert.equal(menu.items.find((item) => item.id === 'new').children.length, 1);
  menu.execute('desktop:new-folder');
  assert.ok(executed.includes('new-folder'));
});

test('shell defines desktop shortcuts for core apps', () => {
  const { DESKTOP_DEFAULT_ENTRIES, DESKTOP_SHORTCUT_COMMANDS } = loadModule('src/shell/boot/session.ts');
  const { createStartMenuModel } = loadModule('src/apps/shell/start-menu/index.ts');
  const { createRecentDocumentsService } = loadModule('src/services/recent-documents/index.ts');

  const entries = Object.fromEntries(DESKTOP_DEFAULT_ENTRIES.map((entry) => [entry.id, entry]));
  assert.ok(entries['desktop/internet-explorer']);
  assert.equal(entries['desktop/computer'].icon, 'icons/w98_computer.ico');
  assert.equal(entries['desktop/recycle-bin'].icon, 'icons/w98_recycle_bin_empty.ico');
  assert.equal(entries['desktop/paint'].icon, 'icons/w98_paint.ico');
  assert.equal(entries['desktop/notepad'].icon, 'icons/w98_notepad.ico');
  assert.equal(entries['desktop/explorer'].icon, 'icons/w98_directory_explorer.ico');
  assert.equal(entries['desktop/minesweeper'].icon, 'icons/w98_minesweeper.ico');
  assert.equal(entries['desktop/msdos'].icon, 'icons/w98_ms-dos.ico');

  assert.equal(DESKTOP_SHORTCUT_COMMANDS['desktop/computer'], 'shell:start:my-computer');
  assert.equal(DESKTOP_SHORTCUT_COMMANDS['desktop/recycle-bin'], 'shell:start:recycle-bin');
  assert.equal(DESKTOP_SHORTCUT_COMMANDS['desktop/internet-explorer'], 'shell:start:internet-explorer');
  assert.equal(DESKTOP_SHORTCUT_COMMANDS['desktop/paint'], 'shell:start:paint');
  assert.equal(DESKTOP_SHORTCUT_COMMANDS['desktop/notepad'], 'shell:start:notepad');
  assert.equal(DESKTOP_SHORTCUT_COMMANDS['desktop/explorer'], 'shell:start:explorer');
  assert.equal(DESKTOP_SHORTCUT_COMMANDS['desktop/minesweeper'], 'shell:start:minesweeper');
  assert.equal(DESKTOP_SHORTCUT_COMMANDS['desktop/msdos'], 'shell:start:msdos');

  const startMenu = createStartMenuModel({ recentDocuments: createRecentDocumentsService() });
  const programsSchema = startMenu.getMenuSchema('programs');
  const findCommand = (id) => {
    const visit = (items = []) => {
      for (const item of items) {
        if (item.id === id) {
          return item.command;
        }
        if (item.children) {
          const match = visit(item.children);
          if (match) {
            return match;
          }
        }
      }
      return undefined;
    };
    return visit(programsSchema.items);
  };

  assert.equal(findCommand('programs/accessories/games/minesweeper'), DESKTOP_SHORTCUT_COMMANDS['desktop/minesweeper']);
  assert.equal(findCommand('programs/ms-dos'), DESKTOP_SHORTCUT_COMMANDS['desktop/msdos']);
});

test('desktop view reuses icon elements across renders', () => {
  withFakeDom(({ document }) => {
    const { createDesktopView } = loadModule('src/ui/components/desktopIcons.ts');

    const updates = [];
    const view = createDesktopView({
      onSelect: (id) => updates.push(['select', id]),
      onOpen: (id) => updates.push(['open', id]),
    });

    const icon = {
      id: 'desktop/test',
      title: 'Test App',
      resource: '::desktop/test',
      type: 'shortcut',
      icon: undefined,
      position: { x: 0, y: 0 },
      selected: false,
    };

    view.render([icon]);
    assert.equal(view.element.children.length, 1);
    const firstInstance = view.element.children[0];

    view.render([{ ...icon, title: 'Test App (2)', position: { x: 48, y: 0 }, selected: true }]);
    assert.equal(view.element.children.length, 1);
    const secondInstance = view.element.children[0];

    assert.strictEqual(firstInstance, secondInstance);
    assert.equal(secondInstance.dataset.selected, 'true');
    assert.equal(secondInstance.style.left, '48px');
    const label = secondInstance.children[1];
    assert.ok(label, 'expected desktop icon label element');
    assert.equal(label.textContent, 'Test App (2)');

    const createEvent = (detail) => ({
      preventDefault() {},
      stopPropagation() {},
      ctrlKey: false,
      metaKey: false,
      detail,
    });

    secondInstance.dispatchEvent('click', createEvent(1));
    secondInstance.dispatchEvent('click', createEvent(2));
    secondInstance.dispatchEvent('dblclick', createEvent(2));

    assert.deepEqual(updates, [
      ['select', 'desktop/test'],
      ['open', 'desktop/test'],
    ]);
  });
});

test('desktop activation clears DOM selections', () => {
  withFakeDom(({ document }) => {
    const { createDesktopView } = loadModule('src/ui/components/desktopIcons.ts');

    const selectionCalls = [];
    const windowSelectionCalls = [];
    const openLog = [];

    const view = createDesktopView({
      onOpen: (id) => openLog.push(id),
    });

    const icon = {
      id: 'desktop/test',
      title: 'Test App',
      resource: '::desktop/test',
      type: 'shortcut',
      icon: undefined,
      position: { x: 0, y: 0 },
      selected: false,
    };

    const previousDocumentGetSelection = document.getSelection;
    const documentSelection = {
      removeAllRanges() {
        selectionCalls.push('document');
      },
    };

    document.getSelection = () => documentSelection;

    const previousWindow = global.window;
    global.window = {
      ...(previousWindow && typeof previousWindow === 'object' ? previousWindow : {}),
      getSelection() {
        return {
          removeAllRanges() {
            windowSelectionCalls.push('window');
          },
        };
      },
      addEventListener: previousWindow?.addEventListener ?? (() => {}),
      removeEventListener: previousWindow?.removeEventListener ?? (() => {}),
    };

    try {
      view.render([icon]);
      const element = view.element.children[0];
      assert.ok(element, 'expected rendered desktop icon');

      const createEvent = (detail) => ({
        preventDefault() {},
        stopPropagation() {},
        ctrlKey: false,
        metaKey: false,
        detail,
      });

      element.dispatchEvent('click', createEvent(1));
      element.dispatchEvent('click', createEvent(2));
      element.dispatchEvent('dblclick', createEvent(2));
    } finally {
      if (previousWindow === undefined) {
        delete global.window;
      } else {
        global.window = previousWindow;
      }
      if (previousDocumentGetSelection === undefined) {
        delete document.getSelection;
      } else {
        document.getSelection = previousDocumentGetSelection;
      }
    }

    assert.deepEqual(openLog, ['desktop/test']);
    assert.equal(selectionCalls.length, 1);
    assert.equal(windowSelectionCalls.length, 1);
  });
});

test('double-clicking desktop shortcuts launches core applications', () => {
  const overrides = {
    '@apps/explorer': `
      const instances = [];
      function createExplorerApp(options) {
        const instance = {
          options,
          mounted: false,
          destroyed: false,
          mount(host) {
            this.mounted = true;
            if (host && host.dataset) {
              host.dataset.app = 'explorer';
            }
          },
          destroy() {
            this.destroyed = true;
          },
        };
        instances.push(instance);
        return instance;
      }
      module.exports = { createExplorerApp, __instances: instances };
    `,
    '@apps/paint': `
      const instances = [];
      function createPaintApp() {
        const instance = {
          mounted: false,
          destroyed: false,
          mount(host) {
            this.mounted = true;
            if (host && host.dataset) {
              host.dataset.app = 'paint';
            }
          },
          openDocument(path) {
            this.openedPath = path;
            return Promise.resolve();
          },
          destroy() {
            this.destroyed = true;
          },
        };
        instances.push(instance);
        return instance;
      }
      module.exports = { createPaintApp, __instances: instances };
    `,
    '@apps/internet/navigator': `
      const instances = [];
      function createNavigatorApp() {
        const instance = {
          mounted: false,
          destroyed: false,
          mount(host) {
            this.mounted = true;
            if (host && host.dataset) {
              host.dataset.app = 'navigator';
            }
          },
          destroy() {
            this.destroyed = true;
          },
          navigate() {},
        };
        instances.push(instance);
        return instance;
      }
      module.exports = { createNavigatorApp, __instances: instances };
    `,
  };

  withFakeDom(({ document }) => {
    const { createShellSession, DESKTOP_DEFAULT_ENTRIES } = loadModule('src/shell/boot/session.ts', { overrides });
    const iconLookup = new Map(DESKTOP_DEFAULT_ENTRIES.map((entry) => [entry.id, entry.icon]));

    const previousWindow = global.window;
    global.window = {
      addEventListener() {},
      removeEventListener() {},
      getSelection() {
        return {
          removeAllRanges() {},
        };
      },
    };

    try {
      const session = createShellSession();
      session.mount(document.body);

      const shortcutExpectations = new Map([
        ['desktop/internet-explorer', 'Internet Explorer'],
        ['desktop/paint', 'Paint'],
        ['desktop/notepad', 'Notepad'],
        ['desktop/explorer', 'Windows Explorer'],
        ['desktop/minesweeper', 'Minesweeper'],
        ['desktop/msdos', 'MS-DOS Prompt'],
      ]);

      const findByDataset = (element, key, value) => {
        if (element.dataset && element.dataset[key] === value) {
          return element;
        }
        for (const child of element.children) {
          const match = findByDataset(child, key, value);
          if (match) {
            return match;
          }
        }
        return undefined;
      };

      const collectWindowTitles = (element, titles = []) => {
        if (typeof element.className === 'string' && element.className.split(/\s+/).includes('window-caption__title')) {
          if (element.textContent) {
            titles.push(element.textContent);
          }
        }
        for (const child of element.children) {
          collectWindowTitles(child, titles);
        }
        return titles;
      };

      const createMouseEvent = (detail) => ({
        preventDefault() {},
        stopPropagation() {},
        ctrlKey: false,
        metaKey: false,
        detail,
      });

      const countTitles = () => {
        const titles = collectWindowTitles(document.body);
        return titles.reduce((map, title) => {
          map.set(title, (map.get(title) ?? 0) + 1);
          return map;
        }, new Map());
      };

      const normalizeIconPath = (iconPath) => {
        if (!iconPath) {
          return 'assets/icons/w2k_default_application.ico';
        }
        if (iconPath.startsWith('assets/')) {
          return iconPath;
        }
        if (iconPath.startsWith('/')) {
          return `assets${iconPath}`;
        }
        return `assets/${iconPath}`;
      };

      const findWindowIconByTitle = (element, targetTitle) => {
        const classes = typeof element.className === 'string' ? element.className.split(/\s+/).filter(Boolean) : [];
        if (classes.includes('window-caption')) {
          let titleNode;
          let iconNode;
          for (const child of element.children) {
            const childClasses = typeof child.className === 'string'
              ? child.className.split(/\s+/).filter(Boolean)
              : [];
            if (childClasses.includes('window-caption__title')) {
              titleNode = child;
            } else if (childClasses.includes('window-caption__icon')) {
              iconNode = child;
            }
          }
          if (titleNode?.textContent === targetTitle && iconNode) {
            return iconNode;
          }
        }
        for (const child of element.children) {
          const match = findWindowIconByTitle(child, targetTitle);
          if (match) {
            return match;
          }
        }
        return undefined;
      };

      for (const [id, expectedTitle] of shortcutExpectations.entries()) {
        let icon = findByDataset(document.body, 'id', id);
        assert.ok(icon, `expected desktop icon for ${id}`);

        const beforeCounts = countTitles();

        icon.dispatchEvent('click', createMouseEvent(1));

        icon = findByDataset(document.body, 'id', id);
        assert.ok(icon, `expected desktop icon for ${id} after selection render`);

        icon.dispatchEvent('click', createMouseEvent(2));
        icon.dispatchEvent('dblclick', createMouseEvent(2));

        const afterCounts = countTitles();
        assert.ok(
          (afterCounts.get(expectedTitle) ?? 0) > (beforeCounts.get(expectedTitle) ?? 0),
          `expected to find window titled "${expectedTitle}" after activating ${id}`,
        );
        assert.equal(
          afterCounts.get('Empty Window') ?? 0,
          beforeCounts.get('Empty Window') ?? 0,
          'did not expect desktop activation to trigger the blank window placeholder',
        );

        const expectedIconPath = iconLookup.get(id);
        assert.ok(expectedIconPath, `expected icon mapping for ${id}`);
        const iconElement = findWindowIconByTitle(document.body, expectedTitle);
        assert.ok(iconElement, `expected window icon element for ${expectedTitle}`);
        assert.equal(
          iconElement.src,
          normalizeIconPath(expectedIconPath),
          `expected ${expectedTitle} window chrome to use its application icon`,
        );
      }
    } finally {
      if (previousWindow === undefined) {
        delete global.window;
      } else {
        global.window = previousWindow;
      }
    }
  });
});

test('double-clicking desktop icon does not trigger workspace dblclick handler', () => {
  const overrides = {
    '@apps/explorer': `
      const instances = [];
      function createExplorerApp(options) {
        const instance = {
          options,
          mounted: false,
          destroyed: false,
          mount(host) {
            this.mounted = true;
            if (host && host.dataset) {
              host.dataset.app = 'explorer';
            }
          },
          destroy() {
            this.destroyed = true;
          },
        };
        instances.push(instance);
        return instance;
      }
      module.exports = { createExplorerApp, __instances: instances };
    `,
  };

  withFakeDom(({ document }) => {
    const { createShellSession } = loadModule('src/shell/boot/session.ts', { overrides });

    const previousWindow = global.window;
    global.window = {
      addEventListener() {},
      removeEventListener() {},
      getSelection() {
        return {
          removeAllRanges() {},
        };
      },
    };

    try {
      const session = createShellSession();
      session.mount(document.body);

      // Track workspace dblclick events to verify test setup
      const workspaceDblclicks = [];
      const findWorkspace = (element) => {
        if (element.className === 'desktop-root__workspace') {
          return element;
        }
        for (const child of element.children) {
          const found = findWorkspace(child);
          if (found) return found;
        }
        return null;
      };
      const workspace = findWorkspace(document.body);
      if (workspace) {
        // Add a listener AFTER session setup to catch workspace dblclick events
        workspace.addEventListener('dblclick', (e) => {
          workspaceDblclicks.push({ target: e.target, currentTarget: e.currentTarget });
        });
      }

      const findByDataset = (element, key, value) => {
        if (element.dataset && element.dataset[key] === value) {
          return element;
        }
        for (const child of element.children) {
          const match = findByDataset(child, key, value);
          if (match) {
            return match;
          }
        }
        return undefined;
      };

      const collectWindowTitles = (element, titles = []) => {
        if (typeof element.className === 'string' && element.className.split(/\s+/).includes('window-caption__title')) {
          if (element.textContent) {
            titles.push(element.textContent);
          }
        }
        for (const child of element.children) {
          collectWindowTitles(child, titles);
        }
        return titles;
      };

      const getWindowTitles = () => collectWindowTitles(document.body);

      // Test the Windows Explorer icon
      const icon = findByDataset(document.body, 'id', 'desktop/explorer');
      assert.ok(icon, 'expected to find desktop/explorer icon');

      const beforeTitles = getWindowTitles();
      const beforeEmptyCount = beforeTitles.filter((t) => t === 'Empty Window').length;
      const beforeExplorerCount = beforeTitles.filter((t) => t === 'Windows Explorer').length;

      // Simulate COMPLETE real browser double-click sequence
      // Real browsers generate: pointerdown, pointerup, click, pointerdown, pointerup, click, dblclick
      
      // First click
      icon.dispatchEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        button: 0,
        clientX: 100,
        clientY: 100,
      });

      icon.dispatchEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        button: 0,
        clientX: 100,
        clientY: 100,
      });

      icon.dispatchEvent('click', {
        bubbles: true,
        cancelable: true,
        detail: 1,
        button: 0,
        clientX: 100,
        clientY: 100,
      });

      // Second click
      icon.dispatchEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        button: 0,
        clientX: 100,
        clientY: 100,
      });

      icon.dispatchEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        button: 0,
        clientX: 100,
        clientY: 100,
      });

      icon.dispatchEvent('click', {
        bubbles: true,
        cancelable: true,
        detail: 2,
        button: 0,
        clientX: 100,
        clientY: 100,
      });

      icon.dispatchEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        detail: 2,
        button: 0,
        clientX: 100,
        clientY: 100,
      });

      const afterTitles = getWindowTitles();
      const afterEmptyCount = afterTitles.filter((t) => t === 'Empty Window').length;
      const afterExplorerCount = afterTitles.filter((t) => t === 'Windows Explorer').length;

      // The bug: Empty Window gets created because dblclick bubbles to workspace
      // If this assert fails, it means the workspace dblclick handler fired (the bug!)
      assert.equal(
        afterEmptyCount,
        beforeEmptyCount,
        `Empty Window should NOT be created when double-clicking a desktop icon. Workspace dblclick fired ${workspaceDblclicks.length} times`
      );

      // The expected behavior: Windows Explorer should open
      assert.ok(
        afterExplorerCount > beforeExplorerCount,
        'Windows Explorer should be opened when double-clicking its desktop icon'
      );
    } finally {
      if (previousWindow === undefined) {
        delete global.window;
      } else {
        global.window = previousWindow;
      }
    }
  });

});

test('double-clicking desktop icon opens only ONE instance (not two)', () => {
  withFakeDom(({ document }) => {
    const { createDesktopView } = loadModule('src/ui/components/desktopIcons.ts');

    let openCount = 0;
    const view = createDesktopView({
      onOpen: (id) => {
        openCount++;
      },
    });

    const icon = {
      id: 'desktop/notepad',
      title: 'Notepad',
      resource: '::desktop/notepad.lnk',
      type: 'shortcut',
      icon: undefined,
      position: { x: 0, y: 0 },
      selected: false,
    };

    view.render([icon]);
    const element = view.element.children[0];
    assert.ok(element, 'expected rendered desktop icon');

    // Simulate full double-click sequence
    element.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    element.dispatchEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    element.dispatchEvent('click', { bubbles: true, cancelable: true, detail: 1, button: 0, clientX: 100, clientY: 100 });
    element.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    element.dispatchEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    element.dispatchEvent('click', { bubbles: true, cancelable: true, detail: 2, button: 0, clientX: 100, clientY: 100 });
    element.dispatchEvent('dblclick', { bubbles: true, cancelable: true, detail: 2, button: 0, clientX: 100, clientY: 100 });

    assert.equal(openCount, 1, 'double-click should open exactly ONE instance, not two');
  });
});

test('dragging desktop icon more than 5px suppresses click event', () => {
  withFakeDom(({ document }) => {
    const { createDesktopView } = loadModule('src/ui/components/desktopIcons.ts');

    let selectCount = 0;
    let openCount = 0;
    const view = createDesktopView({
      onSelect: (id) => {
        selectCount++;
      },
      onOpen: (id) => {
        openCount++;
      },
    });

    const icon = {
      id: 'desktop/notepad',
      title: 'Notepad',
      resource: '::desktop/notepad.lnk',
      type: 'shortcut',
      icon: undefined,
      position: { x: 0, y: 0 },
      selected: false,
    };

    view.render([icon]);
    const element = view.element.children[0];
    assert.ok(element, 'expected rendered desktop icon');

    // Simulate drag: pointerdown, move > 5px, pointerup, click
    element.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    element.dispatchEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 110, clientY: 110 }); // Move 10px
    element.dispatchEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 110, clientY: 110 });
    element.dispatchEvent('click', { bubbles: true, cancelable: true, detail: 1, button: 0, clientX: 110, clientY: 110 });

    assert.equal(selectCount, 0, 'dragging should suppress selection');
    assert.equal(openCount, 0, 'dragging should suppress opening');
  });
});

test('small movements (< 5px) during click do not trigger drag', () => {
  withFakeDom(({ document }) => {
    const { createDesktopView } = loadModule('src/ui/components/desktopIcons.ts');

    let selectCount = 0;
    let dragStartCount = 0;
    const view = createDesktopView({
      onSelect: (id) => {
        selectCount++;
      },
      onDragStart: () => {
        dragStartCount++;
      },
    });

    const icon = {
      id: 'desktop/notepad',
      title: 'Notepad',
      resource: '::desktop/notepad.lnk',
      type: 'shortcut',
      icon: undefined,
      position: { x: 0, y: 0 },
      selected: false,
    };

    view.render([icon]);
    const element = view.element.children[0];
    assert.ok(element, 'expected rendered desktop icon');

    // Simulate tiny movement: pointerdown, move 2px, pointerup, click
    element.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    element.dispatchEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 102, clientY: 102 }); // Move only 2px
    element.dispatchEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 102, clientY: 102 });
    element.dispatchEvent('click', { bubbles: true, cancelable: true, detail: 1, button: 0, clientX: 102, clientY: 102 });

    assert.equal(selectCount, 1, 'small movements should still allow selection');
    assert.equal(dragStartCount, 0, 'small movements should not trigger drag');
  });
});

test('dblclick event fires even after small pointer movements', () => {
  withFakeDom(({ document }) => {
    const { createDesktopView } = loadModule('src/ui/components/desktopIcons.ts');

    let openCount = 0;
    const view = createDesktopView({
      onOpen: (id) => {
        openCount++;
      },
    });

    const icon = {
      id: 'desktop/notepad',
      title: 'Notepad',
      resource: '::desktop/notepad.lnk',
      type: 'shortcut',
      icon: undefined,
      position: { x: 0, y: 0 },
      selected: false,
    };

    view.render([icon]);
    const element = view.element.children[0];
    assert.ok(element, 'expected rendered desktop icon');

    // Simulate double-click with small movements between clicks
    // First click
    element.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    element.dispatchEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 101, clientY: 101 });
    element.dispatchEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 101, clientY: 101 });
    element.dispatchEvent('click', { bubbles: true, cancelable: true, detail: 1, button: 0, clientX: 101, clientY: 101 });
    
    // Second click
    element.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 101, clientY: 101 });
    element.dispatchEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 102, clientY: 102 });
    element.dispatchEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientX: 102, clientY: 102 });
    element.dispatchEvent('click', { bubbles: true, cancelable: true, detail: 2, button: 0, clientX: 102, clientY: 102 });
    element.dispatchEvent('dblclick', { bubbles: true, cancelable: true, detail: 2, button: 0, clientX: 102, clientY: 102 });

    assert.equal(openCount, 1, 'dblclick should work even with small pointer movements');
  });
});
