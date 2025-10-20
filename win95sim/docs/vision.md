# Win95Sim Vision & Goals

## Objective
Create a single, self-contained HTML file that faithfully simulates the Windows 95 desktop experience inside a 4:3 “monitor” surface while running entirely in modern browsers. The simulator should deliver authentic visuals, windowing behavior, applications, and sound without relying on external assets or persistence.

## Success Criteria
- **Single-file deliverable** embedding all CSS, JavaScript, icons, sounds, and fonts.
- **Authentic UI** with Win95 metrics, palettes, window chrome, Start menu, and desktop interactions.
- **Fully functioning shell** including Start menu, taskbar, windows (min/max/restore), system menu, drag-drop, keyboard navigation, and context menus.
- **Virtual file system** supporting drives, shortcuts, recycle bin, search, import/export, and associations.
- **Application suite**: Explorer, Notepad, Navigator (iframe/reader/proxy), Paint, Calculator, Minesweeper, Media Player, Command Prompt, Control Panel applets, utilities (Run, Find, Shutdown, Close Program).
- **Display customization** with multiple resolutions, scaling modes (pixel-perfect, fit, integer), wallpapers, CRT effects, and color depth simulation.
- **System sounds and visual polish** including boot/shutdown experiences, screensavers, themes, and accessibility support.
- **Robust testing and QA** with unit, integration, visual, performance, and accessibility coverage.

## Non-Goals
- Persistence across browser refreshes (optional future enhancement via export/import).
- Direct integration with the host operating system or hardware.
- Faithful emulation of legacy browser rendering quirks beyond available web technologies.

## Constraints
- No network access during tests; all resources must be inlined.
- Only sanctioned third-party libraries: DOMPurify, jsPDF, optional fflate.
- Must comply with locked API and CSS token contract (see `module-apis-v1.md`).

## Stakeholders
- **Product Owner**: Defines feature parity with Windows 95.
- **Engineering**: Builds services, UI toolkit, and applications.
- **QA**: Maintains automated suites and manual regression plans.
- **Design/UX**: Ensures fidelity to Win95 conventions and accessibility.

## Milestone Overview
Development proceeds through ten locked phases covering kernel, shell, applications, and polish. Each phase delivers both implementation and associated test automation as described in `planning/implementation-phases.md` and the per-phase deep dives.

## Definition of Done
A phase is complete when:
1. All scoped features are implemented and documented.
2. Automated test suites covering new functionality pass in CI.
3. Manual QA checklist items are validated and recorded.
4. Regression suites run cleanly with updated baselines.
5. Documentation artifacts are updated (architecture, phase status, feature matrix).

The overall project completes when all phases are delivered, high severity risks are mitigated, and the single HTML file meets success criteria.
