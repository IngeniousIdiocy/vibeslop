# Phase 8 – Control Panel & Printers

## Objectives
- Implement functional Control Panel applets (Display, Date/Time, Keyboard, Mouse, Sounds, Printers) with stub UI for remaining items.
- Deliver printer subsystem with Generic/Text (PNG) and Virtual PDF outputs, printer queue UI, and spool folder integration.

## Deliverables
1. Control Panel hub listing applets; double-click opens dedicated windows with tabs mirroring Win95 layout.
2. Display applet managing resolution, scaling mode, wallpapers, color depth simulation, CRT effects.
3. Date/Time applet updating tray clock, supporting manual offset adjustments.
4. Keyboard/Mouse applets adjusting repeat rate, cursor speed (affecting in-sim behavior only).
5. Sounds applet toggling schemes, previewing sounds, enabling/disabling system audio.
6. Printers folder showing installed printers, ability to add/remove (within simulated set), view queue, pause/cancel jobs.
7. Print service integrated with queue UI, generating output files inside VFS spool folder.

## Engineering Tasks
- Build Control Panel navigation (icon view, category grouping) with tooltips and descriptions.
- Implement Display applet UI with live preview and apply/cancel pattern.
- Integrate Display settings with `svc/display` and `svc/settings`; propagate events to desktop.
- Implement printer job state machine with progress updates, error handling, job history.
- Wire Notepad/Paint/Navigator print flows to queue; allow opening spool file from queue UI.
- Include About dialog with license credits accessible from Control Panel or Help menu.

## Testing
- **Unit**: Settings synchronization, printer job lifecycle transitions, wallpaper mode calculations, CRT effect toggles.
- **Integration**: Playwright scenario changing resolution, verifying Start/desktop reflow; printing from Notepad and Paint to both printers; canceling/pause job; toggling sound scheme and verifying playback gating.
- **Visual**: Snapshots for each Control Panel applet, printer queue window, spool folder view.
- **Accessibility**: Tab order and focus management across tabbed dialogs; keyboard navigation of printer queue.

## Manual QA Checklist
- Apply/cancel in Display applet respects pending changes and prompts for keep/discard countdown.
- Wallpapers tile/center/stretch correctly; CRT effect intensity slider updates overlay.
- Date/Time changes reflect immediately in tray and revert on cancel.
- Sounds preview only after enabling audio; toggling scheme updates default beep etc.
- Printer queue shows correct document names, copies, allows cancel/pause/resume, opens output file.

## Dependencies
- Phases 1–7 complete.

## Exit Criteria
- Automated suites passing.
- Manual QA logged.
- Risk log updated (e.g., printer compatibility issues).
