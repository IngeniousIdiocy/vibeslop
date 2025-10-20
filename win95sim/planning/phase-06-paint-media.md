# Phase 6 – Paint & Media Player

## Objectives
- Deliver Paint application mirroring Win95 toolset and canvas behavior.
- Implement Media Player supporting audio/video playback, playlists, and transport controls.

## Deliverables
1. Paint window with toolbox (pencil, brush, line, rectangle, ellipse, rounded rectangle, text, fill, spray, eraser, color picker), palette, canvas resizing, selection tools, undo/redo stack.
2. Import/export for BMP and PNG files using `util/bitmap`; optional dither filter to simulate 256-color mode.
3. Media Player window with playlist pane, playback controls (play/pause, stop, seek, volume, mute), visualization placeholder, file association for audio/video types.
4. Integration with clipboard for image copy/paste within Paint and between apps.
5. Menu options for both apps consistent with Win95 (File/Edit/View/Options/Help variants).

## Engineering Tasks
- Implement canvas rendering pipeline with offscreen buffer for undo/redo and selection manipulation.
- Implement flood fill, stroke drawing with pixel-perfect accuracy, text tool overlay.
- Hook dithering filter toggled via menu and integrated with Display color depth setting.
- Build Media Player playlist manager (add/remove/reorder, save to VFS as `.m3u` optional) and playback logic using HTMLAudioElement/HTMLVideoElement.
- Handle unsupported codecs gracefully with user messaging and fallback suggestions.

## Testing
- **Unit**: Bitmap encode/decode roundtrips, undo stack operations, playlist serialization, audio/video event handling.
- **Integration**: Playwright scenario drawing, undoing, saving to VFS, reopening; verifying import/export for BMP/PNG; playing audio, seeking, volume adjustments, playlist reorder.
- **Visual**: Snapshots for Paint toolbox/canvas, Media Player playback state, error dialog for unsupported media.
- **Performance**: Canvas stress test drawing rapid strokes to ensure frame rate acceptable.

## Manual QA Checklist
- Verify each tool functions correctly (line thickness, fill boundaries, text input editing).
- Clipboard copy/paste from Paint to Notepad (paste as text placeholder message) and to other apps (if applicable).
- Resize canvas with anchor options; confirm background fill.
- Media Player handles sequential playback, loop toggle (if provided), volume slider response.
- Drag/drop files from Explorer to Paint/Media windows opens assets.

## Dependencies
- Phases 1–5 complete (shell, dialogs, VFS, Navigator for image downloads if needed).

## Exit Criteria
- Automated suites passing.
- Manual QA logged.
- Feature parity matrix updated for creative/media apps.
