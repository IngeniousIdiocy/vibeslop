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
  const previousBounds = new Map<string, WindowBounds>();

  function emitSessionEvent(type: string, descriptor: WindowDescriptor) {
    bus.emit(type, {
      window: descriptor,
      display: display.getState(),
    });
  }

  return {
    createWindow(descriptor) {
      const created = windows.create(descriptor);
      previousBounds.delete(created.id);
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
      const current = windows.get(id);
      if (!current) {
        throw new Error(`Unknown window ${id}`);
      }

      if (current.state !== 'maximized') {
        previousBounds.set(id, { ...current.bounds });
      }

      const { width, height } = display.getState();
      const record = windows.update(id, {
        state: 'maximized',
        bounds: {
          x: 0,
          y: 0,
          width,
          height,
        },
      });
      const focused = windows.focus(id) ?? record;
      emitSessionEvent('window-manager:maximized', focused);
      return focused;
    },
    restoreWindow(id) {
      const current = windows.get(id);
      if (!current) {
        throw new Error(`Unknown window ${id}`);
      }

      const previous = previousBounds.get(id) ?? current.bounds;
      previousBounds.delete(id);

      const record = windows.update(id, {
        state: 'normal',
        bounds: { ...previous },
      });
      const focused = windows.focus(id) ?? record;
      emitSessionEvent('window-manager:restored', focused);
      return focused;
    },
    closeWindow(id) {
      const record = windows.get(id);
      if (record) {
        emitSessionEvent('window-manager:closed', record);
      }
      previousBounds.delete(id);
      windows.remove(id);
    },
    listWindows() {
      return windows.all();
    },
  };
}
