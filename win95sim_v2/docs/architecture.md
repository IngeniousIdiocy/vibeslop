# Architecture Overview

Win95Sim V2 converts the legacy single-file simulator into a modular workspace that can scale across teams. The design prioritizes:
- **Separation of concerns** so features evolve independently.
- **Stable contracts** that keep downstream packages unblocked.
- **Deterministic builds** that ship a cohesive `dist/` bundle for the browser.

## Layered workspace
```
src/
├── core/            # Kernel primitives: scheduler, message bus, window composition
├── services/        # Shared data/service APIs (state, storage, i18n, telemetry)
├── features/        # Cross-cutting UI behaviors (taskbar, notifications, drag/drop)
├── apps/            # Individual Win95 experiences (Explorer, Notepad, Paint, etc.)
├── shell/           # Desktop shell, boot flow, session orchestration
└── ui/              # Design tokens, theming, layout primitives, reusable controls
```

- **Core** exposes the runtime foundation and owns the module registry (`createModuleRegistry`).
- **Services** provide injectable contracts consumed by features/apps. They can depend on `core/` but not vice versa.
- **Features** deliver composable experiences used by apps and the shell (e.g., window chrome, context menus).
- **Apps** implement Win95 programs using services + features.
- **Shell** bootstraps the desktop, orchestrates the taskbar/start menu, and hosts app windows.
- **UI** centralizes styling (CSS custom properties, mixins) and shared web components.

Ownership is assigned per phase. After Phase 01, each team can operate largely within its sub-tree:
- Phase 02 – `apps/explorer/`, `services/filesystem/`
- Phase 03 – `apps/command-shell/`, `services/processes/`
- Phase 04 – `apps/notepad/`, `features/dialogs/`
- Phase 05 – `apps/navigator/`, `services/networking/`
- Phase 06 – `apps/paint/`, `features/media/`
- Phase 07 – `apps/games/`
- Phase 08 – `apps/control-panel/`, `services/devices/`
- Phase 09 – Shared polish in `ui/`, `shell/`
- Phase 10 – `tools/`, release automation

## Build pipeline
Phase 01 introduces a Node-based build orchestrator under `tools/`:
1. **Type checking** (TS or JSDoc) against shared interfaces.
2. **Bundling** via Vite/Rollup configuration that emits:
   - `dist/index.html` bootstrapper loading modular scripts.
   - `dist/assets/` for lazy-loaded bundles, audio, imagery (kept small, documented in `docs/assets.md`).
3. **Testing** – `npm test` for unit suites, `npm run test:e2e` for Playwright once configured.
4. **Distribution** – `npm run package` zips the `dist/` folder and generates hashes for release notes.

Build steps enforce dependency boundaries using lint rules (e.g., `eslint-plugin-boundaries`) configured in Phase 01.

## Module registry & loading
- Modules register via `createModuleRegistry({ id, factory, exports })`.
- Each package exposes a manifest (`module.json`) consumed by the build step to assemble dependency graphs.
- Runtime loading uses dynamic `import()` with chunk prefetch hints to keep the boot path fast.

## State management
- Core provides an event-driven state store similar to Redux but optimized for message-bus broadcasting.
- Services expose domain-specific controllers (filesystem, process manager) with typed events.
- UI state that crosses apps (e.g., focused window) flows through the `shell/session` service to avoid duplication.

## Concurrency safeguards
- Shared contracts live in `core/` and `services/`. Updates require RFC approval captured in `planning/phase-01-window-manager.md`.
- Phases own their directories and can deliver features independently after Phase 01.
- Code owners configure Git to require approvals when touching another team's folder (documented in the Phase 01 plan).

## Extension & compatibility
- Preserve parity with Win95Sim v1 by keeping exported shell APIs (window manager, taskbar API) compatible. Mapping tables live in `docs/module-apis-v2.md`.
- Provide migration helpers so existing automation scripts can bind to the new module IDs.

## Future considerations
- Investigate WebAssembly modules for CPU-intensive features (e.g., audio mixing) once the modular pipeline is stable.
- Explore optional service workers for offline caching in Phase 09.
