# Win95Sim Instructions

## Project intent
- Keep the simulator a **single self-contained `index.html`** document that embeds all CSS, JS, templates, fonts, icons, audio, and other assets. Any build tooling must output this structure exactly as described in `docs/architecture.md`.
- Adhere to the ten-phase roadmap captured in the `planning/` docs. Phase 1–2 functionality already ships; new work should reference the relevant phase plan, QA checklist, and feature-parity matrix entry.
- Respect the locked API and CSS token contract defined in `docs/module-apis-v1.md`. Breaking changes require a version bump and doc updates.

## Coding guidelines
- Organize code according to the layered architecture (kernel → services → utilities → shell → apps) so higher layers only depend on lower ones.
- Use the module loader signatures (`define`/`require`) and service interfaces exactly as documented. New modules should register through the loader and expose stable APIs.
- Use only sanctioned third-party libraries (DOMPurify, jsPDF, optional fflate) that are already embedded inline.
- All UI styling must consume the CSS custom properties documented in `docs/module-apis-v1.md` and `references/ui-guidelines.md`; do not hard-code Win95 colors, fonts, or metrics.
- Follow the interaction and accessibility conventions in `references/ui-guidelines.md` (keyboard accelerators, focus outlines, reduced-motion support, etc.).
- When adding assets, comply with `docs/assets.md`: embed as base64, keep total size reasonable (target <10 MB for the final HTML), and record licensing/attribution updates in the About dialog documentation.

## Testing & QA
- Unit tests run with:
  ```bash
  node --test win95sim/tests/phase1.test.js win95sim/tests/phase2.test.js win95sim/tests/phase3.test.js
  ```
- Maintain and extend Node unit tests alongside new services/utilities. For browser features, add Playwright integration, visual, and accessibility coverage per `planning/testing-strategy.md`.
- Before completing a phase deliverable, walk through the matching manual QA checklist in `planning/qa-checklists/` and log outcomes in the planning docs.

## Documentation expectations
- Update affected documents whenever functionality, assets, or testing scope changes (architecture blueprint, implementation phases, risk log, QA checklists, feature-parity matrix, etc.).
- Record new risks or mitigations in `planning/risk-log.md` and keep the phase status fields accurate.

## Asset & licensing responsibilities
- Track third-party asset sources and licenses, ensuring compatibility with MIT-like distribution.
- Include new assets in the sound/icon/wallpaper registries and document them in `docs/assets.md` and the About dialog copy.
