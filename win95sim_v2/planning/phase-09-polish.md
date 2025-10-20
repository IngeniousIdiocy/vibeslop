# Phase 9 – Polish, Themes, Screensavers (Experience Enhancements)

**Status:** 🚧 Planned. All polish features live in `src/apps/system/experience/` and `src/services/theme/`, enabling UI/experience specialists to iterate without touching earlier phase code. Themes, screensavers, and audio hooks are structured as plug-ins so parallel workstreams can add assets independently after Phase 1.

## Objectives
- Add CRT effect overlay, screensavers, theme variations, system sounds, boot/shutdown sequences, BSOD easter egg, reduced-motion toggle using modular feature flags.
- Finalize accessibility enhancements and ensure high-contrast theme parity with dedicated tokens and test coverage.
- Provide extensible framework for future themes/screensavers to register themselves without editing core runtime files.

## Deliverables
1. CRT overlay rendered via canvas with adjustable scanline/glow/vignette intensity tied to Display settings using `src/services/theme/crt-overlay.ts`.
2. Screensaver subsystem with idle detection, password prompt stub, bundled savers (3D Pipes, Starfield) implemented via canvas modules in `src/apps/system/experience/screensavers/`.
3. Theme variants (Standard, Desert, High Contrast) adjusting CSS tokens defined in `src/styles/themes/` and compiled into theme bundles; high-contrast ensures compliance with WCAG contrast guidelines.
4. System sound playback integrated with Start/taskbar/menus/window events, controlled via Sounds applet and startup/shutdown sequences through `src/services/audio/events.ts`.
5. Boot/shutdown splash screens with optional progress animation; BSOD easter egg accessible via hidden command implemented as overlay module in `src/apps/system/experience/bsod/`.
6. Reduced motion setting disabling animations, CRT effects, screensaver transitions exposed via `@services/accessibility`.
7. Contributor guide `docs/experience-extensibility.md` explaining how to add new themes/screensavers.

## Concurrency & Integration Boundaries
- Theme tokens stored in JSON per theme; merging new themes only requires adding files without editing existing ones.
- Screensavers register through manifest `screensavers.manifest.json`, enabling independent teams to contribute new savers.
- Audio events enumerated in `types/audio-events.d.ts`; modifications require RFC to avoid conflicting changes.
- Provide CLI `scripts/add-theme.js` for scaffolding new theme directories with tests and docs.

## Engineering Tasks
- Implement idle timer using kernel events, reset on user input, start screensaver after configurable delay stored in settings.
- Build screensaver host window that captures pointer/keyboard to exit; integrate with test harness to force activation.
- Update theme CSS injection to switch tokens dynamically; ensure UI components re-render when theme changes and notify active apps.
- Implement sound event mapping and gating on permission toggle; load audio buffers lazily through shared loader.
- Create boot/shutdown sequences triggered during initial load and via Shut Down dialog with event-driven transitions.
- Implement BSOD overlay accessible via keyboard secret (e.g., Ctrl+Alt+Shift+B) and from Command Prompt `bsod` command using plugin registration.
- Add telemetry instrumentation to measure theme usage and screensaver activation frequency.

## Testing
- **Unit**: Idle timer logic, theme token swapping, audio gating, manifest parsing implemented via Jest in `tests/services/theme/`.
- **Integration**: Playwright scenario toggling themes, verifying token application; forcing screensaver activation and exit; enabling/disabling CRT effect and confirming DOM changes; verifying startup/shutdown sequences; triggering BSOD and recovery using built assets.
- **Visual**: Snapshots for each theme, CRT on/off states, screensaver previews (static capture), boot/shutdown screens recorded through Storybook.
- **Accessibility**: Ensure reduced motion disables animations and CRT; high-contrast passes axe-core checks and manual contrast verification.

## Manual QA Checklist
- Validate screensaver delay configurable, exit on mouse/keyboard, optional password prompt stub functioning.
- Theme switching persists during session and across new windows; high-contrast ensures legible text.
- Sounds respond to events (menu open, error, minimize) when enabled, remain silent when disabled.
- Boot/shutdown sequences play correct audio/visual; BSOD accessible and recovers gracefully.
- Reduced motion toggle disables animations and prevents new ones from starting.
- Confirm new themes/screensavers can be added by dropping manifest entries without editing existing files.

## Dependencies
- Phases 1–8 complete; this phase consumes their services only.

## Exit Criteria
- Automated suites passing (unit, integration, visual, accessibility).
- Manual QA logged.
- Documentation updated (theme descriptions, accessibility notes, extensibility guide).
- Dependency lint and ownership rules validated for new experience modules.
