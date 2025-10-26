const test = require('node:test');
const assert = require('node:assert/strict');

const { loadModule } = require('./helpers/loadModule');
const { withFakeDom } = require('./helpers/fakeDom');

const WORD_WRAP_KEY = 'apps.notepad.wordWrap';

test('common dialogs emit primary/secondary actions', () => {
  const { createDialogController } = loadModule('src/ui/dialogs/index.ts');

  const controller = createDialogController({
    id: 'dialogs/message-box',
    title: 'Confirm Delete',
    actions: [
      { id: 'ok', label: 'OK', role: 'primary', isDefault: true },
      { id: 'cancel', label: 'Cancel', role: 'secondary' },
    ],
  });

  const triggered = [];
  controller.onAction((id, context) => {
    triggered.push({ id, context });
  });

  controller.open({ file: 'demo.txt' });
  controller.trigger('cancel');
  controller.open({ file: 'report.txt' });
  controller.triggerDefault();

  assert.deepEqual(triggered, [
    { id: 'cancel', context: { file: 'demo.txt' } },
    { id: 'ok', context: { file: 'report.txt' } },
  ]);

  const finalState = controller.getState();
  assert.equal(finalState.isOpen, false);
  assert.equal(finalState.activeActionId, 'ok');
});

test('focus trap cycles through registered elements', () => {
  const { createFocusTrap } = loadModule('src/ui/dialogs/index.ts');

  withFakeDom(({ document }) => {
    const trap = createFocusTrap();
    const buttonA = document.createElement('button');
    const buttonB = document.createElement('button');
    const buttonC = document.createElement('button');

    trap.register(buttonA);
    trap.register(buttonB);
    trap.register(buttonC);

    assert.equal(trap.activate(), buttonA);
    assert.equal(buttonA.getAttribute('data-dialog-focus'), 'true');

    trap.focusPrevious();
    assert.equal(buttonC.getAttribute('data-dialog-focus'), 'true');

    trap.focusNext();
    assert.equal(buttonA.getAttribute('data-dialog-focus'), 'true');

    trap.focusNext();
    assert.equal(buttonB.getAttribute('data-dialog-focus'), 'true');
    trap.deactivate();
    assert.equal(trap.getFocusedElement(), undefined);
  });
});

test('file dialog state remembers directories and matches filters', () => {
  const { createDialogStateService } = loadModule('src/services/dialog-state/index.ts');

  const state = createDialogStateService({
    recentDirectories: {
      'dialogs:open': 'C:/Documents',
    },
  });

  const filters = [
    { label: 'Text Documents (*.txt)', extensions: ['.txt', '.log'] },
    { label: 'Images (*.bmp)', extensions: ['.bmp'] },
    { label: 'All Files (*.*)', extensions: ['*'] },
  ];

  assert.equal(state.getLastDirectory('dialogs:open'), 'C:/Documents');
  assert.equal(state.matchFilter('notes.TXT', filters).label, 'Text Documents (*.txt)');
  assert.equal(state.matchFilter('archive', filters).label, 'All Files (*.*)');

  state.rememberDirectory('dialogs:open', 'D:/Projects');
  assert.equal(state.getLastDirectory('dialogs:open'), 'D:/Projects');
});

test('notepad document find/replace/go-to-line updates caret and status', () => {
  const { createNotepadDocument } = loadModule('src/apps/accessories/notepad/state/document.ts');

  const document = createNotepadDocument({
    initialText: 'alpha\nbeta\ngamma beta',
    wordWrap: false,
  });

  const first = document.findNext('beta');
  assert.deepEqual(first, { index: 6, wrapped: false, length: 4 });
  assert.deepEqual(document.getSelection(), { start: 6, end: 10 });

  const replaced = document.replaceNext('beta', 'BETA');
  assert.equal(replaced.replaced, true);
  assert.equal(document.getText(), 'alpha\nBETA\ngamma beta');

  const wrapped = document.findNext('beta', { fromIndex: document.getText().length, wrap: true });
  assert.ok(wrapped.wrapped);
  assert.equal(wrapped.index, 6);

  const goTo = document.goToLine(3);
  assert.deepEqual(goTo, { line: 3, column: 1 });
  assert.deepEqual(document.getStatus(), { line: 3, column: 1 });

  const replaceAll = document.replaceAll('beta', 'Beta');
  assert.equal(replaceAll.replacements, 2);
  assert.ok(document.getText().includes('Beta'));
});

