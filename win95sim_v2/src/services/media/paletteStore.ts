export interface PaletteSwatch {
  id: string;
  color: [number, number, number];
  label?: string;
}

export interface Palette {
  id: string;
  swatches: PaletteSwatch[];
  metadata?: Record<string, unknown>;
}

export type PaletteLoader = (id: string) => Promise<Palette>;

export interface PaletteStoreOptions {
  loader: PaletteLoader;
  cacheLimit?: number;
}

export interface PaletteStore {
  load(id: string): Promise<Palette>;
  getCached(id: string): Palette | undefined;
  preload(id: string): Promise<Palette>;
  put(palette: Palette): void;
  clear(id?: string): void;
  list(): string[];
}

interface InflightRequest {
  promise: Promise<Palette>;
  startedAt: number;
}

export function createPaletteStore(options: PaletteStoreOptions): PaletteStore {
  const { loader } = options;
  const cacheLimit = Math.max(1, options.cacheLimit ?? 12);
  const cache = new Map<string, Palette>();
  const inflight = new Map<string, InflightRequest>();

  function remember(id: string, palette: Palette) {
    if (cache.has(id)) {
      cache.delete(id);
    }
    cache.set(id, freezePalette(palette));
    while (cache.size > cacheLimit) {
      const [oldest] = cache.keys();
      cache.delete(oldest);
    }
  }

  async function resolve(id: string): Promise<Palette> {
    const existing = cache.get(id);
    if (existing) {
      return existing;
    }

    const pending = inflight.get(id);
    if (pending) {
      return pending.promise;
    }

    const promise = loader(id)
      .then((palette) => {
        remember(id, palette);
        inflight.delete(id);
        return cache.get(id)!;
      })
      .catch((error) => {
        inflight.delete(id);
        throw error;
      });

    inflight.set(id, { promise, startedAt: Date.now() });
    return promise;
  }

  return {
    load(id) {
      return resolve(id);
    },
    preload(id) {
      return resolve(id);
    },
    getCached(id) {
      return cache.get(id);
    },
    put(palette) {
      remember(palette.id, palette);
    },
    clear(id) {
      if (id) {
        cache.delete(id);
        inflight.delete(id);
        return;
      }

      cache.clear();
      inflight.clear();
    },
    list() {
      return Array.from(cache.keys());
    },
  };
}

function freezePalette(palette: Palette): Palette {
  const frozenSwatches = palette.swatches.map((swatch) => Object.freeze({ ...swatch }));
  return Object.freeze({
    ...palette,
    swatches: frozenSwatches,
  });
}
