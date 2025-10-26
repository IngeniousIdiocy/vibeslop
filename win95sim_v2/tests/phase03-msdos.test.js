const test = require('node:test');
const assert = require('node:assert/strict');

const { loadModule } = require('./helpers/loadModule');
const { withFakeDom } = require('./helpers/fakeDom');

function getTextLines(output) {
  return output.children.map((child) => child.textContent || '');
}

function findByClass(root, className) {
  if (!root) {
    return undefined;
  }
  const classes = typeof root.className === 'string' ? root.className.split(/\s+/).filter(Boolean) : [];
  if (classes.includes(className)) {
    return root;
  }
  for (const child of root.children) {
    const match = findByClass(child, className);
    if (match) {
      return match;
    }
  }
  return undefined;
}

async function submitCommand(form, input, value) {
  input.value = value;
  form.dispatchEvent('submit', { bubbles: true, cancelable: true });
  await new Promise((resolve) => setImmediate(resolve));
}

test('ms-dos prompt integrates with the virtual file system', async () => {
  const { createMsDosPromptApp } = loadModule('src/apps/system/msdos/index.ts');
  const { createVfsService } = loadModule('src/services/vfs/index.ts');

  await withFakeDom(async ({ document }) => {
    const host = document.createElement('div');
    const vfs = createVfsService({
      seed: [
        { path: 'C:/Docs', kind: 'directory' },
        { path: 'C:/Docs/readme.txt', kind: 'file', content: 'Ready to launch!\n' },
      ],
    });

    let exitCount = 0;
    const app = createMsDosPromptApp({
      vfs,
      onExit: () => {
        exitCount += 1;
      },
    });
    app.mount(host);

    const output = findByClass(host, 'app-msdos__output');
    const form = findByClass(host, 'app-msdos__input-line');
    const input = findByClass(host, 'app-msdos__input');
    const prompt = findByClass(host, 'app-msdos__prompt');

    assert.ok(output, 'output element should exist');
    assert.ok(form, 'form element should exist');
    assert.ok(input, 'input element should exist');
    assert.ok(prompt, 'prompt label should exist');

    await submitCommand(form, input, 'dir');
    const initialLines = getTextLines(output);
    assert.ok(initialLines.some((line) => line.includes('Directory of C:\\')));
    assert.ok(initialLines.some((line) => line.includes('Docs') && line.includes('<DIR>')));

    await submitCommand(form, input, 'mkdir demos');
    await submitCommand(form, input, 'cd demos');
    assert.equal(prompt.textContent, 'C:\\demos>');

    await submitCommand(form, input, 'copy ..\\Docs\\readme.txt launch.txt');
    const copied = await vfs.read('C:/demos/launch.txt');
    assert.equal(copied.kind, 'file');
    assert.ok(copied.textContent.includes('Ready to launch!'));

    await submitCommand(form, input, 'type launch.txt');
    const afterType = getTextLines(output);
    assert.ok(afterType.some((line) => line.includes('Ready to launch!')));

    await submitCommand(form, input, 'del launch.txt');
    await assert.rejects(() => vfs.read('C:/demos/launch.txt'));

    await submitCommand(form, input, 'cls');
    const afterCls = getTextLines(output);
    assert.deepEqual(afterCls.slice(0, 3), [
      'Microsoft(R) Windows 95',
      '(C)Copyright Microsoft Corp 1981-1995.',
      '',
    ]);

    await submitCommand(form, input, 'help');
    const helpLines = getTextLines(output);
    assert.ok(helpLines.some((line) => line.includes('For more information on a specific command')));

    await submitCommand(form, input, 'help dir');
    const helpDirLines = getTextLines(output);
    assert.ok(helpDirLines.some((line) => line.includes('DIR [drive:][path]')));

    await submitCommand(form, input, 'prompt $n$g');
    assert.equal(prompt.textContent, 'C>');

    await submitCommand(form, input, 'prompt');
    const promptLines = getTextLines(output);
    assert.ok(promptLines.some((line) => line.includes('PROMPT=$n$g')));

    await submitCommand(form, input, 'set PATH=C:\\DOS;C:\\BIN');
    await submitCommand(form, input, 'path');
    const pathLines = getTextLines(output);
    assert.ok(pathLines.some((line) => line.includes('PATH=C:\\DOS;C:\\BIN')));

    await submitCommand(form, input, 'ver');
    const verLines = getTextLines(output);
    assert.ok(verLines.some((line) => line.includes('Windows 95')));

    await submitCommand(form, input, 'd:');
    const driveLines = getTextLines(output);
    assert.ok(driveLines.some((line) => line.includes('Invalid drive specification')));

    await submitCommand(form, input, 'exit');
    assert.equal(exitCount, 1);
  });
});

