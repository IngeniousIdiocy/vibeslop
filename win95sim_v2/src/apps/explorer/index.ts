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
    if (!breadcrumbs) {
      return;
    }

    breadcrumbs.innerHTML = '';
    const segments = path.split('/');
    let accumulator = segments.shift() ?? '';
    const drive = accumulator;
    const driveButton = document.createElement('button');
    driveButton.textContent = drive;
    driveButton.addEventListener('click', () => {
      void setPath(`${drive}/`);
    });
    breadcrumbs.appendChild(driveButton);

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
      breadcrumbs.appendChild(crumb);
    });
  }

  function renderListItem(entry: VfsNode): HTMLElement {
    const item = document.createElement('div');
    item.className = 'win95-explorer__details-item';
    item.dataset.path = entry.path;
    item.dataset.kind = entry.kind;
    item.textContent = entry.name;
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
