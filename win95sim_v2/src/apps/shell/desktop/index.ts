import { LayoutPosition, LayoutService } from '@services/layout';

export interface DesktopEntry {
  id: string;
  title: string;
  resource: string;
  type: 'file' | 'folder' | 'shortcut';
  icon?: string;
}

export interface DesktopIcon extends DesktopEntry {
  position: LayoutPosition;
  selected: boolean;
}

export interface DesktopModuleOptions {
  layout: LayoutService;
  resolveEntries: () => DesktopEntry[];
  onRename?: (entry: DesktopEntry, nextTitle: string) => void;
  surfaceId?: string;
  columnHeight?: number;
  gridSize?: number;
}

export interface DesktopModule {
  list(): DesktopIcon[];
  move(id: string, position: LayoutPosition, options?: DesktopMoveOptions): void;
  rename(id: string, nextTitle: string): DesktopEntry | undefined;
  getSelection(): string[];
  setSelection(ids: string[]): void;
  clearSelection(): void;
  arrange(): void;
}

export interface DesktopMoveOptions {
  snapToGrid?: boolean;
}

const DEFAULT_SURFACE = '::desktop';
const DEFAULT_COLUMN_HEIGHT = 6;

export function createDesktopModule(options: DesktopModuleOptions): DesktopModule {
  const layout = options.layout;
  const surfaceId = options.surfaceId ?? DEFAULT_SURFACE;
  const columnHeight = options.columnHeight ?? DEFAULT_COLUMN_HEIGHT;
  const baseSnapshot = layout.getSnapshot(surfaceId);
  const gridSize = options.gridSize ?? baseSnapshot.gridSize ?? 48;
  const selection = new Set<string>();

  layout.setGridSize(surfaceId, gridSize);

  function ensureLayout(entries: DesktopEntry[]) {
    const snapshot = layout.getSnapshot(surfaceId);
    let column = 0;
    let row = 0;
    entries.forEach((entry) => {
      if (!snapshot.items[entry.id]) {
        const position = {
          x: column * gridSize,
          y: row * gridSize,
        };
        layout.setItem(surfaceId, entry.id, position);
        row += 1;
        if (row >= columnHeight) {
          row = 0;
          column += 1;
        }
      }
    });
  }

  function list(): DesktopIcon[] {
    const entries = options.resolveEntries();
    ensureLayout(entries);
    const snapshot = layout.getSnapshot(surfaceId);

    return entries.map((entry) => ({
      ...entry,
      position: snapshot.items[entry.id],
      selected: selection.has(entry.id),
    }));
  }

  return {
    list,
    move(id, position, moveOptions) {
      layout.setItem(surfaceId, id, position, {
        snapToGrid: moveOptions?.snapToGrid ?? true,
      });
    },
    rename(id, nextTitle) {
      const entries = options.resolveEntries();
      const entry = entries.find((item) => item.id === id);
      if (!entry) {
        return undefined;
      }

      options.onRename?.(entry, nextTitle);
      entry.title = nextTitle;
      return entry;
    },
    getSelection() {
      return Array.from(selection);
    },
    setSelection(ids) {
      selection.clear();
      ids.forEach((id) => selection.add(id));
    },
    clearSelection() {
      selection.clear();
    },
    arrange() {
      const entries = options.resolveEntries();
      const next = entries
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title));

      layout.clear(surfaceId);

      let column = 0;
      let row = 0;
      next.forEach((entry) => {
        layout.setItem(surfaceId, entry.id, {
          x: column * gridSize,
          y: row * gridSize,
        });
        row += 1;
        if (row >= columnHeight) {
          row = 0;
          column += 1;
        }
      });
    },
  };
}
