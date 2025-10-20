# Win95 UI Guidelines Reference

## Layout & Metrics
- Window border: 1px dark shadow outer, 1px highlight inner for 3D effect.
- Title bar height: 18px, active color `#000080`, inactive color `#808080`.
- Caption icon size: 16px square with 2px padding.
- Button height: 23px including 2px bevel edges; spacing between buttons 4px.
- Menu bar height: 18px; menu items padded 6px horizontally.
- Status bar height: 18px with 2px sunken border.
- Scrollbar width: 16px; arrow buttons 16×16.
- Desktop icon grid: 75×62 cell (approx) with label below icon, centered.

## Typography
- Default UI font: MS Sans Serif equivalent (use `--w95-font-ui`).
- Monospace: Fixedsys equivalent for console/dos prompt (`--w95-font-mono`).
- Menu/title fonts use uppercase initial letter by convention but not enforced.

## Color Usage
- Use CSS tokens for all system colors; do not hardcode values.
- Selected items: background `--w95-highlight`, text `--w95-highlighttext`.
- Disabled text uses `--w95-graytext` with embossed effect (apply highlight/shadow edges when needed).

## Interaction Patterns
- Double-click to open desktop icons and Explorer items.
- Right-click opens context menu; first item is default action in bold.
- Keyboard shortcuts follow Win95 conventions (F2 rename, F5 refresh, Alt accelerators underlined, Esc cancel, Enter accept).
- Menu navigation: Alt activates menu bar, arrow keys traverse, Enter executes highlighted command.
- Drag/drop uses ghosted outline; hold Ctrl for copy, Shift for move, Alt for shortcut.

## Accessibility Considerations
- Provide focus rectangles on interactive elements using `--w95-focus-outline`.
- Ensure all icons have accessible names via `aria-label` or `title`.
- High-contrast theme must swap background/text tokens to maintain readability.
- Reduced motion disables transitions and sound cues (if user preference indicates).

## Sound & Animation
- Keep system sounds short (<1s). Play on menu open/execute, error dialogs, minimize/maximize.
- Animate minimize/maximize using simple scale/translate when reduced-motion disabled; skip otherwise.
- CRT effect should be subtle and optional; default intensity moderate.

## Application-Specific Notes
- Notepad: Use monospaced status bar text for Ln/Col; show indicator for Word Wrap state.
- Explorer: Provide toolbar buttons (Back, Forward, Up, Search, Folders, Views) with appropriate icons; column headers clickable.
- Navigator: Address bar indicates protocol; show security indicator (info icon) for proxy mode.
- Paint: Toolbox icons mimic Win95 arrangement; color palette 28 colors + custom slots.
- Minesweeper: Smiley button centered, timer/counter digits in seven-segment style.

## Documentation
- Update this guide if visual changes diverge from Win95 baseline; include rationale.
- Link to external references (Microsoft Windows 95 UI Guidelines, 1995) in documentation appendix.
