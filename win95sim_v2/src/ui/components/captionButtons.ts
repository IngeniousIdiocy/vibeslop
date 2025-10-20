export interface CaptionButtonOptions {
  onMinimize?(): void;
  onMaximize?(): void;
  onClose?(): void;
}

export function createCaptionButtons(options: CaptionButtonOptions = {}) {
  const container = document.createElement('div');
  container.className = 'window-caption__buttons';

  const buttonConfig: Array<{ label: string; className: string; handler?: () => void; ariaLabel: string }> = [
    {
      label: '_',
      className: 'window-caption__button window-caption__button--minimize',
      handler: options.onMinimize,
      ariaLabel: 'Minimize',
    },
    {
      label: '\u25A1',
      className: 'window-caption__button window-caption__button--maximize',
      handler: options.onMaximize,
      ariaLabel: 'Maximize',
    },
    {
      label: '\u00D7',
      className: 'window-caption__button window-caption__button--close',
      handler: options.onClose,
      ariaLabel: 'Close',
    },
  ];

  buttonConfig.forEach(({ label, className, handler, ariaLabel }) => {
    const button = document.createElement('button');
    button.className = className;
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-label', ariaLabel);
    if (handler) {
      button.addEventListener('click', handler);
    }
    container.appendChild(button);
  });

  return container;
}
