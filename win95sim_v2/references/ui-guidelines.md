# UI Guidelines

These guidelines keep the Win95 aesthetic authentic while leveraging the new modular UI library.

## Layout & grid
- Use the 8px base grid for spacing. Components align to multiples of 4px when mimicking Win95 quirks.
- Windows default to 8px padding inside content regions.
- Taskbar height: 28px. Start button width: 90px.

## Typography
- Primary font stack defined in `ui/tokens.css` (`--win95-font-ui`).
- Heading sizes:
  - Title bar: 11px bold
  - Menu items: 10px
  - Body copy: 10px
- Avoid custom fonts unless cleared with design.

## Color system
- Consume CSS variables from `ui/tokens.css`.
- For high contrast mode (Phase 09), rely on semantic tokens: `--color-surface`, `--color-text`, etc. These map to Win95 defaults initially.
- Do not hard-code hex values in component styles.

## Components
- **Buttons** – Use beveled borders with inset/outset shadows defined by mixins in `ui/components/button.css`.
- **Menus** – Provide keyboard navigation (arrow keys, Alt shortcuts) and use ARIA roles (`menu`, `menuitem`).
- **Windows** – Title bar supports double-click to maximize/restore. Provide system menu button on the left.
- **Dialogs** – Offer primary/secondary buttons with default focus indicated by dotted outline.

## Motion & interactions
- Keep animations subtle (`≤ 150ms`). Provide `prefers-reduced-motion` fallbacks that disable transitions.
- Drag & drop should use cursor hints consistent with Win95 (move, copy, no-drop).

## Accessibility
- Every interactive control must have a keyboard path and visible focus state.
- Provide screen reader labels for icons. If decorative, mark with `aria-hidden="true"`.
- Ensure contrast ratios meet WCAG AA in both normal and high-contrast themes.

## Responsive considerations
- While optimized for desktop, layouts should gracefully adapt down to 768px width.
- Taskbar may collapse into a compact mode controlled by a feature flag (Phase 01 backlog item).

## Documentation & review
- Update this file when introducing new component patterns.
- Include screenshots or GIFs in PR descriptions for visual changes (link to assets in `references/visual-diffs/` once created).
