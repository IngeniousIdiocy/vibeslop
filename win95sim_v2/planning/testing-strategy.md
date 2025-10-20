# Testing Strategy (Multi-file Workspace)

## Goals
- Provide confidence that each phase delivers stable, regression-safe functionality across the multi-file source tree.
- Balance fast deterministic tests with high-value browser automation and visual checks while enabling teams to run suites in parallel.
- Ensure coverage of functional, visual, accessibility, performance, and packaging aspects from source modules through the bundled single-file output.

## Test Layers
1. **Unit Tests (Vitest/Jest + jsdom)**
   - Target pure logic modules: `src/core/*`, `src/services/*`, `src/ui/*`, `src/apps/*` state machines, build scripts under `tools/`.
   - Execute via shared Jest/Vitest configuration located in `tests/config/` with path aliases matching source folders.
   - Tests live beside modules (`*.spec.ts`) and in central suites (`tests/services/*`) to allow teams to run focused watch mode.
   - Fast feedback (<2 minutes) suitable for pre-commit hooks and CI thanks to incremental caching.

2. **Integration Tests (Playwright)**
   - Launch both the dev server bundle (`yarn dev`) and the final packaged `dist/win95sim.html` in Chromium, Firefox, WebKit (headless in CI, headed locally when debugging).
   - Use `window.__win95TestApi` from Phase 1 plus new helpers exported by `tests/helpers/runtime.ts` to orchestrate setup/reset and inspect VFS/task/window state.
   - Automate user journeys for each phase, tagged by milestone so suites can run incrementally and in parallel shards.
   - Capture DOM assertions, ensure taskbar/window states, validate VFS changes, confirm dialogs across modular builds.

3. **Visual Regression Tests**
   - Playwright screenshot comparisons with per-phase baselines (desktop idle, Start menu, Explorer views, Notepad, Navigator modes, Paint, Control Panel, screensavers, themes) stored under `tests/visual-baselines/`.
   - Threshold tuned for CRT effects and dithering noise; run in deterministic mode (disable animations during capture) via shared helper.
   - Storybook/Chromatic integration supplements Playwright for component-level coverage per package.

4. **Performance & Reliability Tests**
   - Synthetic benchmarks creating thousands of files to confirm list virtualization throughput executed with Node workers under `tests/perf/`.
   - Window drag/resize responsiveness measurement via Playwright performance APIs for both dev and packaged builds.
   - Memory usage checks ensuring idle footprint stays below target (documented for manual monitoring) with automated regression thresholds.

5. **Accessibility & Interaction Audits**
   - Automated checks using axe-core via Playwright for semantic issues.
   - Keyboard-only scripted tests verifying focus traversal and accelerator handling.
   - Manual checklist for screen reader hints, high-contrast, reduced motion documented per package; issues logged with owning team.

6. **Manual Exploratory Testing**
   - Phase-specific QA checklists stored in `planning/qa-checklists/` (duplicated for multi-file release) executed against packaged build.
   - Regression tours covering app launch/close, drag-drop combos, printer queue operations, error dialogs with focus on cross-package integration points.

7. **Tooling & Packaging Validation**
   - Release pipeline smoke tests confirming `tools/release/build.ts` produces deterministic artifacts.
   - Integrity checks verifying manifest hashes, license injection, and module boundary lint before publishing.

## Tooling
- **Unit**: Vitest/Jest with ts-node/ESBuild transformers, jsdom environment.
- **Browser**: Playwright test runner with per-browser matrix and parallel shards.
- **Visual**: Playwright snapshot feature plus Chromatic/Storybook for component coverage.
- **Accessibility**: axe-core integration and NVDA/VoiceOver manual sweeps scheduled per release.
- **CI**: GitHub Actions or similar running all layers on each push/PR; artifact upload for screenshots, logs, and packaged builds; caching node_modules to speed pipelines.
- **Static Analysis**: Dependency-cruiser/ESLint rules preventing cross-package imports outside approved boundaries.

## Test Data & Fixtures
- Synthetic VFS seeds (JSON) representing large directories, sample documents, images, audio, video, HTML snippets.
- Local HTML pages replicating iframe-blocked headers for Navigator fallback tests.
- Scriptable Minesweeper board seeds to validate deterministic win/loss flows.

## Maintenance Practices
- Tests added in the same phase as features; each package owns its suites and must update them before merging.
- Snapshots reviewed and updated only when visual changes are intentional and approved by design.
- Document all known flaky tests in risk log with mitigation plan and responsible package.
- Keep automation harness up to date with new command IDs and service events; publish helper utilities in `tests/helpers/` instead of duplicating logic.
- Enforce branch protections requiring lint + unit + integration + packaging jobs before merge to maintain compatibility across parallel teams.

## Reporting
- CI publishes test dashboard summarizing unit/integration/visual results.
- Manual QA outcomes logged alongside phase documents with date, tester, and notes.
- Known issues tracked in risk log with severity and target resolution phase.
