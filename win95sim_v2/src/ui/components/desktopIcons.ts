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

  function render(icons: DesktopIcon[]) {
    element.innerHTML = '';
    icons.forEach((iconData) => {
      const icon = document.createElement('button');
      icon.type = 'button';
      icon.className = 'desktop-icon';
      icon.dataset.id = iconData.id;
      icon.dataset.selected = iconData.selected ? 'true' : 'false';
      icon.style.left = `${iconData.position.x}px`;
      icon.style.top = `${iconData.position.y}px`;
      icon.draggable = false;

      const image = document.createElement('img');
      image.className = 'desktop-icon__image';
      image.src = resolveIcon(iconData.icon, iconData.type);
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      icon.appendChild(image);

      const label = document.createElement('span');
      label.className = 'desktop-icon__label';
      label.textContent = iconData.title;
      icon.appendChild(label);

      const resolvePointerId = (event: PointerEvent) => (typeof event.pointerId === 'number' ? event.pointerId : 0);

      const getPointerPosition = (event: PointerEvent) => ({
        x: typeof event.clientX === 'number' ? event.clientX : 0,
        y: typeof event.clientY === 'number' ? event.clientY : 0,
      });

      let pointerState:
        | {
            pointerId: number;
            origin: { x: number; y: number };
          }
        | undefined;
      let suppressClick = false;

      const emitDragEvent = (phase: 'start' | 'move' | 'end', event: PointerEvent) => {
        if (!pointerState) {
          return;
        }
        const pointerId = resolvePointerId(event);
        const current = getPointerPosition(event);
        const delta = {
          x: current.x - pointerState.origin.x,
          y: current.y - pointerState.origin.y,
        };
        const moved = suppressClick;
        const payload: DesktopDragEvent = {
          id: iconData.id,
          pointerId,
          origin: pointerState.origin,
          current,
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
        const current = getPointerPosition(event);
        const deltaX = Math.abs(current.x - pointerState.origin.x);
        const deltaY = Math.abs(current.y - pointerState.origin.y);
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
          event.preventDefault();
          suppressClick = false;
          return;
        }
        const additive = event.ctrlKey || event.metaKey;
        options.onSelect?.(iconData.id, additive);
      });

      icon.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onOpen?.(iconData.id);
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
          event.preventDefault();
          options.onOpen?.(iconData.id);
        }
      });

      element.appendChild(icon);
    });
  }

  return {
    element,
    render,
  };
}
