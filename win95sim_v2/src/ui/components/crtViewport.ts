export interface CrtViewport {
  element: HTMLElement;
  setStatus(status: 'boot' | 'ready' | 'error'): void;
  mount(content: HTMLElement): void;
  clear(): void;
}

export function createCrtViewport(): CrtViewport {
  const element = document.createElement('div');
  element.className = 'crt-viewport';
  element.dataset.state = 'boot';

  const screen = document.createElement('div');
  screen.className = 'crt-viewport__screen';
  element.appendChild(screen);

  const bootMessage = document.createElement('div');
  bootMessage.className = 'crt-viewport__boot-message';
  bootMessage.textContent = 'Starting Windows 95…';
  screen.appendChild(bootMessage);

  return {
    element,
    setStatus(status) {
      element.dataset.state = status;
      if (status === 'ready') {
        bootMessage.remove();
      }
    },
    mount(content) {
      screen.appendChild(content);
    },
    clear() {
      screen.innerHTML = '';
    },
  };
}
