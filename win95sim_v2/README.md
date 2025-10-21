# Win95Sim V2

Win95Sim V2 re-imagines the original single-file Windows 95 simulator as a modular, multi-file web application. The new workspace separates concerns across packages so teams can collaborate in parallel after the shared desktop shell lands in Phase 01.

## Why a V2?
- **Scalable architecture** – Source lives under `src/` by domain: foundational `core/`, cross-cutting `services/`, composable `features/`, individual `apps/`, and the desktop `shell/`.
- **Concurrent delivery** – Once the platform baseline is complete, phases 02–10 can advance simultaneously with minimal merge contention.
- **Tooling-first workflow** – Dedicated build steps emit a production `dist/` bundle while preserving a modular developer experience.

## Repository layout
```
win95sim_v2/
├── AGENTS.md              # Development guardrails and collaboration contract
├── README.md              # You are here
├── docs/                  # Architecture, API, and asset references
├── planning/              # Phase playbooks, QA checklists, risk log
├── references/            # Feature parity matrix, UI guidelines, shared research
├── src/                   # Source code organized by layer
├── tests/                 # Node test suites aligned to each phase
└── tools/                 # Build and packaging scripts
```
`src/` and `tools/` will be created during Phase 01. Their ownership and responsibilities are already defined in `docs/architecture.md` so downstream teams can plan their work.

## Getting started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the Node unit tests:
   ```bash
   npm test
   ```
3. Build the distributable bundle:
   ```bash
   npm run build
   ```
   The build writes `dist/index.html`, a hashed JS bundle under `dist/assets/`, and
   a manifest for downstream tooling.

## Development principles
- Stabilize shared contracts (module APIs, CSS tokens, event buses) before parallelizing work.
- Keep each phase within its assigned folders to avoid cross-team churn.
- Document all new capabilities, assets, and risks as you build them.

## Built-in desktop apps
The current build ships working Win95 staples that double as reference integrations:

- **Internet Explorer** (`shell:start:internet-explorer`) – Navigator UI with toolbar, address bar, and sandboxed iframe viewport.
- **Paint** (`shell:start:paint`) – Canvas-based paint studio backed by the Phase 06 engine and palette tooling.
- **Notepad** (`shell:start:notepad`) – Phase 04 text editor with word wrap, font settings, and print integration.
- **Windows Explorer** (`shell:start:explorer`) – VFS-driven file browser wired to the desktop layout service.

Desktop shortcuts for these apps are pre-installed and the Start menu mirrors the same commands so downstream teams can see how to register additional experiences.

## Roadmap snapshot
The planning folder captures detailed guidance for each phase. Highlights:
- **Phase 01** – Multi-window desktop shell, module registry, asset pipeline, shared UI tokens.
- **Phase 02** – Virtual file system explorer powered by the new data services.
- **Phase 03** – Command shell + scripting engine.
- **Phase 04** – Notepad and dialog frameworks.
- **Phase 05** – Internet Explorer-like navigator.
- **Phase 06** – Paint & media utilities.
- **Phase 07** – Games and accessories.
- **Phase 08** – Control Panel and printers.
- **Phase 09** – Polish, accessibility, localization.
- **Phase 10** – Packaging, deployment, and long-term support.

Consult the corresponding QA checklists and risk log before shipping any phase milestone.

## Contributing
1. Coordinate ownership in `planning/phase-01-window-manager.md` and the architecture doc.
2. Keep pull requests focused on a single phase deliverable.
3. Update documentation and tests alongside code changes.

## License
Win95Sim V2 inherits the original Win95Sim licensing. Confirm third-party asset compatibility via `docs/assets.md` before merging.
