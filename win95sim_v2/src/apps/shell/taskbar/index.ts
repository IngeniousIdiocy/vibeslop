import { EventBus } from '@core/kernel/eventBus';
import type { WindowDescriptor, WindowEvent, WindowService } from '@services/window';

export type TaskButtonState = 'active' | 'inactive' | 'minimized';

export interface TaskButton {
  id: string;
  title: string;
  state: TaskButtonState;
  lastActivated: number;
}

export interface TaskbarOptions {
  windows: WindowService;
  bus: EventBus;
  clock?: () => number;
}

export interface TaskbarController {
  listButtons(): TaskButton[];
  handleWindow(descriptor: WindowDescriptor): void;
  activateWindow(id: string): void;
  toggleMinimize(id: string): void;
}

export function createTaskbarController(options: TaskbarOptions): TaskbarController {
  const { windows, bus } = options;
  const now = options.clock ?? (() => Date.now());
  const buttons = new Map<string, TaskButton>();

  function ensureButton(descriptor: WindowDescriptor) {
    if (!buttons.has(descriptor.id)) {
      buttons.set(descriptor.id, {
        id: descriptor.id,
        title: descriptor.title,
        state: descriptor.state === 'minimized' ? 'minimized' : 'inactive',
        lastActivated: 0,
      });
    }
  }

  function setActive(id: string) {
    for (const button of buttons.values()) {
      if (button.id === id) {
        button.state = 'active';
        button.lastActivated = now();
      } else if (button.state !== 'minimized') {
        button.state = 'inactive';
      }
    }
  }

  windows.bus.on<WindowEvent>('window:created', ({ descriptor }) => {
    ensureButton(descriptor);
    setActive(descriptor.id);
    bus.emit('taskbar:buttons-changed', listButtons());
  });

  windows.bus.on<WindowEvent>('window:updated', ({ descriptor }) => {
    ensureButton(descriptor);
    const button = buttons.get(descriptor.id);
    if (!button) {
      return;
    }

    button.title = descriptor.title;
    if (descriptor.state === 'minimized') {
      button.state = 'minimized';
    } else if (descriptor.state === 'maximized') {
      setActive(descriptor.id);
    } else if (descriptor.state === 'normal' && windows.getActiveWindow()?.id === descriptor.id) {
      setActive(descriptor.id);
    }
    bus.emit('taskbar:buttons-changed', listButtons());
  });

  windows.bus.on<WindowEvent>('window:activated', ({ descriptor }) => {
    ensureButton(descriptor);
    setActive(descriptor.id);
    bus.emit('taskbar:buttons-changed', listButtons());
  });

  windows.bus.on<WindowEvent>('window:removed', ({ id }) => {
    buttons.delete(id);
    bus.emit('taskbar:buttons-changed', listButtons());
  });

  function listButtons(): TaskButton[] {
    return Array.from(buttons.values()).sort((a, b) => a.lastActivated - b.lastActivated);
  }

  return {
    listButtons,
    handleWindow(descriptor) {
      ensureButton(descriptor);
      bus.emit('taskbar:buttons-changed', listButtons());
    },
    activateWindow(id) {
      const descriptor = windows.get(id);
      if (!descriptor) {
        return;
      }

      windows.focus(id);
      setActive(id);
      bus.emit('taskbar:buttons-changed', listButtons());
    },
    toggleMinimize(id) {
      const descriptor = windows.get(id);
      if (!descriptor) {
        return;
      }

      if (descriptor.state === 'minimized') {
        windows.update(id, { state: 'normal' });
        setActive(id);
      } else {
        windows.update(id, { state: 'minimized' });
        const button = buttons.get(id);
        if (button) {
          button.state = 'minimized';
        }
      }
      bus.emit('taskbar:buttons-changed', listButtons());
    },
  };
}

export default createTaskbarController;
