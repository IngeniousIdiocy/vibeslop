# Phase 4 – Dialog Framework & Notepad (Shared UI Foundation)

**Status:** 🚧 Planned. Dialogs and Notepad are implemented as independent packages that consume shell APIs without modifying Phase 1–3 surfaces. The dialog framework ships from `src/ui/dialogs/` and Notepad from `src/apps/accessories/notepad/`. Teams responsible for later utilities can build on the same dialog primitives without merge conflicts.

## Objectives
- Implement reusable dialogs (Open/Save, MessageBox, Font, Color, Print) via UI toolkit with each dialog in its own folder under `src/ui/dialogs/`.
- Build Notepad application with word wrap, find/replace, go-to line, status bar, font chooser, print integration using shared dialog primitives.
- Integrate dialogs with Explorer and other shell features via exported service functions rather than editing their modules directly.
- Provide scaffolding so future apps (Paint, WordPad, etc.) can register custom dialog views without touching Notepad source.

## Deliverables
1. Dialog component library with keyboard focus trapping, default button behaviour, and accessibility roles, published through `@ui/dialogs` barrel exports.
2. File dialog supporting filters, recent directories, multi-select, thumbnail preview with adapters stored in `src/services/dialog-state/`.
3. Notepad app registered with file associations for `.txt` and `.log` via manifest `src/apps/accessories/notepad/notepad.app.json`.
4. Print pipeline generating text pages for Generic/Text printer and PDF output using shared print service `src/services/print/`.
5. Updated Start menu entries (Programs → Accessories → Notepad) and desktop shortcut option defined in Start menu manifest files.
6. Guidance document `docs/dialog-framework.md` detailing extension hooks for other teams.

## Concurrency & Integration Boundaries
- Dialog framework exposes React/Preact-agnostic primitives (pure TypeScript + templating) so multiple app teams can integrate without UI coupling.
- Provide strict typing via `types/dialogs/*.d.ts` and lock down exports to avoid cross-editing between apps.
- Generate reference mocks for dialogs under `tests/mocks/dialogs/` enabling other phases to stub interactions while working concurrently.
- Document event contracts for `@services/dialog-bus` and require change control for modifications.

## Engineering Tasks
- Build dialog templates using UI toolkit menus/buttons/list views with SCSS modules co-located and compiled by bundler.
- Implement find/replace with incremental search and wrap-around toggle using state machines stored under `src/apps/accessories/notepad/state/`.
- Implement go-to line with validation; update status bar (Ln/Col) in real time through shared `useTextMetrics` hook.
- Support word wrap toggle updating editor layout service; ensure preferences persist via `src/services/settings` API.
- Integrate `@services/clipboard` for copy/paste; handle asynchronous system clipboard gracefully via fallback messaging.
- Add Notepad-specific menu commands (Page Setup placeholder, Print, Font…) declared in JSON to keep menu definitions declarative.

## Testing
- **Unit**: Dialog filter matching, recent directory persistence, print job page layout calculations, find/replace logic executed via Jest (`tests/ui/dialogs/` and `tests/apps/notepad/`).
- **Integration**: Playwright scenario creating text file via Explorer, editing in Notepad, using find/replace, toggling word wrap, printing to PNG and PDF printers through built assets.
- **Visual**: Snapshots for Notepad main window, Find dialog, Font dialog, Print preview captured in Storybook.
- **Accessibility**: Ensure dialog focus trap works; screen reader labels for controls validated with axe-core and manual NVDA/VoiceOver sweeps.

## Manual QA Checklist
- Open/save flows from both Notepad and Explorer double-click.
- Word wrap toggle updates horizontal scrollbar availability.
- Font dialog updates text area font family/size; persisted per session or per document as designed.
- Print results stored in VFS spool folder with metadata and accessible via Explorer.
- Error handling for read-only files and unsaved changes on exit (prompt to save).
- Verify dialog manifests can be extended by creating sample plugin without editing Notepad code.

## Dependencies
- Phases 1–3 complete with frozen APIs; this phase consumes their exports only.

## Exit Criteria
- Automated suites passing (unit, integration, visual, lint).
- Manual QA logged.
- Documentation updated (feature matrix, testing strategy referencing dialogs, dialog framework guide).
- Ownership files ensure future dialog additions do not conflict across teams.
