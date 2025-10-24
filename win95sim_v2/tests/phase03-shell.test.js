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

    const createEvent = (overrides = {}) => ({
      preventDefault() {},
      stopPropagation() {},
      ctrlKey: false,
      metaKey: false,
      ...overrides,
    });

    secondInstance.dispatchEvent('click', createEvent());
    secondInstance.dispatchEvent('dblclick', createEvent());

    assert.deepEqual(updates, [
      ['select', 'desktop/test'],
      ['open', 'desktop/test'],
    ]);
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

      const createMouseEvent = () => ({
        preventDefault() {},
        stopPropagation() {},
      });

      const countTitles = () => {
        const titles = collectWindowTitles(document.body);
        return titles.reduce((map, title) => {
          map.set(title, (map.get(title) ?? 0) + 1);
          return map;
        }, new Map());
      };

      for (const [id, expectedTitle] of shortcutExpectations.entries()) {
        let icon = findByDataset(document.body, 'id', id);
        assert.ok(icon, `expected desktop icon for ${id}`);

        const beforeCounts = countTitles();

        icon.dispatchEvent(
          'click',
          {
            preventDefault() {},
            stopPropagation() {},
            ctrlKey: false,
            metaKey: false,
          },
        );

        icon = findByDataset(document.body, 'id', id);
        assert.ok(icon, `expected desktop icon for ${id} after selection render`);

        icon.dispatchEvent('dblclick', createMouseEvent());

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
