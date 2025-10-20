# Phase 4 – Dialog Framework & Notepad

## Objectives
- Implement reusable dialogs (Open/Save, MessageBox, Font, Color, Print) via UI toolkit.
- Build Notepad application with word wrap, find/replace, go-to line, status bar, font chooser, print integration.
- Integrate dialogs with Explorer and other shell features as needed.

## Deliverables
1. Dialog components with keyboard focus trapping, default button behavior, and accessibility roles.
2. File dialog supporting filters, recent directories, multi-select, thumbnail preview (if available).
3. Notepad app registered with file associations for `.txt` and `.log`.
4. Print pipeline generating text pages for Generic/Text printer and PDF output.
5. Updated Start menu entries (Programs → Accessories → Notepad) and desktop shortcut option.

## Engineering Tasks
- Build dialog templates using UI toolkit menus/buttons/list views.
- Implement find/replace with incremental search and wrap-around toggle.
- Implement go-to line with validation; update status bar (Ln/Col) in real time.
- Support word wrap toggle updating `textarea` CSS and status bar visibility.
- Integrate `svc/clipboard` for copy/paste; handle asynchronous system clipboard gracefully.
- Add Notepad-specific menu commands (Page Setup placeholder, Print, Font…).

## Testing
- **Unit**: Dialog filter matching, recent directory persistence, print job page layout calculations, find/replace logic.
- **Integration**: Playwright scenario creating text file via Explorer, editing in Notepad, using find/replace, toggling word wrap, printing to PNG and PDF printers.
- **Visual**: Snapshots for Notepad main window, Find dialog, Font dialog, Print preview.
- **Accessibility**: Ensure dialog focus trap works; screen reader labels for controls.

## Manual QA Checklist
- Open/save flows from both Notepad and Explorer double-click.
- Word wrap toggle updates horizontal scrollbar availability.
- Font dialog updates text area font family/size; persisted per session or per document as designed.
- Print results stored in VFS spool folder with metadata and accessible via Explorer.
- Error handling for read-only files and unsaved changes on exit (prompt to save).

## Dependencies
- Phases 1–3 complete.

## Exit Criteria
- Automated suites passing.
- Manual QA logged.
- Documentation updated (feature matrix, testing strategy referencing dialogs).
