import { createModuleRegistry } from '@core/kernel/moduleRegistry';
import { createEventBus } from '@core/kernel/eventBus';
import { createSettingsService } from '@services/settings';
import { createDisplayService } from '@services/display';
import { createWindowService, WindowDescriptor } from '@services/window';
import { createWindowManager } from '@apps/shell/window-manager';
import { createCrtViewport } from '@ui/components/crtViewport';
import { createWindowFrame } from '@ui/components/windowFrame';

export interface ShellSession {
  mount(root: HTMLElement): void;
  createWindow(descriptor: WindowDescriptor): WindowDescriptor;
  listWindows(): WindowDescriptor[];
}

export function createShellSession(): ShellSession {
  const registry = createModuleRegistry();
  const bus = createEventBus();

  const settings = createSettingsService({ theme: 'classic' });
  const display = createDisplayService();
  const windows = createWindowService();
  const windowManager = createWindowManager({ display, windows, bus });

  registry.register({ id: 'services/settings', version: '2.0.0', factory: () => settings });
  registry.register({ id: 'services/display', version: '2.0.0', factory: () => display });
  registry.register({ id: 'services/windows', version: '2.0.0', factory: () => windows });
  registry.register({ id: 'apps/window-manager', version: '2.0.0', factory: () => windowManager });
  registry.register({ id: 'shell/session', version: '2.0.0', factory: () => ({ bus, registry }) });

  let viewport: ReturnType<typeof createCrtViewport> | undefined;
  const frames = new Map<string, HTMLElement>();

  function ensureViewport(root: HTMLElement) {
    if (viewport) {
      return viewport;
    }

    viewport = createCrtViewport();
    root.appendChild(viewport.element);

    const desktop = document.createElement('div');
    desktop.className = 'desktop-root';
    viewport.mount(desktop);

    const windowsLayer = document.createElement('div');
    windowsLayer.className = 'desktop-root__windows';
    desktop.appendChild(windowsLayer);

    windows.bus.on('window:created', ({ descriptor }) => {
      const frame = createWindowFrame({
        title: descriptor.title,
        onClose: () => windowManager.closeWindow(descriptor.id),
        onMinimize: () => windowManager.minimizeWindow(descriptor.id),
        onMaximize: () => {
          const current = windows.get(descriptor.id);
          if (!current) {
            return;
          }

          if (current.state === 'maximized') {
            windowManager.restoreWindow(descriptor.id);
          } else {
            windowManager.maximizeWindow(descriptor.id);
          }
        },
      });

      frame.element.addEventListener('mousedown', () => {
        windows.focus(descriptor.id);
      });

      frames.set(descriptor.id, frame.element);
      windowsLayer.appendChild(frame.element);
      renderWindow(descriptor.id, descriptor);
    });

    const update = ({ descriptor }: { descriptor: WindowDescriptor }) => {
      renderWindow(descriptor.id, descriptor);
    };

    windows.bus.on('window:updated', update);
    windows.bus.on('window:activated', update);
    windows.bus.on('window:removed', ({ id }) => {
      const element = frames.get(id);
      if (element) {
        element.remove();
        frames.delete(id);
      }
    });

    bus.emit('session:ready', { registry });
    viewport.setStatus('ready');

    return viewport;
  }

  function renderWindow(id: string, descriptor: WindowDescriptor) {
    const element = frames.get(id);
    if (!element) {
      return;
    }

    element.style.left = `${descriptor.bounds.x}px`;
    element.style.top = `${descriptor.bounds.y}px`;
    element.style.width = `${descriptor.bounds.width}px`;
    element.style.height = `${descriptor.bounds.height}px`;
    element.style.zIndex = String(descriptor.zIndex ?? 1);
    element.dataset.state = descriptor.state ?? 'normal';
    element.toggleAttribute('hidden', descriptor.state === 'minimized');
    const activeId = windows.getActiveWindow()?.id;
    if (activeId === id) {
      element.dataset.active = 'true';
    } else {
      delete element.dataset.active;
    }
  }

  return {
    mount(root) {
      ensureViewport(root);
      if (!windowManager.listWindows().length) {
        windowManager.createWindow({
          id: 'shell:welcome',
          title: 'Windows 95',
          bounds: { x: 80, y: 60, width: 320, height: 240 },
        });
      }
    },
    createWindow(descriptor) {
      const frame = windowManager.createWindow(descriptor);
      return frame;
    },
    listWindows() {
      return windowManager.listWindows();
    },
  };
}
