import { createEventBus, EventBus } from '@core/kernel/eventBus';
import enUsCatalog from '../../assets/locales/en-US.json';
import esEsCatalog from '../../assets/locales/es-ES.json';

export interface LocaleCatalog {
  locale: string;
  direction?: 'ltr' | 'rtl';
  messages: Record<string, string>;
}

export type LocaleLoader = () => LocaleCatalog | Promise<LocaleCatalog>;

export interface LocalizationChangeEvent {
  locale: string;
  previous: string;
  catalog: LocaleCatalog;
}

export interface LocalizationServiceOptions {
  defaultLocale?: string;
  loaders?: Record<string, LocaleLoader>;
  bus?: EventBus;
}

export interface LocalizationService {
  getLocale(): string;
  listLocales(): string[];
  getDirection(): 'ltr' | 'rtl';
  translate(key: string, replacements?: Record<string, string>): string;
  setLocale(locale: string): Promise<LocaleCatalog>;
  onLocaleChanged(handler: (event: LocalizationChangeEvent) => void): () => void;
  preload(locale: string): Promise<LocaleCatalog>;
}

const builtinLoaders: Record<string, LocaleLoader> = {
  'en-US': () => enUsCatalog,
  'es-ES': () => esEsCatalog,
};

export function createLocalizationService(options: LocalizationServiceOptions = {}): LocalizationService {
  const defaultLocale = options.defaultLocale ?? 'en-US';
  const loaders: Record<string, LocaleLoader> = { ...builtinLoaders, ...(options.loaders ?? {}) };
  const bus = options.bus ?? createEventBus();

  if (!loaders[defaultLocale]) {
    throw new Error(`No loader registered for default locale "${defaultLocale}"`);
  }

  const catalogs = new Map<string, LocaleCatalog | Promise<LocaleCatalog>>();
  let activeLocale = defaultLocale;
  let activeCatalog = loadInitialCatalog(defaultLocale);

  function loadInitialCatalog(locale: string) {
    const loader = loaders[locale];
    if (!loader) {
      throw new Error(`No loader registered for locale "${locale}"`);
    }
    const result = loader();
    if (result instanceof Promise) {
      throw new Error('Default locale loader must return catalog synchronously');
    }
    catalogs.set(locale, result);
    return result;
  }

  function getResolvedCatalog(locale: string): LocaleCatalog | undefined {
    const value = catalogs.get(locale);
    if (!value || value instanceof Promise) {
      return undefined;
    }
    return value;
  }

  async function ensureCatalog(locale: string): Promise<LocaleCatalog> {
    const existing = catalogs.get(locale);
    if (existing) {
      if (existing instanceof Promise) {
        return existing;
      }
      return existing;
    }

    const loader = loaders[locale];
    if (!loader) {
      throw new Error(`No loader registered for locale "${locale}"`);
    }

    const pending = Promise.resolve(loader()).then((catalog) => {
      catalogs.set(locale, catalog);
      return catalog;
    });

    catalogs.set(locale, pending);
    return pending;
  }

  function format(template: string, replacements?: Record<string, string>) {
    if (!replacements) {
      return template;
    }
    return Object.keys(replacements).reduce((acc, key) => acc.replace(new RegExp(`{${key}}`, 'g'), replacements[key]), template);
  }

  function translate(key: string, replacements?: Record<string, string>) {
    const active = getResolvedCatalog(activeLocale);
    const fallback = getResolvedCatalog(defaultLocale);

    const message = active?.messages[key] ?? fallback?.messages[key];
    if (!message) {
      return key;
    }
    return format(message, replacements);
  }

  async function setLocale(locale: string): Promise<LocaleCatalog> {
    if (locale === activeLocale) {
      return activeCatalog;
    }

    const catalog = await ensureCatalog(locale);
    const previous = activeLocale;
    activeLocale = locale;
    activeCatalog = catalog;
    bus.emit<LocalizationChangeEvent>('localization:changed', {
      locale: activeLocale,
      previous,
      catalog,
    });
    return catalog;
  }

  async function preload(locale: string) {
    return ensureCatalog(locale);
  }

  function listLocales() {
    return Object.keys(loaders).sort();
  }

  function getDirection(): 'ltr' | 'rtl' {
    return activeCatalog.direction ?? 'ltr';
  }

  return {
    getLocale() {
      return activeLocale;
    },
    listLocales,
    getDirection,
    translate,
    setLocale,
    onLocaleChanged(handler) {
      return bus.on('localization:changed', handler);
    },
    preload,
  };
}
