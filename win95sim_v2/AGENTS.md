# Win95Sim V2 Instructions

## Project intent
- Deliver Win95Sim as a modular multi-file application rooted in the `src/` workspace and emitted to a distributable `dist/` bundle.
- Adopt the ten-phase roadmap captured in `planning/` with the mandate that Phase 01 lays the shared platform foundation so Phases 02–10 can develop in parallel without merge conflicts.
- Maintain forward compatibility with the legacy single-file simulator by exposing equivalent public services and shell affordances documented in `docs/module-apis-v2.md`.

## Coding guidelines
- Follow the layered architecture defined in `docs/architecture.md`: `core/` → `services/` → `features/` → `apps/` → `shell/` and shared `ui/` primitives. Higher layers may depend only on the layers beneath them.
- Modules must register through the `createModuleRegistry` contract and expose typed interfaces declared in `docs/module-apis-v2.md`.
- Keep build outputs deterministic. Bundle tooling must support incremental builds so phase teams can integrate without touching other packages.
- Use the shared CSS tokens under `src/ui/tokens.css` (to be created in Phase 01) rather than hard-coded metrics or colors.
- Add new third-party dependencies only inside `package.json` and document them in `docs/assets.md`.

## Testing & QA
- Node unit tests live in `tests/` and should mirror the phase roadmap (`phase01-window-manager.test.js`, etc.). Use Node's native test runner.
- Browser automation, visual, and accessibility coverage should target the built `dist/` output per `planning/testing-strategy.md`.
- Before closing a phase, complete the manual QA checklist in `planning/qa-checklists/` and log outcomes in the phase doc.

## Documentation expectations
- Update architecture, implementation phases, risk log, and parity references whenever a shared contract changes.
- Record new shared APIs in `docs/module-apis-v2.md` and surface risks that could impact concurrent teams.

## Collaboration & concurrency
- Respect the workspace ownership map in `docs/architecture.md`. Do not modify folders owned by another phase without coordination.
- Keep shared `core/` and `services/` code backward compatible. Breaking changes require RFC notes in `planning/phase-01-window-manager.md` and sign-off from dependent phase owners.
