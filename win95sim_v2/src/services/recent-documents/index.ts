import { EventBus, createEventBus } from '@core/kernel/eventBus';

export interface RecentDocumentEntry {
  id: string;
  title: string;
  path: string;
  openedAt: number;
  metadata?: Record<string, unknown>;
}

export interface RecentDocumentsSnapshot {
  entries: RecentDocumentEntry[];
}

export interface RecentDocumentsAdapter {
  load(): RecentDocumentsSnapshot | undefined;
  save(snapshot: RecentDocumentsSnapshot): void;
}

export interface RecentDocumentEvent {
  entry: RecentDocumentEntry;
  entries: RecentDocumentEntry[];
}

export interface RecentDocumentsService {
  bus: EventBus;
  add(entry: Omit<RecentDocumentEntry, 'openedAt'> & { openedAt?: number }): RecentDocumentEntry;
  list(): RecentDocumentEntry[];
  clear(): void;
}

export interface RecentDocumentsOptions {
  adapter?: RecentDocumentsAdapter;
  capacity?: number;
  clock?: () => number;
  bus?: EventBus;
}

const DEFAULT_CAPACITY = 10;

export function createRecentDocumentsService(options: RecentDocumentsOptions = {}): RecentDocumentsService {
  const adapter = options.adapter;
  const capacity = options.capacity ?? DEFAULT_CAPACITY;
  const bus = options.bus ?? createEventBus();
  const now = options.clock ?? (() => Date.now());

  const entries = new Map<string, RecentDocumentEntry>();
  const order: string[] = [];

  function loadInitial() {
    const snapshot = adapter?.load();
    if (!snapshot) {
      return;
    }

    snapshot.entries
      .slice()
      .sort((a, b) => b.openedAt - a.openedAt)
      .forEach((entry) => {
        entries.set(entry.id, entry);
        order.push(entry.id);
      });
  }

  function emit(entry: RecentDocumentEntry) {
    const list = listEntries();
    bus.emit<RecentDocumentEvent>('recent-documents:added', { entry, entries: list });
    adapter?.save({ entries: list });
  }

  function listEntries(): RecentDocumentEntry[] {
    return order.map((id) => entries.get(id)!).filter(Boolean);
  }

  loadInitial();

  return {
    bus,
    add(entry) {
      const openedAt = entry.openedAt ?? now();
      const record: RecentDocumentEntry = { ...entry, openedAt };
      if (entries.has(record.id)) {
        const index = order.indexOf(record.id);
        if (index !== -1) {
          order.splice(index, 1);
        }
      }

      entries.set(record.id, record);
      order.unshift(record.id);

      while (order.length > capacity) {
        const removed = order.pop();
        if (removed) {
          entries.delete(removed);
        }
      }

      emit(record);
      return record;
    },
    list() {
      return listEntries();
    },
    clear() {
      entries.clear();
      order.splice(0, order.length);
      adapter?.save({ entries: [] });
      bus.emit('recent-documents:cleared', { entries: [] });
    },
  };
}
