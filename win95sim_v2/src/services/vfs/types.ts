import type { EventBus } from '@core/kernel/eventBus';

export type VfsNodeKind = 'file' | 'directory' | 'shortcut';

export interface VfsNodeBase {
  /** Normalized absolute path (e.g. `C:/Users`). */
  path: string;
  /** Friendly display name derived from the path. */
  name: string;
  kind: VfsNodeKind;
  /**
   * Size in bytes. For directories the size represents the cumulative size of
   * the immediate children so the UI can surface rough totals.
   */
  size: number;
  /** Unix epoch timestamp (ms) updated whenever the node mutates. */
  modified: number;
  /** Icon identifier used by Explorer; backed by `@services/vfs/utils/icons`. */
  icon?: string;
  /** Optional metadata bag for future extensions (icons, attributes, etc.). */
  metadata?: Record<string, unknown>;
}

export interface VfsDirectoryNode extends VfsNodeBase {
  kind: 'directory';
  /** Normalized absolute paths to the directory's children. */
  children: string[];
}

export interface VfsFileNode extends VfsNodeBase {
  kind: 'file';
  /** MIME type derived from the file extension. */
  mimeType: string;
  /** Encoded file contents. */
  content: Uint8Array;
  /** Optional decoded UTF-8 string for text-based files. */
  textContent?: string;
}

export interface VfsShortcutNode extends VfsNodeBase {
  kind: 'shortcut';
  /** Target path the shortcut resolves to. */
  target: string;
}

export type VfsNode = VfsDirectoryNode | VfsFileNode | VfsShortcutNode;

export type VfsWatchEventType = 'created' | 'updated' | 'deleted' | 'moved' | 'restored';

export interface VfsWatchEvent {
  type: VfsWatchEventType;
  node: VfsNode;
  /** Previous normalized path when type is `moved` or `restored`. */
  previousPath?: string;
}

export interface VfsSearchOptions {
  /**
   * When enabled the search routine will scan text content in addition to file
   * and folder names.
   */
  includeContent?: boolean;
  /** Case sensitivity flag. Defaults to `false` to match Windows Explorer. */
  caseSensitive?: boolean;
  /** Optional path constraint restricting the search scope. */
  within?: string;
}

export interface VfsRecycleBinEntry {
  id: string;
  name: string;
  originalPath: string;
  kind: VfsNodeKind;
  size: number;
  deletedAt: number;
}

export interface VfsRecycleBin {
  list(): VfsRecycleBinEntry[];
  restore(id: string): VfsNode[];
  empty(): void;
}

export interface CreateVfsServiceOptions {
  /** Optional seed tree used by tests/fixtures. */
  seed?: Array<{ path: string; kind: VfsNodeKind; content?: string | Uint8Array; target?: string }>;
  /** Optional file association seed table applied during bootstrap. */
  associations?: VfsFileAssociationSeed[];
}

export interface VfsFileAssociationSeed {
  extension: string;
  appId: string;
  command?: string;
}

export interface VfsFileAssociation {
  extension: string;
  appId: string;
  command?: string;
}

export interface VfsService {
  list(path: string): Promise<VfsNode[]>;
  read(path: string): Promise<VfsNode>;
  writeFile(path: string, contents: string | Uint8Array, metadata?: Record<string, unknown>): Promise<VfsNode>;
  makeDirectory(path: string, metadata?: Record<string, unknown>): Promise<VfsNode>;
  createShortcut(path: string, target: string, metadata?: Record<string, unknown>): Promise<VfsNode>;
  move(source: string, destination: string): Promise<VfsNode>;
  remove(path: string): Promise<void>;
  watch(path: string, handler: (event: VfsWatchEvent) => void): () => void;
  search(query: string, options?: VfsSearchOptions): Promise<VfsNode[]>;
  resolveShortcut(path: string): Promise<VfsNode>;
  recycleBin: VfsRecycleBin;
  registerFileAssociation(extension: string, association: Omit<VfsFileAssociation, 'extension'>): VfsFileAssociation;
  unregisterFileAssociation(extension: string): void;
  getFileAssociation(path: string): VfsFileAssociation | undefined;
  listFileAssociations(): VfsFileAssociation[];
  bus: EventBus;
}
