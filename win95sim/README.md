# Win95Sim Project Plan

This directory contains the comprehensive implementation and testing plan for the Windows 95 style web simulator that will live inside a single self-contained HTML document. The plan captures the locked module APIs, CSS token contract, phased development strategy, documentation requirements, QA strategy, and risk management notes so that the actual build can proceed without rework.

## Phase 1 prototype

The first implementation milestone is now available as `index.html`, delivering the kernel, settings, display service, boot splash, CRT viewport, baseline window manager (move/resize/min/max), system menu, and Alt+` task switcher overlay described in the plan. Open the file directly in a browser to interact with the Phase 1 desktop shell.

## Phase 2 – Virtual File System and Explorer

Phase 2 layers on an in-memory virtual file system with drive roots, special folders, shortcut support, basic search, and change notifications. The Explorer application now ships as part of the single HTML file, providing a desktop-focused tree and list view, quick actions (new folder/document, delete), directory navigation, and live updates driven by the VFS watcher API. The boot flow seeds sample content under `C:\Documents` and launches Explorer targeting the desktop.

### Tests

Unit tests covering the core services can be executed with:

```bash
node --test win95sim/tests/phase1.test.js win95sim/tests/phase2.test.js win95sim/tests/phase3.test.js
```

These tests run entirely in Node using a lightweight DOM stub to validate kernel events, settings watchers, display scaling math, window lifecycle, VFS path semantics, watcher notifications, and Explorer-facing file operations.

## Contents
- `docs/` — architectural blueprints, module/API specification, phase overview, and asset guidelines.
- `planning/` — milestone deep dives, QA/test plans, and risk tracking artifacts.
- `references/` — UX guidelines and feature parity matrix.

The simulator is incrementally implemented inside `index.html`. Documentation in this folder continues to track the remaining phases, QA strategy, and reference material that guide further development.
