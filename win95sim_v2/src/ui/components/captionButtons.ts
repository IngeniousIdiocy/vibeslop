export interface CaptionButtonOptions {
  onMinimize?(): void;
  onMaximize?(): void;
  onClose?(): void;
}

export function createCaptionButtons(options: CaptionButtonOptions = {}) {
  const container = document.createElement('div');
  container.className = 'window-caption__buttons';

  const buttonConfig: Array<{ label: string; className: string; handler?: () => void }> = [
    { label: '_', className: 'window-caption__button window-caption__button--minimize', handler: options.onMinimize },
    { label: '□', className: 'window-caption__button window-caption__button--maximize', handler: options.onMaximize },
    { label: '✕', className: 'window-caption__button window-caption__button--close', handler: options.onClose },
  ];

  buttonConfig.forEach(({ label, className, handler }) => {
    const button = document.createElement('button');
    button.className = className;
    button.type = 'button';
    button.textContent = label;
    if (handler) {
      button.addEventListener('click', handler);
    }
    container.appendChild(button);
  });

  return container;
}
