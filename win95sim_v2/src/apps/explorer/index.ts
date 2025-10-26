import type { VfsNode, VfsService, VfsWatchEvent } from '@services/vfs';

interface ExplorerTreeNode {
  path: string;
  name: string;
  children: ExplorerTreeNode[];
}

export interface ExplorerOptions {
  vfs: VfsService;
  startPath?: string;
}

export interface ExplorerInstance {
  mount(host: HTMLElement): void;
  destroy(): void;
  setPath(path: string): Promise<void>;
  getCurrentPath(): string;
}

export function createExplorerApp(options: ExplorerOptions): ExplorerInstance {
  const vfs = options.vfs;
  let currentPath = options.startPath ?? 'C:/';
  let container: HTMLElement | null = null;
  let treePane: HTMLElement | null = null;
  let detailsPane: HTMLElement | null = null;
  let breadcrumbs: HTMLElement | null = null;
  let detailWatcher: (() => void) | null = null;
  const teardown: Array<() => void> = [];
  let treeRenderToken = 0;
  const selectedPaths = new Set<string>();

  function normalize(path: string): string {
    return path.replace(/\\/g, '/');
  }

  function clearHost() {
    if (!container) {
      return;
    }
    container.innerHTML = '';
    treePane = null;
    detailsPane = null;
    breadcrumbs = null;
  }

  function focusDetailsPane() {
    detailsPane?.focus({ preventScroll: true });
  }

  function updateSelectionStyles() {
    if (!detailsPane) {
      return;
    }
    let nodes: HTMLElement[] = [];
    if (typeof detailsPane.querySelectorAll === 'function') {
      nodes = Array.from(detailsPane.querySelectorAll<HTMLElement>('.win95-explorer__details-item'));
    } else {
      const rawChildren = (detailsPane as unknown as { children?: unknown }).children;
      if (Array.isArray(rawChildren)) {
        nodes = rawChildren as HTMLElement[];
      } else if (rawChildren && typeof (rawChildren as { length: number }).length === 'number') {
        nodes = Array.from(rawChildren as ArrayLike<HTMLElement>);
      }
    }
    nodes.forEach((node) => {
      const dataset = (node as HTMLElement & { dataset?: Record<string, string> }).dataset;
      const path = dataset?.path ?? '';
      if (!path) {
        return;
      }
      if (selectedPaths.has(path)) {
        if (dataset) {
          dataset.selected = 'true';
        }
      } else if (dataset && Object.prototype.hasOwnProperty.call(dataset, 'selected')) {
        delete dataset.selected;
      }
    });
  }

  function clearSelection() {
    selectedPaths.clear();
    updateSelectionStyles();
  }

  function selectEntry(path: string, options: { additive?: boolean } = {}) {
    const additive = options.additive ?? false;
    if (!additive) {
      selectedPaths.clear();
    }
    if (additive && selectedPaths.has(path)) {
      selectedPaths.delete(path);
    } else {
      selectedPaths.add(path);
    }
    updateSelectionStyles();
    focusDetailsPane();
  }

  function deleteSelection() {
    if (selectedPaths.size === 0) {
      return;
    }
    const targets = Array.from(selectedPaths);
    clearSelection();
    void (async () => {
      for (const target of targets) {
        try {
          await vfs.remove(target);
        } catch (error) {
          console.error('Failed to delete', target, error);
        }
      }
    })();
  }

  async function buildTree(path: string, depth = 0): Promise<ExplorerTreeNode> {
    const node = await vfs.read(path);
    const entry: ExplorerTreeNode = {
      path: node.path,
      name: node.name,
      children: [],
    };

    if (depth > 2) {
      return entry;
    }

    const entries = await vfs.list(path);
    const directories = entries
      .filter((item) => item.kind === 'directory')
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const directory of directories) {
      entry.children.push(await buildTree(directory.path, depth + 1));
    }

    return entry;
  }

  function renderTreeNode(node: ExplorerTreeNode, host: HTMLElement) {
    const item = document.createElement('div');
    item.className = 'win95-explorer__tree-item';
    item.dataset.path = node.path;
    item.textContent = node.name;
    if (normalize(node.path) === normalize(currentPath)) {
      item.className += ' win95-explorer__tree-item--selected';
    }
    item.addEventListener('click', () => {
      void setPath(node.path);
    });
    host.appendChild(item);

    if (node.children.length > 0) {
      const childContainer = document.createElement('div');
      childContainer.className = 'win95-explorer__tree-children';
      host.appendChild(childContainer);
      node.children.forEach((child) => renderTreeNode(child, childContainer));
    }
  }

  async function renderTree() {
    if (!treePane) {
      return;
    }

    const token = ++treeRenderToken;
    const tree = await buildTree('C:/');
    if (!treePane || token !== treeRenderToken) {
      return;
    }
    treePane.innerHTML = '';
    renderTreeNode(tree, treePane);
  }

  function renderBreadcrumbs(path: string) {
    const host = breadcrumbs;
    if (!host) {
      return;
    }

    host.innerHTML = '';
    const segments = path.split('/');
    let accumulator = segments.shift() ?? '';
    const drive = accumulator;
    const driveButton = document.createElement('button');
    driveButton.textContent = drive;
    driveButton.addEventListener('click', () => {
      void setPath(`${drive}/`);
    });
    host.appendChild(driveButton);

    segments.forEach((segment) => {
      if (!segment) {
        return;
      }
      accumulator = `${accumulator}/${segment}`;
      const crumb = document.createElement('button');
      crumb.textContent = segment;
      crumb.addEventListener('click', () => {
        void setPath(accumulator);
      });
      host.appendChild(crumb);
    });
  }

  function renderListItem(entry: VfsNode): HTMLElement {
    const item = document.createElement('div');
    item.className = 'win95-explorer__details-item';
    item.dataset.path = entry.path;
    item.dataset.kind = entry.kind;
    item.textContent = entry.name;
    if (selectedPaths.has(entry.path)) {
      item.dataset.selected = 'true';
    }
    item.addEventListener('click', (event) => {
      event.preventDefault();
      const additive = event.ctrlKey || event.metaKey;
      selectEntry(entry.path, { additive });
    });
    if (entry.kind === 'directory') {
      item.addEventListener('dblclick', () => {
        void setPath(entry.path);
      });
    }
    return item;
  }

  async function renderDetails() {
    if (!detailsPane) {
      return;
    }

    const entries = await vfs.list(currentPath);
    detailsPane.innerHTML = '';
    entries
      .sort((a, b) => {
        if (a.kind === b.kind) {
          return a.name.localeCompare(b.name);
        }
        if (a.kind === 'directory') {
          return -1;
        }
        if (b.kind === 'directory') {
          return 1;
        }
        return a.name.localeCompare(b.name);
      })
      .forEach((entry) => {
        detailsPane!.appendChild(renderListItem(entry));
      });
    updateSelectionStyles();
  }

  function bindDetailWatcher() {
    if (detailWatcher) {
      detailWatcher();
      detailWatcher = null;
    }
    detailWatcher = vfs.watch(currentPath, (_event: VfsWatchEvent) => {
      void renderDetails();
    });
  }

  async function setPath(path: string): Promise<void> {
    currentPath = normalize(path);
    if (container) {
      container.dataset.path = currentPath;
    }
    clearSelection();
    bindDetailWatcher();
    renderBreadcrumbs(currentPath);
    await renderDetails();
    await renderTree();
  }

  function mount(host: HTMLElement) {
    clearHost();
    container = document.createElement('div');
    container.className = 'win95-explorer';
    container.dataset.path = currentPath;

    const layout = document.createElement('div');
    layout.className = 'win95-explorer__layout';

    treePane = document.createElement('div');
    treePane.className = 'win95-explorer__tree';
    layout.appendChild(treePane);

    const content = document.createElement('div');
    content.className = 'win95-explorer__content';

    const breadcrumbBar = document.createElement('div');
    breadcrumbBar.className = 'win95-explorer__breadcrumbs';
    content.appendChild(breadcrumbBar);
    breadcrumbs = breadcrumbBar;

    detailsPane = document.createElement('div');
    detailsPane.className = 'win95-explorer__details';
    detailsPane.tabIndex = 0;
    detailsPane.addEventListener('keydown', (event) => {
      if (event.key === 'Delete') {
        event.preventDefault();
        deleteSelection();
      }
    });
    detailsPane.addEventListener('click', (event) => {
      if (event.target === detailsPane) {
        clearSelection();
      }
    });
    content.appendChild(detailsPane);

    layout.appendChild(content);
    container.appendChild(layout);
    host.appendChild(container);

    teardown.push(
      vfs.watch('C:/', () => {
        void renderTree();
      }),
    );

    bindDetailWatcher();
    renderBreadcrumbs(currentPath);
    void renderTree();
    void renderDetails();
  }

  function destroy() {
    if (detailWatcher) {
      detailWatcher();
      detailWatcher = null;
    }

    teardown.splice(0).forEach((fn) => fn());
    selectedPaths.clear();
    if (container) {
      container.remove();
    }
    container = null;
    treePane = null;
    detailsPane = null;
  }

  return {
    mount,
    destroy,
    setPath,
    getCurrentPath() {
      return currentPath;
    },
  };
}
