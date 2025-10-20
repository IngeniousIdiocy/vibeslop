const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert');

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.eventListeners = new Map();
    this.parentNode = null;
    this.nodeType = 1;
    this.attributes = new Map();
    this._innerHTML = '';
    this.clientHeight = 600;
    this.clientWidth = 800;
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  addEventListener(type, handler) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    if (!this.eventListeners.has(type)) return;
    this.eventListeners.get(type).delete(handler);
  }

  dispatchEvent(type, event) {
    if (!this.eventListeners.has(type)) return;
    this.eventListeners.get(type).forEach((handler) => handler(event));
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  setPointerCapture() {}

  getBoundingClientRect() {
    const left = parseFloat(this.style.left || '0');
    const top = parseFloat(this.style.top || '0');
    const width = parseFloat(this.style.width || this.clientWidth || '0');
    const height = parseFloat(this.style.height || this.clientHeight || '0');
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height
    };
  }
}

function buildContext() {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const sfmScript = (html.match(/<script id="sfm">([\s\S]*?)<\/script>/) || [null, ''])[1];
  const modulesScript = (html.match(/<script id="modules">([\s\S]*?)<\/script>/) || [null, ''])[1];

  const context = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    TextEncoder,
    TextDecoder
  };
  context.globalThis = context;
  context.window = context;
  context.self = context;
  context.HTMLElement = function HTMLElementStub() {};
  const body = new MockElement('body');
  context.document = {
    readyState: 'complete',
    createElement: (tag) => new MockElement(tag),
    addEventListener: () => {},
    getElementById: () => null,
    body
  };

  vm.createContext(context);
  vm.runInContext(sfmScript, context);
  vm.runInContext(modulesScript, context);
  return context;
}

const context = buildContext();
const requireFromContext = (id) => vm.runInContext(`require(${JSON.stringify(id)})`, context);

const kernel = requireFromContext('core/kernel');
const vfs = requireFromContext('svc/vfs');
const desktop = requireFromContext('svc/desktop');
const taskbar = requireFromContext('svc/taskbar');
const processSvc = requireFromContext('svc/process');
const startMenu = requireFromContext('svc/startmenu');

async function resetEnvironment() {
  desktop.destroy();
  taskbar.destroy();
  startMenu.destroy();
  processSvc.reset();
  vfs.reset();
  vfs.init();
}

test('desktop icons track VFS updates and layout positions', async () => {
  await resetEnvironment();
  const container = new MockElement('div');
  desktop.init({ container });
  await vfs.write('C:\\Desktop\\Report.txt', 'content');
  const icons = desktop.getIcons();
  assert.ok(icons.some((icon) => icon.name === 'Report.txt'));
  desktop.setIconPosition('C:\\Desktop\\Report.txt', { x: 120, y: 200 });
  const layout = JSON.parse(JSON.stringify(desktop.getLayout()));
  const layoutPoints = Object.values(layout);
  assert.ok(layoutPoints.some((point) => point.x === 120 && point.y === 200));
  desktop.setIconPosition('C:\\Desktop\\Report.txt', { x: 140, y: 220 });
  await desktop.renameIcon('C:\\Desktop\\Report.txt', 'Summary.txt');
  const renamedIcons = desktop.getIcons();
  assert.ok(renamedIcons.some((icon) => icon.name === 'Summary.txt'));
  const renamedPath = String(vfs.resolve('C:\\Desktop\\Summary.txt'));
  const updatedLayout = JSON.parse(JSON.stringify(desktop.getLayout()));
  assert.ok(Object.keys(updatedLayout).includes(renamedPath));
  assert.strictEqual(updatedLayout[renamedPath].x, 140);
  assert.strictEqual(updatedLayout[renamedPath].y, 220);
});

test('taskbar reflects window lifecycle events', async () => {
  await resetEnvironment();
  const taskband = new MockElement('div');
  const startButton = new MockElement('button');
  const clock = new MockElement('div');
  taskbar.init({
    taskband,
    startButton,
    clockEl: clock,
    scheduler: null,
    now: () => Date.UTC(1995, 7, 24, 9, 5),
    clockFormatter: (date) => `${date.getUTCHours()}:${date.getUTCMinutes().toString().padStart(2, '0')}`
  });
  assert.strictEqual(taskbar.getClockText(), '9:05');
  kernel.emit('win:create', { id: 'win1', title: 'Document - Notepad' });
  kernel.emit('win:create', { id: 'win2', title: 'Explorer' });
  kernel.emit('win:focus', { id: 'win1' });
  let tasks = taskbar.tasks();
  assert.strictEqual(tasks.length, 2);
  assert.strictEqual(tasks[0].title, 'Document - Notepad');
  assert.strictEqual(tasks[0].active, true);
  kernel.emit('win:minimize', { id: 'win1' });
  tasks = taskbar.tasks();
  assert.strictEqual(tasks[0].minimized, true);
  kernel.emit('win:restore', { id: 'win1' });
  kernel.emit('win:focus', { id: 'win2' });
  tasks = taskbar.tasks();
  assert.strictEqual(tasks[1].active, true);
  taskbar.setStartOpen(true);
  assert.strictEqual(taskbar.isStartOpen(), true);
  kernel.emit('win:close', { id: 'win2' });
  tasks = taskbar.tasks();
  assert.strictEqual(tasks.length, 1);
});

test('start menu builds from process registry and recent documents', async () => {
  await resetEnvironment();
  startMenu.init({ maxRecent: 5 });
  processSvc.register({
    id: 'notepad',
    name: 'Notepad',
    version: '1.0.0',
    icon: 'notepad',
    fileTypes: ['.txt'],
    startMenuPath: ['Accessories'],
    entry: async () => ({
      focus() {},
      async close() {}
    })
  });
  processSvc.register({
    id: 'paint',
    name: 'Paint',
    version: '1.0.0',
    icon: 'paint',
    startMenuPath: ['Accessories'],
    entry: async () => ({
      focus() {},
      async close() {}
    })
  });
  startMenu.rebuild();
  const model = startMenu.model();
  const programs = model.items.find((section) => section.id === 'programs');
  assert.ok(programs);
  const accessories = programs.items.find((item) => item.label === 'Accessories');
  assert.ok(accessories);
  const appLabels = Array.from(accessories.items || [])
    .filter((item) => item.type === 'app')
    .map((item) => item.label);
  assert.strictEqual(appLabels.join(','), 'Notepad,Paint');

  await vfs.write('C:\\Documents\\draft.txt', 'draft');
  await processSvc.open('C:\\Documents\\draft.txt');
  let documents = startMenu.model().items.find((section) => section.id === 'documents');
  assert.strictEqual(documents.items[0].label, 'draft.txt');

  processSvc.recordRecentDocument('C:\\Documents\\notes.txt');
  documents = startMenu.model().items.find((section) => section.id === 'documents');
  assert.strictEqual(documents.items[0].label, 'notes.txt');
});
