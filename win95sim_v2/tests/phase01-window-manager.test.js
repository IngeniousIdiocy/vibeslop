const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadModule } = require('./helpers/loadModule');
const { withFakeDom } = require('./helpers/fakeDom');

const eventBusOverride = `
const events = (globalThis.__win95TestEvents = globalThis.__win95TestEvents ?? []);

function ensureBucket(listeners, type) {
  let bucket = listeners.get(type);
  if (!bucket) {
    bucket = new Set();
    listeners.set(type, bucket);
  }
  return bucket;
}

function remove(listeners, type, handler) {
  const bucket = listeners.get(type);
  if (!bucket) {
    return;
  }
  bucket.delete(handler);
  if (bucket.size === 0) {
    listeners.delete(type);
  }
}

function createEventBus() {
  const listeners = new Map();
  return {
    emit(type, payload) {
      events.push({ type, payload });
      const bucket = listeners.get(type);
      if (!bucket) {
        return;
      }
      Array.from(bucket).forEach((handler) => handler(payload));
    },
    on(type, handler) {
      const bucket = ensureBucket(listeners, type);
      bucket.add(handler);
      return () => remove(listeners, type, handler);
    },
    once(type, handler) {
      const bucket = ensureBucket(listeners, type);
      const onceHandler = (payload) => {
        remove(listeners, type, onceHandler);
        handler(payload);
      };
      bucket.add(onceHandler);
      return () => remove(listeners, type, onceHandler);
    },
  };
}

module.exports = { createEventBus };
`;

const GLOBAL_CSS_PATH = path.join(__dirname, '..', 'src', 'styles', 'global.css');

function readGlobalCss() {
  return fs.readFileSync(GLOBAL_CSS_PATH, 'utf8');
}

function createPointerEvent(target, overrides = {}) {
  return {
    pointerId: 1,
    button: 0,
    clientX: 0,
    clientY: 0,
    ctrlKey: false,
    metaKey: false,
    detail: 1,
    preventDefault() {},
    stopPropagation() {},
    target,
    currentTarget: target,
    ...overrides,
  };
}

test('window frame layout uses flex columns so app hosts fill the height', () => {
  const css = readGlobalCss();

  const readRule = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm');
    const match = css.match(pattern);
    assert.ok(match, `expected ${selector} styles`);
    return match[1];
  };

  const frameRule = readRule('.window-frame');
  assert.match(frameRule, /display\s*:\s*flex/);
  assert.match(frameRule, /flex-direction\s*:\s*column/);

  const bodyRule = readRule('.window-body');
  assert.match(bodyRule, /display\s*:\s*flex/);
  assert.match(bodyRule, /flex-direction\s*:\s*column/);
  assert.match(bodyRule, /flex\s*:\s*1\s+1\s+auto/);
  assert.match(bodyRule, /min-height\s*:\s*0/);

  const contentRule = readRule('.window-content');
  assert.match(contentRule, /display\s*:\s*flex/);
  assert.match(contentRule, /flex-direction\s*:\s*column/);
  assert.match(contentRule, /flex\s*:\s*1\s+1\s+auto/);
  assert.match(contentRule, /min-height\s*:\s*0/);
});

test('scrollbars emulate Win95 beveled chrome', () => {
  const css = readGlobalCss();
  assert.match(css, /--win95-scrollbar-size:\s*17px/);
  assert.match(
    css,
    new RegExp('\\*\\s*\\{[^}]*scrollbar-color\\s*:\\s*var\\(--win95-scrollbar-shadow\\)\\s+var\\(--win95-scrollbar-track\\)', 's'),
  );
  assert.match(
    css,
    /\*::\-webkit-scrollbar\s*\{[^}]*width:\s*var\(--win95-scrollbar-size\)[^}]*height:\s*var\(--win95-scrollbar-size\)/s,
  );
  assert.match(
    css,
    /\*::\-webkit-scrollbar-thumb\s*\{[^}]*border-top-color:\s*var\(--win95-scrollbar-highlight\)[^}]*border-left-color:\s*var\(--win95-scrollbar-highlight\)/s,
  );
  assert.match(css, /\*::\-webkit-scrollbar-button\s*\{[^}]*border-top-color:\s*var\(--win95-scrollbar-highlight\)/s);
});

