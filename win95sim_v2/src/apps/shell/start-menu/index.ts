import manifestData from './data/manifest.json';
import { MenuSchema, MenuSchemaItem } from '@ui/menus';
import { RecentDocumentEntry, RecentDocumentsService } from '@services/recent-documents';

export type StartMenuItemType = 'folder' | 'command';

export interface StartMenuManifestItem {
  id: string;
  label: string;
  type?: StartMenuItemType;
  command?: string;
  items?: StartMenuManifestItem[];
  icon?: string;
}

export interface StartMenuManifestSection {
  id: string;
  label: string;
  items: StartMenuManifestItem[];
  icon?: string;
}

export interface StartMenuManifest {
  sections: StartMenuManifestSection[];
}

export interface StartMenuOptions {
  manifest?: StartMenuManifest;
  recentDocuments: RecentDocumentsService;
}

export interface StartMenuSection extends StartMenuManifestSection {}

export interface StartMenuSearchResult {
  id: string;
  label: string;
  path: string[];
  command?: string;
}

export interface StartMenuModel {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  getSections(): StartMenuSection[];
  getRecentDocuments(): RecentDocumentEntry[];
  getMenuSchema(sectionId: string): MenuSchema;
  search(query: string): StartMenuSearchResult[];
}

function cloneManifest(manifest: StartMenuManifest): StartMenuManifest {
  return {
    sections: manifest.sections.map((section) => ({
      ...section,
      icon: section.icon,
      items: section.items.map(cloneItem),
    })),
  };
}

function cloneItem(item: StartMenuManifestItem): StartMenuManifestItem {
  return {
    ...item,
    icon: item.icon,
    items: item.items?.map(cloneItem),
  };
}

function toMenuSchema(section: StartMenuManifestSection): MenuSchema {
  return {
    id: `start-menu:${section.id}`,
    items: section.items.map(toMenuItem),
  };
}

function toMenuItem(item: StartMenuManifestItem): MenuSchemaItem {
  return {
    id: item.id,
    type: item.items?.length ? 'submenu' : 'command',
    label: item.label,
    command: item.command,
    children: item.items?.map(toMenuItem),
  };
}

function walkItems(section: StartMenuManifestSection, path: string[], results: StartMenuSearchResult[]) {
  for (const item of section.items) {
    const nextPath = [...path, item.label];
    const type = item.type ?? (item.items?.length ? 'folder' : 'command');
    if (type === 'command') {
      results.push({
        id: item.id,
        label: item.label,
        path: nextPath,
        command: item.command,
      });
    }
    if (item.items) {
      walkItems({ id: section.id, label: section.label, items: item.items }, nextPath, results);
    }
  }
}

export function createStartMenuModel(options: StartMenuOptions): StartMenuModel {
  const manifest = cloneManifest(options.manifest ?? (manifestData as StartMenuManifest));
  let open = false;

  return {
    open() {
      open = true;
    },
    close() {
      open = false;
    },
    toggle() {
      open = !open;
    },
    isOpen() {
      return open;
    },
    getSections() {
      return manifest.sections.map((section) => ({ ...section, items: section.items.map(cloneItem) }));
    },
    getRecentDocuments() {
      return options.recentDocuments.list();
    },
    getMenuSchema(sectionId) {
      const section = manifest.sections.find((entry) => entry.id === sectionId);
      if (!section) {
        throw new Error(`Unknown start menu section ${sectionId}`);
      }
      return toMenuSchema(section);
    },
    search(query) {
      if (!query.trim()) {
        return [];
      }
      const lower = query.toLowerCase();
      const results: StartMenuSearchResult[] = [];
      manifest.sections.forEach((section) => {
        walkItems(section, [section.label], results);
      });
      return results.filter((result) => result.label.toLowerCase().includes(lower));
    },
  };
}
