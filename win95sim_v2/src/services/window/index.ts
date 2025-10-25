import { createEventBus, EventBus } from '@core/kernel/eventBus';

export type WindowState = 'normal' | 'minimized' | 'maximized';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowDescriptor {
  id: string;
  title: string;
  icon?: string;
  bounds: WindowBounds;
  state?: WindowState;
  zIndex?: number;
}

export interface WindowEvent {
  id: string;
  descriptor: WindowDescriptor;
}

export interface WindowService {
  bus: EventBus;
  create(descriptor: WindowDescriptor): WindowDescriptor;
  update(id: string, updates: Partial<WindowDescriptor>): WindowDescriptor;
  get(id: string): WindowDescriptor | undefined;
  all(): WindowDescriptor[];
  remove(id: string): void;
  focus(id: string): WindowDescriptor | undefined;
  getActiveWindow(): WindowDescriptor | undefined;
}

export function createWindowService(): WindowService {
  const bus = createEventBus();
  const windows = new Map<string, WindowDescriptor>();
  let activeWindowId: string | undefined;
  let zIndex = 1;

  function emit(type: string, descriptor: WindowDescriptor) {
    bus.emit<WindowEvent>(type, { id: descriptor.id, descriptor });
  }

  return {
    bus,
    create(descriptor) {
      if (windows.has(descriptor.id)) {
        throw new Error(`Window ${descriptor.id} already exists`);
      }

      const record: WindowDescriptor = {
        ...descriptor,
        state: descriptor.state ?? 'normal',
        zIndex: zIndex++,
      };
      windows.set(record.id, record);
      activeWindowId = record.id;
      emit('window:created', record);
      emit('window:activated', record);
      return record;
    },
    update(id, updates) {
      const record = windows.get(id);
      if (!record) {
        throw new Error(`Unknown window ${id}`);
      }

      const updated: WindowDescriptor = {
        ...record,
        ...updates,
        bounds: {
          ...record.bounds,
          ...(updates.bounds ?? {}),
        },
      };

      if (updates.state && updates.state !== record.state && updates.state === 'maximized') {
        updated.zIndex = zIndex++;
        activeWindowId = id;
        emit('window:activated', updated);
      }

      if (updates.state && updates.state === 'minimized' && activeWindowId === id) {
        activeWindowId = undefined;
        const nextActive = Array.from(windows.values())
          .filter((entry) => entry.id !== id && entry.state !== 'minimized')
          .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
          .pop();
        if (nextActive) {
          activeWindowId = nextActive.id;
          emit('window:activated', nextActive);
        }
      }

      windows.set(id, updated);
      emit('window:updated', updated);
      return updated;
    },
    get(id) {
      return windows.get(id);
    },
    all() {
      return Array.from(windows.values()).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    },
    remove(id) {
      const record = windows.get(id);
      if (!record) {
        return;
      }

      windows.delete(id);
      emit('window:removed', record);
      if (activeWindowId === id) {
        activeWindowId = Array.from(windows.keys()).pop();
        if (activeWindowId) {
          const next = windows.get(activeWindowId)!;
          emit('window:activated', next);
        }
      }
    },
    focus(id) {
      const record = windows.get(id);
      if (!record) {
        return undefined;
      }

      activeWindowId = id;
      const updated = {
        ...record,
        zIndex: zIndex++,
      };
      windows.set(id, updated);
      emit('window:activated', updated);
      return updated;
    },
    getActiveWindow() {
      if (!activeWindowId) {
        return undefined;
      }

      return windows.get(activeWindowId);
    },
  };
}
