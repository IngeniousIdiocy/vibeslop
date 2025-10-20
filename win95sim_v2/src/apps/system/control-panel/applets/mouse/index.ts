import type { ControlPanelApplet, ControlPanelContext, MouseAppletSession } from '../../types';
import type { ControlPanelManifestEntry } from '../../manifest';

const SPEED_KEY = 'mouse.pointerSpeed';
const DOUBLE_CLICK_KEY = 'mouse.doubleClickSpeed';

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function createApplet(
  context: ControlPanelContext,
  manifest: ControlPanelManifestEntry,
): ControlPanelApplet<MouseAppletSession> {
  const { settings } = context;

  return {
    id: `control-panel/${manifest.id}`,
    title: manifest.title,
    description: manifest.description,
    category: manifest.category,
    keywords: [...manifest.keywords],
    manifest,
    open(): MouseAppletSession {
      const initialSpeed = clamp((settings.get(SPEED_KEY, 10) as number) ?? 10, 1, 20);
      const initialDoubleClick = clamp((settings.get(DOUBLE_CLICK_KEY, 500) as number) ?? 500, 200, 1000);
      let speed = initialSpeed;
      let doubleClick = initialDoubleClick;

      return {
        tabs: ['Buttons', 'Pointers', 'Motion', 'Wheel'],
        getPointerSpeed() {
          return speed;
        },
        setPointerSpeed(next: number) {
          speed = clamp(next, 1, 20);
        },
        getDoubleClickSpeed() {
          return doubleClick;
        },
        setDoubleClickSpeed(next: number) {
          doubleClick = clamp(next, 200, 1000);
        },
        apply() {
          settings.set(SPEED_KEY, speed);
          settings.set(DOUBLE_CLICK_KEY, doubleClick);
        },
        reset() {
          speed = clamp((settings.get(SPEED_KEY, initialSpeed) as number) ?? initialSpeed, 1, 20);
          doubleClick = clamp((settings.get(DOUBLE_CLICK_KEY, initialDoubleClick) as number) ?? initialDoubleClick, 200, 1000);
        },
        dispose() {
          speed = initialSpeed;
          doubleClick = initialDoubleClick;
        },
      };
    },
  };
}
