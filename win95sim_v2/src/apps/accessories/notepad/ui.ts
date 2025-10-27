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
  type?: 'command' | 'separator' | 'checkbox';
  action?: () => void | Promise<void>;
  disabled?: () => boolean;
  checked?: () => boolean;
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
  let statusVisible = true;
  let lastFindQuery = '';
  let lastFindMatchCase = false;

  type MenuEntry = {
    config: MenuItemConfig;
    button: HTMLButtonElement;
    check?: HTMLSpanElement;
  };

  const menuEntries = new Map<string, MenuEntry>();

  type SelectionBehavior = 'select' | 'start' | 'end' | 'preserve';

  function focusEditor() {
    if (typeof (textarea as HTMLTextAreaElement).focus === 'function') {
      (textarea as HTMLTextAreaElement).focus();
    }
  }

  function promptUser(message: string, defaultValue?: string): string | null {
    if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
      return null;
    }
    return window.prompt(message, defaultValue);
  }

  function alertUser(message: string): void {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message);
    }
  }

  function execDocumentCommand(command: string): boolean {
    if (!ownerDocument) {
      return false;
    }
    const doc = ownerDocument as Document & { execCommand?: (commandId: string) => boolean };
    if (typeof doc.execCommand !== 'function') {
      return false;
    }
    try {
      focusEditor();
      return doc.execCommand(command);
    } catch {
      return false;
    }
  }

  function replaceSelectionWith(text: string, behavior: SelectionBehavior = 'end') {
    const element = textarea as HTMLTextAreaElement;
    const start = typeof element.selectionStart === 'number' ? element.selectionStart : 0;
    const end = typeof element.selectionEnd === 'number' ? element.selectionEnd : start;

    if (typeof element.setRangeText === 'function') {
      element.setRangeText(text, start, end, behavior);
      handleTextInput();
      return;
    }

    const value = textarea.value;
    textarea.value = `${value.slice(0, start)}${text}${value.slice(end)}`;
    const nextStart = behavior === 'start' ? start : start + text.length;
    const nextEnd = behavior === 'select' ? start + text.length : nextStart;
    if (typeof element.setSelectionRange === 'function') {
      element.setSelectionRange(nextStart, nextEnd);
    }
    handleTextInput();
  }

  function updateEditorSelectionFromDocument() {
    const selection = notepadDocument.getSelection();
    const element = textarea as HTMLTextAreaElement;
    if (typeof element.setSelectionRange === 'function') {
      element.setSelectionRange(selection.start, selection.end);
    }
    updatePosition();
    refreshMenuState();
  }

  function hasSelection(): boolean {
    const selection = notepadDocument.getSelection();
    return selection.end > selection.start;
  }

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
    refreshMenuState();
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
    refreshMenuState();
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
      alertUser(`Unable to open file: ${message}`);
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
      alertUser(`Unable to save file: ${message}`);
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
    alertUser('Page setup is not available in this preview build of Notepad.');
  }

  function handlePrint() {
    try {
      app.printDocument(notepadDocument, `${displayName}.txt`);
      setStatus('Document sent to printer');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alertUser(`Unable to print document: ${message}`);
    }
  }

  function handleUndo() {
    if (!execDocumentCommand('undo')) {
      setStatus('Nothing to undo');
    }
  }

  async function handleCut() {
    if (!hasSelection()) {
      setStatus('Nothing selected to cut');
      return;
    }
    if (execDocumentCommand('cut')) {
      return;
    }
    const selection = notepadDocument.getSelection();
    const text = notepadDocument.getText().slice(selection.start, selection.end);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Ignore clipboard errors and fall back to local removal.
      }
    }
    replaceSelectionWith('', 'start');
    setStatus('Cut selection');
  }

  async function handleCopy() {
    if (!hasSelection()) {
      setStatus('Nothing selected to copy');
      return;
    }
    if (execDocumentCommand('copy')) {
      setStatus('Copied selection');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      const selection = notepadDocument.getSelection();
      const text = notepadDocument.getText().slice(selection.start, selection.end);
      try {
        await navigator.clipboard.writeText(text);
        setStatus('Copied selection');
        return;
      } catch {
        // Ignore clipboard errors and fall through to alert.
      }
    }
    alertUser('Copy is not available in this environment.');
  }

  async function handlePaste() {
    if (execDocumentCommand('paste')) {
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText();
        replaceSelectionWith(text, 'end');
        setStatus('Pasted from clipboard');
        return;
      } catch {
        // Ignore clipboard errors and fall through to alert.
      }
    }
    alertUser('Paste is not available in this environment.');
  }

  function handleDelete() {
    if (!hasSelection()) {
      setStatus('Nothing selected to delete');
      return;
    }
    replaceSelectionWith('', 'start');
    setStatus('Deleted selection');
  }

  function handleSelectAll() {
    focusEditor();
    const element = textarea as HTMLTextAreaElement;
    if (typeof element.select === 'function') {
      element.select();
      syncSelectionFromTextarea();
      setStatus('Selected all');
    }
  }

  function handleInsertTimeDate() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const date = now.toLocaleDateString('en-US');
    const stamp = `${time} ${date}`;
    replaceSelectionWith(stamp, 'end');
    setStatus('Inserted time/date');
  }

  function performFind(query: string, options?: Parameters<NotepadDocument['findNext']>[1]) {
    if (!query) {
      return false;
    }
    const result = notepadDocument.findNext(query, options);
    if (!result) {
      alertUser(`Cannot find "${query}"`);
      return false;
    }
    updateEditorSelectionFromDocument();
    setStatus(result.wrapped ? 'Reached beginning of document' : 'Found next');
    return true;
  }

  function handleFind() {
    const input = promptUser('Find what:', lastFindQuery || '');
    if (input === null || input === '') {
      return;
    }
    const matchCase =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm('Match case?')
        : lastFindMatchCase;
    lastFindQuery = input;
    lastFindMatchCase = matchCase;
    refreshMenuState();
    performFind(lastFindQuery, {
      direction: 'forward',
      wrap: true,
      matchCase: lastFindMatchCase,
    });
  }

  function handleFindNext() {
    if (!lastFindQuery) {
      handleFind();
      return;
    }
    performFind(lastFindQuery, {
      direction: 'forward',
      wrap: true,
      matchCase: lastFindMatchCase,
      fromIndex: notepadDocument.getSelection().end,
    });
  }

  function handleReplace() {
    const query = promptUser('Find what:', lastFindQuery || '');
    if (query === null || query === '') {
      return;
    }
    const replacement = promptUser('Replace with:', '');
    if (replacement === null) {
      return;
    }
    lastFindQuery = query;
    const matchCase =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm('Match case?')
        : lastFindMatchCase;
    lastFindMatchCase = matchCase;
    refreshMenuState();

    const replaceAll = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm('Replace all occurrences?')
      : false;

    if (replaceAll) {
      const result = notepadDocument.replaceAll(query, replacement, {
        matchCase,
        wrap: true,
      });
      textarea.value = notepadDocument.getText();
      updateEditorSelectionFromDocument();
      setDirtyState(notepadDocument.getText() !== savedSnapshot);
      setStatus(result.replacements ? `Replaced ${result.replacements} occurrence(s)` : 'No matches found');
      return;
    }

    const result = notepadDocument.replaceNext(query, replacement, {
      matchCase,
      wrap: true,
    });
    if (!result.replaced) {
      alertUser(`Cannot find "${query}"`);
      return;
    }
    textarea.value = notepadDocument.getText();
    updateEditorSelectionFromDocument();
    setDirtyState(notepadDocument.getText() !== savedSnapshot);
    setStatus('Replaced selection');
  }

  function handleGoToLine() {
    if (notepadDocument.getWordWrap()) {
      setStatus('Disable word wrap to use Go To');
      return;
    }
    const input = promptUser('Line number:', '');
    if (!input) {
      return;
    }
    const lineNumber = Number.parseInt(input, 10);
    if (!Number.isFinite(lineNumber)) {
      alertUser('Please enter a valid line number.');
      return;
    }
    try {
      notepadDocument.goToLine(lineNumber);
      updateEditorSelectionFromDocument();
      setStatus(`Moved to line ${lineNumber}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alertUser(message);
    }
  }

  function handleToggleWordWrap() {
    const nextWrap = !notepadDocument.getWordWrap();
    app.setWordWrap(nextWrap);
    applyWordWrap(nextWrap);
    if (nextWrap && statusVisible) {
      applyStatusVisibility(false);
    }
    setStatus(`Word Wrap ${nextWrap ? 'enabled' : 'disabled'}`);
    refreshMenuState();
  }

  function handleChooseFont() {
    const font = app.getFont();
    const family = promptUser('Font family:', font.family);
    if (!family) {
      return;
    }
    const sizeInput = promptUser('Font size (pt):', String(font.size));
    if (!sizeInput) {
      return;
    }
    const size = Number.parseInt(sizeInput, 10);
    if (!Number.isFinite(size) || size <= 0) {
      alertUser('Please enter a valid font size.');
      return;
    }
    app.setFont({ family, size });
    applyFontPreferences();
    setStatus(`Font set to ${family} ${size}pt`);
  }

  function applyStatusVisibility(visible: boolean) {
    statusVisible = visible;
    status.style.display = visible ? 'flex' : 'none';
  }

  applyStatusVisibility(statusVisible);

  function handleToggleStatusBar() {
    if (notepadDocument.getWordWrap()) {
      return;
    }
    applyStatusVisibility(!statusVisible);
    setStatus(statusVisible ? STATUS_READY : 'Status bar hidden');
    refreshMenuState();
  }

  function handleViewHelp() {
    alertUser('Notepad help is not available in this preview build.');
  }

  function handleAbout() {
    alertUser('Notepad\n\nWindows 95 Simulator Preview Build');
  }

  async function handleExit() {
    const proceed = await confirmSaveIfNeeded();
    if (!proceed) {
      return;
    }
    options.onRequestClose?.();
  }

  const fileMenuItems: MenuItemConfig[] = [
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

  const editMenuItems: MenuItemConfig[] = [
    { id: 'edit:undo', label: 'Undo', accelerator: 'Ctrl+Z', action: () => handleUndo() },
    { id: 'edit:separator-1', type: 'separator' },
    {
      id: 'edit:cut',
      label: 'Cut',
      accelerator: 'Ctrl+X',
      action: () => handleCut(),
      disabled: () => !hasSelection(),
    },
    {
      id: 'edit:copy',
      label: 'Copy',
      accelerator: 'Ctrl+C',
      action: () => handleCopy(),
      disabled: () => !hasSelection(),
    },
    { id: 'edit:paste', label: 'Paste', accelerator: 'Ctrl+V', action: () => handlePaste() },
    {
      id: 'edit:delete',
      label: 'Delete',
      accelerator: 'Del',
      action: () => handleDelete(),
      disabled: () => !hasSelection(),
    },
    { id: 'edit:separator-2', type: 'separator' },
    { id: 'edit:find', label: 'Find…', accelerator: 'Ctrl+F', action: () => handleFind() },
    {
      id: 'edit:find-next',
      label: 'Find Next',
      accelerator: 'F3',
      action: () => handleFindNext(),
      disabled: () => !lastFindQuery,
    },
    { id: 'edit:replace', label: 'Replace…', accelerator: 'Ctrl+H', action: () => handleReplace() },
    {
      id: 'edit:go-to',
      label: 'Go To…',
      accelerator: 'Ctrl+G',
      action: () => handleGoToLine(),
      disabled: () => notepadDocument.getWordWrap(),
    },
    { id: 'edit:separator-3', type: 'separator' },
    { id: 'edit:select-all', label: 'Select All', accelerator: 'Ctrl+A', action: () => handleSelectAll() },
    { id: 'edit:time-date', label: 'Time/Date', accelerator: 'F5', action: () => handleInsertTimeDate() },
  ];

  const formatMenuItems: MenuItemConfig[] = [
    {
      id: 'format:word-wrap',
      label: 'Word Wrap',
      type: 'checkbox',
      action: () => handleToggleWordWrap(),
      checked: () => notepadDocument.getWordWrap(),
    },
    { id: 'format:font', label: 'Font…', action: () => handleChooseFont() },
  ];

  const viewMenuItems: MenuItemConfig[] = [
    {
      id: 'view:status-bar',
      label: 'Status Bar',
      type: 'checkbox',
      action: () => handleToggleStatusBar(),
      checked: () => statusVisible,
      disabled: () => notepadDocument.getWordWrap(),
    },
  ];

  const helpMenuItems: MenuItemConfig[] = [
    { id: 'help:view-help', label: 'View Help', action: () => handleViewHelp() },
    { id: 'help:about', label: 'About Notepad', action: () => handleAbout() },
  ];

  const menuGroups = [
    { label: 'File', items: fileMenuItems },
    { label: 'Edit', items: editMenuItems },
    { label: 'Format', items: formatMenuItems },
    { label: 'View', items: viewMenuItems },
    { label: 'Help', items: helpMenuItems },
  ];

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
    button.setAttribute('role', config.type === 'checkbox' ? 'menuitemcheckbox' : 'menuitem');

    let check: HTMLSpanElement | undefined;
    if (config.type === 'checkbox') {
      check = document.createElement('span');
      check.className = 'app-notepad__menu-check';
      button.appendChild(check);
    }

    const label = document.createElement('span');
    label.className = 'app-notepad__menu-label';
    label.textContent = config.label ?? '';
    button.appendChild(label);

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
          alertUser(message);
        });
      }
    });

    item.appendChild(button);
    item.dataset.commandId = config.id;
    menuEntries.set(config.id, { config, button, check });
    return item;
  }

  function refreshMenuState() {
    menuEntries.forEach(({ config, button, check }) => {
      if (config.type === 'separator') {
        return;
      }
      const disabled = config.disabled?.() ?? false;
      if (typeof button.toggleAttribute === 'function') {
        button.toggleAttribute('disabled', disabled);
      } else if (typeof button.setAttribute === 'function') {
        if (disabled) {
          button.setAttribute('disabled', 'true');
        } else if (typeof button.removeAttribute === 'function') {
          button.removeAttribute('disabled');
        }
      }
      if (config.type === 'checkbox') {
        const checked = config.checked?.() ?? false;
        if (typeof button.setAttribute === 'function') {
          button.setAttribute('aria-checked', checked ? 'true' : 'false');
        }
        if (check) {
          check.textContent = checked ? '✓' : '';
        }
      } else if (typeof button.removeAttribute === 'function') {
        button.removeAttribute('aria-checked');
      }
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

  menuGroups.forEach(({ label, items }) => {
    const menu = createMenu(label, items);
    menubar.appendChild(menu);
  });
  refreshMenuState();

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
    if (event.key === 'F5') {
      event.preventDefault();
      handleInsertTimeDate();
      return;
    }
    if (event.key === 'F3' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      handleFindNext();
      return;
    }
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
    } else if (key === 'z') {
      event.preventDefault();
      handleUndo();
    } else if (key === 'x') {
      event.preventDefault();
      void handleCut();
    } else if (key === 'c') {
      event.preventDefault();
      void handleCopy();
    } else if (key === 'v') {
      event.preventDefault();
      void handlePaste();
    } else if (key === 'f') {
      event.preventDefault();
      handleFind();
    } else if (key === 'h') {
      event.preventDefault();
      handleReplace();
    } else if (key === 'g') {
      event.preventDefault();
      if (notepadDocument.getWordWrap()) {
        setStatus('Disable word wrap to use Go To');
      } else {
        handleGoToLine();
      }
    } else if (key === 'a') {
      event.preventDefault();
      handleSelectAll();
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
