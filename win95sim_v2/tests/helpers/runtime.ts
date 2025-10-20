import { createModuleRegistry } from '../../src/core/kernel/moduleRegistry';
import { createEventBus } from '../../src/core/kernel/eventBus';
import { createSettingsService } from '../../src/services/settings';
import { createDisplayService } from '../../src/services/display';
import { createWindowService } from '../../src/services/window';
import { createWindowManager } from '../../src/apps/shell/window-manager';

export interface TestRuntime {
  registry: ReturnType<typeof createModuleRegistry>;
  bus: ReturnType<typeof createEventBus>;
  services: {
    settings: ReturnType<typeof createSettingsService>;
    display: ReturnType<typeof createDisplayService>;
    windows: ReturnType<typeof createWindowService>;
  };
  windowManager: ReturnType<typeof createWindowManager>;
}

export function createTestRuntime(): TestRuntime {
  const registry = createModuleRegistry();
  const bus = createEventBus();
  const settings = createSettingsService();
  const display = createDisplayService();
  const windows = createWindowService();
  const windowManager = createWindowManager({ display, windows, bus });

  registry.register({ id: 'services/settings', factory: () => settings });
  registry.register({ id: 'services/display', factory: () => display });
  registry.register({ id: 'services/windows', factory: () => windows });
  registry.register({ id: 'apps/window-manager', factory: () => windowManager });

  return { registry, bus, services: { settings, display, windows }, windowManager };
}
