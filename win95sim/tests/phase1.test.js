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
    this.innerHTML = '';
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

  querySelector(selector) {
    if (this._queryMap && selector in this._queryMap) {
      return this._queryMap[selector];
    }
    return null;
  }

  querySelectorAll(selector) {
    if (this._queryAllMap && selector in this._queryAllMap) {
      return this._queryAllMap[selector];
    }
    return [];
  }

  setPointerCapture() {}

  getBoundingClientRect() {
    const left = parseFloat(this.style.left || '0');
    const top = parseFloat(this.style.top || '0');
    const width = parseFloat(this.style.width || this.width || '0');
    const height = parseFloat(this.style.height || this.height || '0');
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

function createWindowStub() {
  const root = new MockElement('div');
  const frame = new MockElement('div');
  const titlebar = new MockElement('div');
  const title = new MockElement('div');
  const body = new MockElement('div');
  const systemBtn = new MockElement('button');
  const minBtn = new MockElement('button');
  const maxBtn = new MockElement('button');
  const closeBtn = new MockElement('button');
  const handles = ['n','s','e','w','ne','nw','se','sw'].map(() => new MockElement('div'));

  systemBtn.dataset.action = 'system';
  minBtn.dataset.action = 'minimize';
  maxBtn.dataset.action = 'maximize';
  closeBtn.dataset.action = 'close';
  handles.forEach((h, idx) => { h.dataset.edge = ['n','s','e','w','ne','nw','se','sw'][idx]; });

  root.appendChild(frame);
  frame.appendChild(titlebar);
  frame.appendChild(body);

  root._queryMap = {
    '.w95-window__frame': frame,
    '[data-role="titlebar"]': titlebar,
    '[data-role="title"]': title,
    '[data-role="body"]': body
  };
  root._queryAllMap = {
    '[data-action]': [systemBtn, minBtn, maxBtn, closeBtn],
    '.w95-window__resize-handle': handles
  };

  titlebar.getBoundingClientRect = () => ({ left: 0, right: 0, top: 0, bottom: 0 });
  systemBtn.getBoundingClientRect = () => ({ left: 0, bottom: 0 });

  return root;
}

function buildContext() {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const sfmScript = (html.match(/<script id="sfm">([\s\S]*?)<\/script>/) || [null, ''])[1];
  const modulesScript = (html.match(/<script id="modules">([\s\S]*?)<\/script>/) || [null, ''])[1];

  const context = {
    console,
    setTimeout,
    clearTimeout,
  };
  context.globalThis = context;
  context.window = context;
  context.self = context;
  context.HTMLElement = function HTMLElementStub() {};
  context.document = {
    createElement: (tag) => new MockElement(tag),
    addEventListener: () => {},
    getElementById: () => null
  };

  vm.createContext(context);
  vm.runInContext(sfmScript, context);
  vm.runInContext(modulesScript, context);
  return context;
}

const context = buildContext();
const requireFromContext = (id) => {
  return vm.runInContext(`require(${JSON.stringify(id)})`, context);
};

const kernel = requireFromContext('core/kernel');
const settings = requireFromContext('svc/settings');
const display = requireFromContext('svc/display');
const windowSvc = requireFromContext('svc/window');

test('kernel pub/sub mechanics', () => {
  let count = 0;
  const off = kernel.on('ping', (payload) => {
    count += payload;
  });
  kernel.emit('ping', 2);
  assert.strictEqual(count, 2);
  off();
  kernel.emit('ping', 5);
  assert.strictEqual(count, 2);
});

test('settings watch notifications', () => {
  let observed = 0;
  const unwatch = settings.watch('mouse.pointerSpeed', (value) => {
    observed = value;
  });
  settings.set('mouse.pointerSpeed', 2);
  assert.strictEqual(observed, 2);
  unwatch();
});

test('display resolution and scaling updates', () => {
  const crt = new MockElement('div');
  crt.width = 800;
  crt.height = 600;
  crt.getBoundingClientRect = () => ({ width: 800, height: 600 });
  const desktop = new MockElement('div');
  const monitor = new MockElement('div');

  display.init({ crt, desktop, monitor });
  assert.strictEqual(desktop.style.width, '1024px');
  assert.strictEqual(desktop.style.height, '768px');

  display.setResolution({ w: 800, h: 600 });
  assert.strictEqual(desktop.style.width, '800px');
  assert.strictEqual(desktop.style.height, '600px');

  display.setScaleMode('fit');
  assert.strictEqual(crt.dataset.scale, 'fit');
  assert.ok(desktop.style.transform.includes('scale'));
});

test('window service basic lifecycle', () => {
  const desktop = new MockElement('div');
  const taskband = new MockElement('div');
  const systemMenu = new MockElement('div');
  const taskSwitcher = new MockElement('div');
  const taskSwitcherList = new MockElement('ul');
  taskSwitcher.querySelector = () => taskSwitcherList;
  const startButton = new MockElement('button');

  windowSvc.init({
    desktop,
    taskband,
    systemMenu,
    taskSwitcher,
    taskSwitcherList,
    startButton,
    createWindowElement: createWindowStub
  });

  const winRef = windowSvc.create({ title: 'Test', width: 300, height: 200, x: 10, y: 20 });
  assert.strictEqual(winRef.element.style.width, '300px');
  assert.strictEqual(winRef.element.style.height, '200px');
  assert.strictEqual(winRef.element.style.left, '10px');
  assert.strictEqual(winRef.element.style.top, '20px');

  winRef.moveTo(50, 60);
  assert.strictEqual(winRef.element.style.left, '50px');
  assert.strictEqual(winRef.element.style.top, '60px');

  winRef.resizeTo(400, 250);
  assert.strictEqual(winRef.element.style.width, '400px');
  assert.strictEqual(winRef.element.style.height, '250px');

  winRef.maximize();
  assert.strictEqual(winRef.element.dataset.maximized, 'true');

  winRef.restore();
  assert.strictEqual(winRef.element.dataset.maximized, 'false');
  assert.strictEqual(winRef.element.style.width, '400px');
  assert.strictEqual(winRef.element.style.height, '250px');
  assert.strictEqual(winRef.element.style.display, '');

  winRef.minimize();
  assert.strictEqual(winRef.element.style.display, 'none');
});
