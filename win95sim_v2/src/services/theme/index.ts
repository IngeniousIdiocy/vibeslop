import { createEventBus, EventBus } from '@core/kernel/eventBus';
import type { SettingsService } from '@services/settings';
import classicTheme from '../../styles/themes/classic.json';
import highContrastTheme from '../../styles/themes/highContrast.json';

export interface ThemeDefinitionMetadata {
  highContrast?: boolean;
}

export interface ThemeDefinition {
  id: string;
  label: string;
  tokens: Record<string, string>;
  metadata?: ThemeDefinitionMetadata;
}

export interface ThemeChangeEvent {
  theme: ThemeDefinition;
  previous?: ThemeDefinition;
  reducedMotion: boolean;
}

export interface ThemeServiceOptions {
  themes?: ThemeDefinition[];
  settings?: SettingsService;
  host?: ThemeHost;
  bus?: EventBus;
  initialThemeId?: string;
  reducedMotion?: boolean;
}

export interface ThemeHostContext {
  reducedMotion: boolean;
}

export interface ThemeHost {
  apply(theme: ThemeDefinition, tokens: Record<string, string>, context: ThemeHostContext): void;
}

export interface ThemeService {
  listThemes(): ThemeDefinition[];
  getTheme(id: string): ThemeDefinition | undefined;
  getActiveTheme(): ThemeDefinition;
  applyTheme(id: string): ThemeDefinition;
  onThemeChanged(handler: (event: ThemeChangeEvent) => void): () => void;
  getToken(name: string): string | undefined;
  getTokens(): Record<string, string>;
  registerTheme(theme: ThemeDefinition): void;
  setReducedMotionEnabled(enabled: boolean): void;
  isReducedMotionEnabled(): boolean;
}

const builtinThemes: ThemeDefinition[] = [classicTheme, highContrastTheme];

type DocumentLike = {
  documentElement?: {
    style?: Record<string, string>;
    dataset?: Record<string, string>;
    toggleAttribute?: (name: string, force?: boolean) => void;
  };
  body?: {
    style?: Record<string, string>;
    dataset?: Record<string, string>;
    toggleAttribute?: (name: string, force?: boolean) => void;
  };
};

export function createCssVariableThemeHost(
  doc: DocumentLike | undefined = typeof document !== 'undefined' ? (document as DocumentLike) : undefined,
): ThemeHost {
  return {
    apply(theme, tokens, context) {
      if (!doc) {
        return;
      }

      const root = (doc.documentElement ?? doc.body) as
        | {
            style?: Record<string, string>;
            dataset?: Record<string, string>;
            toggleAttribute?: (name: string, force?: boolean) => void;
          }
        | undefined;

      if (!root) {
        return;
      }

      if (typeof root.toggleAttribute === 'function') {
        root.toggleAttribute('data-reduced-motion', context.reducedMotion);
      } else if (root.dataset) {
        if (context.reducedMotion) {
          root.dataset.reducedMotion = 'true';
        } else {
          delete root.dataset.reducedMotion;
        }
      }

      if (root.dataset) {
        root.dataset.theme = theme.id;
        if (theme.metadata?.highContrast) {
          root.dataset.themeContrast = 'high';
        } else {
          delete root.dataset.themeContrast;
        }
      }

      const style = root.style ?? (root.style = {} as Record<string, string>);
      Object.entries(tokens).forEach(([name, value]) => {
        style[name] = value;
      });
    },
  };
}