test('window manager exposes create/move/resize lifecycle', () => {
  const { createWindowManager } = loadModule('src/apps/shell/window-manager/index.ts');
  const { createWindowService } = loadModule('src/services/window/index.ts');
  const { createDisplayService } = loadModule('src/services/display/index.ts');
  const { createEventBus } = loadModule('src/core/kernel/eventBus.ts');

  const display = createDisplayService({ width: 800, height: 600 });
  const windows = createWindowService();
  const bus = createEventBus();
  const manager = createWindowManager({ display, windows, bus });

  const lifecycleEvents = [];
  bus.on('window-manager:moved', (payload) => lifecycleEvents.push({ type: 'window-manager:moved', payload }));
  bus.on('window-manager:resized', (payload) => lifecycleEvents.push({ type: 'window-manager:resized', payload }));

  const created = manager.createWindow({
    id: 'demo-window',
    title: 'Demo',
    bounds: { x: 10, y: 20, width: 200, height: 150 },
  });

  assert.equal(created.id, 'demo-window');
  assert.equal(windows.get('demo-window').bounds.width, 200);

  const moved = manager.moveWindow('demo-window', { x: 60, y: 40 });
  assert.deepEqual(moved.bounds, { x: 60, y: 40, width: 200, height: 150 });

  const resized = manager.resizeWindow('demo-window', { width: 320, height: 240 });
  assert.deepEqual(resized.bounds, { x: 60, y: 40, width: 320, height: 240 });

  assert.equal(lifecycleEvents.length, 2);
  assert.deepEqual(
    lifecycleEvents.map((entry) => entry.type),
    ['window-manager:moved', 'window-manager:resized'],
  );
  lifecycleEvents.forEach((entry) => {
    assert.equal(entry.payload.window.id, 'demo-window');
    assert.deepEqual(entry.payload.display, display.getState());
  });

  assert.deepEqual(manager.listWindows().map((win) => win.id), ['demo-window']);
  assert.equal(windows.get('demo-window'), resized);
});

test('window frames support pointer-driven move and resize', () => {
  const { createWindowFrame } = loadModule('src/ui/components/windowFrame.ts');
  const { createWindowInteractionController } = loadModule(
    'src/features/window-interactions/windowInteractionController.ts',
  );
  const { createWindowManager } = loadModule('src/apps/shell/window-manager/index.ts');
  const { createWindowService } = loadModule('src/services/window/index.ts');
  const { createDisplayService } = loadModule('src/services/display/index.ts');
  const { createEventBus } = loadModule('src/core/kernel/eventBus.ts');

  withFakeDom(() => {
    const display = createDisplayService({ width: 640, height: 480 });
    const windows = createWindowService();
    const bus = createEventBus();
    const manager = createWindowManager({ display, windows, bus });

    const managerEvents = [];
    bus.on('window-manager:moved', ({ window }) => {
      managerEvents.push({ type: 'moved', bounds: { ...window.bounds } });
    });
    bus.on('window-manager:resized', ({ window }) => {
      managerEvents.push({ type: 'resized', bounds: { ...window.bounds } });
    });

    const descriptor = manager.createWindow({
      id: 'drag-window',
      title: 'Pointer Window',
      bounds: { x: 100, y: 100, width: 200, height: 160 },
    });

    const frame = createWindowFrame({ title: 'Pointer Window' });
    createWindowInteractionController({
      windowId: descriptor.id,
      frame,
      windowManager: manager,
      windows,
      display,
      workspaceBounds: { width: 640, height: 480 },
    });

    const caption = frame.element.children[0];
    const moveStart = createPointerEvent(caption, { pointerId: 1, clientX: 0, clientY: 0 });
    caption.dispatchEvent('pointerdown', moveStart);
    const moveDrag = createPointerEvent(caption, { pointerId: 1, clientX: 40, clientY: 30 });
    caption.dispatchEvent('pointermove', moveDrag);
    const moveEnd = createPointerEvent(caption, { pointerId: 1, clientX: 40, clientY: 30 });
    caption.dispatchEvent('pointerup', moveEnd);

    const afterMove = windows.get('drag-window');
    assert.deepEqual(afterMove.bounds, { x: 140, y: 130, width: 200, height: 160 });

    const handleSe = frame.element.children.find((child) => child.dataset?.handle === 'se');
    assert.ok(handleSe, 'expected southeast resize handle');

    const resizeStart = createPointerEvent(handleSe, { pointerId: 2, clientX: 0, clientY: 0 });
    handleSe.dispatchEvent('pointerdown', resizeStart);
    const resizeDrag = createPointerEvent(handleSe, { pointerId: 2, clientX: 50, clientY: 70 });
    handleSe.dispatchEvent('pointermove', resizeDrag);
    const resizeEnd = createPointerEvent(handleSe, { pointerId: 2, clientX: 50, clientY: 70 });
    handleSe.dispatchEvent('pointerup', resizeEnd);

    const afterResize = windows.get('drag-window');
    assert.deepEqual(afterResize.bounds, { x: 140, y: 130, width: 250, height: 230 });

    const clampStart = createPointerEvent(caption, { pointerId: 3, clientX: 0, clientY: 0 });
    caption.dispatchEvent('pointerdown', clampStart);
    const clampDrag = createPointerEvent(caption, { pointerId: 3, clientX: 600, clientY: 600 });
    caption.dispatchEvent('pointermove', clampDrag);
    const clampEnd = createPointerEvent(caption, { pointerId: 3, clientX: 600, clientY: 600 });
    caption.dispatchEvent('pointerup', clampEnd);

    const finalBounds = windows.get('drag-window').bounds;
    assert.deepEqual(finalBounds, { x: 390, y: 250, width: 250, height: 230 });

    assert.deepEqual(
      managerEvents.map((entry) => entry.type),
      ['moved', 'resized', 'moved'],
    );
    assert.deepEqual(managerEvents[0].bounds, { x: 140, y: 130, width: 200, height: 160 });
    assert.deepEqual(managerEvents[1].bounds, { x: 140, y: 130, width: 250, height: 230 });
    assert.deepEqual(managerEvents[2].bounds, finalBounds);
  });
});

