# Phase 10 – Packaging & Release (Multi-file Source → Single-file Output)

**Status:** 🚧 Planned. This phase finalizes the release tooling that consumes the multi-file workspace and emits the legacy single-file distribution. Packaging scripts live under `tools/release/` so release engineers can iterate independently once earlier phases stabilize.

## Objectives
- Produce final single-file HTML build with minified assets, license banner, and integrity metadata sourced from modular directories.
- Validate cross-browser compatibility and finalize release documentation, ensuring reproducible builds from CI or local environments.
- Establish long-term maintenance workflows (hotfix branches, version bumps) that respect module boundaries introduced in Phase 1.

## Deliverables
1. Build pipeline (Node script or similar) that stitches modules, minifies JS/CSS, compresses assets, and inlines base64 resources into final `dist/win95sim.html` while preserving source maps.
2. License banner appended to output including project license and third-party attributions (DOMPurify, jsPDF, fflate if used, asset authors) pulled from `docs/licenses.json`.
3. Hash manifest (SHA-256) and file size report for release notes plus optional zipped distributions, stored in `dist/manifest.json`.
4. About dialog updated with version, API contract version, license details, credits via generated data file `src/apps/system/about/about.data.json`.
5. Release checklist covering QA sign-off, regression status, browser matrix results maintained in `docs/release-checklist.md`.
6. Deployment instructions for static hosting (GitHub Pages, Netlify) and npm package distribution documented in `docs/deployment.md`.
7. Automation to tag releases, update changelog, and create GitHub releases using GitHub Actions workflow in `.github/workflows/release.yml`.

## Engineering Tasks
- Implement build script reading modular source and producing single file according to architecture blueprint, leveraging Rollup/ESBuild pipeline configured in `tools/release/build.ts`.
- Integrate HTML minifier, CSS/JS minifiers, base64 compression pipeline; ensure deterministic chunk ordering for consistent diffs.
- Verify third-party libraries included exactly once with proper wrappers; fail build if duplicates detected.
- Generate integrity hash, file size metrics, optional Brotli/gzip size estimates and embed them into release notes template.
- Automate license text injection and About dialog generation from data file using script `tools/release/generate-about.ts`.
- Prepare release notes template referencing feature parity matrix and risk log updates; integrate with PR automation.
- Set up CI job to build, run regression tests, and attach artifacts for manual review.

## Testing
- **Unit**: Build script modules (asset bundler, manifest generator) with sample inputs executed via Jest under `tests/tools/release/`.
- **Integration**: Playwright smoke test running against minified artifact to ensure identical behaviour to development build; cross-browser run (Chromium, Firefox, WebKit, Safari manual) verifying no regressions.
- **Visual**: Snapshot diffs verifying minified build identical to reference using `yarn test:visual --release`.
- **Performance**: Measure initial load time, ensure within acceptable envelope (<3s on reference hardware) and document results in release notes.
- **Security**: Verify Subresource Integrity hashes and Content Security Policy meta tags applied correctly.

## Manual QA Checklist
- Load final file locally in Chrome/Firefox/Safari; ensure no console errors, all apps launch, screensavers operate, sound toggle works.
- Validate About dialog lists all licenses, version numbers, API contract version.
- Run full regression checklist from earlier phases; ensure no outstanding high-severity issues.
- Confirm export/import (if implemented) works with minified build.
- Verify release automation publishes expected assets and tags when run in dry-run mode.

## Dependencies
- Phases 1–9 complete with stable module contracts and documentation.

## Exit Criteria
- Final build artifact produced and stored in release directory with accompanying manifest and hashes.
- All automated and manual checks green; CI release pipeline passes without intervention.
- Release notes approved; project ready for distribution with signed tag and changelog entry.
