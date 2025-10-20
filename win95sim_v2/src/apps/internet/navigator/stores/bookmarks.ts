import { createEventBus, EventBus } from '@core/kernel/eventBus';
import { SettingsService } from '@services/settings';

export interface BookmarkEntry {
  id: string;
  title: string;
  url: string;
  createdAt: number;
}

export interface BookmarkEvent {
  bookmarks: BookmarkEntry[];
}

export interface BookmarkStoreOptions {
  settings: SettingsService;
  storageKey?: string;
  idGenerator?: () => string;
}

export interface BookmarkStore {
  list(): BookmarkEntry[];
  add(title: string, url: string): BookmarkEntry;
  remove(id: string): void;
  reorder(order: string[]): void;
  bus: EventBus;
}

const DEFAULT_STORAGE_KEY = 'navigator.bookmarks';

let bookmarkCounter = 0;

function defaultIdGenerator(): string {
  bookmarkCounter += 1;
  return `bookmark-${bookmarkCounter}`;
}

function loadBookmarks(settings: SettingsService, storageKey: string): BookmarkEntry[] {
  const raw = settings.get(storageKey);
  if (typeof raw !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as BookmarkEntry[];
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt ?? Date.now(),
      }));
    }
  } catch (error) {
    // Ignore malformed payloads.
  }

  return [];
}

export function createBookmarkStore(options: BookmarkStoreOptions): BookmarkStore {
  const { settings } = options;
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const idGenerator = options.idGenerator ?? defaultIdGenerator;

  const bus = createEventBus();
  let bookmarks = loadBookmarks(settings, storageKey);

  function emit() {
    bus.emit<BookmarkEvent>('bookmarks:changed', { bookmarks: list() });
  }

  function persist() {
    settings.set(storageKey, JSON.stringify(bookmarks));
  }

  function list(): BookmarkEntry[] {
    return bookmarks.map((entry) => ({ ...entry }));
  }

  function add(title: string, url: string): BookmarkEntry {
    const entry: BookmarkEntry = {
      id: idGenerator(),
      title,
      url,
      createdAt: Date.now(),
    };
    bookmarks = [...bookmarks, entry];
    persist();
    emit();
    return { ...entry };
  }

  function remove(id: string) {
    const next = bookmarks.filter((entry) => entry.id !== id);
    if (next.length === bookmarks.length) {
      return;
    }
    bookmarks = next;
    persist();
    emit();
  }

  function reorder(order: string[]) {
    const orderSet = new Set(order);
    const reordered: BookmarkEntry[] = [];
    order.forEach((id) => {
      const match = bookmarks.find((entry) => entry.id === id);
      if (match) {
        reordered.push(match);
      }
    });

    bookmarks.forEach((entry) => {
      if (!orderSet.has(entry.id)) {
        reordered.push(entry);
      }
    });

    bookmarks = reordered;
    persist();
    emit();
  }

  return {
    list,
    add,
    remove,
    reorder,
    bus,
  };
}