test('desktop icon drags update layout and keep selection stable', () => {
  const { createDesktopView } = loadModule('src/ui/components/desktopIcons.ts');
  const { createDesktopModule } = loadModule('src/apps/shell/desktop/index.ts');
  const { createLayoutService } = loadModule('src/services/layout/index.ts');

  withFakeDom(() => {
    const entries = [
      { id: 'icon-a', title: 'Icon A', resource: 'a', type: 'shortcut' },
      { id: 'icon-b', title: 'Icon B', resource: 'b', type: 'shortcut' },
    ];
    const layout = createLayoutService({ defaultGridSize: 48 });
    const setItemCalls = [];
    const originalSetItem = layout.setItem.bind(layout);
    layout.setItem = function patchedSetItem(surfaceId, itemId, position, options) {
      setItemCalls.push({ surfaceId, itemId, position: { ...position }, options });
      return originalSetItem(surfaceId, itemId, position, options);
    };

    const desktopModule = createDesktopModule({
      layout,
      resolveEntries: () => entries,
      gridSize: 48,
    });

    const surfaceId = '::desktop';
    layout.bus.on('layout:updated', ({ surfaceId: updated }) => {
      if (updated === surfaceId) {
        render();
      }
    });

    let view;
    let dragState;

    function render() {
      view.render(desktopModule.list());
    }

    function applySelection(id, additive) {
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
      render();
    }

    function handleDragStart(event) {
      const current = new Set(desktopModule.getSelection());
      if (!current.has(event.id)) {
        current.clear();
        current.add(event.id);
        desktopModule.setSelection(Array.from(current));
        render();
      }
      const snapshot = layout.getSnapshot(surfaceId);
      const origins = new Map();
      Array.from(desktopModule.getSelection()).forEach((selectedId) => {
        const position = snapshot.items[selectedId];
        if (position) {
          origins.set(selectedId, { x: position.x, y: position.y });
        }
      });
      if (!origins.has(event.id)) {
        const fallback = snapshot.items[event.id];
        if (fallback) {
          origins.set(event.id, { x: fallback.x, y: fallback.y });
        }
      }
      if (origins.size === 0) {
        dragState = undefined;
        return;
      }
      dragState = {
        pointerId: event.pointerId,
        origins,
      };
    }

    function handleDragMove(event) {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      dragState.origins.forEach((origin, id) => {
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

    function handleDragEnd(event) {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      dragState.origins.forEach((origin, id) => {
        desktopModule.move(
          id,
          {
            x: origin.x + event.delta.x,
            y: origin.y + event.delta.y,
          },
          { snapToGrid: true },
        );
      });
      dragState = undefined;
    }

    view = createDesktopView({
      onSelect: (id, additive) => applySelection(id, additive),
      onClearSelection: () => {
        desktopModule.clearSelection();
        render();
      },
      onDragStart: (event) => handleDragStart(event),
      onDrag: (event) => handleDragMove(event),
      onDragEnd: (event) => handleDragEnd(event),
    });

    render();
    desktopModule.setSelection(['icon-a']);
    render();
    setItemCalls.length = 0;

    const snapshot = layout.getSnapshot(surfaceId);
    const startPosition = snapshot.items['icon-a'];
    const delta = { x: 60, y: 30 };

    function findIcon(element, id) {
      if (element?.dataset?.id === id) {
        return element;
      }
      for (const child of element.children || []) {
        const match = findIcon(child, id);
        if (match) {
          return match;
        }
      }
      return null;
    }

    const iconA = findIcon(view.element, 'icon-a');
    assert.ok(iconA, 'expected icon-a to be rendered');

    const dragStartEvent = createPointerEvent(iconA, { pointerId: 10, clientX: 0, clientY: 0 });
    iconA.dispatchEvent('pointerdown', dragStartEvent);
    const dragMoveEvent = createPointerEvent(iconA, { pointerId: 10, clientX: delta.x, clientY: delta.y });
    iconA.dispatchEvent('pointermove', dragMoveEvent);
    const dragEndEvent = createPointerEvent(iconA, { pointerId: 10, clientX: delta.x, clientY: delta.y });
    iconA.dispatchEvent('pointerup', dragEndEvent);

    const dragCalls = setItemCalls.filter((call) => call.itemId === 'icon-a');
    assert.ok(dragCalls.length >= 2);
    const previewCall = dragCalls[0];
    assert.equal(previewCall.options?.snapToGrid, false);
    assert.deepEqual(previewCall.position, {
      x: startPosition.x + delta.x,
      y: startPosition.y + delta.y,
    });

    const dropCall = dragCalls[dragCalls.length - 1];
    assert.notEqual(dropCall.options?.snapToGrid, false);
    const gridSize = 48;
    const expectedSnap = {
      x: Math.round((startPosition.x + delta.x) / gridSize) * gridSize,
      y: Math.round((startPosition.y + delta.y) / gridSize) * gridSize,
    };
    const finalSnapshot = layout.getSnapshot(surfaceId);
    assert.equal(finalSnapshot.items['icon-a'].x, expectedSnap.x);
    assert.equal(finalSnapshot.items['icon-a'].y, expectedSnap.y);

    const selection = desktopModule.getSelection();
    assert.deepEqual(selection, ['icon-a']);
    const renderedIcon = findIcon(view.element, 'icon-a');
    assert.equal(renderedIcon?.dataset?.selected, 'true');
  });
});

test('desktop shortcuts launch their mapped applications', () => {
  const { createShellSession } = loadModule('src/shell/boot/session.ts', {
    overrides: {
      '@apps/explorer': `
        function createExplorerApp() {
          return {
            mount(host) {
              if (host && typeof host.appendChild === 'function') {
                const doc = host.ownerDocument;
                const element = doc && typeof doc.createElement === 'function' ? doc.createElement('div') : null;
                if (element) {
                  element.className = 'explorer-stub';
                  element.textContent = 'Explorer Stub';
                  host.appendChild(element);
                }
              }
            },
            destroy() {},
            setPath: async () => {},
            getCurrentPath: () => 'C:/',
          };
        }
        module.exports = { createExplorerApp };
      `,
    },
  });

  withFakeDom(() => {
    const previousWindow = global.window;
    const selectionClears = [];
    global.window = {
      getSelection() {
        return {
          removeAllRanges() {
            selectionClears.push(true);
          },
        };
      },
      addEventListener() {},
      removeEventListener() {},
      alert() {},
    };

    try {
      const session = createShellSession();
      const root = document.createElement('div');
      session.mount(root);

      const seenIds = new Set(session.listWindows().map((win) => win.id));

      function findIcon(element, id) {
        if (element?.dataset?.id === id) {
          return element;
        }
        for (const child of element.children || []) {
          const match = findIcon(child, id);
          if (match) {
            return match;
          }
        }
        return null;
      }

      function openShortcut(datasetId, pointerId) {
        let icon = findIcon(root, datasetId);
        assert.ok(icon, `expected desktop icon ${datasetId}`);
        if (typeof icon.blur !== 'function') {
          icon.blur = () => {};
        }

        const createClickEvent = (detail) =>
          createPointerEvent(icon, {
            pointerId,
            detail,
          });

        icon.dispatchEvent('click', createClickEvent(1));

        icon = findIcon(root, datasetId) ?? icon;

        icon.dispatchEvent('click', createClickEvent(2));
        icon.dispatchEvent('dblclick', createClickEvent(2));
        const freshWindows = session
          .listWindows()
          .filter((win) => !seenIds.has(win.id));
        freshWindows.forEach((win) => seenIds.add(win.id));
        return freshWindows;
      }

      const notepadWindows = openShortcut('desktop/notepad', 21);
      assert.ok(notepadWindows.some((win) => win.title === 'Notepad'));
      assert.ok(notepadWindows.every((win) => win.title !== 'Empty Window'));

      const internetWindows = openShortcut('desktop/internet-explorer', 22);
      assert.ok(internetWindows.some((win) => win.title === 'Internet Explorer'));
      assert.ok(internetWindows.every((win) => win.title !== 'Empty Window'));

      const paintWindows = openShortcut('desktop/paint', 23);
      assert.ok(paintWindows.some((win) => win.title === 'Paint'));
      assert.ok(paintWindows.every((win) => win.title !== 'Empty Window'));

      const explorerWindows = openShortcut('desktop/explorer', 24);
      assert.ok(explorerWindows.some((win) => win.title === 'Windows Explorer'));
      assert.ok(explorerWindows.every((win) => win.title !== 'Empty Window'));

      const myComputerWindows = openShortcut('desktop/computer', 25);
      assert.ok(myComputerWindows.some((win) => win.title === 'My Computer'));
      assert.ok(myComputerWindows.every((win) => win.title !== 'Empty Window'));

      const recycleBinWindows = openShortcut('desktop/recycle-bin', 26);
      assert.ok(recycleBinWindows.some((win) => win.title === 'Recycle Bin'));
      assert.ok(recycleBinWindows.every((win) => win.title !== 'Empty Window'));

      assert.ok(selectionClears.length >= 6, 'expected selection to clear after opening shortcuts');
    } finally {
      if (previousWindow === undefined) {
        delete global.window;
      } else {
        global.window = previousWindow;
      }
    }
  });
});

test('module registry registers shell/taskbar without collisions', () => {
  const { createModuleRegistry } = loadModule('src/core/kernel/moduleRegistry.ts');

  const registry = createModuleRegistry();
  registry.register({ id: 'shell/session', factory: () => ({ id: 'shell/session' }) });
  registry.register({ id: 'shell/taskbar', factory: () => ({ id: 'shell/taskbar' }) });

  assert.deepEqual(registry.list(), ['shell/session', 'shell/taskbar']);
  assert.equal(registry.has('shell/session'), true);
  assert.equal(registry.resolve('shell/session').id, 'shell/session');

  assert.throws(
    () => registry.register({ id: 'shell/session', factory: () => ({ id: 'dup' }) }),
    /already registered/i,
  );
});

test('shell session boots and emits session:ready', () => {
  global.__win95TestEvents = [];

  withFakeDom(() => {
    const { createShellSession } = loadModule('src/shell/boot/session.ts', {
      overrides: {
        '@core/kernel/eventBus': eventBusOverride,
      },
    });

    const session = createShellSession();
    const root = document.createElement('div');
    session.mount(root);

    assert.ok(
      global.__win95TestEvents.some((event) => event.type === 'session:ready'),
      'expected session:ready to be emitted',
    );

    assert.equal(root.children.length, 1);
    const viewport = root.children[0];
    assert.equal(viewport.dataset.state, 'ready');

    const windows = session.listWindows();
    assert.ok(windows.some((win) => win.id === 'shell:welcome'));
  });

  delete global.__win95TestEvents;
});
