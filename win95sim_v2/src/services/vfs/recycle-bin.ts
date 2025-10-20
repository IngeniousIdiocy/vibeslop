import { normalizePath } from './utils/path';
import type { VfsNode, VfsRecycleBin, VfsRecycleBinEntry } from './types';

interface SerializedNode {
  node: VfsNode;
  children: SerializedNode[];
}

interface StoredEntry {
  id: string;
  originalPath: string;
  deletedAt: number;
  tree: SerializedNode;
}

let counter = 0;

function cloneNode(node: VfsNode): VfsNode {
  if (node.kind === 'file') {
    return {
      ...node,
      content: new Uint8Array(node.content),
      textContent: node.textContent,
    };
  }

  if (node.kind === 'directory') {
    return {
      ...node,
      children: [...node.children],
    };
  }

  return { ...node };
}

function cloneTree(tree: SerializedNode): SerializedNode {
  return {
    node: cloneNode(tree.node),
    children: tree.children.map((child) => cloneTree(child)),
  };
}

export interface RecycleBinCapture {
  tree: SerializedNode;
  originalPath: string;
}

export function createRecycleBin(): {
  bin: VfsRecycleBin;
  capture(entry: RecycleBinCapture): VfsRecycleBinEntry;
  restore(id: string): SerializedNode | undefined;
} {
  const entries: StoredEntry[] = [];

  function list(): VfsRecycleBinEntry[] {
    return entries.map((entry) => ({
      id: entry.id,
      originalPath: entry.originalPath,
      name: entry.tree.node.name,
      kind: entry.tree.node.kind,
      size: entry.tree.node.size,
      deletedAt: entry.deletedAt,
    }));
  }

  function empty(): void {
    entries.splice(0, entries.length);
  }

  function restore(id: string): SerializedNode | undefined {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return undefined;
    }

    const [entry] = entries.splice(index, 1);
    return cloneTree(entry.tree);
  }

  function capture(entry: RecycleBinCapture): VfsRecycleBinEntry {
    const id = `rb-${Date.now()}-${counter++}`;
    const stored: StoredEntry = {
      id,
      originalPath: normalizePath(entry.originalPath),
      deletedAt: Date.now(),
      tree: cloneTree(entry.tree),
    };
    entries.push(stored);
    return {
      id,
      originalPath: stored.originalPath,
      name: stored.tree.node.name,
      kind: stored.tree.node.kind,
      size: stored.tree.node.size,
      deletedAt: stored.deletedAt,
    };
  }

  return {
    bin: {
      list,
      empty,
      restore(id) {
        const restored = restore(id);
        if (!restored) {
          throw new Error(`Recycle Bin entry ${id} not found`);
        }
        const collected: VfsNode[] = [];

        function flatten(node: SerializedNode) {
          collected.push(cloneNode(node.node));
          node.children.forEach(flatten);
        }

        flatten(restored);
        return collected;
      },
    },
    capture,
    restore,
  };
}
