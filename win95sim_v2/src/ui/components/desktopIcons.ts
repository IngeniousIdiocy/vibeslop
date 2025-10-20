import type { DesktopIcon } from '@apps/shell/desktop';

export interface DesktopViewOptions {
  onOpen?(id: string): void;
  onSelect?(id: string, additive: boolean): void;
  onClearSelection?(): void;
}

export interface DesktopView {
  element: HTMLElement;
  render(icons: DesktopIcon[]): void;
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

      icon.addEventListener('click', (event) => {
        event.stopPropagation();
        const additive = event.ctrlKey || event.metaKey;
        options.onSelect?.(iconData.id, additive);
      });

      icon.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onOpen?.(iconData.id);
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
