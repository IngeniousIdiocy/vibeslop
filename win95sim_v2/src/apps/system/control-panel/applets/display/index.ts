import type { DisplayState, ScalingMode } from '@services/display';
import type { ControlPanelApplet, ControlPanelContext, DisplayAppletSession } from '../../types';
import type { ControlPanelManifestEntry } from '../../manifest';

function cloneState(state: DisplayState): DisplayState {
  return { ...state };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function createApplet(
  context: ControlPanelContext,
  manifest: ControlPanelManifestEntry,
): ControlPanelApplet<DisplayAppletSession> {
  const { display } = context;

  return {
    id: `control-panel/${manifest.id}`,
    title: manifest.title,
    description: manifest.description,
    category: manifest.category,
    keywords: [...manifest.keywords],
    manifest,
    open(): DisplayAppletSession {
      const base = display.getState();
      let applied = cloneState(base);
      let pending = cloneState(base);

      function updateResolution(width: number, height: number) {
        width = clamp(width, 320, 2048);
        height = clamp(height, 200, 1536);
        pending = { ...pending, width, height };
      }

      return {
        tabs: ['Background', 'Screen Saver', 'Appearance', 'Settings'],
        state: {
          get applied() {
            return cloneState(applied);
          },
          get pending() {
            return cloneState(pending);
          },
        },
        previewResolution(width: number, height: number) {
          updateResolution(width, height);
        },
        setScalingMode(mode: ScalingMode) {
          pending = { ...pending, scalingMode: mode };
        },
        toggleIntegerScale(enabled: boolean) {
          pending = { ...pending, integerScale: !!enabled };
        },
        apply() {
          applied = cloneState(pending);
          display.setResolution(applied.width, applied.height);
          display.setScalingMode(applied.scalingMode);
          display.toggleIntegerScale(applied.integerScale);
        },
        cancel() {
          pending = cloneState(applied);
        },
        dispose() {
          pending = cloneState(applied);
        },
      };
    },
  };
}
