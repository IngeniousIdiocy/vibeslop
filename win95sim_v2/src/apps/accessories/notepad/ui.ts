import type { NotepadApp } from './index';
import type { NotepadDocument } from './state/document';
import type { VfsFileNode, VfsService } from '@services/vfs/types';
import { basename, dirname, join, normalizePath } from '@services/vfs/utils/path';
import type { RecentDocumentsService } from '@services/recent-documents';

export interface NotepadWindowOptions {
  app: NotepadApp;
  document?: NotepadDocument;
  vfs?: VfsService;
  recentDocuments?: RecentDocumentsService;
  onRequestClose?: () => void;
  onTitleChange?: (title: string) => void;
  defaultContent?: string;
}

export interface NotepadWindowState {
  path?: string;
  displayName: string;
  dirty: boolean;
  message: string;
  position: { line: number; column: number };
}

export interface NotepadWindowInstance {
  element: HTMLElement;
  getState(): NotepadWindowState;
  getText(): string;
  setText(value: string): void;
  newDocument(): Promise<void>;
  openPath(path: string): Promise<void>;
  save(): Promise<boolean>;
  saveAsPath(path: string): Promise<boolean>;
  dispose(): void;
}

interface MenuItemConfig {
  id: string;
  label?: string;
  accelerator?: string;
  type?: 'command' | 'separator';
  action?: () => void | Promise<void>;
  disabled?: () => boolean;
}

const UNTITLED_NAME = 'Untitled';
const STATUS_READY = 'Ready';
const STATUS_MODIFIED = 'Modified';
const OPEN_DIALOG_ID = 'dialogs:open';
const SAVE_AS_DIALOG_ID = 'dialogs:save-as';
const DEFAULT_DIRECTORY = 'C:/Documents';

const DRIVE_PATTERN = /^[a-zA-Z]:/;

function isPromise<T>(value: unknown): value is Promise<T> {
  return typeof value === 'object' && value !== null && 'then' in (value as Record<string, unknown>);
}

