const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert');

function buildContext() {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const sfmScript = (html.match(/<script id="sfm">([\s\S]*?)<\/script>/) || [null, ''])[1];
  const modulesScript = (html.match(/<script id="modules">([\s\S]*?)<\/script>/) || [null, ''])[1];

  const context = {
    console,
    setTimeout,
    clearTimeout,
    TextEncoder,
    TextDecoder,
  };
  context.globalThis = context;
  context.window = context;
  context.self = context;
  context.document = {
    createElement: () => ({ click() {}, setAttribute() {}, removeAttribute() {} }),
    body: { appendChild() {}, removeChild() {} }
  };

  vm.createContext(context);
  vm.runInContext(sfmScript, context);
  vm.runInContext(modulesScript, context);
  return context;
}

const context = buildContext();
const requireFromContext = (id) => vm.runInContext(`require(${JSON.stringify(id)})`, context);

const vfs = requireFromContext('svc/vfs');

async function resetVfs() {
  vfs.reset();
  vfs.init();
}

test('vfs initializes default structure', async () => {
  await resetVfs();
  const desktop = vfs.stat(vfs.special.desktop);
  assert.ok(desktop);
  assert.strictEqual(desktop.kind, 'dir');
  const rootList = vfs.list('C:\\');
  const names = rootList.map((entry) => entry.name.toLowerCase());
  assert.ok(names.includes('desktop'));
  assert.ok(names.includes('documents'));
});

test('write and read text files', async () => {
  await resetVfs();
  await vfs.write('C:\\Documents\\notes.txt', 'Hello world');
  const meta = vfs.stat('C:\\Documents\\notes.txt');
  assert.strictEqual(meta.size, 11);
  const contents = await vfs.read('C:\\Documents\\notes.txt');
  assert.strictEqual(contents, 'Hello world');
});

test('mkdir, move, copy operations update listings', async () => {
  await resetVfs();
  vfs.mkdir('C:\\Documents\\Reports');
  await vfs.write('C:\\Documents\\Reports\\q1.txt', 'report');
  vfs.move('C:\\Documents\\Reports\\q1.txt', 'C:\\Documents\\q1.txt');
  vfs.copy('C:\\Documents\\q1.txt', 'C:\\Desktop\\q1.txt');
  const docs = vfs.list('C:\\Documents');
  const desktop = vfs.list('C:\\Desktop');
  assert.ok(docs.some((entry) => entry.name === 'q1.txt'));
  assert.ok(desktop.some((entry) => entry.name === 'q1.txt'));
});

test('watchers receive notifications for changes', async () => {
  await resetVfs();
  const events = [];
  const unwatch = vfs.watch('::all', (payload) => {
    if (payload.path && payload.path.startsWith('C:\\Desktop')) {
      events.push(payload.type);
    }
  });
  vfs.mkdir('C:\\Desktop\\New Folder');
  await vfs.write('C:\\Desktop\\New Folder\\note.txt', 'hello');
  await vfs.write('C:\\Desktop\\New Folder\\note.txt', 'hello again');
  vfs.remove('C:\\Desktop\\New Folder\\note.txt');
  unwatch();
  assert.ok(events.includes('create'));
  assert.ok(events.includes('update'));
  assert.ok(events.includes('delete'));
});

test('search locates files by pattern', async () => {
  await resetVfs();
  await vfs.write('C:\\Documents\\alpha.txt', 'a');
  await vfs.write('C:\\Documents\\beta.log', 'b');
  const matches = vfs.search({ path: 'C:\\Documents', namePattern: '*.txt' });
  assert.strictEqual(matches.length, 1);
  assert.strictEqual(matches[0].name, 'alpha.txt');
});
