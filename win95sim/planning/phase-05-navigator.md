# Phase 5 – Navigator

## Objectives
- Build the Netscape-inspired Navigator app with iframe, reader, and proxy modes.
- Implement bookmarks, history, address bar, status bar, throbber animation, download manager, and view source capabilities.

## Deliverables
1. Navigator window chrome with toolbar (Back, Forward, Stop, Reload, Home), address bar, bookmarks menu, throbber.
2. Mode switching UI with persistent per-tab preference (iframe/reader/proxy).
3. iframe mode using sandboxed iframe honoring CSP/allow flags.
4. Reader mode sanitizing pasted HTML, local files, and data URLs via DOMPurify.
5. Proxy mode gated behind user configuration, prepending user-supplied proxy base URL.
6. Download manager saving resources to VFS and presenting progress/status.
7. View source window showing sanitized markup for accessible documents.

## Engineering Tasks
- Implement tab/session model (single-tab acceptable initially with stub for tabbed future).
- Integrate DOMPurify sanitization service; ensure configuration prevents script execution while retaining necessary tags.
- Handle iframe load errors, blocked framing, and present fallback messaging.
- Implement bookmarks store (add, remove, reorder) persisted in settings during session.
- Build download pipeline with fetch (same-origin/data) and fallback instructions for blocked resources.
- Integrate with process associations for `.url` files and `http/https` protocols.

## Testing
- **Unit**: Sanitization rules, bookmark CRUD, proxy URL validation, download manager state transitions.
- **Integration**: Playwright flows loading same-origin test page in iframe mode, handling blocked iframe response, using reader mode for pasted HTML, configuring proxy (with mock server in tests), saving downloads to VFS.
- **Visual**: Snapshots for each mode, download manager pane, view source window.
- **Security**: Tests verifying scripts/styles removed in reader mode, sandboxed iframe lacks navigation privileges.

## Manual QA Checklist
- Toggle between modes and confirm state persists per tab.
- Bookmarks add via menu, appear in Start → Favorites (if integrated) and address dropdown.
- Downloads produce files accessible in Explorer with correct metadata.
- `.url` files double-click open Navigator and load target.
- Proxy warning text clear; disable resets to safe state.

## Dependencies
- Phases 1–4 complete (shell, dialogs, VFS, Notepad for view source integration).

## Exit Criteria
- Automated suites passing.
- Manual QA logged.
- Risk log updated with any outstanding Navigator items.
