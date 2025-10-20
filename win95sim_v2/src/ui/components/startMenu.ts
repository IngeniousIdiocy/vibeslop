import type { StartMenuManifestItem, StartMenuManifestSection } from '@apps/shell/start-menu';

export interface StartMenuViewOptions {
  onCommand(command: string): void;
}

export interface StartMenuView {
  element: HTMLElement;
  render(sections: StartMenuManifestSection[]): void;
  setOpen(open: boolean): void;
}

const BRANDING_ICON = 'assets/icons/w98_windows.ico';
const DEFAULT_ICON = 'assets/icons/w2k_programs.ico';

function resolveIcon(icon?: string): string {
  if (!icon) {
    return DEFAULT_ICON;
  }
  if (icon.startsWith('assets/')) {
    return icon;
  }
  if (icon.startsWith('/')) {
    return `assets${icon}`;
  }
  return `assets/${icon}`;
}

export function createStartMenuView(options: StartMenuViewOptions): StartMenuView {
  const element = document.createElement('div');
  element.className = 'start-menu';
  element.hidden = true;
  element.style.display = 'none';

  const branding = document.createElement('div');
  branding.className = 'start-menu__branding';

  const brandingLogo = document.createElement('img');
  brandingLogo.className = 'start-menu__branding-logo';
  brandingLogo.src = BRANDING_ICON;
  brandingLogo.alt = '';

  const brandingLabel = document.createElement('span');
  brandingLabel.className = 'start-menu__branding-label';
  brandingLabel.textContent = 'Windows 95';

  branding.appendChild(brandingLogo);
  branding.appendChild(brandingLabel);

  const content = document.createElement('div');
  content.className = 'start-menu__content';

  element.appendChild(branding);
  element.appendChild(content);

  function render(sections: StartMenuManifestSection[]) {
    content.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'start-menu__list';
    const visibleSections = sections.filter((section) => (section.items?.length ?? 0) > 0 || section.command);
    visibleSections.forEach((section, index) => {
      const childItems = section.items ?? [];
      const asItem: StartMenuManifestItem = {
        id: section.id,
        label: section.label,
        icon: section.icon,
        command: section.command,
      };
      if (childItems.length) {
        asItem.items = childItems;
      }
      list.appendChild(createMenuItem(asItem, 0));
      if (index < visibleSections.length - 1) {
        list.appendChild(createSeparator());
      }
    });
    if (visibleSections.length) {
      content.appendChild(list);
    }
  }

  function createMenuItem(item: StartMenuManifestItem, depth: number): HTMLElement {
    const entry = document.createElement('div');
    entry.className = 'start-menu__item';
    entry.dataset.depth = String(depth);
    entry.tabIndex = 0;

    const icon = document.createElement('img');
    icon.className = 'start-menu__icon';
    icon.src = resolveIcon(item.icon);
    icon.alt = '';
    entry.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'start-menu__label';
    label.textContent = item.label;
    entry.appendChild(label);

    if (item.items && item.items.length) {
      entry.dataset.hasSubmenu = 'true';
      const arrow = document.createElement('span');
      arrow.className = 'start-menu__arrow';
      arrow.textContent = '\u25B6';
      entry.appendChild(arrow);

      const submenu = document.createElement('div');
      submenu.className = 'start-menu__submenu';
      item.items.forEach((child) => submenu.appendChild(createMenuItem(child, depth + 1)));
      entry.appendChild(submenu);

      const open = () => submenu.classList.add('start-menu__submenu--open');
      const close = () => submenu.classList.remove('start-menu__submenu--open');
      entry.addEventListener('mouseenter', open);
      entry.addEventListener('mouseleave', close);
      entry.addEventListener('focus', open);
      entry.addEventListener('blur', close);
    } else if (item.command) {
      entry.addEventListener('click', () => options.onCommand(item.command!));
      entry.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          options.onCommand(item.command!);
        }
      });
    } else {
      entry.classList.add('start-menu__item--disabled');
    }

    return entry;
  }

  function setOpen(open: boolean) {
    element.hidden = !open;
    element.style.display = open ? 'flex' : 'none';
  }

  function createSeparator(): HTMLElement {
    const separator = document.createElement('div');
    separator.className = 'start-menu__separator';
    separator.setAttribute('role', 'separator');
    separator.tabIndex = -1;
    return separator;
  }

  return {
    element,
    render,
    setOpen,
  };
}
