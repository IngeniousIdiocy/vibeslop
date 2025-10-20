const test = require('node:test');
const assert = require('node:assert/strict');
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
