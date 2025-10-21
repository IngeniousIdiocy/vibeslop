import { createNavigatorSession } from './state/session';
import type { SettingsService } from '@services/settings';
import { createIframePolicy, type IframePolicyOptions } from '@services/network/iframe-policy';

export interface NavigatorAppOptions {
  settings: SettingsService;
  homeUrl?: string;
  iframePolicyOptions?: IframePolicyOptions;
}

export interface NavigatorAppInstance {
  mount(host: HTMLElement): void;
  destroy(): void;
  navigate(url: string): void;
}

type ThrobberState = 'idle' | 'loading';

const DEFAULT_HOME_URL = 'https://www.example.com/';
const THROBBER_IDLE = 'icons/w98_msie1.ico';
const THROBBER_BUSY = 'icons/w98_msie2.ico';

interface ToolbarButtonConfig {
  icon: string;
  title: string;
  action?: () => void;
  trackDisabled?: 'back' | 'forward' | 'reload';
}

function normalizeUrl(input: string, fallback: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return fallback;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function createNavigatorApp(options: NavigatorAppOptions): NavigatorAppInstance {
  const homeUrl = options.homeUrl ?? DEFAULT_HOME_URL;
  const session = createNavigatorSession({
    settings: options.settings,
    homeUrl,
  });

  const mergedPolicyOptions: IframePolicyOptions = {
    ...(options.iframePolicyOptions ?? {}),
  };
  if (typeof mergedPolicyOptions.allowScripts === 'undefined') {
    mergedPolicyOptions.allowScripts = true;
  }
  if (!mergedPolicyOptions.allowedProtocols) {
    mergedPolicyOptions.allowedProtocols = ['http', 'https', 'data'];
  }
  const iframePolicy = createIframePolicy(mergedPolicyOptions);

  let container: HTMLElement | null = null;
  let hostElement: HTMLElement | null = null;
  let addressInput: HTMLInputElement | null = null;
  let addressDropdown: HTMLButtonElement | null = null;
  let backButton: HTMLButtonElement | null = null;
  let forwardButton: HTMLButtonElement | null = null;
  let reloadButton: HTMLButtonElement | null = null;
  let homeButton: HTMLButtonElement | null = null;
  let throbberImage: HTMLImageElement | null = null;
  let statusText: HTMLElement | null = null;
  let frame: HTMLIFrameElement | null = null;

  const busUnsubscribes: Array<() => void> = [];
  const domTeardowns: Array<() => void> = [];

  function addClassName(element: HTMLElement | null, token: string) {
    if (!element) {
      return;
    }
    const classes = new Set((element.className ?? '').split(/\s+/).filter(Boolean));
    if (!classes.has(token)) {
      classes.add(token);
      element.className = Array.from(classes).join(' ');
    }
  }

  function removeClassName(element: HTMLElement | null, token: string) {
    if (!element) {
      return;
    }
    const classes = new Set((element.className ?? '').split(/\s+/).filter(Boolean));
    classes.delete(token);
    element.className = Array.from(classes).join(' ');
  }

  function resolveIconPath(path: string): string {
    if (!path) {
      return '';
    }
    if (path.startsWith('assets/')) {
      return path;
    }
    if (path.startsWith('/')) {
      return `assets${path}`;
    }
    return `assets/${path}`;
  }

  function setStatus(text: string) {
    if (statusText) {
      statusText.textContent = text;
    }
  }

  function setThrobberState(state: ThrobberState) {
    if (!throbberImage) {
      return;
    }
    const nextSrc = state === 'loading' ? THROBBER_BUSY : THROBBER_IDLE;
    const resolved = resolveIconPath(nextSrc);
    if (throbberImage.getAttribute('src') !== resolved) {
      throbberImage.setAttribute('src', resolved);
    }
  }

  function updateButtons() {
    const active = session.getActiveTab();
    const canGoBack = active.historyIndex > 0;
    const canGoForward = active.historyIndex < active.history.length - 1;

    if (backButton) {
      backButton.disabled = !canGoBack;
    }
    if (forwardButton) {
      forwardButton.disabled = !canGoForward;
    }
    if (reloadButton) {
      reloadButton.disabled = !active.url;
    }
    if (homeButton) {
      homeButton.disabled = false;
    }
  }

  function applyFrameAttributes(url: string, force = false) {
    if (!frame) {
      return;
    }

    const allowed = iframePolicy.isUrlAllowed(url);
    const attributes = iframePolicy.buildAttributes(url);

    if (force) {
      frame.src = 'about:blank';
    }

    const currentSrc = frame.getAttribute('src');
    if (force || currentSrc !== attributes.src) {
      frame.setAttribute('src', attributes.src);
    }
    frame.setAttribute('sandbox', attributes.sandbox);
    frame.setAttribute('referrerpolicy', attributes.referrerpolicy);

    if (!allowed) {
      setStatus('Navigation blocked by security policy.');
      setThrobberState('idle');
    }
  }

  function updateAddressField(url: string) {
    if (!addressInput) {
      return;
    }
    if (typeof document !== 'undefined' && document.activeElement === addressInput) {
      return;
    }
    addressInput.value = url;
  }

  function updateUiState(forceFrameReload = false) {
    const active = session.getActiveTab();
    updateButtons();
    updateAddressField(active.url);
    applyFrameAttributes(active.url, forceFrameReload);
    if (iframePolicy.isUrlAllowed(active.url)) {
      if (!active.url) {
        setStatus('Ready');
      }
    }
  }

  function bindDom(target: EventTarget, type: string, handler: (event: Event) => void) {
    target.addEventListener(type, handler as EventListener);
    domTeardowns.push(() => target.removeEventListener(type, handler as EventListener));
  }

  function navigateTo(raw: string) {
    const target = normalizeUrl(raw, homeUrl);
    setStatus(`Opening ${target}`);
    setThrobberState('loading');
    session.navigate(target);
  }

  function goHome() {
    setStatus(`Opening ${homeUrl}`);
    setThrobberState('loading');
    session.navigate(homeUrl);
  }

  function goBack() {
    const result = session.goBack();
    if (!result) {
      setStatus('No previous page');
      setThrobberState('idle');
      return;
    }
    setStatus(`Opening ${result.url}`);
    setThrobberState('loading');
  }

  function goForward() {
    const result = session.goForward();
    if (!result) {
      setStatus('No forward page');
      setThrobberState('idle');
      return;
    }
    setStatus(`Opening ${result.url}`);
    setThrobberState('loading');
  }

  function reload() {
    const active = session.getActiveTab();
    if (!active.url) {
      return;
    }
    setStatus(`Refreshing ${active.url}`);
    setThrobberState('loading');
    updateUiState(true);
  }

  function featurePlaceholder(feature: string) {
    setStatus(`${feature} is not available in this preview.`);
  }

  function createToolbarButton(config: ToolbarButtonConfig): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-navigator__toolbar-button';
    button.title = config.title;

    const icon = document.createElement('img');
    icon.src = resolveIconPath(config.icon);
    icon.alt = '';
    icon.className = 'app-navigator__toolbar-icon';
    button.appendChild(icon);

    if (config.action) {
      bindDom(button, 'click', (event) => {
        event.preventDefault();
        config.action?.();
      });
    } else {
      button.disabled = true;
    }

    switch (config.trackDisabled) {
      case 'back':
        backButton = button;
        break;
      case 'forward':
        forwardButton = button;
        break;
      case 'reload':
        reloadButton = button;
        break;
      default:
        break;
    }

    return button;
  }

  function mount(host: HTMLElement) {
    if (container) {
      destroy();
    }

    hostElement = host;
    addClassName(hostElement, 'app-navigator__host');

    container = document.createElement('div');
    container.className = 'app-navigator';

    const menuBar = document.createElement('div');
    menuBar.className = 'app-navigator__menubar';
    ['File', 'Edit', 'View', 'Favorites', 'Help'].forEach((label) => {
      const menuButton = document.createElement('button');
      menuButton.type = 'button';
      menuButton.className = 'app-navigator__menu-item';
      menuButton.textContent = label;
      bindDom(menuButton, 'click', () => featurePlaceholder(`${label} menu`));
      menuBar.appendChild(menuButton);
    });
    container.appendChild(menuBar);

    const toolbarRow = document.createElement('div');
    toolbarRow.className = 'app-navigator__toolbar';

    const navigationGroup = document.createElement('div');
    navigationGroup.className = 'app-navigator__toolbar-group';
    navigationGroup.appendChild(
      createToolbarButton({
        icon: 'icons/w98_history.ico',
        title: 'Back',
        action: () => goBack(),
        trackDisabled: 'back',
      }),
    );
    navigationGroup.appendChild(
      createToolbarButton({
        icon: 'icons/w98_directory_open_history.ico',
        title: 'Forward',
        action: () => goForward(),
        trackDisabled: 'forward',
      }),
    );
    navigationGroup.appendChild(
      createToolbarButton({
        icon: 'icons/w2k_stop.ico',
        title: 'Stop',
        action: () => {
          if (frame) {
            frame.src = 'about:blank';
          }
          setStatus('Navigation stopped.');
          setThrobberState('idle');
        },
      }),
    );
    navigationGroup.appendChild(
      createToolbarButton({
        icon: 'icons/w98_overlay_refresh.ico',
        title: 'Refresh',
        action: () => reload(),
        trackDisabled: 'reload',
      }),
    );
    const homeNavigationButton = createToolbarButton({
      icon: 'icons/w98_homepage.ico',
      title: 'Home',
      action: () => goHome(),
    });
    navigationGroup.appendChild(homeNavigationButton);
    homeButton = homeNavigationButton;
    toolbarRow.appendChild(navigationGroup);

    const primarySeparator = document.createElement('div');
    primarySeparator.className = 'app-navigator__toolbar-separator';
    toolbarRow.appendChild(primarySeparator);

    const secondaryGroup = document.createElement('div');
    secondaryGroup.className = 'app-navigator__toolbar-group';
    secondaryGroup.appendChild(
      createToolbarButton({
        icon: 'icons/w2k_search.ico',
        title: 'Search',
        action: () => featurePlaceholder('Search'),
      }),
    );
    secondaryGroup.appendChild(
      createToolbarButton({
        icon: 'icons/w2k_favorites.ico',
        title: 'Favorites',
        action: () => featurePlaceholder('Favorites'),
      }),
    );
    secondaryGroup.appendChild(
      createToolbarButton({
        icon: 'icons/w98_mailbox_world.ico',
        title: 'Mail',
        action: () => featurePlaceholder('Mail'),
      }),
    );
    secondaryGroup.appendChild(
      createToolbarButton({
        icon: 'icons/w2k_printer.ico',
        title: 'Print',
        action: () => featurePlaceholder('Print'),
      }),
    );
    toolbarRow.appendChild(secondaryGroup);
    container.appendChild(toolbarRow);

    const addressRow = document.createElement('div');
    addressRow.className = 'app-navigator__address-row';

    const addressLabel = document.createElement('span');
    addressLabel.className = 'app-navigator__address-label';
    addressLabel.textContent = 'Address:';
    addressRow.appendChild(addressLabel);

    const addressWrapper = document.createElement('div');
    addressWrapper.className = 'app-navigator__address-wrapper';

    addressInput = document.createElement('input');
    addressInput.type = 'text';
    addressInput.className = 'app-navigator__address-input';
    addressInput.placeholder = 'Type an Internet address here';
    addressWrapper.appendChild(addressInput);

    addressDropdown = document.createElement('button');
    addressDropdown.type = 'button';
    addressDropdown.className = 'app-navigator__address-dropdown';
    addressDropdown.setAttribute('aria-label', 'Address history');
    addressDropdown.innerHTML = '&#9662;';
    bindDom(addressDropdown, 'click', () => featurePlaceholder('Address history'));
    addressWrapper.appendChild(addressDropdown);

    bindDom(addressInput, 'keydown', (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === 'Enter') {
        event.preventDefault();
        navigateTo(addressInput?.value ?? homeUrl);
      }
    });

    const goButton = document.createElement('button');
    goButton.type = 'button';
    goButton.className = 'app-navigator__toolbar-button app-navigator__toolbar-button--go';
    goButton.title = 'Go';
    goButton.textContent = 'Go';
    bindDom(goButton, 'click', () => navigateTo(addressInput?.value ?? homeUrl));

    addressWrapper.appendChild(goButton);
    addressRow.appendChild(addressWrapper);

    const throbber = document.createElement('div');
    throbber.className = 'app-navigator__throbber';
    throbberImage = document.createElement('img');
    throbberImage.className = 'app-navigator__throbber-image';
    throbberImage.src = resolveIconPath(THROBBER_IDLE);
    throbberImage.alt = 'Activity indicator';
    throbber.appendChild(throbberImage);
    addressRow.appendChild(throbber);

    container.appendChild(addressRow);

    const content = document.createElement('div');
    content.className = 'app-navigator__content';

    const viewportFrame = document.createElement('div');
    viewportFrame.className = 'app-navigator__viewport';

    frame = document.createElement('iframe');
    frame.className = 'app-navigator__frame';
    frame.setAttribute('title', 'Web content');

    bindDom(frame, 'load', () => {
      const active = session.getActiveTab();
      const allowed = iframePolicy.isUrlAllowed(active.url);
      if (allowed) {
        setStatus(active.url ? `Done` : 'Ready');
      }
      setThrobberState('idle');
    });

    viewportFrame.appendChild(frame);
    content.appendChild(viewportFrame);
    container.appendChild(content);

    const statusBar = document.createElement('div');
    statusBar.className = 'app-navigator__status';

    statusText = document.createElement('div');
    statusText.className = 'app-navigator__status-text';
    statusText.textContent = 'Ready';
    statusBar.appendChild(statusText);

    const statusGrip = document.createElement('div');
    statusGrip.className = 'app-navigator__status-grip';
    statusBar.appendChild(statusGrip);

    container.appendChild(statusBar);
    host.appendChild(container);

    const toolbarButtons = [backButton, forwardButton, reloadButton];
    toolbarButtons.forEach((button) => {
      if (button) {
        button.className = `${button.className} app-navigator__toolbar-button--icon`.trim();
      }
    });

    busUnsubscribes.push(
      session.bus.on('navigator:navigated', () => {
        updateUiState(false);
      }),
    );
    busUnsubscribes.push(
      session.bus.on('navigator:mode-changed', () => {
        updateUiState(false);
      }),
    );

    updateUiState(true);
    setStatus('Ready');
    setThrobberState('idle');
  }

  function destroy() {
    domTeardowns.splice(0).forEach((dispose) => dispose());
    busUnsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());

    if (container && container.parentElement) {
      container.parentElement.removeChild(container);
    }

    if (hostElement) {
      removeClassName(hostElement, 'app-navigator__host');
    }

    container = null;
    hostElement = null;
    addressInput = null;
    addressDropdown = null;
    backButton = null;
    forwardButton = null;
    reloadButton = null;
    homeButton = null;
    throbberImage = null;
    statusText = null;
    frame = null;
  }

  return {
    mount,
    destroy,
    navigate(url: string) {
      navigateTo(url);
    },
  };
}
