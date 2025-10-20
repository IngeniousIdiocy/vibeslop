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
}

export function createWindowFrame(options: WindowFrameOptions): WindowFrame {
  const element = document.createElement('div');
  element.className = 'window-frame';
  element.dataset.state = 'normal';

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

  return {
    element,
    content: body,
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
