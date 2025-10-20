import type { ControlPanelApplet, ControlPanelContext, SoundsAppletSession } from '../../types';
import type { ControlPanelManifestEntry } from '../../manifest';

const ENABLED_KEY = 'audio.enabled';
const SCHEME_KEY = 'audio.scheme';
const DEFAULT_SCHEME = 'Windows Default';

export function createApplet(
  context: ControlPanelContext,
  manifest: ControlPanelManifestEntry,
): ControlPanelApplet<SoundsAppletSession> {
  const { settings } = context;

  return {
    id: `control-panel/${manifest.id}`,
    title: manifest.title,
    description: manifest.description,
    category: manifest.category,
    keywords: [...manifest.keywords],
    manifest,
    open(): SoundsAppletSession {
      const initialEnabled = Boolean(settings.get(ENABLED_KEY, true));
      const initialScheme = String(settings.get(SCHEME_KEY, DEFAULT_SCHEME) ?? DEFAULT_SCHEME);
      let enabled = initialEnabled;
      let scheme = initialScheme;

      return {
        tabs: ['Sounds', 'Schemes'],
        isEnabled() {
          return enabled;
        },
        setEnabled(next: boolean) {
          enabled = !!next;
        },
        getScheme() {
          return scheme;
        },
        setScheme(next: string) {
          scheme = next.trim() || DEFAULT_SCHEME;
        },
        preview(event: string) {
          if (!enabled) {
            return null;
          }
          return `${scheme}:${event}`;
        },
        apply() {
          settings.set(ENABLED_KEY, enabled);
          settings.set(SCHEME_KEY, scheme);
        },
        reset() {
          enabled = Boolean(settings.get(ENABLED_KEY, initialEnabled));
          scheme = String(settings.get(SCHEME_KEY, initialScheme) ?? initialScheme);
        },
        dispose() {
          enabled = initialEnabled;
          scheme = initialScheme;
        },
      };
    },
  };
}
