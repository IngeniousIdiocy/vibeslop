# Phase 1 – Kernel, Display, Window Manager

**Status:** ✅ Complete. `index.html` now ships the kernel/settings/display/window services, boot splash, CRT viewport, baseline window chrome (move/resize/min/max), system menu, task switcher overlay, and Start button placeholder with empty taskband. Automated unit tests cover the core service contracts (`node --test win95sim/tests/phase1.test.js`).

## Objectives
- Implement foundational services (`core/kernel`, `svc/settings`, `svc/display`, `svc/window`).
- Establish CRT container with resolution/scaling controls and boot splash.
- Deliver baseline window manager with move, resize, min/max, focus, z-order, Alt+Space system menu, Alt+` task switch overlay.
- Provide Start button placeholder and empty taskbar strip for integration in later phases.

## Deliverables
1. Core services loaded via SFM, unit tested for API compliance.
2. CRT viewport supporting pixel-perfect, fit-to-window, and integer scaling modes with scrollbars where appropriate.
3. Window template implementing Win95 chrome, draggable caption, resizable edges, system menu, keyboard accelerators.
4. Boot splash that transitions to desktop once services load.
5. `window.__win95TestApi` initial harness exposing service references and reset hooks.

## Engineering Tasks
- Build kernel event bus with unsubscribe/once semantics and ID generator.
- Implement settings store with watchers.
- Implement display service calculating scale transforms, integer scaling availability, viewport queries.
- Implement window manager: create, destroy, show/hide, focus management, z-index, hit-test edges, pointer capture, keyboard shortcuts.
- Implement Start button placeholder and Alt+` task switcher overlay (list of open windows with navigation).
- Set up SFM loader integration for unit tests (Node harness to load modules from inline script).

## Testing
- **Unit**: kernel pub/sub, settings watch/unwatch, display scaling math, window state transitions.
- **Integration** (Playwright): spawn sample windows, verify move/resize/min/max, ensure pixel mode scrollbars, assert integer scaling toggle updates data attribute, check Alt+` overlay.
- **Visual**: snapshots for desktop with two sample windows (active/inactive).
- **Accessibility**: basic axe-core scan on empty desktop.

## Manual QA Checklist
- Move/resize windows via mouse and keyboard (Alt+Space → Size → arrow keys).
- Verify maximize respects CRT bounds and restore returns to original size.
- Confirm minimized windows disappear (task button placeholder toggles state even if non-functional).
- Validate scrollbars appear when resolution > viewport in pixel mode; removed in fit mode.
- Confirm integer scaling options disabled if viewport insufficient.

## Dependencies
- None (first phase).

## Exit Criteria
- All automated tests green in CI.
- Manual QA checklist completed with notes logged.
- Documentation updated: architecture overview, implementation phases, testing strategy references to new capabilities.
