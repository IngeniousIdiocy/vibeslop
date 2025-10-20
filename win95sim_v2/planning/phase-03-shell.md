# Phase 3 – Desktop, Taskbar, Start Menu (Shell Packages)

**Status:** 🚧 Planned. This phase delivers the desktop shell as discrete packages that sit on top of the Phase 1 kernel/services and Phase 2 VFS API. Implementation lives under `src/apps/shell/` with subfolders for desktop, taskbar, start menu, and tray. Each package exposes only public hooks so subsequent app teams can integrate without modifying shell code, allowing parallel workstreams after Phase 1.

## Objectives
- Finalize shell chrome: desktop icons, taskbar with task buttons, system tray, Start menu hierarchy, recent documents integration.
- Implement context menus, keyboard navigation, drag/drop interactions on desktop leveraging shared UI toolkit.
- Produce shell extension points (command registry, menu composition, tray providers) enabling independent development of utilities.

## Deliverables
1. Desktop module at `src/apps/shell/desktop/` mounting `::desktop` folder with layout persistence stored in `src/services/layout/`.
2. Taskbar package `src/apps/shell/taskbar/` with Start button, task buttons linked to window focus/minimize state, tray clock, stub tray icons (volume/network) implemented via plugin registry.
3. Start menu data model with Programs, Documents, Settings, Find, Help, Run, Shut Down entries defined in JSON manifest files under `src/apps/shell/start-menu/data/`.
4. Recent documents tracking service `src/services/recent-documents/` with event hooks consumed by Start menu and Explorer.
5. Context menu system under `src/ui/menus/` with shell-specific command adapters and declarative menu schemas.
6. Public `ShellAPI` TypeScript definitions (`types/shell/index.d.ts`) describing extension points for future phases.

## Concurrency & Integration Boundaries
- Shell packages expose plugin interfaces via `registerShellWidget()` so Phase 4+ teams can extend Start menu or tray without editing core files.
- Provide mocked implementations and contract tests to guarantee Start menu changes do not cascade into Explorer or utilities.
- Document context menu command identifiers in `docs/shell-commands.md` and freeze after this phase to eliminate conflicts.
- Introduce per-package changelog to communicate breaking changes.

## Engineering Tasks
- Implement desktop icon arrangement, multi-select, rubber-band selection, rename inline edit using shared state machines.
- Hook taskbar buttons to window events (create, focus, minimize, close) via `@services/window` event bus.
- Implement clock updating via `kernel.now()` ticker with localization-friendly formatting service.
- Build Start menu navigation with keyboard accelerators, submenus, search integration using accessible menu components.
- Implement recent documents store updated by `proc:recent:add` events and persisted via `localStorage` adapter.
- Add system tray hover tooltips and right-click menus (volume/network stubs) with plugin registration scaffolding.

## Testing
- **Unit**: Recent documents store, Start menu data builder, taskbar state machine, menu reducer (Jest under `tests/apps/shell/`).
- **Integration**: Playwright flows launching apps from Start, minimizing/restoring via taskbar, verifying recent docs after file opens, Start keyboard navigation (Ctrl+Esc, arrow keys, Enter) against built assets.
- **Visual**: Snapshots for desktop idle, Start expanded, taskbar with multiple buttons, tray popover using Storybook.
- **Accessibility**: Keyboard-only traversal tests, focus ring verification, screen reader announcements run via axe-core and NVDA smoke scripts.

## Manual QA Checklist
- Right-click desktop → View/New/Sort/Properties menu correctness.
- Drag icons to rearrange, align to grid toggle, auto-arrange behavior.
- Task buttons show active/inactive states, support context menu (Restore/Move/Size/Minimize/Maximize/Close).
- Start menu closes on click outside/Esc, supports type-to-select.
- Tray clock respects 12/24 hour toggle (if exposed) and updates each minute.
- Validate shell plugin registration logs helpful errors when duplicate IDs are detected.

## Dependencies
- Requires Phases 1 and 2 delivered; this phase must not mutate their public contracts.

## Exit Criteria
- Automated suites passing (lint, unit, integration, visual regression).
- Manual QA logged.
- Feature parity matrix updated for shell components, including plugin API documentation.
- `docs/shell-extension-guide.md` published and reviewed by downstream teams.
