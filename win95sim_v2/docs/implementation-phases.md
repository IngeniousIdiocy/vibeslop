# Implementation Phases

The roadmap mirrors the original Win95Sim goals while accommodating the multi-file workspace. Phase 01 establishes the shared foundation so remaining phases can execute in parallel.

| Phase | Focus | Key Deliverables | Dependencies |
|-------|-------|------------------|--------------|
| 01 | Desktop shell & tooling | Module registry, window manager, build tooling, lint/test config, CSS token library | None (bootstrapping) |
| 02 | Virtual File System Explorer | Explorer app, filesystem service, desktop icons | Phase 01 platform |
| 03 | Command Shell | Terminal UI, scripting runtime, process service integrations | Phase 01 platform |
| 04 | Productivity Apps | Notepad app, dialog framework, clipboard integration | Phases 01, 02 (read-only FS) |
| 05 | Navigator & Web Stack | Navigator app, networking service, HTML renderer bridge | Phases 01, 02 |
| 06 | Paint & Media | Paint app, media service, bitmap editor components | Phases 01, 02 |
| 07 | Games & Utilities | Minesweeper, Solitaire, calculator, sound recorder | Phase 01 platform |
| 08 | Control Panel & Devices | Settings hub, printer manager, driver manifests | Phases 01, 02 |
| 09 | Polish & Accessibility | Localization, high contrast mode, performance & QA | Phases 01–08 |
| 10 | Packaging & Release | Build final `dist/`, telemetry opt-in, documentation freeze | Phases 01–09 |

## Phase sequencing & concurrency
- **Phase 01** builds the module registry, dependency graph, CSS tokens, and base shell. It also writes the code ownership map and `tools/` build scripts.
- After **Phase 01** lands, phases 02–10 proceed concurrently. Shared dependencies (e.g., services) provide stubs so teams can work without blocking each other.
- Each phase maintains compatibility with the contracts in `docs/module-apis-v2.md`. Breaking changes require cross-phase coordination logged in the risk log.

## Definition of done
Every phase must:
1. Ship automated tests (`tests/phaseXX-*.test.js` or Playwright suites).
2. Update relevant planning docs with status, risks, and QA results.
3. Produce updated documentation (architecture, assets, parity matrix) when shared contracts move.
4. Generate release notes entry describing user-facing behavior.

## Release trains
- We target a minor release after each phase milestone. Phases completing concurrently can share a release train if they pass integration tests.
- Release management (Phase 10) owns tagging, changelog compilation, and CDN publishing.
