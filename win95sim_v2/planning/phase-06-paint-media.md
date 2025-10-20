# Phase 6 – Paint & Media Player (Creative Suite Modules)

**Status:** 🚧 Planned. Paint and Media Player are developed as separate packages under `src/apps/creative/paint/` and `src/apps/media/player/`, sharing rendering utilities from `src/services/graphics/` and audio/video abstractions from `src/services/media/`. Teams can implement these features concurrently with other app phases because they depend solely on the stabilized APIs from Phases 1–5.

## Objectives
- Deliver Paint application mirroring Win95 toolset and canvas behaviour using modularized tools, state, and rendering layers.
- Implement Media Player supporting audio/video playback, playlists, and transport controls with reusable media service wrappers.
- Provide shared creative utilities (color palette store, bitmap encoding helpers) for future creative apps without code duplication.

## Deliverables
1. Paint window with toolbox (pencil, brush, line, rectangle, ellipse, rounded rectangle, text, fill, spray, eraser, color picker), palette, canvas resizing, selection tools, undo/redo stack under `src/apps/creative/paint/components/`.
2. Import/export for BMP and PNG files using shared `src/services/graphics/bitmap.ts`; optional dither filter module toggled via settings to simulate 256-color mode.
3. Media Player window with playlist pane, playback controls (play/pause, stop, seek, volume, mute), visualization placeholder, and file associations defined via manifest `src/apps/media/player/player.app.json`.
4. Integration with clipboard for image copy/paste within Paint and between apps using `@services/clipboard` adapters that accept binary payloads.
5. Menu options for both apps consistent with Win95 (File/Edit/View/Options/Help variants) defined declaratively in JSON per app.
6. Shared creative assets documented in `docs/creative-suite.md` for cross-team reuse.

## Concurrency & Integration Boundaries
- Graphics and media services expose typed interfaces (`IGraphicsContext`, `IMediaSession`) that other teams can consume without editing Paint/Media Player modules.
- Provide stub implementations for tests in `tests/mocks/graphics/` and `tests/mocks/media/` to let parallel teams simulate behaviours.
- Use Storybook stories for each tool/control to support design QA without impacting other feature branches.
- Maintain dedicated `OWNERS` per app folder to guard against conflicting edits.

## Engineering Tasks
- Implement canvas rendering pipeline with offscreen buffer for undo/redo and selection manipulation stored under `src/apps/creative/paint/engine/`.
- Implement flood fill, stroke drawing with pixel-perfect accuracy, text tool overlay using typed tool interfaces.
- Hook dithering filter toggled via menu and integrated with Display color depth setting (consuming `@services/display`).
- Build Media Player playlist manager (add/remove/reorder, save to VFS as `.m3u` optional) and playback logic using shared `MediaSession` wrapper.
- Handle unsupported codecs gracefully with user messaging and fallback suggestions defined in localization files.
- Emit telemetry events for creative/media actions to `@services/telemetry` without coupling to other apps.

## Testing
- **Unit**: Bitmap encode/decode roundtrips, undo stack operations, playlist serialization, audio/video event handling implemented via Jest in `tests/apps/creative/paint/` and `tests/apps/media/player/`.
- **Integration**: Playwright scenario drawing, undoing, saving to VFS, reopening; verifying import/export for BMP/PNG; playing audio, seeking, volume adjustments, playlist reorder on built bundle.
- **Visual**: Snapshots for Paint toolbox/canvas, Media Player playback state, error dialog for unsupported media captured in Storybook.
- **Performance**: Canvas stress test drawing rapid strokes to ensure frame rate acceptable; audio buffer streaming load test via automated benchmark script.

## Manual QA Checklist
- Verify each tool functions correctly (line thickness, fill boundaries, text input editing).
- Clipboard copy/paste from Paint to Notepad (paste as text placeholder message) and to other apps (if applicable).
- Resize canvas with anchor options; confirm background fill.
- Media Player handles sequential playback, loop toggle (if provided), volume slider response.
- Drag/drop files from Explorer to Paint/Media windows opens assets.
- Confirm Paint/Media Player assets remain isolated to their respective folders and build outputs.

## Dependencies
- Phases 1–5 complete (shell, dialogs, VFS, Navigator for image downloads if needed) with public APIs consumed only.

## Exit Criteria
- Automated suites passing (unit, integration, visual, performance, lint).
- Manual QA logged.
- Feature parity matrix updated for creative/media apps with documentation for shared utilities.
- Ownership and dependency lint checks validated.
