# Implementation Phases & Acceptance Criteria

The simulator ships in ten phases. Each phase includes engineering tasks, automated test deliverables, and manual QA exit criteria. Tests become part of the regression suite for subsequent phases.

## Phase 1 – Kernel, Display, Window Manager
- Implement `core/kernel`, `svc/settings`, `svc/display`, `svc/window`, shell boot splash, base CRT container.
- Deliver basic window chrome (move, resize, minimize, maximize, focus, z-order) and Start button placeholder.
- **Automation**: Node-based unit tests for kernel pub/sub, settings watchers, display scaling math, and window lifecycle (implemented with lightweight DOM stubs); planned Playwright smoke test ensuring windows can be spawned, moved, resized, minimized/restored; visual snapshot of empty desktop with two sample windows.
- **Manual QA**: Keyboard navigation (Alt+Space menu, Alt+` task switch), bounds clamping, scrollbars in pixel-perfect mode, integer scaling behavior.

## Phase 2 – Virtual File System & Explorer
- Implement `svc/vfs`, path utilities, icon registry, recycle bin, shortcuts, search index.
- Build Explorer shell (tree/list/details, New/Delete/Rename, Properties, Recycle Bin, Find).
- **Automation**: Unit tests covering path normalization, shortcut resolution, search wildcard matching, recycle bin restore/delete; Playwright scenario creating, moving, deleting files/folders; visual snapshots for Explorer (icons, details views).
- **Manual QA**: Drag/drop with modifiers, rubber-band selection, context menus, special folders (Desktop, Control Panel, Printers, Network), error dialogs.

## Phase 3 – Desktop, Taskbar, Start
- Finish desktop icon surface, taskbar with task buttons, Start menu hierarchy, tray clock, recent documents integration.
- **Automation**: Playwright regression verifying Start menu navigation, task button activation, clock ticking, recent document entries; visual snapshots for desktop idle, Start open, taskbar with minimized windows.
- **Manual QA**: Context menus (Desktop/View/New/Properties), keyboard toggles (Ctrl+Esc), Alt+Tab overlay, drag icons to recycle bin, wallpaper and theme switching.

## Phase 4 – Dialogs & Notepad
- Implement UI dialogs (Open/Save, MessageBox, Font, Color, Print). Build Notepad with word wrap, find/replace, go-to line, status bar, print integration.
- **Automation**: Unit tests for dialog filtering, recent folders persistence, Notepad text operations, print job creation; Playwright scenario editing a file, saving, reopening, printing to PNG printer; visual snapshot for Notepad with dialog open.
- **Manual QA**: Clipboard operations, keyboard accelerators, status bar line/column accuracy, error handling for read-only files.

## Phase 5 – Navigator
- Implement Navigator app with iframe, reader, proxy modes; bookmarks, history, download manager, view source.
- **Automation**: Mock fetch/unit tests for reader-mode sanitization and proxy mode fallbacks; Playwright scenario loading local HTML, verifying sanitized output, handling blocked iframe; visual snapshot of Navigator in each mode.
- **Manual QA**: Toggle between modes, blocked iframe messaging, download to VFS, open `.url` shortcuts, print preview (if supported).

## Phase 6 – Paint & Media Player
- Build Paint toolset (canvas operations, palette, selection, import/export PNG/BMP, dithering) and Media Player (audio/video playback, playlists).
- **Automation**: Unit tests for bitmap encode/decode, dithering; Playwright scenario drawing, saving, reopening in Paint; Playwright audio/video playback with events; visual snapshots of Paint toolbox and Media Player UI.
- **Manual QA**: Undo/redo stack, keyboard shortcuts, clipboard image paste, unsupported codec messaging, playlist persistence within session.

## Phase 7 – Utilities & Games
- Deliver Calculator, Minesweeper, Command Prompt (DOS subset), Run/Find/Shut Down/Close Program utilities.
- **Automation**: Unit tests for calculator arithmetic and command parser; Playwright scenario playing Minesweeper (first-click safety), executing command-line scripts, using Run to start apps; visual snapshots of Minesweeper board states.
- **Manual QA**: Keyboard accessibility, timer accuracy, high-score persistence in session, batch command behavior, Close Program termination flow.

## Phase 8 – Control Panel & Printers
- Implement functional applets (Display, Date/Time, Keyboard/Mouse, Sounds, Printers) and printer queue with Generic/Text + Virtual PDF outputs.
- **Automation**: Unit tests for settings sync, printer job lifecycle, PDF output metadata; Playwright scenario changing resolution, enabling CRT effects, submitting print jobs, verifying output files; visual snapshots for Control Panel tabs and printer queue.
- **Manual QA**: Monitor scaling interactions, sound scheme switching, mouse/keyboard setting impact, printer job cancellation/retry, spool folder cleanup.

## Phase 9 – Polish & Extras
- Add CRT filter overlay, screensavers (3D Pipes, Starfield), system sounds, boot/shutdown sequences, themes, BSOD easter egg.
- **Automation**: Playwright idle timer test for screensaver activation, snapshot comparisons for each theme, audio enablement gating; performance test measuring FPS during window drag with CRT effect on/off.
- **Manual QA**: Sound toggles, screensaver exit flows, theme persistence across apps, BSOD trigger/recovery, reduced-motion setting.

## Phase 10 – Packaging & Release
- Build pipeline to concatenate/minify modules, inline assets, append license banner, generate hash manifest, publish About dialog with credits.
- **Automation**: Node-based checksum validation, HTML structure linter ensuring required sections present, license text comparison, Playwright smoke test against minified artifact.
- **Manual QA**: Load final file in Chrome, Firefox, Safari; confirm About dialog lists licenses; verify no console errors; run full regression checklist.

Each phase document in `planning/` expands on tasks, dependencies, and references back to this overview.
