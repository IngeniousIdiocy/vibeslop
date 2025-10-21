import type { WindowManager } from '@apps/shell/window-manager';
import type { DisplayService } from '@services/display';
import type { WindowService, WindowBounds } from '@services/window';
import type {
  WindowFrame,
  WindowInteractionEvent,
  WindowInteractionHandler,
  WindowResizeHandle,
} from '@ui/components/windowFrame';

export interface WorkspaceBounds {
  width: number;
  height: number;
}

export interface WindowInteractionControllerOptions {
  windowId: string;
  frame: WindowFrame;
  windowManager: WindowManager;
  windows: WindowService;
  display: DisplayService;
  workspaceBounds?: WorkspaceBounds;
  onInteractionToggle?(active: boolean): void;
}

export interface WindowInteractionController {
  destroy(): void;
  setWorkspaceBounds(bounds: WorkspaceBounds): void;
}

type InteractionMode = 'move' | 'resize';

interface InteractionState {
  pointerId: number;
  mode: InteractionMode;
  handle?: WindowResizeHandle;
  origin: { x: number; y: number };
  startBounds: WindowBounds;
}

const MIN_WIDTH = 160;
const MIN_HEIGHT = 120;

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  if (max < min) {
    return min;
  }
  return Math.max(min, Math.min(value, max));
}

function getPointerPosition(event: PointerEvent): { x: number; y: number } {
  const x = typeof event.clientX === 'number' ? event.clientX : 0;
  const y = typeof event.clientY === 'number' ? event.clientY : 0;
  return { x, y };
}

function includesAxis(handle: WindowResizeHandle | undefined, axis: 'n' | 's' | 'e' | 'w'): boolean {
  if (!handle) {
    return false;
  }
  return handle.includes(axis);
}

export function createWindowInteractionController(
  options: WindowInteractionControllerOptions,
): WindowInteractionController {
  const { frame, windowId, windowManager, windows, display } = options;
  let workspaceBounds = options.workspaceBounds ?? { ...display.getState() };
  let interactionState: InteractionState | undefined;

  const notifyToggle = (active: boolean) => {
    frame.element.dataset.interacting = active ? 'true' : 'false';
    options.onInteractionToggle?.(active);
  };

  const resolveWorkspaceBounds = () => {
    const bounds = workspaceBounds ?? { ...display.getState() };
    const width = typeof bounds.width === 'number' && bounds.width > 0 ? bounds.width : display.getState().width;
    const height = typeof bounds.height === 'number' && bounds.height > 0 ? bounds.height : display.getState().height;
    return {
      width: width || 0,
      height: height || 0,
    };
  };

  function handleMove(event: WindowInteractionEvent) {
    if (!interactionState || interactionState.mode !== 'move' || event.phase === 'start') {
      return;
    }
    const descriptor = windows.get(windowId);
    if (!descriptor) {
      return;
    }
    const bounds = resolveWorkspaceBounds();
    const pointer = getPointerPosition(event.pointerEvent);
    const deltaX = pointer.x - interactionState.origin.x;
    const deltaY = pointer.y - interactionState.origin.y;

    const base = descriptor.bounds;
    const width = base.width;
    const height = base.height;
    const maxX = Math.max(0, bounds.width - width);
    const maxY = Math.max(0, bounds.height - height);

    const nextX = clamp(interactionState.startBounds.x + deltaX, 0, maxX || interactionState.startBounds.x + deltaX);
    const nextY = clamp(interactionState.startBounds.y + deltaY, 0, maxY || interactionState.startBounds.y + deltaY);

    windowManager.moveWindow(windowId, { x: nextX, y: nextY });
  }

  function handleResize(event: WindowInteractionEvent) {
    if (!interactionState || interactionState.mode !== 'resize' || event.phase === 'start') {
      return;
    }

    const descriptor = windows.get(windowId);
    if (!descriptor) {
      return;
    }

    const bounds = resolveWorkspaceBounds();
    const pointer = getPointerPosition(event.pointerEvent);
    const deltaX = pointer.x - interactionState.origin.x;
    const deltaY = pointer.y - interactionState.origin.y;

    let { x, y, width, height } = interactionState.startBounds;

    if (includesAxis(interactionState.handle, 'e')) {
      const maxWidth = Math.max(MIN_WIDTH, bounds.width - x);
      const nextWidth = clamp(width + deltaX, MIN_WIDTH, maxWidth);
      width = nextWidth;
    }

    if (includesAxis(interactionState.handle, 's')) {
      const maxHeight = Math.max(MIN_HEIGHT, bounds.height - y);
      const nextHeight = clamp(height + deltaY, MIN_HEIGHT, maxHeight);
      height = nextHeight;
    }

    if (includesAxis(interactionState.handle, 'w')) {
      const nextX = clamp(x + deltaX, 0, x + width - MIN_WIDTH);
      const widthDelta = x - nextX;
      x = nextX;
      const maxWidth = Math.max(MIN_WIDTH, bounds.width - x);
      width = clamp(width + widthDelta, MIN_WIDTH, maxWidth);
    }

    if (includesAxis(interactionState.handle, 'n')) {
      const nextY = clamp(y + deltaY, 0, y + height - MIN_HEIGHT);
      const heightDelta = y - nextY;
      y = nextY;
      const maxHeight = Math.max(MIN_HEIGHT, bounds.height - y);
      height = clamp(height + heightDelta, MIN_HEIGHT, maxHeight);
    }

    const maxWidth = Math.max(MIN_WIDTH, bounds.width - x);
    const maxHeight = Math.max(MIN_HEIGHT, bounds.height - y);
    width = clamp(width, MIN_WIDTH, maxWidth);
    height = clamp(height, MIN_HEIGHT, maxHeight);

    windowManager.resizeWindow(windowId, { x, y, width, height });
  }

  const interactionHandler: WindowInteractionHandler = (event) => {
    const pointerId = typeof event.pointerId === 'number' ? event.pointerId : 0;
    const descriptor = windows.get(windowId);
    if (!descriptor) {
      return;
    }

    if (event.phase === 'start') {
      if (descriptor.state !== 'normal') {
        return;
      }
      const pointer = getPointerPosition(event.pointerEvent);
      interactionState = {
        pointerId,
        mode: event.type,
        handle: event.handle,
        origin: pointer,
        startBounds: { ...descriptor.bounds },
      };
      const target = (event.pointerEvent.currentTarget || event.pointerEvent.target) as HTMLElement | undefined;
      target?.setPointerCapture?.(pointerId);
      windows.focus(windowId);
      notifyToggle(true);
      return;
    }

    if (!interactionState || interactionState.pointerId !== pointerId) {
      return;
    }

    if (event.phase === 'move') {
      if (interactionState.mode === 'move') {
        handleMove(event);
      } else {
        handleResize(event);
      }
      return;
    }

    if (event.phase === 'end') {
      const target = (event.pointerEvent.currentTarget || event.pointerEvent.target) as HTMLElement | undefined;
      target?.releasePointerCapture?.(pointerId);
      interactionState = undefined;
      notifyToggle(false);
    }
  };

  frame.setInteractionHandler(interactionHandler);

  return {
    destroy() {
      frame.setInteractionHandler(undefined);
      notifyToggle(false);
      interactionState = undefined;
    },
    setWorkspaceBounds(bounds: WorkspaceBounds) {
      workspaceBounds = bounds;
    },
  };
}
