const test = require('node:test');
const assert = require('node:assert/strict');

const { loadModule } = require('./helpers/loadModule');
const { withFakeDom } = require('./helpers/fakeDom');
const sampleTree = require('./fixtures/vfs/sampleTree');

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('filesystem service supports CRUD, watchers, search, and recycle bin', async () => {
  const { createVfsService } = loadModule('src/services/vfs/index.ts');
  const vfs = createVfsService({ seed: sampleTree() });

  const events = [];
  const stopWatching = vfs.watch('C:/Projects', (event) => {
    events.push({ type: event.type, path: event.node.path, previousPath: event.previousPath });
  });

  const readme = await vfs.writeFile('C:/Projects/README.txt', 'Phase 02 ready');
  assert.equal(readme.textContent, 'Phase 02 ready');
  assert.equal(readme.mimeType, 'text/plain');

  await vfs.writeFile('C:/Projects/README.txt', 'Phase 02 updated');
  await vfs.makeDirectory('C:/Projects/Archive');
  await vfs.writeFile('C:/Projects/Archive/log.txt', 'log entry');

  const moved = await vfs.move('C:/Projects/Archive', 'C:/Archive/Archive');
  assert.equal(moved.path, 'C:/Archive/Archive');
  const movedFile = await vfs.read('C:/Archive/Archive/log.txt');
  assert.equal(movedFile.textContent, 'log entry');

  await vfs.createShortcut('C:/Desktop/Projects.lnk', 'C:/Projects/README.txt');
  const resolvedShortcut = await vfs.resolveShortcut('C:/Desktop/Projects.lnk');
  assert.equal(resolvedShortcut.path, 'C:/Projects/README.txt');

  const nameResults = await vfs.search('readme');
  assert.equal(nameResults.length, 1);
  const contentResults = await vfs.search('updated', { includeContent: true });
  assert.equal(contentResults.length, 1);

  await vfs.remove('C:/Projects/README.txt');
  const entries = vfs.recycleBin.list();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].originalPath, 'C:/Projects/README.txt');
  const restored = vfs.recycleBin.restore(entries[0].id);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].path, 'C:/Projects/README.txt');
  const restoredFile = await vfs.read('C:/Projects/README.txt');
  assert.equal(restoredFile.textContent, 'Phase 02 updated');

  stopWatching();

  assert.deepEqual(
    events.map((event) => event.type),
    ['created', 'updated', 'created', 'created', 'moved', 'deleted', 'restored'],
  );
  assert.ok(events.some((event) => event.type === 'moved' && event.previousPath === 'C:/Projects/Archive'));
});

test('filesystem service exposes file association helpers', () => {
  const { createVfsService } = loadModule('src/services/vfs/index.ts');
  const vfs = createVfsService();
  const registered = vfs.registerFileAssociation('.txt', { appId: 'apps/notepad', command: 'shell:start:notepad' });
  assert.equal(registered.extension, '.txt');
  assert.equal(registered.appId, 'apps/notepad');
  const resolved = vfs.getFileAssociation('C:/Docs/Readme.TXT');
  assert.ok(resolved, 'expected association to resolve for mixed case extension');
  assert.equal(resolved.appId, 'apps/notepad');
  const list = vfs.listFileAssociations();
  assert.equal(list.length, 1);
  vfs.unregisterFileAssociation('.txt');
  assert.equal(vfs.getFileAssociation('C:/Docs/Readme.txt'), undefined);
});

function extractTreeLabels(node) {
  const labels = [];
  node.children.forEach((child) => {
    if (typeof child.className === 'string' && child.className.includes('win95-explorer__tree-item')) {
      labels.push(child.textContent);
    }
    labels.push(...extractTreeLabels(child));
  });
  return labels;
}

function collectText(children) {
  return children.map((node) => node.textContent);
}

test('explorer app renders tree and details panes reacting to VFS updates', async () => {
  const { createVfsService } = loadModule('src/services/vfs/index.ts');
  const { createExplorerApp } = loadModule('src/apps/explorer/index.ts');

  const vfs = createVfsService({ seed: sampleTree() });

  await withFakeDom(async () => {
    const host = document.createElement('div');
    const explorer = createExplorerApp({ vfs, startPath: 'C:/Projects' });
    explorer.mount(host);

    await flush();
    await flush();

    assert.equal(host.children.length, 1);
    const container = host.children[0];
    assert.equal(container.className, 'win95-explorer');
    assert.equal(container.dataset.path, 'C:/Projects');

    const layout = container.children[0];
    const treePane = layout.children[0];
    const content = layout.children[1];
    const detailsPane = content.children[1];

    // Root drive plus child directories should be present.
    assert.equal(treePane.children[0].textContent, 'C:');
    const treeLabels = extractTreeLabels(treePane);
    assert.ok(treeLabels.includes('Projects'));

    const detailNames = collectText(detailsPane.children);
    assert.ok(detailNames.includes('Phase02.txt'));

    await vfs.writeFile('C:/Projects/Notes.txt', 'Meeting notes');
    await flush();
    await flush();
    const updatedNames = collectText(detailsPane.children);
    assert.ok(updatedNames.includes('Notes.txt'));

    await vfs.makeDirectory('C:/Projects/Assets');
    await flush();
    await flush();
    const directoriesAfter = (await vfs.list('C:/Projects'))
      .filter((entry) => entry.kind === 'directory')
      .map((entry) => entry.name);
    assert.ok(directoriesAfter.includes('Assets'));
    const updatedTreeLabels = extractTreeLabels(treePane);
    assert.ok(updatedTreeLabels.includes('Assets'));

    explorer.destroy();
  });
});

test('explorer double-click dispatches file open callback', async () => {
  const { createVfsService } = loadModule('src/services/vfs/index.ts');
  const { createExplorerApp } = loadModule('src/apps/explorer/index.ts');
  const vfs = createVfsService({ seed: sampleTree() });
  await vfs.writeFile('C:/Projects/Test.txt', 'content');

  await withFakeDom(async () => {
    const opened = [];
    const host = document.createElement('div');
    const explorer = createExplorerApp({
      vfs,
      startPath: 'C:/Projects',
      onOpenNode: (node) => opened.push(node.path),
    });
    explorer.mount(host);

    await flush();
    await flush();

    const container = host.children[0];
    const layout = container.children[0];
    const content = layout.children[1];
    const detailsPane = content.children[1];
    const items = Array.from(detailsPane.children);
    const target = items.find((child) => child.dataset?.path === 'C:/Projects/Test.txt');
    assert.ok(target, 'expected Test.txt item in details pane');
    target.dispatchEvent('dblclick');

    assert.deepEqual(opened, ['C:/Projects/Test.txt']);

    explorer.destroy();
  });
});
