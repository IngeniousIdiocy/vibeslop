import type { DesktopIcon } from '@apps/shell/desktop';

export interface DesktopViewOptions {
  onOpen?(id: string): void;
  onSelect?(id: string, additive: boolean): void;
  onClearSelection?(): void;
  onDragStart?(event: DesktopDragEvent): void;
  onDrag?(event: DesktopDragEvent): void;
  onDragEnd?(event: DesktopDragEvent): void;
}

export interface DesktopView {
  element: HTMLElement;
  render(icons: DesktopIcon[]): void;
}

export interface DesktopDragEvent {
  id: string;
  pointerId: number;
  origin: { x: number; y: number };
  current: { x: number; y: number };
  delta: { x: number; y: number };
  moved: boolean;
  pointerEvent: PointerEvent;
}

const TYPE_ICONS: Record<string, string> = {
  folder: 'icons/w2k_folder_closed.ico',
  shortcut: 'icons/w2k_default_application.ico',
  file: 'icons/w2k_default_document.ico',
};

function resolveIcon(icon?: string, type?: string): string {
  if (icon && icon.startsWith('assets/')) {
    return icon;
  }
  if (icon && icon.startsWith('/')) {
    return `assets${icon}`;
  }
  if (icon && icon.length) {
    return `assets/${icon}`;
  }
  const fallback = type ? TYPE_ICONS[type] : TYPE_ICONS.shortcut;
  return `assets/${fallback}`;
}

export function createDesktopView(options: DesktopViewOptions = {}): DesktopView {
  const element = document.createElement('div');
  element.className = 'desktop-icons';

  element.addEventListener('mousedown', (event) => {
    if (event.target === element) {
      options.onClearSelection?.();
    }
  });

  type IconNode = {
    element: HTMLElement;
    update(data: DesktopIcon): void;
  };

  const iconNodes = new Map<string, IconNode>();

  const resolvePointerId = (event: PointerEvent) => (typeof event.pointerId === 'number' ? event.pointerId : 0);
  const getPointerPosition = (event: PointerEvent) => ({
    x: typeof event.clientX === 'number' ? event.clientX : 0,
    y: typeof event.clientY === 'number' ? event.clientY : 0,
  });

  const createIconNode = (initialData: DesktopIcon): IconNode => {
    let current = initialData;
    let pointerState:
      | {
          pointerId: number;
          origin: { x: number; y: number };
        }
      | undefined;
    let suppressClick = false;

    const icon = document.createElement('button');
    icon.type = 'button';
    icon.className = 'desktop-icon';
    icon.draggable = false;

    const image = document.createElement('img');
    image.className = 'desktop-icon__image';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    icon.appendChild(image);

    const label = document.createElement('span');
    label.className = 'desktop-icon__label';
    icon.appendChild(label);

    const emitDragEvent = (phase: 'start' | 'move' | 'end', event: PointerEvent) => {
      if (!pointerState) {
        return;
      }
      const pointerId = resolvePointerId(event);
      const currentPosition = getPointerPosition(event);
      const delta = {
        x: currentPosition.x - pointerState.origin.x,
        y: currentPosition.y - pointerState.origin.y,
      };
      const moved = suppressClick;
      const payload: DesktopDragEvent = {
        id: current.id,
        pointerId,
        origin: pointerState.origin,
        current: currentPosition,
        delta,
        moved,
        pointerEvent: event,
      };
      if (phase === 'start') {
        options.onDragStart?.(payload);
      } else if (phase === 'move') {
        options.onDrag?.(payload);
      } else {
        options.onDragEnd?.(payload);
      }
    };

    icon.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      const pointerId = resolvePointerId(event);
      pointerState = {
        pointerId,
        origin: getPointerPosition(event),
      };
      suppressClick = false;
      icon.dataset.dragging = 'true';
      icon.setPointerCapture?.(pointerId);
      event.preventDefault?.();
      event.stopPropagation?.();
      emitDragEvent('start', event);
    });

    icon.addEventListener('pointermove', (event) => {
      if (!pointerState || resolvePointerId(event) !== pointerState.pointerId) {
        return;
      }
      const currentPosition = getPointerPosition(event);
      const deltaX = Math.abs(currentPosition.x - pointerState.origin.x);
      const deltaY = Math.abs(currentPosition.y - pointerState.origin.y);
      if (!suppressClick && (deltaX > 1 || deltaY > 1)) {
        suppressClick = true;
      }
      emitDragEvent('move', event);
    });

    const releasePointer = (event: PointerEvent) => {
      if (!pointerState || resolvePointerId(event) !== pointerState.pointerId) {
        return;
      }
      emitDragEvent('end', event);
      icon.releasePointerCapture?.(pointerState.pointerId);
      pointerState = undefined;
      delete icon.dataset.dragging;
    };

    icon.addEventListener('pointerup', (event) => {
      releasePointer(event);
    });

    icon.addEventListener('pointercancel', (event) => {
      releasePointer(event);
      suppressClick = false;
    });

    icon.addEventListener('click', (event) => {
      event.stopPropagation();
      if (suppressClick) {
        event.preventDefault?.();
        suppressClick = false;
        return;
      }
      const additive = Boolean(event.ctrlKey || event.metaKey);
      options.onSelect?.(current.id, additive);
    });

    icon.addEventListener('dblclick', (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      options.onOpen?.(current.id);
      icon.blur();
      if (typeof window !== 'undefined') {
        const selection = window.getSelection?.();
        if (selection && typeof selection.removeAllRanges === 'function') {
          selection.removeAllRanges();
        }
      }
      suppressClick = false;
    });

    icon.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault?.();
        options.onOpen?.(current.id);
      }
    });

    const update = (data: DesktopIcon) => {
      current = data;
      icon.dataset.id = data.id;
      icon.dataset.selected = data.selected ? 'true' : 'false';
      icon.style.left = `${data.position.x}px`;
      icon.style.top = `${data.position.y}px`;
      image.src = resolveIcon(data.icon, data.type);
      label.textContent = data.title;
    };

    update(initialData);

    return { element: icon, update };
  };

  function render(icons: DesktopIcon[]) {
    const activeIds = new Set<string>();

    icons.forEach((iconData) => {
      activeIds.add(iconData.id);
      let node = iconNodes.get(iconData.id);
      if (!node) {
        node = createIconNode(iconData);
        iconNodes.set(iconData.id, node);
      } else {
        node.update(iconData);
      }

      if (node.element.parentElement !== element) {
        element.appendChild(node.element);
      } else {
        element.appendChild(node.element);
      }
    });

    for (const [id, node] of iconNodes.entries()) {
      if (!activeIds.has(id)) {
        node.element.remove();
        iconNodes.delete(id);
      }
    }
  }

  return {
    element,
    render,
  };
}
