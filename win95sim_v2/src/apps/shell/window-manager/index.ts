import { EventBus } from '@core/kernel/eventBus';
import { DisplayService } from '@services/display';
import { WindowService, WindowDescriptor, WindowBounds } from '@services/window';

export interface WindowManagerOptions {
  display: DisplayService;
  windows: WindowService;
  bus: EventBus;
}

export interface WindowManager {
  createWindow(descriptor: WindowDescriptor): WindowDescriptor;
  moveWindow(id: string, bounds: Partial<WindowBounds>): WindowDescriptor;
  resizeWindow(id: string, bounds: Partial<WindowBounds>): WindowDescriptor;
  minimizeWindow(id: string): WindowDescriptor;
  maximizeWindow(id: string): WindowDescriptor;
  restoreWindow(id: string): WindowDescriptor;
  closeWindow(id: string): void;
  listWindows(): WindowDescriptor[];
}

function mergeBounds(bounds: WindowBounds, updates: Partial<WindowBounds>): WindowBounds {
  return {
    x: updates.x ?? bounds.x,
    y: updates.y ?? bounds.y,
    width: updates.width ?? bounds.width,
    height: updates.height ?? bounds.height,
  };
}

export function createWindowManager(options: WindowManagerOptions): WindowManager {
  const { display, windows, bus } = options;

  function emitSessionEvent(type: string, descriptor: WindowDescriptor) {
    bus.emit(type, {
      window: descriptor,
      display: display.getState(),
    });
  }

  return {
    createWindow(descriptor) {
      const created = windows.create(descriptor);
      emitSessionEvent('window-manager:created', created);
      return created;
    },
    moveWindow(id, bounds) {
      const current = windows.get(id);
      if (!current) {
        throw new Error(`Unknown window ${id}`);
      }

      const record = windows.update(id, {
        bounds: mergeBounds(current.bounds, bounds),
      });
      emitSessionEvent('window-manager:moved', record);
      return record;
    },
    resizeWindow(id, bounds) {
      const current = windows.get(id);
      if (!current) {
        throw new Error(`Unknown window ${id}`);
      }

      const record = windows.update(id, {
        bounds: mergeBounds(current.bounds, bounds),
      });
      emitSessionEvent('window-manager:resized', record);
      return record;
    },
    minimizeWindow(id) {
      const record = windows.update(id, { state: 'minimized' });
      emitSessionEvent('window-manager:minimized', record);
      return record;
    },
    maximizeWindow(id) {
      const record = windows.update(id, { state: 'maximized' });
      emitSessionEvent('window-manager:maximized', record);
      return record;
    },
    restoreWindow(id) {
      const record = windows.update(id, { state: 'normal' });
      const focused = windows.focus(id) ?? record;
      emitSessionEvent('window-manager:restored', focused);
      return focused;
    },
    closeWindow(id) {
      const record = windows.get(id);
      if (record) {
        emitSessionEvent('window-manager:closed', record);
      }
      windows.remove(id);
    },
    listWindows() {
      return windows.all();
    },
  };
}
