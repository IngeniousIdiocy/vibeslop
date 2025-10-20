import { createEventBus, EventBus } from '@core/kernel/eventBus';
import { createRecycleBin } from './recycle-bin';
import { basename, comparePathDepth, dirname, isDescendant, isRoot, normalizePath, toDisplayName } from './utils/path';
import { lookupMime } from './utils/mime';
import { lookupIcon } from './utils/icons';
import type {
  CreateVfsServiceOptions,
  VfsDirectoryNode,
  VfsFileNode,
  VfsNode,
  VfsRecycleBin,
  VfsSearchOptions,
  VfsService,
  VfsShortcutNode,
  VfsWatchEvent,
  VfsWatchEventType,
} from './types';

interface InternalDirectoryNode extends VfsDirectoryNode {
  kind: 'directory';
  icon: string;
}

interface InternalFileNode extends VfsFileNode {
  kind: 'file';
  icon: string;
  encoding: 'binary' | 'text';
}

interface InternalShortcutNode extends VfsShortcutNode {
  kind: 'shortcut';
  icon: string;
}

type InternalNode = InternalDirectoryNode | InternalFileNode | InternalShortcutNode;

type Watcher = (event: VfsWatchEvent) => void;

interface WatchBucket {
  path: string;
  handlers: Set<Watcher>;
}

const DEFAULT_DRIVES = ['C:/'];

function now(): number {
  return Date.now();
}

function toPublic(node: InternalNode, includeContent = false): VfsNode {
  if (node.kind === 'directory') {
    return {
      ...node,
      children: [...node.children],
    };
  }

  if (node.kind === 'file') {
    return {
      ...node,
      content: includeContent ? new Uint8Array(node.content) : new Uint8Array(0),
      textContent: includeContent ? node.textContent : undefined,
    };
  }

  return { ...node };
}

function ensureText(value: string | Uint8Array): { content: Uint8Array; text?: string; encoding: 'binary' | 'text' } {
  if (typeof value === 'string') {
    const encoder = new TextEncoder();
    return { content: encoder.encode(value), text: value, encoding: 'text' };
  }

  return { content: new Uint8Array(value), encoding: 'binary' };
}

function createDirectoryNode(path: string, metadata?: Record<string, unknown>): InternalDirectoryNode {
  const normalized = normalizePath(path);
  return {
    path: normalized,
    name: toDisplayName(normalized),
    kind: 'directory',
    size: 0,
    modified: now(),
    children: [],
    icon: lookupIcon('directory'),
    metadata,
  };
}

function createFileNode(path: string, payload: { content: Uint8Array; text?: string; encoding: 'binary' | 'text'; metadata?: Record<string, unknown> }): InternalFileNode {
  const normalized = normalizePath(path);
  const { mime, icon } = lookupMime(normalized);
  return {
    path: normalized,
    name: basename(normalized),
    kind: 'file',
    size: payload.content.byteLength,
    modified: now(),
    mimeType: mime,
    icon: lookupIcon(icon),
    content: payload.content,
    textContent: payload.encoding === 'text' ? payload.text : undefined,
    encoding: payload.encoding,
    metadata: payload.metadata,
  };
}

function createShortcutNode(path: string, target: string, metadata?: Record<string, unknown>): InternalShortcutNode {
  const normalized = normalizePath(path);
  return {
    path: normalized,
    name: basename(normalized),
    kind: 'shortcut',
    size: 0,
    modified: now(),
    target: normalizePath(target),
    icon: lookupIcon('shortcut'),
    metadata,
  };
}

interface SerializedNode {
  node: InternalNode;
  children: SerializedNode[];
}

function serializeTree(node: InternalNode, getChildren: (path: string) => InternalNode[]): SerializedNode {
  return {
    node: toInternalClone(node),
    children: node.kind === 'directory' ? getChildren(node.path).map((child) => serializeTree(child, getChildren)) : [],
  };
}

