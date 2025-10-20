# Phase 10 – Packaging & Release

## Objectives
- Produce final single-file HTML build with minified assets, license banner, and integrity metadata.
- Validate cross-browser compatibility and finalize release documentation.

## Deliverables
1. Build pipeline (Node script or similar) that stitches modules, minifies JS/CSS, compresses assets, and inlines base64 resources into final `win95sim.html`.
2. License banner appended to output including project license and third-party attributions (DOMPurify, jsPDF, fflate if used, asset authors).
3. Hash manifest (SHA-256) and file size report for release notes.
4. About dialog updated with version, API contract version, license details, credits.
5. Release checklist covering QA sign-off, regression status, browser matrix results.
6. Deployment instructions for static hosting (GitHub Pages, etc.).

## Engineering Tasks
- Implement build script reading modular source (likely from development repo) and producing single file according to architecture blueprint.
- Integrate HTML minifier, CSS/JS minifiers, base64 compression pipeline.
- Verify third-party libraries included exactly once with proper wrappers.
- Generate integrity hash, file size metrics, optional Brotli/gzip size estimates.
- Automate license text injection and About dialog generation from data file.
- Prepare release notes template referencing feature parity matrix.

## Testing
- **Unit**: Build script modules (asset bundler, manifest generator) with sample inputs.
- **Integration**: Playwright smoke test running against minified artifact to ensure identical behavior to development build; cross-browser run (Chromium, Firefox, WebKit, Safari manual) verifying no regressions.
- **Visual**: Snapshot diffs verifying minified build identical to reference.
- **Performance**: Measure initial load time, ensure within acceptable envelope (<3s on reference hardware) and document results.

## Manual QA Checklist
- Load final file locally in Chrome/Firefox/Safari; ensure no console errors, all apps launch, screensavers operate, sound toggle works.
- Validate About dialog lists all licenses, version numbers, API contract version.
- Run full regression checklist from earlier phases; ensure no outstanding high-severity issues.
- Confirm export/import (if implemented) works with minified build.

## Dependencies
- Phases 1–9 complete.

## Exit Criteria
- Final build artifact produced and stored in release directory.
- All automated and manual checks green.
- Release notes approved; project ready for distribution.