function ensureTxtExtension(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('File name cannot be empty');
  }
  if (/\.[^./\\]+$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}.txt`;
}

function getDirectoryFromPath(path: string): string {
  try {
    return dirname(path);
  } catch {
    return DEFAULT_DIRECTORY;
  }
}

export function createNotepadWindow(options: NotepadWindowOptions): NotepadWindowInstance {
  const { app, recentDocuments, vfs } = options;
  if (!app) {
    throw new Error('Notepad app instance is required.');
  }

  const container = document.createElement('div');
  container.className = 'app-notepad';

  const menubar = document.createElement('div');
  menubar.className = 'app-notepad__menubar';

  const status = document.createElement('div');
  status.className = 'app-notepad__status';

  const statusMessage = document.createElement('div');
  statusMessage.className = 'app-notepad__status-message';

  const statusPosition = document.createElement('div');
  statusPosition.className = 'app-notepad__status-position';

  status.appendChild(statusMessage);
  status.appendChild(statusPosition);

  const textarea = document.createElement('textarea');
  textarea.className = 'app-notepad__editor';
  textarea.spellcheck = false;
  textarea.wrap = 'off';

  container.appendChild(menubar);
  container.appendChild(textarea);
  container.appendChild(status);

  let notepadDocument: NotepadDocument = options.document ?? app.createDocument(options.defaultContent ?? '');
  let savedSnapshot = notepadDocument.getText();
  let dirty = false;
  let currentPath: string | undefined;
  let displayName = UNTITLED_NAME;
  let statusText = STATUS_READY;

  const ownerDocument = container.ownerDocument ?? (typeof document !== 'undefined' ? document : undefined);
  const teardowns: Array<() => void> = [];

  function setStatus(text: string) {
    statusText = text;
    const position = notepadDocument.getStatus();
    statusMessage.textContent = statusText;
    statusPosition.textContent = `Ln ${position.line}, Col ${position.column}`;
  }

  function updatePosition() {
    const position = notepadDocument.getStatus();
    statusPosition.textContent = `Ln ${position.line}, Col ${position.column}`;
  }

  function applyFontPreferences() {
    const font = app.getFont();
    textarea.style.fontFamily = font.family;
    textarea.style.fontSize = `${font.size}px`;
  }

  function applyWordWrap(enabled: boolean) {
    textarea.wrap = enabled ? 'soft' : 'off';
    textarea.style.whiteSpace = enabled ? 'pre-wrap' : 'pre';
    textarea.style.wordBreak = enabled ? 'break-word' : 'normal';
    notepadDocument.setWordWrap(enabled);
  }

  function getRememberedDirectory(dialogId: string): string {
    const remembered = app.getLastDirectory(dialogId);
    if (remembered) {
      try {
        return normalizePath(remembered);
      } catch {
        return DEFAULT_DIRECTORY;
      }
    }
    return DEFAULT_DIRECTORY;
  }

  function resolveInputPath(raw: string, dialogId: string, ensureExtension = false): string {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error('Path cannot be empty');
    }

    const candidate = ensureExtension ? ensureTxtExtension(trimmed) : trimmed;
    if (DRIVE_PATTERN.test(candidate)) {
      return normalizePath(candidate);
    }

    const directory = getRememberedDirectory(dialogId);
    return join(directory, candidate);
  }

  function updateTitle() {
    const suffix = dirty ? '*' : '';
    const title = currentPath
      ? `${displayName}${suffix} - Notepad`
      : `Notepad${suffix}`;
    options.onTitleChange?.(title);
  }

  function updateRecentDocument(path: string) {
    if (!recentDocuments) {
      return;
    }
    try {
      const normalized = normalizePath(path);
      recentDocuments.add({
        id: normalized,
        path: normalized,
        title: basename(normalized),
      });
    } catch {
      // Ignore invalid paths when updating recents.
    }
  }

  function setDirtyState(nextDirty: boolean) {
    if (dirty === nextDirty) {
      return;
    }
    dirty = nextDirty;
    updateTitle();
    refreshMenuState();
  }

  function syncSelectionFromTextarea() {
    const element = textarea as HTMLTextAreaElement;
    const start = typeof element.selectionStart === 'number' ? element.selectionStart : notepadDocument.getSelection().start;
    const end = typeof element.selectionEnd === 'number' ? element.selectionEnd : notepadDocument.getSelection().end;
    notepadDocument.setSelection(start, end);
    updatePosition();
  }

  async function confirmSaveIfNeeded(): Promise<boolean> {
    if (!dirty) {
      return true;
    }

    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
      return true;
    }

    const shouldSave = window.confirm(`Do you want to save changes to ${displayName}?`);
    if (!shouldSave) {
      return true;
    }

    return handleSave();
  }

  function ensureVfs(action: string): VfsService {
    if (!vfs) {
      throw new Error(`${action} is not available because the virtual filesystem is not initialized.`);
    }
    return vfs;
  }

  async function openFromPath(path: string) {
    try {
      const resolved = resolveInputPath(path, OPEN_DIALOG_ID, false);
      const vfsService = ensureVfs('Open');
      const node = (await vfsService.read(resolved)) as VfsFileNode;
      if (node.kind !== 'file') {
        throw new Error('Selected path is not a file.');
      }
      const content = node.textContent ?? new TextDecoder().decode(node.content);
      notepadDocument = app.createDocument(content);
      savedSnapshot = notepadDocument.getText();
      displayName = basename(resolved);
      currentPath = resolved;
      applyWordWrap(notepadDocument.getWordWrap());
      textarea.value = notepadDocument.getText();
      const length = textarea.value.length;
      if (typeof (textarea as HTMLTextAreaElement).selectionStart === 'number') {
        (textarea as HTMLTextAreaElement).selectionStart = length;
        (textarea as HTMLTextAreaElement).selectionEnd = length;
      }
      syncSelectionFromTextarea();
      setDirtyState(false);
      setStatus(`Opened ${displayName}`);
      app.rememberDirectory(OPEN_DIALOG_ID, getDirectoryFromPath(resolved));
      updateRecentDocument(resolved);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Unable to open file: ${message}`);
      }
    }
  }

  async function saveToPath(path: string): Promise<boolean> {
    try {
      const resolved = resolveInputPath(path, SAVE_AS_DIALOG_ID, true);
      const vfsService = ensureVfs('Save');
      const text = notepadDocument.getText();
      await vfsService.writeFile(resolved, text);
      savedSnapshot = text;
      displayName = basename(resolved);
      currentPath = resolved;
      setDirtyState(false);
      setStatus(`Saved to ${displayName}`);
      app.rememberDirectory(SAVE_AS_DIALOG_ID, getDirectoryFromPath(resolved));
      updateRecentDocument(resolved);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Unable to save file: ${message}`);
      }
      return false;
    }
  }

  async function handleNew() {
    const proceed = await confirmSaveIfNeeded();
    if (!proceed) {
      return;
    }
    notepadDocument = app.createDocument('');
    savedSnapshot = '';
    currentPath = undefined;
    displayName = UNTITLED_NAME;
    textarea.value = '';
    if (typeof (textarea as HTMLTextAreaElement).selectionStart === 'number') {
      (textarea as HTMLTextAreaElement).selectionStart = 0;
      (textarea as HTMLTextAreaElement).selectionEnd = 0;
    }
    syncSelectionFromTextarea();
    setDirtyState(false);
    setStatus(STATUS_READY);
    applyWordWrap(notepadDocument.getWordWrap());
  }

  async function handleOpen() {
    const proceed = await confirmSaveIfNeeded();
    if (!proceed) {
      return;
    }
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
      return;
    }
    const suggestion = currentPath ?? getRememberedDirectory(OPEN_DIALOG_ID);
    const input = window.prompt('Open', suggestion);
    if (!input) {
      return;
    }
    await openFromPath(input);
  }

  async function handleSave(): Promise<boolean> {
    if (!dirty && currentPath) {
      return true;
    }
    if (!currentPath) {
      return handleSaveAs();
    }
    return saveToPath(currentPath);
  }

  async function handleSaveAs(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
      return false;
    }
    const baseDirectory = currentPath ?? getRememberedDirectory(SAVE_AS_DIALOG_ID);
    const defaultName = currentPath
      ? currentPath
      : join(baseDirectory, `${displayName === UNTITLED_NAME ? 'Untitled' : displayName}`);
    const input = window.prompt('Save As', defaultName);
    if (!input) {
      return false;
    }
    return saveToPath(input);
  }

  function handlePageSetup() {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert('Page setup is not available in this preview build of Notepad.');
    }
  }

  function handlePrint() {
    try {
      app.printDocument(notepadDocument, `${displayName}.txt`);
      setStatus('Document sent to printer');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Unable to print document: ${message}`);
      }
    }
  }

  async function handleExit() {
    const proceed = await confirmSaveIfNeeded();
    if (!proceed) {
      return;
    }
    options.onRequestClose?.();
  }

  const menuItems: MenuItemConfig[] = [
    { id: 'file:new', label: 'New', accelerator: 'Ctrl+N', action: () => handleNew() },
    { id: 'file:open', label: 'Open…', accelerator: 'Ctrl+O', action: () => handleOpen() },
    {
      id: 'file:save',
      label: 'Save',
      accelerator: 'Ctrl+S',
      action: () => handleSave(),
      disabled: () => !dirty,
    },
    { id: 'file:save-as', label: 'Save As…', accelerator: 'F12', action: () => handleSaveAs() },
    { id: 'file:separator-1', type: 'separator' },
    { id: 'file:page-setup', label: 'Page Setup…', action: () => handlePageSetup() },
    { id: 'file:print', label: 'Print…', accelerator: 'Ctrl+P', action: () => handlePrint() },
    { id: 'file:separator-2', type: 'separator' },
    { id: 'file:exit', label: 'Exit', action: () => handleExit() },
  ];

  const menuButtons = new Map<string, HTMLButtonElement>();

  function closeMenu(menu: HTMLElement) {
    menu.dataset.open = 'false';
    const button = menu.querySelector('button');
    if (button) {
      button.setAttribute('aria-expanded', 'false');
    }
  }

  function closeAllMenus() {
    menubar.querySelectorAll<HTMLElement>('.app-notepad__menu').forEach((menu) => closeMenu(menu));
  }

  function buildMenuItem(config: MenuItemConfig): HTMLElement {
    if (config.type === 'separator') {
      const separator = document.createElement('li');
      separator.className = 'app-notepad__menu-separator';
      separator.setAttribute('role', 'separator');
      return separator;
    }

    const item = document.createElement('li');
    item.className = 'app-notepad__menu-item';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-notepad__menu-command';
    button.setAttribute('role', 'menuitem');
    button.textContent = config.label ?? '';

    const accelerator = document.createElement('span');
    accelerator.className = 'app-notepad__menu-accelerator';
    accelerator.textContent = config.accelerator ?? '';
    button.appendChild(accelerator);

    button.addEventListener('click', () => {
      if (config.disabled?.()) {
        return;
      }
      closeAllMenus();
      const result = config.action?.();
      if (isPromise(result)) {
        result.catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert(message);
          }
        });
      }
    });

    item.appendChild(button);
    item.dataset.commandId = config.id;
    menuButtons.set(config.id, button);
    return item;
  }

  function refreshMenuState() {
    menuItems.forEach((config) => {
      if (config.type === 'separator' || !config.action) {
        return;
      }
      const button = menuButtons.get(config.id);
      if (!button) {
        return;
      }
      const disabled = config.disabled?.() ?? false;
      button.toggleAttribute('disabled', disabled);
    });
  }

  function createMenu(label: string, items: MenuItemConfig[]): HTMLElement {
    const menu = document.createElement('div');
    menu.className = 'app-notepad__menu';
    menu.dataset.open = 'false';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'app-notepad__menu-button';
    trigger.textContent = label;
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');

    const list = document.createElement('ul');
    list.className = 'app-notepad__menu-dropdown';
    list.setAttribute('role', 'menu');

    items.map(buildMenuItem).forEach((item) => list.appendChild(item));

    trigger.addEventListener('click', () => {
      const isOpen = menu.dataset.open === 'true';
      closeAllMenus();
      if (!isOpen) {
        menu.dataset.open = 'true';
        trigger.setAttribute('aria-expanded', 'true');
        refreshMenuState();
      }
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu(menu);
      }
    });

    menu.appendChild(trigger);
    menu.appendChild(list);
    return menu;
  }

  const fileMenu = createMenu('File', menuItems);
  menubar.appendChild(fileMenu);

  function handleTextInput() {
    notepadDocument.setText(textarea.value);
    syncSelectionFromTextarea();
    const isDirty = notepadDocument.getText() !== savedSnapshot;
    setDirtyState(isDirty);
    setStatus(isDirty ? STATUS_MODIFIED : STATUS_READY);
  }

  textarea.addEventListener('input', () => handleTextInput());
  textarea.addEventListener('select', () => syncSelectionFromTextarea());
  textarea.addEventListener('keyup', () => syncSelectionFromTextarea());
  textarea.addEventListener('click', () => syncSelectionFromTextarea());

  textarea.addEventListener('keydown', (event) => {
    if (!event.ctrlKey) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'n') {
      event.preventDefault();
      handleNew();
    } else if (key === 'o') {
      event.preventDefault();
      handleOpen();
    } else if (key === 's') {
      event.preventDefault();
      handleSave();
    } else if (key === 'p') {
      event.preventDefault();
      handlePrint();
    }
  });

  if (
    ownerDocument &&
    typeof ownerDocument.addEventListener === 'function' &&
    typeof ownerDocument.removeEventListener === 'function'
  ) {
    const handleDocumentMouseDown = (event: Event) => {
      const target = event.target as Node | null;
      if (target && !container.contains(target)) {
        closeAllMenus();
      }
    };
    const handleDocumentKeyDown = (event: Event) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        closeAllMenus();
      }
    };
    ownerDocument.addEventListener('mousedown', handleDocumentMouseDown as EventListener);
    ownerDocument.addEventListener('keydown', handleDocumentKeyDown as EventListener);
    teardowns.push(() => ownerDocument.removeEventListener('mousedown', handleDocumentMouseDown as EventListener));
    teardowns.push(() => ownerDocument.removeEventListener('keydown', handleDocumentKeyDown as EventListener));
  }

  applyFontPreferences();
  applyWordWrap(notepadDocument.getWordWrap());
  textarea.value = notepadDocument.getText();
  const initialLength = textarea.value.length;
  if (typeof (textarea as HTMLTextAreaElement).selectionStart === 'number') {
    (textarea as HTMLTextAreaElement).selectionStart = initialLength;
    (textarea as HTMLTextAreaElement).selectionEnd = initialLength;
  }
  syncSelectionFromTextarea();
  setStatus(STATUS_READY);
  updateTitle();

  return {
    element: container,
    getState() {
      return {
        path: currentPath,
        displayName,
        dirty,
        message: statusText,
        position: notepadDocument.getStatus(),
      };
    },
    getText() {
      return notepadDocument.getText();
    },
    setText(value: string) {
      textarea.value = value;
      const element = textarea as HTMLTextAreaElement;
      if (typeof element.selectionStart === 'number') {
        element.selectionStart = value.length;
        element.selectionEnd = value.length;
      }
      handleTextInput();
    },
    async newDocument() {
      await handleNew();
    },
    async openPath(path: string) {
      await openFromPath(path);
    },
    async save() {
      return handleSave();
    },
    async saveAsPath(path: string) {
      return saveToPath(path);
    },
    dispose() {
      teardowns.splice(0, teardowns.length).forEach((teardown) => teardown());
    },
  };
}
