# QA Checklist – Phase 2

_Current functionality (Phase 2 initial drop):_
- [x] Create folders/files via Explorer toolbar.
- [x] Delete removes items from the active folder.
- [x] Search returns name matches within the selected scope (no content search yet).

_Outstanding for future iterations:_
- [ ] Rename inline (F2) updates VFS metadata.
- [ ] Drag/drop with Ctrl=Copy, Shift=Move, Alt=Shortcut behaves correctly.
- [ ] Delete sends items to Recycle Bin; Restore returns to original path.
- [ ] Empty Recycle Bin clears contents after confirmation.
- [ ] Search finds files by name and content; double-click result opens location.
- [ ] Import local file via drag/drop or dialog.
- [ ] Dependency lint confirms Explorer/VFS code only imports from `@core`, `@services`, `@ui`, or local modules.