function toInternalClone(node: InternalNode): InternalNode {
  if (node.kind === 'directory') {
    return {
      ...node,
      children: [...node.children],
    };
  }

  if (node.kind === 'file') {
    return {
      ...node,
      content: new Uint8Array(node.content),
      textContent: node.textContent,
    };
  }

  return { ...node };
}

function flattenSerialized(node: SerializedNode): InternalNode[] {
  const result: InternalNode[] = [toInternalClone(node.node)];
  node.children.forEach((child) => {
    result.push(...flattenSerialized(child));
  });
  return result;
}

export function createVfsService(options: CreateVfsServiceOptions = {}): VfsService {
  const bus: EventBus = createEventBus();
  const nodes = new Map<string, InternalNode>();
  const watchers: WatchBucket[] = [];
  const { bin: recycleBin, capture, restore } = createRecycleBin();

  function emit(type: VfsWatchEventType, node: InternalNode, previousPath?: string) {
    const event: VfsWatchEvent = { type, node: toPublic(node, true), previousPath };
    watchers.forEach((bucket) => {
      if (isDescendant(bucket.path, node.path)) {
        bucket.handlers.forEach((handler) => handler(event));
        return;
      }

      if (previousPath && isDescendant(bucket.path, previousPath)) {
        bucket.handlers.forEach((handler) => handler(event));
      }
    });
    bus.emit(`vfs:${type}`, event);
  }

  function ensureDirectoryExists(path: string) {
    const normalized = normalizePath(path);
    if (nodes.has(normalized)) {
      const entry = nodes.get(normalized)!;
      if (entry.kind !== 'directory') {
        throw new Error(`Path ${normalized} is not a directory`);
      }
      return entry;
    }

    if (isRoot(normalized)) {
      const created = createDirectoryNode(normalized);
      nodes.set(normalized, created);
      return created;
    }

    const parent = ensureDirectoryExists(dirname(normalized));
    const directory = createDirectoryNode(normalized);
    parent.children.push(directory.path);
    nodes.set(normalized, directory);
    emit('created', directory);
    return directory;
  }

  function addNode(node: InternalNode) {
    const normalized = normalizePath(node.path);
    const parentPath = dirname(normalized);
    const parent = ensureDirectoryExists(parentPath);
    if (!parent.children.includes(normalized)) {
      parent.children.push(normalized);
      parent.modified = now();
    }
    nodes.set(normalized, node);
  }

  function removeNode(path: string) {
    const normalized = normalizePath(path);
    const node = nodes.get(normalized);
    if (!node) {
      throw new Error(`Unknown path ${normalized}`);
    }

    if (node.kind === 'directory') {
      [...node.children].forEach((child) => removeNode(child));
    }

    nodes.delete(normalized);
    if (!isRoot(normalized)) {
      const parent = nodes.get(dirname(normalized));
      if (parent && parent.kind === 'directory') {
        parent.children = parent.children.filter((entry) => entry !== normalized);
      }
    }
    return node;
  }

  function hydrateTree(tree: SerializedNode) {
    const flat = flattenSerialized(tree).sort((a, b) => comparePathDepth(a.path, b.path));
    flat.forEach((node) => {
      if (node.kind === 'directory') {
        node.children = [...node.children];
      }
      addNode(node);
    });
  }

  function list(path: string): Promise<VfsNode[]> {
    const normalized = normalizePath(path);
    const node = nodes.get(normalized);
    if (!node) {
      throw new Error(`Unknown path ${normalized}`);
    }

    if (node.kind !== 'directory') {
      throw new Error(`Path ${normalized} is not a directory`);
    }

    const entries = node.children
      .map((child) => toPublic(nodes.get(child)!, false))
      .sort((a, b) => a.name.localeCompare(b.name));
    return Promise.resolve(entries);
  }

  async function read(path: string): Promise<VfsNode> {
    const normalized = normalizePath(path);
    const node = nodes.get(normalized);
    if (!node) {
      throw new Error(`Unknown path ${normalized}`);
    }

    return toPublic(node, true);
  }

  async function writeFile(path: string, contents: string | Uint8Array, metadata?: Record<string, unknown>): Promise<VfsNode> {
    const normalized = normalizePath(path);
    const parent = ensureDirectoryExists(dirname(normalized));
    const payload = ensureText(contents);
    let node = nodes.get(normalized);
    const existed = Boolean(node);

    if (node && node.kind !== 'file') {
      throw new Error(`Cannot write file over ${node.kind}`);
    }

    node = createFileNode(normalized, { ...payload, metadata });
    addNode(node);
    parent.modified = now();
    emit(existed ? 'updated' : 'created', node);
    return toPublic(node, true);
  }

  async function makeDirectory(path: string, metadata?: Record<string, unknown>): Promise<VfsNode> {
    const normalized = normalizePath(path);
    if (nodes.has(normalized)) {
      const existing = nodes.get(normalized)!;
      if (existing.kind !== 'directory') {
        throw new Error(`Cannot convert ${normalized} to directory`);
      }
      return toPublic(existing, false);
    }

    const parent = ensureDirectoryExists(dirname(normalized));
    const directory = createDirectoryNode(normalized, metadata);
    addNode(directory);
    parent.modified = now();
    emit('created', directory);
    return toPublic(directory, false);
  }

  async function createShortcut(path: string, target: string, metadata?: Record<string, unknown>): Promise<VfsNode> {
    const normalized = normalizePath(path);
    const shortcut = createShortcutNode(normalized, target, metadata);
    addNode(shortcut);
    emit('created', shortcut);
    return toPublic(shortcut, false);
  }

  async function move(source: string, destination: string): Promise<VfsNode> {
    const from = normalizePath(source);
    const to = normalizePath(destination);
    const node = nodes.get(from);
    if (!node) {
      throw new Error(`Unknown path ${from}`);
    }

    if (nodes.has(to)) {
      throw new Error(`Destination already exists: ${to}`);
    }

    const oldParent = nodes.get(dirname(from));
    if (oldParent && oldParent.kind === 'directory') {
      oldParent.children = oldParent.children.filter((entry) => entry !== from);
      oldParent.modified = now();
    }

    const newParent = ensureDirectoryExists(dirname(to));
    if (!newParent.children.includes(to)) {
      newParent.children.push(to);
    }
    newParent.modified = now();

    const pathMap = new Map<string, string>();
    pathMap.set(from, to);

    if (node.kind === 'directory') {
      const prefixFrom = from.endsWith('/') ? from : `${from}/`;
      const prefixTo = to.endsWith('/') ? to : `${to}/`;
      const updates: Array<{ oldPath: string; newPath: string; node: InternalNode }> = [];

      nodes.forEach((entry, key) => {
        if (key === from) {
          return;
        }
        if (!key.startsWith(prefixFrom)) {
          return;
        }
        const suffix = key.slice(prefixFrom.length);
        const nextPath = normalizePath(`${prefixTo}${suffix}`);
        pathMap.set(key, nextPath);
        updates.push({ oldPath: key, newPath: nextPath, node: entry });
      });

      nodes.delete(from);
      node.path = to;
      node.name = basename(to);
      node.modified = now();
      node.children = node.children.map((childPath) => pathMap.get(childPath) ?? childPath);
      nodes.set(to, node);

      updates.forEach(({ oldPath, newPath, node: entry }) => {
        nodes.delete(oldPath);
        entry.path = newPath;
        entry.name = basename(newPath);
        entry.modified = now();
        if (entry.kind === 'directory') {
          entry.children = entry.children.map((childPath) => pathMap.get(childPath) ?? childPath);
        }
        nodes.set(newPath, entry);
      });
    } else {
      nodes.delete(from);
      node.path = to;
      node.name = basename(to);
      node.modified = now();
      nodes.set(to, node);
    }

    emit('moved', node, from);
    return toPublic(node, true);
  }

  async function remove(path: string): Promise<void> {
    const normalized = normalizePath(path);
    const node = nodes.get(normalized);
    if (!node) {
      throw new Error(`Unknown path ${normalized}`);
    }

    const serialized = serializeTree(node, (candidate) => {
      const entry = nodes.get(candidate);
      if (!entry || entry.kind !== 'directory') {
        return [];
      }
      return entry.children.map((child) => nodes.get(child)!).filter(Boolean);
    });

    const entry = capture({ tree: serialized, originalPath: normalized });
    removeNode(normalized);
    emit('deleted', node);
    bus.emit('vfs:recycle-bin', entry);
  }

  function watchPath(path: string, handler: (event: VfsWatchEvent) => void): () => void {
    const normalized = normalizePath(path);
    let bucket = watchers.find((entry) => entry.path === normalized);
    if (!bucket) {
      bucket = { path: normalized, handlers: new Set() };
      watchers.push(bucket);
    }
    bucket.handlers.add(handler);
    return () => {
      bucket!.handlers.delete(handler);
      if (bucket!.handlers.size === 0) {
        const index = watchers.indexOf(bucket!);
        if (index >= 0) {
          watchers.splice(index, 1);
        }
      }
    };
  }

  async function search(query: string, options: VfsSearchOptions = {}): Promise<VfsNode[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    const within = options.within ? normalizePath(options.within) : undefined;
    const comparator = options.caseSensitive ? (value: string) => value : (value: string) => value.toLowerCase();
    const target = comparator(trimmed);

    const results: VfsNode[] = [];
    nodes.forEach((node) => {
      if (node.kind === 'directory') {
        return;
      }

      if (within && !isDescendant(within, node.path)) {
        return;
      }

      const name = comparator(node.name);
      if (name.includes(target)) {
        results.push(toPublic(node, false));
        return;
      }

      if (options.includeContent && node.kind === 'file' && node.encoding === 'text' && node.textContent) {
        const content = comparator(node.textContent);
        if (content.includes(target)) {
          results.push(toPublic(node, false));
        }
      }
    });

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function resolveShortcut(path: string): Promise<VfsNode> {
    const normalized = normalizePath(path);
    const node = nodes.get(normalized);
    if (!node || node.kind !== 'shortcut') {
      throw new Error(`Shortcut not found: ${normalized}`);
    }

    return read(node.target);
  }

  function restoreFromRecycleBin(id: string): VfsNode[] {
    const tree = restore(id);
    if (!tree) {
      throw new Error(`Recycle Bin entry ${id} not found`);
    }

    const flattened = flattenSerialized(tree).map((entry) => entry.path);
    hydrateTree(tree);
    return flattened.map((path) => {
      const entry = nodes.get(path)!;
      emit('restored', entry);
      return toPublic(entry, true);
    });
  }

  function bootstrap() {
    DEFAULT_DRIVES.forEach((drive) => {
      const normalized = normalizePath(drive);
      if (!nodes.has(normalized)) {
        nodes.set(normalized, createDirectoryNode(normalized));
      }
    });

    options.seed?.forEach((seed) => {
      if (seed.kind === 'directory') {
        void makeDirectory(seed.path, undefined);
      } else if (seed.kind === 'file') {
        void writeFile(seed.path, seed.content ?? '', undefined);
      } else if (seed.kind === 'shortcut' && seed.target) {
        void createShortcut(seed.path, seed.target, undefined);
      }
    });
  }

  bootstrap();

  const recycleBinFacade: VfsRecycleBin = {
    list: () => recycleBin.list(),
    empty: () => recycleBin.empty(),
    restore: (id: string) => restoreFromRecycleBin(id),
  };

  const service: VfsService = {
    list,
    read,
    writeFile,
    makeDirectory,
    createShortcut,
    move,
    remove,
    watch(path, handler) {
      return watchPath(path, handler);
    },
    search,
    resolveShortcut,
    recycleBin: recycleBinFacade,
    bus,
  };

  return service;
}

export type { VfsService, VfsNode, VfsRecycleBin, VfsWatchEvent } from './types';
