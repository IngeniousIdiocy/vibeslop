# Dialog Framework Overview

Phase 04 introduces a shared dialog framework so later application teams can
integrate modal experiences without duplicating infrastructure. The framework
builds on the kernel event bus and exposes lightweight primitives that remain
agnostic of any particular rendering library.

## Packages

- `@ui/dialogs`
  - `createDialogController` – state container for modal dialogs. Tracks open
    state, dispatches primary/secondary actions, and provides helpers for
    default buttons.
  - `createFocusTrap` – manages keyboard focus for dialog content. Consumers
    register focusable elements and use `focusNext`/`focusPrevious` in response
    to keyboard events to keep focus contained.
- `@services/dialog-state`
  - Persists recent directories for file dialogs and exposes helper utilities
    for filter matching. Events are dispatched on `dialog:directory` when a
    dialog updates its working directory so multiple entry points stay
    synchronized.
- `@services/print`
  - Offers an in-memory spooler that paginates plain-text content. Notepad uses
    the service to generate jobs for Generic/Text printers while other apps can
    reuse the pagination helpers.

## Integration guidelines

1. Create a dialog controller via `createDialogController({ id, title, actions })`
   and connect handlers through `onAction`.
2. Instantiate a focus trap and call `register` for each tabbable element.
   Invoke `focusNext`/`focusPrevious` when handling keyboard navigation to keep
   focus within the dialog root.
3. Use `createDialogStateService` to share state between the various dialog
   entry points. Persist the selected directory with
   `rememberDirectory(dialogId, path)` so future invocations open at the same
   location.
4. For file dialogs, build filters using the shared `DialogFilter` type and use
   `matchFilter(filename, filters)` to resolve the active filter based on the
   selected file name.

These primitives provide enough structure for Phase 04 while keeping the public
surface stable for downstream teams (Paint, WordPad, etc.). Future phases can
layer specific visual implementations without modifying the contracts
established here.
