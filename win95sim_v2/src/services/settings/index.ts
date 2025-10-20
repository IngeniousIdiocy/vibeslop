import { createEventBus, EventBus } from '@core/kernel/eventBus';

export type SettingValue = string | number | boolean | null | undefined;

export interface SettingsChangeEvent {
  key: string;
  value: SettingValue;
}

export interface SettingsService {
  get(key: string, fallback?: SettingValue): SettingValue;
  set(key: string, value: SettingValue): void;
  watch(key: string, handler: (event: SettingsChangeEvent) => void): () => void;
  bus: EventBus;
}

export function createSettingsService(initialValues: Record<string, SettingValue> = {}): SettingsService {
  const values = new Map<string, SettingValue>(Object.entries(initialValues));
  const bus = createEventBus();

  return {
    bus,
    get(key, fallback = undefined) {
      return values.has(key) ? values.get(key) : fallback;
    },
    set(key, value) {
      values.set(key, value);
      bus.emit<SettingsChangeEvent>('settings:changed', { key, value });
    },
    watch(key, handler) {
      return bus.on<SettingsChangeEvent>('settings:changed', (event) => {
        if (event.key === key) {
          handler(event);
        }
      });
    },
  };
}
