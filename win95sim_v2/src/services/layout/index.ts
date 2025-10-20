import { createEventBus, EventBus } from '@core/kernel/eventBus';

export interface LayoutPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface LayoutSnapshot {
  surfaceId: string;
  items: Record<string, LayoutPosition>;
  gridSize?: number;
}

export interface LayoutAdapter {
  load(surfaceId: string): LayoutSnapshot | undefined;
  save(surfaceId: string, snapshot: LayoutSnapshot): void;
}

export interface LayoutEvent {
  surfaceId: string;
  snapshot: LayoutSnapshot;
}

export interface LayoutService {
  bus: EventBus;
  getSnapshot(surfaceId: string): LayoutSnapshot;
  setItem(surfaceId: string, itemId: string, position: LayoutPosition, options?: LayoutUpdateOptions): LayoutSnapshot;
  removeItem(surfaceId: string, itemId: string): LayoutSnapshot;
  clear(surfaceId: string): LayoutSnapshot;
  setGridSize(surfaceId: string, size: number): void;
}

export interface LayoutUpdateOptions {
  snapToGrid?: boolean;
}

interface SurfaceState {
  gridSize: number;
  items: Map<string, LayoutPosition>;
}

export interface LayoutServiceOptions {
  adapter?: LayoutAdapter;
  defaultGridSize?: number;
}

const DEFAULT_GRID_SIZE = 24;

function snap(position: LayoutPosition, gridSize: number): LayoutPosition {
  const round = (value: number) => Math.round(value / gridSize) * gridSize;
  return {
    ...position,
    x: round(position.x),
    y: round(position.y),
    width: position.width !== undefined ? round(position.width) : position.width,
    height: position.height !== undefined ? round(position.height) : position.height,
  };
}

function clone(items: Map<string, LayoutPosition>): Record<string, LayoutPosition> {
  const snapshot: Record<string, LayoutPosition> = {};
  for (const [id, position] of items) {
    snapshot[id] = { ...position };
  }
  return snapshot;
}

export function createLayoutService(options: LayoutServiceOptions = {}): LayoutService {
  const adapter = options.adapter;
  const defaultGrid = options.defaultGridSize ?? DEFAULT_GRID_SIZE;
  const surfaces = new Map<string, SurfaceState>();
  const bus = createEventBus();

  function ensureSurface(surfaceId: string): SurfaceState {
    let surface = surfaces.get(surfaceId);
    if (surface) {
      return surface;
    }

    const initial = adapter?.load(surfaceId);
    surface = {
      gridSize: initial?.gridSize ?? defaultGrid,
      items: new Map<string, LayoutPosition>(),
    };

    if (initial) {
      for (const [id, position] of Object.entries(initial.items)) {
        if (id === '__gridSize') {
          continue;
        }
        surface.items.set(id, { ...position });
      }
    }

    surfaces.set(surfaceId, surface);
    return surface;
  }

  function emit(surfaceId: string): LayoutSnapshot {
    const surface = ensureSurface(surfaceId);
    const snapshot: LayoutSnapshot = {
      surfaceId,
      items: clone(surface.items),
      gridSize: surface.gridSize,
    };
    if (adapter) {
      adapter.save(surfaceId, snapshot);
    }
    bus.emit<LayoutEvent>('layout:updated', { surfaceId, snapshot });
    return snapshot;
  }

  return {
    bus,
    getSnapshot(surfaceId) {
      const surface = ensureSurface(surfaceId);
      return {
        surfaceId,
        items: clone(surface.items),
        gridSize: surface.gridSize,
      };
    },
    setItem(surfaceId, itemId, position, options = {}) {
      const surface = ensureSurface(surfaceId);
      const shouldSnap = options.snapToGrid ?? true;
      const next = shouldSnap ? snap(position, surface.gridSize) : { ...position };
      surface.items.set(itemId, next);
      return emit(surfaceId);
    },
    removeItem(surfaceId, itemId) {
      const surface = ensureSurface(surfaceId);
      surface.items.delete(itemId);
      return emit(surfaceId);
    },
    clear(surfaceId) {
      const surface = ensureSurface(surfaceId);
      surface.items.clear();
      return emit(surfaceId);
    },
    setGridSize(surfaceId, size) {
      const surface = ensureSurface(surfaceId);
      surface.gridSize = size;
      emit(surfaceId);
    },
  };
}
