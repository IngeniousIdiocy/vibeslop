const test = require('node:test');

// Phase 01 will implement the window manager, shell boot, and module registry.
// The tests below outline the expectations teams should satisfy while building the feature set.

test('window manager exposes create/move/resize lifecycle', (t) => {
  t.todo('implement WindowManager contract once core/runtime/windows exists');
});

test('module registry registers shell/taskbar without collisions', (t) => {
  t.todo('assert registry rejects duplicate ids when implemented');
});

test('shell session boots and emits session:ready', (t) => {
  t.todo('simulate session boot using Phase 01 bootloader');
});