test('notepad app persists preferences, integrates dialogs, and spools print jobs', () => {
  const { createNotepadApp } = loadModule('src/apps/accessories/notepad/index.ts');
  const { createSettingsService } = loadModule('src/services/settings/index.ts');
  const { createDialogStateService } = loadModule('src/services/dialog-state/index.ts');
  const { createPrintService } = loadModule('src/services/print/index.ts');

  const settings = createSettingsService({ [WORD_WRAP_KEY]: false });
  const dialogState = createDialogStateService();
  const print = createPrintService();

  const app = createNotepadApp({ settings, dialogState, print });

  assert.equal(app.getPreferences().wordWrap, false);
  app.setWordWrap(true);
  assert.equal(settings.get(WORD_WRAP_KEY), true);
  assert.equal(app.toggleWordWrap(), false);
  assert.equal(settings.get(WORD_WRAP_KEY), false);

  const font = app.getFont();
  app.setFont({ family: 'Arial', size: 14 });
  assert.deepEqual(app.getFont(), { family: 'Arial', size: 14 });

  const document = app.createDocument('line 1\nline 2\nline 3');
  assert.equal(document.getWordWrap(), false);

  const job = app.printDocument(document, 'notes.txt');
  const [spooled] = print.listJobs();
  assert.equal(job.id, spooled.id);
  assert.equal(job.pages[0].lines[0], 'line 1');

  app.rememberDirectory('dialogs:open', 'C:/Temp');
  assert.equal(app.getLastDirectory('dialogs:open'), 'C:/Temp');
});

test('notepad window saves through VFS, updates title, and tracks recents', async () => {
  const { createNotepadWindow } = loadModule('src/apps/accessories/notepad/ui.ts');
  const { createNotepadApp } = loadModule('src/apps/accessories/notepad/index.ts');
  const { createSettingsService } = loadModule('src/services/settings/index.ts');
  const { createDialogStateService } = loadModule('src/services/dialog-state/index.ts');
  const { createPrintService } = loadModule('src/services/print/index.ts');
  const { createRecentDocumentsService } = loadModule('src/services/recent-documents/index.ts');

  await withFakeDom(async ({ document }) => {
    const previousWindow = global.window;
    global.window = {
      confirm: () => true,
      prompt: () => undefined,
      alert: () => {},
    };

    try {
      const settings = createSettingsService();
      const dialogState = createDialogStateService();
      const print = createPrintService({ autoProcess: false, now: () => 0 });
      const app = createNotepadApp({ settings, dialogState, print });
      const recentDocuments = createRecentDocumentsService({ clock: () => 123 });

      const files = new Map();
      const writes = [];
      const vfs = {
        async read(path) {
          if (!files.has(path)) {
            throw new Error(`File not found: ${path}`);
          }
          const text = files.get(path);
          const encoder = new TextEncoder();
          return {
            kind: 'file',
            path,
            name: path.split('/').pop() || '',
            size: text.length,
            modified: Date.now(),
            mimeType: 'text/plain',
            content: encoder.encode(text),
            textContent: text,
          };
        },
        async writeFile(path, contents) {
          const text = typeof contents === 'string' ? contents : new TextDecoder().decode(contents);
          files.set(path, text);
          writes.push({ path, contents: text });
          const encoder = new TextEncoder();
          return {
            kind: 'file',
            path,
            name: path.split('/').pop() || '',
            size: text.length,
            modified: Date.now(),
            mimeType: 'text/plain',
            content: encoder.encode(text),
            textContent: text,
          };
        },
      };

      let capturedTitle = '';
      const instance = createNotepadWindow({
        app,
        vfs,
        recentDocuments,
        onTitleChange: (title) => {
          capturedTitle = title;
        },
      });

      document.body.appendChild(instance.element);

      instance.setText('Hello world');
      assert.equal(instance.getState().dirty, true);

      await instance.saveAsPath('C:/Documents/demo');
      assert.equal(writes.length, 1);
      assert.equal(writes[0].path, 'C:/Documents/demo.txt');
      assert.equal(instance.getState().dirty, false);
      assert.equal(instance.getState().path, 'C:/Documents/demo.txt');
      assert.equal(capturedTitle, 'demo.txt - Notepad');

      const recent = recentDocuments.list();
      assert.equal(recent.length, 1);
      assert.equal(recent[0].path, 'C:/Documents/demo.txt');

      instance.setText('Updated text');
      assert.equal(instance.getState().dirty, true);

      await instance.save();
      assert.equal(writes.length, 2);
      assert.equal(writes[1].path, 'C:/Documents/demo.txt');
      assert.equal(instance.getState().dirty, false);

      await instance.openPath('C:/Documents/demo.txt');
      assert.equal(instance.getText(), 'Updated text');
      assert.equal(instance.getState().dirty, false);

      instance.dispose();
      if (typeof instance.element.remove === 'function') {
        instance.element.remove();
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
