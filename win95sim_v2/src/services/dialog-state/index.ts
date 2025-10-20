import { createEventBus, EventBus } from '@core/kernel/eventBus';

export interface DialogFilter {
  label: string;
  extensions: string[];
}

export interface DialogStateEvent {
  dialogId: string;
  directory: string;
}

export interface DialogStateService {
  bus: EventBus;
  rememberDirectory(dialogId: string, directory: string): void;
  getLastDirectory(dialogId: string): string | undefined;
  matchFilter(filename: string, filters: DialogFilter[]): DialogFilter | undefined;
}

interface DialogStateOptions {
  recentDirectories?: Record<string, string>;
}

function normaliseExtension(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '*') {
    return '*';
  }
  return trimmed.startsWith('.') ? trimmed.toLowerCase() : `.${trimmed.toLowerCase()}`;
}

function extractExtension(filename: string): string | undefined {
  const normalised = filename.trim();
  const lastDot = normalised.lastIndexOf('.');
  if (lastDot === -1 || lastDot === normalised.length - 1) {
    return undefined;
  }
  return normalised.slice(lastDot).toLowerCase();
}

export function createDialogStateService(options: DialogStateOptions = {}): DialogStateService {
  const recentDirectories = new Map<string, string>(Object.entries(options.recentDirectories ?? {}));
  const bus = createEventBus();

  return {
    bus,
    rememberDirectory(dialogId, directory) {
      recentDirectories.set(dialogId, directory);
      bus.emit<DialogStateEvent>('dialog:directory', { dialogId, directory });
    },
    getLastDirectory(dialogId) {
      return recentDirectories.get(dialogId);
    },
    matchFilter(filename, filters) {
      if (!filename || filters.length === 0) {
        return undefined;
      }

      const extension = extractExtension(filename);
      if (extension) {
        for (const filter of filters) {
          if (filter.extensions.some((ext) => normaliseExtension(ext) === extension)) {
            return filter;
          }
        }
      }

      const wildcard = filters.find((filter) => filter.extensions.some((ext) => normaliseExtension(ext) === '*'));
      return wildcard;
    },
  };
}
