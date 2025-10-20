# Testing Strategy

## Goals
- Provide confidence that each phase delivers stable, regression-safe functionality.
- Balance fast deterministic tests with high-value browser automation and visual checks.
- Ensure coverage of functional, visual, accessibility, and performance aspects.

## Test Layers
1. **Unit Tests (Node + JSDOM)**
   - Target pure logic modules: `core/kernel`, `svc/settings`, `svc/vfs`, `util/path`, `util/bitmap`, command parsers, printer queues.
   - Execute via Node test runner (currently `node --test` harnesses in `tests/phase1.test.js` and `tests/phase2.test.js`) using a helper that loads the bundled script and exposes the SFM registry.
   - Fast feedback (<2 minutes) suitable for pre-commit hooks and CI.

2. **Integration Tests (Playwright)**
   - Launch the actual HTML file in Chromium, Firefox, WebKit (headless in CI, headed locally when debugging).
   - Use `window.__win95TestApi` to orchestrate setup/reset and to inspect VFS/task/window state.
   - Automate user journeys for each phase, tagged by milestone so suites can run incrementally.
   - Capture DOM assertions, ensure taskbar/window states, validate VFS changes, confirm dialogs.

3. **Visual Regression Tests**
   - Playwright screenshot comparisons with per-phase baselines (desktop idle, Start menu, Explorer views, Notepad, Navigator modes, Paint, Control Panel, screensavers, themes).
   - Threshold tuned for CRT effects and dithering noise; run in deterministic mode (disable animations during capture).

4. **Performance & Reliability Tests**
   - Synthetic benchmarks creating thousands of files to confirm list virtualization throughput.
   - Window drag/resize responsiveness measurement via Playwright performance APIs.
   - Memory usage checks ensuring idle footprint stays below target (documented for manual monitoring).

5. **Accessibility & Interaction Audits**
   - Automated checks using axe-core via Playwright for semantic issues.
   - Keyboard-only scripted tests verifying focus traversal and accelerator handling.
   - Manual checklist for screen reader hints, high-contrast, reduced motion.

6. **Manual Exploratory Testing**
   - Phase-specific QA checklists stored in `planning/qa-checklists/`.
   - Regression tours covering app launch/close, drag-drop combos, printer queue operations, error dialogs.

## Tooling
- **Unit**: Node, Vitest/Jest, jsdom.
- **Browser**: Playwright with test runner, per-browser matrix.
- **Visual**: Playwright snapshot feature.
- **Accessibility**: axe-core integration.
- **CI**: GitHub Actions or similar running all layers on each push/PR; artifact upload for screenshots and logs.

## Test Data & Fixtures
- Synthetic VFS seeds (JSON) representing large directories, sample documents, images, audio, video, HTML snippets.
- Local HTML pages replicating iframe-blocked headers for Navigator fallback tests.
- Scriptable Minesweeper board seeds to validate deterministic win/loss flows.

## Maintenance Practices
- Tests added in the same phase as features; failing tests block promotion.
- Snapshots reviewed and updated only when visual changes are intentional and approved.
- Document all known flaky tests in risk log with mitigation plan.
- Keep automation harness up to date with new command IDs and service events.

## Reporting
- CI publishes test dashboard summarizing unit/integration/visual results.
- Manual QA outcomes logged alongside phase documents with date, tester, and notes.
- Known issues tracked in risk log with severity and target resolution phase.
