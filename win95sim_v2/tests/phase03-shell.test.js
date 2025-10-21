const test = require('node:test');
const assert = require('node:assert/strict');

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

  const entries = Object.fromEntries(DESKTOP_DEFAULT_ENTRIES.map((entry) => [entry.id, entry]));
  assert.ok(entries['desktop/internet-explorer']);
  assert.equal(entries['desktop/paint'].icon, 'icons/w98_paint.ico');
  assert.equal(entries['desktop/notepad'].icon, 'icons/w98_notepad.ico');
  assert.equal(entries['desktop/explorer'].icon, 'icons/w98_directory_explorer.ico');

  assert.equal(DESKTOP_SHORTCUT_COMMANDS['desktop/internet-explorer'], 'shell:start:internet-explorer');
  assert.equal(DESKTOP_SHORTCUT_COMMANDS['desktop/paint'], 'shell:start:paint');
  assert.equal(DESKTOP_SHORTCUT_COMMANDS['desktop/notepad'], 'shell:start:notepad');
  assert.equal(DESKTOP_SHORTCUT_COMMANDS['desktop/explorer'], 'shell:start:explorer');
});
