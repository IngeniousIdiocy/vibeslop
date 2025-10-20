# Phase 3 – Desktop, Taskbar, Start Menu

## Objectives
- Finalize shell chrome: desktop icons, taskbar with task buttons, system tray, Start menu hierarchy, recent documents integration.
- Implement context menus, keyboard navigation, drag/drop interactions on desktop.

## Deliverables
1. Desktop module mounting `::desktop` folder with icon layout persistence during session.
2. Taskbar with Start button, task buttons linked to window focus/minimize state, tray clock, stub tray icons (volume/network).
3. Start menu data model with Programs, Documents, Settings, Find, Help, Run, Shut Down entries; integration with `svc/process` registry.
4. Recent documents tracking and display in Start → Documents.
5. Context menu system (desktop and taskbar) with commands wired to services.

## Engineering Tasks
- Implement desktop icon arrangement, multi-select, rubber-band selection, rename inline edit.
- Hook taskbar buttons to window events (create, focus, minimize, close).
- Implement clock updating via `kernel.now()` ticker.
- Build Start menu navigation with keyboard accelerators, submenus, search integration.
- Implement recent documents store updated by `proc:recent:add` events.
- Add system tray hover tooltips and right-click menus (volume/network stubs).

## Testing
- **Unit**: Recent documents store, Start menu data builder, taskbar state machine.
- **Integration**: Playwright flows launching apps from Start, minimizing/restoring via taskbar, verifying recent docs after file opens, Start keyboard navigation (Ctrl+Esc, arrow keys, Enter).
- **Visual**: Snapshots for desktop idle, Start expanded, taskbar with multiple buttons, tray popover.
- **Accessibility**: Keyboard-only traversal tests, focus ring verification.

## Manual QA Checklist
- Right-click desktop → View/New/Sort/Properties menu correctness.
- Drag icons to rearrange, align to grid toggle, auto-arrange behavior.
- Task buttons show active/inactive states, support context menu (Restore/Move/Size/Minimize/Maximize/Close).
- Start menu closes on click outside/Esc, supports type-to-select.
- Tray clock respects 12/24 hour toggle (if exposed) and updates each minute.

## Dependencies
- Phases 1 and 2 completed.

## Exit Criteria
- Automated suites passing.
- Manual QA logged.
- Feature parity matrix updated for shell components.
