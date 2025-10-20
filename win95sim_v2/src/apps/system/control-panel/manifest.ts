import manifest from './control-panel.manifest.json';

export interface ControlPanelManifestEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  keywords: string[];
  module: string;
}

export interface ControlPanelManifest {
  applets: ControlPanelManifestEntry[];
}

function normalizeManifest(data: ControlPanelManifest): ControlPanelManifestEntry[] {
  const seen = new Set<string>();
  return data.applets.map((entry) => {
    const id = entry.id.trim();
    if (!id) {
      throw new Error('Control Panel applet id cannot be empty');
    }
    if (seen.has(id)) {
      throw new Error(`Duplicate Control Panel applet id detected: ${id}`);
    }
    seen.add(id);
    return {
      ...entry,
      id,
      title: entry.title.trim(),
      description: entry.description.trim(),
      category: entry.category.trim(),
      keywords: entry.keywords.map((keyword) => keyword.trim()).filter(Boolean),
    };
  });
}

const CONTROL_PANEL_MANIFEST: ControlPanelManifestEntry[] = normalizeManifest(manifest as ControlPanelManifest);

export function getControlPanelManifest(): ControlPanelManifestEntry[] {
  return CONTROL_PANEL_MANIFEST.map((entry) => ({ ...entry, keywords: [...entry.keywords] }));
}
