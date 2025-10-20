import type { ControlPanelApplet, ControlPanelContext, DateTimeAppletSession } from '../../types';
import type { ControlPanelManifestEntry } from '../../manifest';

const OFFSET_KEY = 'time.offsetMinutes';

function clampOffset(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-720, Math.min(840, Math.round(value)));
}

export function createApplet(
  context: ControlPanelContext,
  manifest: ControlPanelManifestEntry,
): ControlPanelApplet<DateTimeAppletSession> {
  const { settings } = context;

  return {
    id: `control-panel/${manifest.id}`,
    title: manifest.title,
    description: manifest.description,
    category: manifest.category,
    keywords: [...manifest.keywords],
    manifest,
    open(): DateTimeAppletSession {
      const initial = clampOffset((settings.get(OFFSET_KEY, 0) as number) ?? 0);
      let pending = initial;

      return {
        tabs: ['Date & Time', 'Time Zone'],
        getOffsetMinutes() {
          return pending;
        },
        setOffsetMinutes(minutes: number) {
          pending = clampOffset(minutes);
        },
        apply() {
          settings.set(OFFSET_KEY, pending);
        },
        reset() {
          pending = clampOffset((settings.get(OFFSET_KEY, 0) as number) ?? 0);
        },
        dispose() {
          pending = initial;
        },
      };
    },
  };
}
