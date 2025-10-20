# Phase 5 – Navigator (Web Suite Package)

**Status:** 🚧 Planned. Navigator lives entirely under `src/apps/internet/navigator/` with supporting services in `src/services/network/`. The app consumes Phase 1–4 APIs only, enabling browser-focused engineers to iterate without touching shell, dialogs, or Explorer modules. Shared browser tooling (DOMPurify config, download manager hooks) is exposed via dedicated packages to prevent merge conflicts with other teams.

## Objectives
- Build the Netscape-inspired Navigator app with iframe, reader, and proxy modes using modular architecture.
- Implement bookmarks, history, address bar, status bar, throbber animation, download manager, and view source capabilities with each subsystem in its own file tree.
- Publish extension points for future browser add-ons (e.g., mail/news) without requiring edits to Navigator core files.

## Deliverables
1. Navigator window chrome with toolbar (Back, Forward, Stop, Reload, Home), address bar, bookmarks menu, throbber built from `src/apps/internet/navigator/components/`.
2. Mode switching UI with persistent per-tab preference (iframe/reader/proxy) persisted via `src/services/settings` namespace `navigator.*`.
3. iframe mode using sandboxed iframe honoring CSP/allow flags defined in `src/services/network/iframe-policy.ts`.
4. Reader mode sanitizing pasted HTML, local files, and data URLs via DOMPurify configuration stored under `src/services/security/sanitizer.ts`.
5. Proxy mode gated behind user configuration, prepending user-supplied proxy base URL with validation utilities in `src/services/network/proxy.ts`.
6. Download manager saving resources to VFS and presenting progress/status using shared download service `src/services/downloads/`.
7. View source window showing sanitized markup for accessible documents built as separate process `src/apps/tools/view-source/`.
8. API documentation `docs/navigator-extension-guide.md` clarifying plugin hooks.

## Concurrency & Integration Boundaries
- Provide stub implementations and mocks so file associations or Start menu updates are declarative (JSON manifests) rather than manual edits.
- Enforce dependency linting to restrict Navigator to `@core`, `@services/*`, and `@ui/*` imports; prevent cross-app couplings.
- Establish `OWNERS` for Navigator and network services to isolate code review responsibilities.
- Offer shared components (throbber, download list items) through `@ui/internet` barrel so other teams can reuse without editing Navigator files.

## Engineering Tasks
- Implement tab/session model (single tab initially) using state machine under `src/apps/internet/navigator/state/session.ts` with extension points for multi-tab future.
- Integrate DOMPurify sanitization service; ensure configuration prevents script execution while retaining necessary tags.
- Handle iframe load errors, blocked framing, and present fallback messaging with localized strings stored under `src/locales/en-US/navigator.json`.
- Implement bookmarks store (add, remove, reorder) persisted via settings and exposed to Start menu favourites through service events.
- Build download pipeline with fetch (same-origin/data) and fallback instructions for blocked resources; surface progress via service events.
- Integrate with process associations for `.url` files and `http/https` protocols using manifest-driven registration.

## Testing
- **Unit**: Sanitization rules, bookmark CRUD, proxy URL validation, download manager state transitions located in `tests/apps/navigator/`.
- **Integration**: Playwright flows loading same-origin test page in iframe mode, handling blocked iframe response, using reader mode for pasted HTML, configuring proxy (with mock server in tests), saving downloads to VFS.
- **Visual**: Snapshots for each mode, download manager pane, view source window using Storybook or Chromatic.
- **Security**: Tests verifying scripts/styles removed in reader mode, sandboxed iframe lacks navigation privileges, proxy validation rejects unsafe hosts.

## Manual QA Checklist
- Toggle between modes and confirm state persists per tab.
- Bookmarks add via menu, appear in Start → Favorites (if integrated) and address dropdown.
- Downloads produce files accessible in Explorer with correct metadata.
- `.url` files double-click open Navigator and load target.
- Proxy warning text clear; disable resets to safe state.
- Confirm Navigator bundle lives exclusively under `src/apps/internet/navigator/` aside from shared services.

## Dependencies
- Phases 1–4 complete (shell, dialogs, VFS, Notepad for view source integration) with no contract changes required.

## Exit Criteria
- Automated suites passing (unit, integration, security, visual).
- Manual QA logged.
- Risk log updated with any outstanding Navigator items.
- Dependency graph check verifies Navigator stays within approved import boundaries.
