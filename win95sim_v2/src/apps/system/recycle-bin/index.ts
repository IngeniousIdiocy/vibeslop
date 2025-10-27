import type { VfsRecycleBinEntry, VfsService } from '@services/vfs';

export interface RecycleBinAppOptions {
  vfs: VfsService;
}

export interface RecycleBinAppInstance {
  mount(host: HTMLElement): void;
  destroy(): void;
}

function formatDeletedAt(timestamp: number): string {
  const date = new Date(timestamp);
  try {
    return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return date.toLocaleString();
  }
}

export function createRecycleBinApp(options: RecycleBinAppOptions): RecycleBinAppInstance {
  const vfs = options.vfs;
  let container: HTMLElement | null = null;
  let listHost: HTMLElement | null = null;
  let emptyState: HTMLElement | null = null;
  let restoreButton: HTMLButtonElement | null = null;
  let emptyButton: HTMLButtonElement | null = null;
  let statusCount: HTMLElement | null = null;
  let statusSize: HTMLElement | null = null;
  let selectedId: string | null = null;
  const teardown: Array<() => void> = [];
  let currentEntries: VfsRecycleBinEntry[] = [];

  function getEntries(): VfsRecycleBinEntry[] {
    return vfs
      .recycleBin
      .list()
      .slice()
      .sort((a, b) => b.deletedAt - a.deletedAt);
  }

  function updateActions(entries: VfsRecycleBinEntry[]) {
    if (restoreButton) {
      restoreButton.disabled = !selectedId;
    }
    if (emptyButton) {
      emptyButton.disabled = entries.length === 0;
    }
  }

  function formatSize(bytes: number): string {
    if (bytes <= 0) {
      return '0 bytes';
    }

    const units = ['bytes', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let value = bytes;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    if (unitIndex === 0) {
      return `${Math.round(value)} ${units[unitIndex]}`;
    }

    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  function updateStatus(entries: VfsRecycleBinEntry[]) {
    if (!statusCount || !statusSize) {
      return;
    }

    const totalBytes = entries.reduce((acc, entry) => acc + (entry.size ?? 0), 0);
    statusCount.textContent = `${entries.length} object(s)`;
    statusSize.textContent = formatSize(totalBytes);
  }

  function updateSelectionVisuals() {
    if (!listHost) {
      return;
    }
    let nodes: HTMLElement[] = [];
    if (typeof listHost.querySelectorAll === 'function') {
      nodes = Array.from(listHost.querySelectorAll<HTMLElement>('.app-recycle-bin__row'));
    } else {
      const rawChildren = (listHost as unknown as { children?: unknown }).children;
      if (Array.isArray(rawChildren)) {
        nodes = rawChildren as HTMLElement[];
      } else if (rawChildren && typeof (rawChildren as { length: number }).length === 'number') {
        nodes = Array.from(rawChildren as ArrayLike<HTMLElement>);
      }
    }
    nodes.forEach((node) => {
      const dataset = (node as HTMLElement & { dataset?: Record<string, string> }).dataset;
      const id = dataset?.id ?? node.getAttribute?.('data-id') ?? null;
      if (!id) {
        return;
      }
      if (id === selectedId) {
        if (dataset) {
          dataset.selected = 'true';
        }
      } else if (dataset && Object.prototype.hasOwnProperty.call(dataset, 'selected')) {
        delete dataset.selected;
      }
    });
  }

  function setSelected(id: string | null) {
    selectedId = id;
    updateSelectionVisuals();
    updateActions(currentEntries);
  }

  function renderRows(entries: VfsRecycleBinEntry[]) {
    if (!listHost || !emptyState) {
      return;
    }

    listHost.innerHTML = '';

    if (typeof emptyState.toggleAttribute === 'function') {
      emptyState.toggleAttribute('hidden', entries.length > 0);
    } else if ('hidden' in emptyState) {
      (emptyState as { hidden?: boolean }).hidden = entries.length > 0;
    } else if (entries.length > 0) {
      emptyState.setAttribute?.('hidden', 'true');
    } else {
      emptyState.removeAttribute?.('hidden');
    }

    if (entries.length === 0) {
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'app-recycle-bin__row';
      row.dataset.id = entry.id;

      const name = document.createElement('span');
      name.className = 'app-recycle-bin__cell app-recycle-bin__cell--name';
      name.textContent = entry.name;
      row.appendChild(name);

      const location = document.createElement('span');
      location.className = 'app-recycle-bin__cell app-recycle-bin__cell--location';
      location.textContent = entry.originalPath;
      row.appendChild(location);

      const deleted = document.createElement('span');
      deleted.className = 'app-recycle-bin__cell app-recycle-bin__cell--deleted';
      deleted.textContent = formatDeletedAt(entry.deletedAt);
      row.appendChild(deleted);

      row.addEventListener('click', (event) => {
        event.preventDefault();
        setSelected(entry.id);
      });

      row.addEventListener('dblclick', () => {
        setSelected(entry.id);
        restoreSelected();
      });

      if (entry.id === selectedId) {
        row.dataset.selected = 'true';
      }
      listHost.appendChild(row);
    });
  }

  function restoreSelected() {
    if (!selectedId) {
      return;
    }
    try {
      vfs.recycleBin.restore(selectedId);
    } catch (error) {
      console.error('Failed to restore entry from recycle bin', error);
    }
    selectedId = null;
    refresh();
  }

  function emptyRecycleBin() {
    const entries = vfs.recycleBin.list();
    if (!entries.length) {
      return;
    }
    const confirmed = typeof window !== 'undefined' ? window.confirm?.('Empty the Recycle Bin?') ?? true : true;
    if (!confirmed) {
      return;
    }
    vfs.recycleBin.empty();
    selectedId = null;
    refresh();
  }

  function refresh() {
    currentEntries = getEntries();
    if (selectedId && !currentEntries.some((entry) => entry.id === selectedId)) {
      selectedId = null;
    }
    renderRows(currentEntries);
    updateSelectionVisuals();
    updateActions(currentEntries);
    updateStatus(currentEntries);
  }

  function mount(host: HTMLElement) {
    container = document.createElement('div');
    container.className = 'app-recycle-bin';

    const menuBar = document.createElement('div');
    menuBar.className = 'app-recycle-bin__menubar';
    ['File', 'Edit', 'View', 'Help'].forEach((label) => {
      const menuItem = document.createElement('button');
      menuItem.type = 'button';
      menuItem.className = 'app-recycle-bin__menu-item';
      menuItem.textContent = label;
      menuItem.addEventListener('click', () => {
        console.info(`Recycle Bin ${label} menu clicked`);
      });
      menuBar.appendChild(menuItem);
    });
    container.appendChild(menuBar);

    const toolbar = document.createElement('div');
    toolbar.className = 'app-recycle-bin__toolbar';
    container.appendChild(toolbar);

    restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'app-recycle-bin__button';
    restoreButton.textContent = 'Restore';
    restoreButton.disabled = true;
    restoreButton.addEventListener('click', () => restoreSelected());
    toolbar.appendChild(restoreButton);

    emptyButton = document.createElement('button');
    emptyButton.type = 'button';
    emptyButton.className = 'app-recycle-bin__button';
    emptyButton.textContent = 'Empty Recycle Bin';
    emptyButton.disabled = true;
    emptyButton.addEventListener('click', () => emptyRecycleBin());
    toolbar.appendChild(emptyButton);

    const header = document.createElement('div');
    header.className = 'app-recycle-bin__header';
    header.innerHTML = `
      <span class="app-recycle-bin__header-cell app-recycle-bin__cell--name">Name</span>
      <span class="app-recycle-bin__header-cell app-recycle-bin__cell--location">Original Location</span>
      <span class="app-recycle-bin__header-cell app-recycle-bin__cell--deleted">Deleted</span>
    `;
    container.appendChild(header);

    listHost = document.createElement('div');
    listHost.className = 'app-recycle-bin__list';
    listHost.tabIndex = 0;
    listHost.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        restoreSelected();
      }
    });
    container.appendChild(listHost);

    emptyState = document.createElement('div');
    emptyState.className = 'app-recycle-bin__empty';
    emptyState.textContent = 'No deleted items right now.';
    container.appendChild(emptyState);

    const statusBar = document.createElement('div');
    statusBar.className = 'app-recycle-bin__status';

    statusCount = document.createElement('span');
    statusCount.className = 'app-recycle-bin__status-count';
    statusBar.appendChild(statusCount);

    statusSize = document.createElement('span');
    statusSize.className = 'app-recycle-bin__status-size';
    statusBar.appendChild(statusSize);

    container.appendChild(statusBar);

    host.appendChild(container);

    teardown.push(
      vfs.bus.on('vfs:recycle-bin:changed', () => refresh()),
      vfs.bus.on('vfs:recycle-bin', () => refresh()),
    );

    refresh();
  }

  function destroy() {
    teardown.splice(0).forEach((fn) => fn());
    if (container) {
      container.remove();
    }
    container = null;
    listHost = null;
    emptyState = null;
    restoreButton = null;
    emptyButton = null;
    statusCount = null;
    statusSize = null;
    selectedId = null;
  }

  return {
    mount,
    destroy,
  };
}

export type { VfsRecycleBinEntry };