export function createThemeService(options: ThemeServiceOptions = {}): ThemeService {
  const themes = new Map<string, ThemeDefinition>();
  const order: string[] = [];

  const host = options.host ?? createCssVariableThemeHost();
  const bus = options.bus ?? createEventBus();
  const settings = options.settings;

  const providedThemes = options.themes ?? builtinThemes;
  providedThemes.forEach((theme) => register(theme));

  if (themes.size === 0) {
    throw new Error('At least one theme must be registered');
  }

  let reducedMotion = Boolean(options.reducedMotion);
  let activeTheme = resolveInitialTheme();
  let activeTokens = computeTokens(activeTheme, reducedMotion);

  host.apply(activeTheme, activeTokens, { reducedMotion });

  if (settings) {
    settings.watch('theme', (event) => {
      if (typeof event.value !== 'string') {
        return;
      }
      if (!themes.has(event.value) || event.value === activeTheme.id) {
        return;
      }
      applyThemeInternal(event.value, { skipSettings: true });
    });
  }

  function register(theme: ThemeDefinition) {
    if (themes.has(theme.id)) {
      throw new Error(`Theme with id "${theme.id}" is already registered`);
    }
    const frozen = {
      ...theme,
      tokens: { ...theme.tokens },
      metadata: theme.metadata ? { ...theme.metadata } : undefined,
    };
    themes.set(frozen.id, frozen);
    order.push(frozen.id);
  }

  function resolveInitialTheme() {
    if (options.initialThemeId && themes.has(options.initialThemeId)) {
      return themes.get(options.initialThemeId)!;
    }

    if (settings) {
      const configured = settings.get('theme');
      if (typeof configured === 'string' && themes.has(configured)) {
        return themes.get(configured)!;
      }
    }

    const first = themes.get(order[0]);
    if (!first) {
      throw new Error('Unable to determine initial theme');
    }
    return first;
  }

  function computeTokens(theme: ThemeDefinition, reduced: boolean) {
    const tokens = { ...theme.tokens };
    if (reduced) {
      Object.keys(tokens).forEach((key) => {
        if (key.startsWith('--motion-duration-')) {
          tokens[key] = '0ms';
        }
      });
    }
    return tokens;
  }

  interface ApplyOptions {
    skipSettings?: boolean;
    emit?: boolean;
  }

  function applyThemeInternal(id: string, applyOptions: ApplyOptions = {}) {
    const nextTheme = themes.get(id);
    if (!nextTheme) {
      throw new Error(`Theme "${id}" is not registered`);
    }
    if (nextTheme.id === activeTheme.id && applyOptions.emit !== true) {
      return nextTheme;
    }

    const previous = activeTheme;
    activeTheme = nextTheme;
    activeTokens = computeTokens(activeTheme, reducedMotion);
    host.apply(activeTheme, activeTokens, { reducedMotion });

    if (!applyOptions.skipSettings && settings && settings.get('theme') !== id) {
      settings.set('theme', id);
    }

    const shouldEmit = applyOptions.emit ?? (previous.id !== activeTheme.id || reducedMotion);
    if (shouldEmit) {
      bus.emit<ThemeChangeEvent>('theme:changed', {
        theme: activeTheme,
        previous,
        reducedMotion,
      });
    }

    return nextTheme;
  }

  function listThemes() {
    return order.map((id) => themes.get(id)!);
  }

  function getTokens() {
    return { ...activeTokens };
  }

  return {
    listThemes,
    getTheme(id) {
      return themes.get(id);
    },
    getActiveTheme() {
      return activeTheme;
    },
    applyTheme(id) {
      return applyThemeInternal(id);
    },
    onThemeChanged(handler) {
      return bus.on('theme:changed', handler);
    },
    getToken(name) {
      return activeTokens[name];
    },
    getTokens,
    registerTheme(theme) {
      register(theme);
      bus.emit('theme:registered', { theme });
    },
    setReducedMotionEnabled(enabled) {
      if (reducedMotion === enabled) {
        return;
      }
      reducedMotion = enabled;
      activeTokens = computeTokens(activeTheme, reducedMotion);
      host.apply(activeTheme, activeTokens, { reducedMotion });
      bus.emit<ThemeChangeEvent>('theme:changed', {
        theme: activeTheme,
        previous: activeTheme,
        reducedMotion,
      });
    },
    isReducedMotionEnabled() {
      return reducedMotion;
    },
  };
}
