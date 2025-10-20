# Phase 8 – Control Panel & Printers (System Configuration Suite)

**Status:** 🚧 Planned. Control Panel applets and the printer subsystem are grouped into `src/apps/system/control-panel/` and `src/services/print/`. Each applet resides in its own folder with shared state managed by configuration services, allowing multiple teams to implement individual applets concurrently after Phase 1 without merge conflicts.

## Objectives
- Implement functional Control Panel applets (Display, Date/Time, Keyboard, Mouse, Sounds, Printers) with stub UI for remaining items using modular architecture.
- Deliver printer subsystem with Generic/Text (PNG) and Virtual PDF outputs, printer queue UI, and spool folder integration, all defined within `src/services/print/` and `src/apps/system/printers/`.
- Provide extensibility for future applets to plug into Control Panel without editing existing code.

## Deliverables
1. Control Panel hub listing applets; double-click opens dedicated windows with tabs mirroring Win95 layout using manifest-driven registration (`control-panel.manifest.json`).
2. Display applet managing resolution, scaling mode, wallpapers, color depth simulation, CRT effects consuming `@services/display` API.
3. Date/Time applet updating tray clock, supporting manual offset adjustments stored via `@services/settings/time` namespace.
4. Keyboard/Mouse applets adjusting repeat rate, cursor speed (affecting in-sim behaviour only) with settings broadcast to relevant services.
5. Sounds applet toggling schemes, previewing sounds, enabling/disabling system audio via `@services/audio`.
6. Printers folder showing installed printers, ability to add/remove (within simulated set), view queue, pause/cancel jobs implemented in `src/apps/system/printers/`.
7. Print service integrated with queue UI, generating output files inside VFS spool folder using pipeline defined in `src/services/print/spooler.ts`.
8. Documentation `docs/control-panel-extension.md` outlining how to add new applets.

## Concurrency & Integration Boundaries
- Applets registered via manifest with unique IDs so new applets can be added by app teams without modifying hub source.
- Print service exposes contract via `types/print/index.d.ts` and prohibits direct file system access; job submissions go through events.
- Provide shared state management utilities under `src/services/config/` to prevent cross-app race conditions.
- Introduce Playwright fixtures to mock printer hardware so other teams can run tests without conflicting spool outputs.

## Engineering Tasks
- Build Control Panel navigation (icon view, category grouping) with tooltips and descriptions using shared UI components.
- Implement Display applet UI with live preview and apply/cancel pattern including rollback timer.
- Integrate Display settings with `@services/display` and `@services/settings`; propagate events to desktop and shell.
- Implement printer job state machine with progress updates, error handling, job history stored per printer.
- Wire Notepad/Paint/Navigator print flows to queue via `@services/print` event channel; allow opening spool file from queue UI.
- Include About dialog with license credits accessible from Control Panel or Help menu built as separate module.

## Testing
- **Unit**: Settings synchronization, printer job lifecycle transitions, wallpaper mode calculations, CRT effect toggles using Jest in `tests/apps/control-panel/` and `tests/services/print/`.
- **Integration**: Playwright scenario changing resolution, verifying Start/desktop reflow; printing from Notepad and Paint to both printers; canceling/pausing job; toggling sound scheme and verifying playback gating using built assets.
- **Visual**: Snapshots for each Control Panel applet, printer queue window, spool folder view captured via Storybook.
- **Accessibility**: Tab order and focus management across tabbed dialogs; keyboard navigation of printer queue validated with axe-core.

## Manual QA Checklist
- Apply/cancel in Display applet respects pending changes and prompts for keep/discard countdown.
- Wallpapers tile/center/stretch correctly; CRT effect intensity slider updates overlay.
- Date/Time changes reflect immediately in tray and revert on cancel.
- Sounds preview only after enabling audio; toggling scheme updates default beep etc.
- Printer queue shows correct document names, copies, allows cancel/pause/resume, opens output file.
- Confirm new applets can be added via manifest without modifying hub code.

## Dependencies
- Phases 1–7 complete with stable services; Control Panel consumes but does not mutate shared contracts.

## Exit Criteria
- Automated suites passing (unit, integration, visual, accessibility).
- Manual QA logged.
- Risk log updated (e.g., printer compatibility issues) and manifest validated.
- Ownership and dependency lint checks remain green.
