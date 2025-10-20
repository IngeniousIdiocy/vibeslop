import { createCaptionButtons, CaptionButtonOptions } from './captionButtons';

export interface WindowFrameOptions extends CaptionButtonOptions {
  title: string;
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
  const title = document.createElement('span');
  title.className = 'window-caption__title';
  title.textContent = options.title;
  caption.appendChild(title);

  const buttons = createCaptionButtons(options);
  caption.appendChild(buttons);

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
