# Planning Overview

This directory mirrors the original Win95Sim planning set with updates for the modular workspace.

## Structure
- `phase-*.md` – Detailed implementation guides per phase with objectives, deliverables, and ownership.
- `qa-checklists/` – Manual validation steps before declaring a phase complete.
- `testing-strategy.md` – Automation roadmap across unit, integration, visual, and accessibility coverage.
- `risk-log.md` – Shared risks, mitigations, and owners.

## Concurrency readiness
Phase 01 defines the governance model that allows phases 02–10 to develop simultaneously:
- Shared contracts (`core/`, `services/`) gain versioning and change-control gates.
- Directory ownership lists guard against conflicting edits.
- Build tooling supports incremental compilation so teams avoid touching each other’s bundles.

Keep phase docs updated with status and decision logs. Downstream teams rely on this documentation to plan their work without stepping on each other.
