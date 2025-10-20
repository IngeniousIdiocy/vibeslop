# Phase 9 – Polish, Themes, Screensavers

## Objectives
- Add CRT effect overlay, screensavers, theme variations, system sounds, boot/shutdown sequences, BSOD easter egg, reduced-motion toggle.
- Finalize accessibility enhancements and ensure high-contrast theme parity.

## Deliverables
1. CRT overlay rendered via canvas with adjustable scanline/glow/vignette intensity tied to Display settings.
2. Screensaver subsystem with idle detection, password prompt stub, bundled savers (3D Pipes, Starfield) implemented via canvas.
3. Theme variants (Standard, Desert, High Contrast) adjusting CSS tokens; high-contrast ensures compliance with WCAG contrast guidelines.
4. System sound playback integrated with Start/taskbar/menus/window events, controlled via Sounds applet and startup/shutdown sequences.
5. Boot/shutdown splash screens with optional progress animation; BSOD easter egg accessible via hidden command.
6. Reduced motion setting disabling animations, CRT effects, screensaver transitions.

## Engineering Tasks
- Implement idle timer using kernel events, reset on user input, start screensaver after configurable delay.
- Build screensaver host window that captures pointer/keyboard to exit; integrate with test harness to force activation.
- Update theme CSS injection to switch tokens dynamically; ensure UI components re-render when theme changes.
- Implement sound event mapping and gating on permission toggle; load audio buffers lazily.
- Create boot/shutdown sequences triggered during initial load and via Shut Down dialog.
- Implement BSOD overlay accessible via keyboard secret (e.g., Ctrl+Alt+Shift+B) and from Command Prompt `bsod` command.

## Testing
- **Unit**: Idle timer logic, theme token swapping, audio gating.
- **Integration**: Playwright scenario toggling themes, verifying token application; forcing screensaver activation and exit; enabling/disabling CRT effect and confirming DOM changes; verifying startup/shutdown sequences; triggering BSOD and recovery.
- **Visual**: Snapshots for each theme, CRT on/off states, screensaver previews (static capture), boot/shutdown screens.
- **Accessibility**: Ensure reduced motion disables animations and CRT; high-contrast passes axe-core checks.

## Manual QA Checklist
- Validate screensaver delay configurable, exit on mouse/keyboard, optional password prompt stub functioning.
- Theme switching persists during session and across new windows; high-contrast ensures legible text.
- Sounds respond to events (menu open, error, minimize) when enabled, remain silent when disabled.
- Boot/shutdown sequences play correct audio/visual; BSOD accessible and recovers gracefully.
- Reduced motion toggle disables animations and prevents new ones from starting.

## Dependencies
- Phases 1–8 complete.

## Exit Criteria
- Automated suites passing.
- Manual QA logged.
- Documentation updated (theme descriptions, accessibility notes).
