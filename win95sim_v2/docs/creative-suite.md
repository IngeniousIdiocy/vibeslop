# Creative Suite Shared Assets

Phase 06 introduces foundational utilities that future creative and media-focused apps can reuse without coupling to their UI layers.

## Graphics utilities
- **`@services/graphics/bitmap`** exposes helpers for working with in-memory bitmaps. It normalises colour input, bounds checks pixel writes, and provides cloning/export helpers to support undo/redo workflows.
- The paint engine stores history snapshots as immutable bitmap clones so other tooling (e.g. thumbnail generation) can operate on snapshots without affecting the live canvas state.

## Paint engine contract
- **`@apps/creative/paint/engine`** delivers a headless drawing engine with commands for strokes, pixel placement, and region filling. The engine maintains an undo/redo stack capped by a configurable history limit and yields read-only exports that higher layers can serialise or render.
- Strokes use a Bresenham-based rasteriser and configurable brush size, allowing additional tool implementations (airbrush, shapes) to be layered on top without modifying the core engine.

## Media services
- **`@services/media/paletteStore`** provides an async palette loader with in-flight request coalescing and an LRU cache. Media Player, Paint, and other creative apps can depend on the store to retrieve colour palettes or theme manifests without duplicating caching logic.
- Palettes are frozen before caching so consumers cannot accidentally mutate shared data when tweaking UI themes at runtime.

These shared utilities keep Phase 06 self-contained while enabling later phases (e.g., asset viewers or multimedia editors) to build upon stable contracts.
