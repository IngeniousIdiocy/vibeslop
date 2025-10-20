# Win95Sim Project Plan

This directory contains the comprehensive implementation and testing plan for the Windows 95 style web simulator that will live inside a single self-contained HTML document. The plan captures the locked module APIs, CSS token contract, phased development strategy, documentation requirements, QA strategy, and risk management notes so that the actual build can proceed without rework.

## Phase 1 prototype

The first implementation milestone is now available as `index.html`, delivering the kernel, settings, display service, boot splash, CRT viewport, baseline window manager (move/resize/min/max), system menu, and Alt+` task switcher overlay described in the plan. Open the file directly in a browser to interact with the Phase 1 desktop shell.

### Tests

Unit tests covering the core services can be executed with:

```bash
node --test win95sim/tests/phase1.test.js
```

These tests run entirely in Node using a lightweight DOM stub to validate kernel events, settings watchers, display scaling math, and the window lifecycle.

## Contents
- `docs/` — architectural blueprints, module/API specification, phase overview, and asset guidelines.
- `planning/` — milestone deep dives, QA/test plans, and risk tracking artifacts.
- `references/` — UX guidelines and feature parity matrix.

The simulator itself has not been implemented yet. All files here are preparatory documentation used to drive development and validation of the eventual single-file HTML build.
