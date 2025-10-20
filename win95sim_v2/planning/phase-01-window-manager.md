# Phase 1 – Kernel, Display, Window Manager (Multi-file Baseline)

**Status:** ✅ Complete. The repository now ships with a modular source tree, build pipeline, shared UI tokens, and a bootable window manager experience compiled into the legacy `dist/index.html` artifact. Downstream phases can build on the stabilized contracts without touching Phase 01 code.

## Objectives
- Establish repository layout: `src/core`, `src/services`, `src/ui`, `src/apps`, `src/styles`, `src/assets`, and `tests` folders with clear ownership files.
- Implement foundational services (`core/kernel`, `services/settings`, `services/display`, `services/window`) as individual ES modules loaded through a lightweight module loader shim.
- Deliver CRT viewport, boot splash, and base window manager behaviour using modularized templates, stylesheets, and assets.
- Stand up build tooling (`scripts/build.js`) that concatenates/minifies modules into the legacy `dist/index.html` artifact for backwards compatibility.
- Publish contribution guide that documents naming conventions, dependency rules, and merge boundaries for downstream phases.

## Deliverables
1. Multi-file source tree with TypeScript configuration, lint rules, and shared tsconfig/eslint settings for deterministic builds.
2. Automated build pipeline (`tools/build.js`) that outputs `dist/index.html` plus hashed asset files while preserving source maps for debugging.
3. Window manager package under `src/apps/shell/window-manager/` exposing move/resize/min/max APIs and wired to the shell boot session.
4. Shared UI kit in `src/ui/components/` (caption buttons, window frame, CRT viewport) referenced by the window manager and exported for later phases.
5. `scripts/scaffolding/create-module.js` CLI that generates module folders with documentation stubs to keep structure consistent.
6. Shared testing harness (`tests/helpers/runtime.ts`) exposing `createTestRuntime()` for Node + browser tests.

## Engineering Tasks
- Scaffold repository configuration: ESLint, Prettier, TypeScript, Jest/Node test runner, Playwright baseline, commit hooks.
- Implement module loader shim that resolves `@core`, `@services`, `@ui`, and `@apps` aliases, ensuring bundler emits deterministic chunk names.
- Author kernel event bus, settings store, and display service as separate modules with typed contracts and exported interfaces.
- Build window manager package with dedicated entry file and dependency graph limited to `@core` and `@services` imports.
- Create CRT viewport layout using CSS modules/SCSS compiled into `src/styles/global.scss`.
- Configure CI pipeline to build, lint, test, and publish artifacts, caching dependencies to support parallel developer workflows.

## Concurrency Enablement
- Define code ownership files (e.g., `OWNERS`, `CODEOWNERS`, `docs/module-boundaries.md`) per folder so later phases can work in isolation.
- Freeze shared contracts by publishing `.d.ts` files for kernel/services and documenting change control in `docs/change-management.md`.
- Configure lint rule that prevents cross-app imports except through approved service interfaces, reducing merge conflicts.
- Generate feature flags for upcoming phases but keep them toggled off, enabling developers to merge without UI contention.

## Testing
- **Unit**: kernel pub/sub, settings watch/unwatch, display scaling math, window state transitions (implemented with Jest/Node in `tests/core/`).
- **Integration** (Playwright): spawn sample windows, verify move/resize/min/max, ensure pixel mode scrollbars, assert integer scaling toggle updates data attribute, check Alt+` overlay using built bundle.
- **Visual**: Percy/Chromatic snapshots for desktop with two sample windows (active/inactive) built from `dist/` output.
- **Accessibility**: axe-core scan on empty desktop executed against built assets.
- **Tooling**: Build pipeline smoke test verifying chunk manifests and integrity hashes.

## Manual QA Checklist
- Move/resize windows via mouse and keyboard (Alt+Space → Size → arrow keys) using built output from `dist/`.
- Verify maximize respects CRT bounds and restore returns to original size.
- Confirm minimized windows disappear (task button placeholder toggles state even if non-functional).
- Validate scrollbars appear when resolution > viewport in pixel mode; removed in fit mode.
- Confirm integer scaling options disabled if viewport insufficient.
- Run scaffolding CLI to create a sample module and ensure generated files compile and pass lint/test.

## Dependencies
- None (first phase) but it establishes module boundaries that later phases must not modify without RFC.

## Exit Criteria
- All automated checks green in CI (lint, unit, integration, build verification).
- Manual QA checklist completed with notes logged.
- Documentation updated: architecture overview, implementation phases, testing strategy references to new capabilities, contribution guide committed.
- `CODEOWNERS`/branch protection rules active to guard shared contracts.
