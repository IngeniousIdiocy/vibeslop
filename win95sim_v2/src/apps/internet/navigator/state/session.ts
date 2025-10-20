import { createEventBus, EventBus } from '@core/kernel/eventBus';
import { SettingsService } from '@services/settings';

export type NavigatorMode = 'iframe' | 'reader' | 'proxy';

export interface NavigatorTabState {
  id: string;
  url: string;
  mode: NavigatorMode;
  history: string[];
  historyIndex: number;
}

export interface NavigatorSessionSnapshot {
  activeTab: NavigatorTabState;
}

export interface NavigatorSessionOptions {
  settings: SettingsService;
  homeUrl?: string;
  storageKey?: string;
}

export interface NavigatorSession {
  getSnapshot(): NavigatorSessionSnapshot;
  getActiveTab(): NavigatorTabState;
  navigate(url: string): NavigatorTabState;
  goBack(): NavigatorTabState | undefined;
  goForward(): NavigatorTabState | undefined;
  setMode(mode: NavigatorMode): NavigatorTabState;
  bus: EventBus;
}

interface PersistedState {
  activeTab: NavigatorTabState;
}

const DEFAULT_HOME_URL = 'about:blank';
const DEFAULT_STORAGE_KEY = 'navigator.session';

function createInitialTab(homeUrl: string): NavigatorTabState {
  return {
    id: 'tab-1',
    url: homeUrl,
    mode: 'iframe',
    history: [homeUrl],
    historyIndex: 0,
  };
}

function cloneTab(tab: NavigatorTabState): NavigatorTabState {
  return {
    ...tab,
    history: [...tab.history],
  };
}

function restoreState(settings: SettingsService, storageKey: string, homeUrl: string): NavigatorTabState {
  const raw = settings.get(storageKey);
  if (typeof raw !== 'string') {
    return createInitialTab(homeUrl);
  }

  try {
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed && parsed.activeTab && parsed.activeTab.url) {
      const tab = parsed.activeTab;
      return {
        ...tab,
        history: Array.isArray(tab.history) && tab.history.length > 0 ? [...tab.history] : [tab.url],
        historyIndex: typeof tab.historyIndex === 'number' ? tab.historyIndex : tab.history.length - 1,
        mode: tab.mode ?? 'iframe',
        id: tab.id ?? 'tab-1',
      };
    }
  } catch (error) {
    // fall through to default state
  }

  return createInitialTab(homeUrl);
}

export function createNavigatorSession(options: NavigatorSessionOptions): NavigatorSession {
  const { settings } = options;
  const homeUrl = options.homeUrl ?? DEFAULT_HOME_URL;
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;

  const bus = createEventBus();
  let activeTab = restoreState(settings, storageKey, homeUrl);

  function persist() {
    const snapshot: PersistedState = {
      activeTab: cloneTab(activeTab),
    };
    settings.set(storageKey, JSON.stringify(snapshot));
  }

  function emit(type: string) {
    bus.emit(type, { snapshot: getSnapshot() });
  }

  function getSnapshot(): NavigatorSessionSnapshot {
    return {
      activeTab: cloneTab(activeTab),
    };
  }

  function navigate(url: string): NavigatorTabState {
    const nextHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
    nextHistory.push(url);

    activeTab = {
      ...activeTab,
      url,
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
    };

    persist();
    emit('navigator:navigated');
    return cloneTab(activeTab);
  }

  function goBack(): NavigatorTabState | undefined {
    if (activeTab.historyIndex === 0) {
      return undefined;
    }

    activeTab = {
      ...activeTab,
      historyIndex: activeTab.historyIndex - 1,
      url: activeTab.history[activeTab.historyIndex - 1],
    };

    persist();
    emit('navigator:navigated');
    return cloneTab(activeTab);
  }

  function goForward(): NavigatorTabState | undefined {
    if (activeTab.historyIndex >= activeTab.history.length - 1) {
      return undefined;
    }

    activeTab = {
      ...activeTab,
      historyIndex: activeTab.historyIndex + 1,
      url: activeTab.history[activeTab.historyIndex + 1],
    };

    persist();
    emit('navigator:navigated');
    return cloneTab(activeTab);
  }

  function setMode(mode: NavigatorMode): NavigatorTabState {
    if (activeTab.mode === mode) {
      return cloneTab(activeTab);
    }

    activeTab = {
      ...activeTab,
      mode,
    };

    persist();
    emit('navigator:mode-changed');
    return cloneTab(activeTab);
  }

  return {
    getSnapshot,
    getActiveTab() {
      return cloneTab(activeTab);
    },
    navigate,
    goBack,
    goForward,
    setMode,
    bus,
  };
}
