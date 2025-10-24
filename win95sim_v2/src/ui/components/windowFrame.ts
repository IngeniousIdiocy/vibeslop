import { createCaptionButtons, CaptionButtonOptions } from './captionButtons';

const DEFAULT_WINDOW_ICON = 'assets/icons/program.ico';

export interface WindowFrameOptions extends CaptionButtonOptions {
  title: string;
  icon?: string;
  content?: HTMLElement;
}

export interface WindowFrame {
  element: HTMLElement;
  content: HTMLElement;
  setInteractionHandler(handler: WindowInteractionHandler | undefined): void;
}

export type WindowResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type WindowInteractionPhase = 'start' | 'move' | 'end';

export interface WindowInteractionEvent {
  type: 'move' | 'resize';
  phase: WindowInteractionPhase;
  handle?: WindowResizeHandle;
  pointerId: number;
  pointerEvent: PointerEvent;
}

export type WindowInteractionHandler = (event: WindowInteractionEvent) => void;

export function createWindowFrame(options: WindowFrameOptions): WindowFrame {
  const element = document.createElement('div');
  element.className = 'window-frame';
  element.dataset.state = 'normal';

  let interactionHandler: WindowInteractionHandler | undefined;

  const caption = document.createElement('div');
  caption.className = 'window-caption';

  const icon = document.createElement('img');
  icon.className = 'window-caption__icon';
  icon.src = resolveIcon(options.icon);
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');
  caption.appendChild(icon);

  const title = document.createElement('span');
  title.className = 'window-caption__title';
  title.textContent = options.title;
  caption.appendChild(title);

  const buttons = createCaptionButtons(options);
  caption.appendChild(buttons);

  if (options.onMaximize) {
    caption.addEventListener('dblclick', (event) => {
      event.preventDefault();
      options.onMaximize?.();
    });
  }

  const body = document.createElement('div');
  body.className = 'window-body';
  if (options.content) {
    body.appendChild(options.content);
  }

  element.appendChild(caption);
  element.appendChild(body);

  const resizeHandles: Array<{ handle: WindowResizeHandle; className: string }> = [
    { handle: 'n', className: 'window-resize-handle--n' },
    { handle: 's', className: 'window-resize-handle--s' },
    { handle: 'e', className: 'window-resize-handle--e' },
    { handle: 'w', className: 'window-resize-handle--w' },
    { handle: 'ne', className: 'window-resize-handle--ne' },
    { handle: 'nw', className: 'window-resize-handle--nw' },
    { handle: 'se', className: 'window-resize-handle--se' },
    { handle: 'sw', className: 'window-resize-handle--sw' },
  ];

  function emitInteraction(event: WindowInteractionEvent) {
    interactionHandler?.(event);
  }

  function attachPointerGesture(target: HTMLElement, detail: { type: 'move' | 'resize'; handle?: WindowResizeHandle }) {
    let activePointerId: number | undefined;

    const resolvePointerId = (event: PointerEvent) =>
      typeof event.pointerId === 'number' ? event.pointerId : 0;

    target.addEventListener('pointerdown', (event: PointerEvent) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      if (detail.type === 'move' && event.target instanceof HTMLElement) {
        if (event.target.closest('.window-caption__button')) {
          return;
        }
      }
      activePointerId = resolvePointerId(event);
      event.preventDefault?.();
      event.stopPropagation?.();
      emitInteraction({
        type: detail.type,
        handle: detail.handle,
        phase: 'start',
        pointerId: activePointerId,
        pointerEvent: event,
      });
    });

    target.addEventListener('pointermove', (event: PointerEvent) => {
      const pointerId = resolvePointerId(event);
      if (activePointerId === undefined || pointerId !== activePointerId) {
        return;
      }
      emitInteraction({
        type: detail.type,
        handle: detail.handle,
        phase: 'move',
        pointerId,
        pointerEvent: event,
      });
    });

    const endInteraction = (event: PointerEvent) => {
      const pointerId = resolvePointerId(event);
      if (activePointerId === undefined || pointerId !== activePointerId) {
        return;
      }
      activePointerId = undefined;
      emitInteraction({
        type: detail.type,
        handle: detail.handle,
        phase: 'end',
        pointerId,
        pointerEvent: event,
      });
    };

    target.addEventListener('pointerup', endInteraction);
    target.addEventListener('pointercancel', endInteraction);
  }

  attachPointerGesture(caption, { type: 'move' });

  resizeHandles.forEach(({ handle, className }) => {
    const handleElement = document.createElement('div');
    handleElement.className = `window-resize-handle ${className}`;
    handleElement.dataset.handle = handle;
    element.appendChild(handleElement);
    attachPointerGesture(handleElement, { type: 'resize', handle });
  });

  return {
    element,
    content: body,
    setInteractionHandler(handler) {
      interactionHandler = handler;
    },
  };
}

function resolveIcon(icon?: string): string {
  if (!icon) {
    return DEFAULT_WINDOW_ICON;
  }
  if (icon.startsWith('assets/')) {
    return icon;
  }
  if (icon.startsWith('/')) {
    return `assets${icon}`;
  }
  return `assets/${icon}`;
}
