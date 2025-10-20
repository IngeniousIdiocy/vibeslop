import type { ControlPanelApplet, ControlPanelContext, InputAppletSession } from '../../types';
import type { ControlPanelManifestEntry } from '../../manifest';

const RATE_KEY = 'input.repeatRate';
const DELAY_KEY = 'input.repeatDelay';

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function createApplet(
  context: ControlPanelContext,
  manifest: ControlPanelManifestEntry,
): ControlPanelApplet<InputAppletSession> {
  const { settings } = context;

  return {
    id: `control-panel/${manifest.id}`,
    title: manifest.title,
    description: manifest.description,
    category: manifest.category,
    keywords: [...manifest.keywords],
    manifest,
    open(): InputAppletSession {
      const initialRate = clamp((settings.get(RATE_KEY, 31) as number) ?? 31, 1, 31);
      const initialDelay = clamp((settings.get(DELAY_KEY, 2) as number) ?? 2, 1, 4);
      let rate = initialRate;
      let delay = initialDelay;

      return {
        tabs: ['Speed'],
        getRepeatRate() {
          return rate;
        },
        setRepeatRate(next: number) {
          rate = clamp(next, 1, 31);
        },
        getDelay() {
          return delay;
        },
        setDelay(next: number) {
          delay = clamp(next, 1, 4);
        },
        apply() {
          settings.set(RATE_KEY, rate);
          settings.set(DELAY_KEY, delay);
        },
        reset() {
          rate = clamp((settings.get(RATE_KEY, initialRate) as number) ?? initialRate, 1, 31);
          delay = clamp((settings.get(DELAY_KEY, initialDelay) as number) ?? initialDelay, 1, 4);
        },
        dispose() {
          rate = initialRate;
          delay = initialDelay;
        },
      };
    },
  };
}
