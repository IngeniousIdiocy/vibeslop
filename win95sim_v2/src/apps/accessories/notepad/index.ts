import { SettingsService } from '@services/settings';
import { DialogStateService, DialogFilter } from '@services/dialog-state';
import { PrintService, PrintJob } from '@services/print';
import { createNotepadDocument, NotepadDocument } from './state/document';

export interface NotepadFontPreference {
  family: string;
  size: number;
}

export interface NotepadPreferences {
  wordWrap: boolean;
  font: NotepadFontPreference;
}

export interface NotepadAppDependencies {
  settings: SettingsService;
  dialogState: DialogStateService;
  print: PrintService;
}

export interface NotepadApp {
  createDocument(initialText?: string): NotepadDocument;
  getPreferences(): NotepadPreferences;
  setWordWrap(enabled: boolean): void;
  toggleWordWrap(): boolean;
  setFont(font: NotepadFontPreference): void;
  getFont(): NotepadFontPreference;
  getFileFilters(): DialogFilter[];
  rememberDirectory(dialogId: string, directory: string): void;
  getLastDirectory(dialogId: string): string | undefined;
  printDocument(document: NotepadDocument, documentName: string): PrintJob;
}

const WORD_WRAP_KEY = 'apps.notepad.wordWrap';
const FONT_FAMILY_KEY = 'apps.notepad.fontFamily';
const FONT_SIZE_KEY = 'apps.notepad.fontSize';

const defaultFilters: DialogFilter[] = [
  { label: 'Text Documents (*.txt)', extensions: ['.txt', '.log'] },
  { label: 'All Files (*.*)', extensions: ['*'] },
];

export function createNotepadApp(dependencies: NotepadAppDependencies): NotepadApp {
  const { settings, dialogState, print } = dependencies;
  let wordWrap = Boolean(settings.get(WORD_WRAP_KEY, false));
  let font: NotepadFontPreference = {
    family: (settings.get(FONT_FAMILY_KEY, 'Courier New') as string) ?? 'Courier New',
    size: Number(settings.get(FONT_SIZE_KEY, 10)) || 10,
  };

  return {
    createDocument(initialText = '') {
      const document = createNotepadDocument({ initialText, wordWrap });
      return document;
    },
    getPreferences() {
      return { wordWrap, font: { ...font } };
    },
    setWordWrap(enabled) {
      wordWrap = !!enabled;
      settings.set(WORD_WRAP_KEY, wordWrap);
    },
    toggleWordWrap() {
      wordWrap = !wordWrap;
      settings.set(WORD_WRAP_KEY, wordWrap);
      return wordWrap;
    },
    setFont(preferredFont) {
      font = { ...preferredFont };
      settings.set(FONT_FAMILY_KEY, font.family);
      settings.set(FONT_SIZE_KEY, font.size);
    },
    getFont() {
      return { ...font };
    },
    getFileFilters() {
      return defaultFilters.map((filter) => ({ ...filter, extensions: [...filter.extensions] }));
    },
    rememberDirectory(dialogId, directory) {
      dialogState.rememberDirectory(dialogId, directory);
    },
    getLastDirectory(dialogId) {
      return dialogState.getLastDirectory(dialogId);
    },
    printDocument(document, documentName) {
      return print.spoolText({
        documentName,
        text: document.getText(),
        columns: wordWrap ? 72 : 80,
        linesPerPage: 60,
      });
    },
  };
}
