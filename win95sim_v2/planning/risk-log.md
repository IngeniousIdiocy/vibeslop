# Risk Log

| ID | Risk | Phase Impact | Likelihood | Severity | Mitigation | Owner | Status |
|----|------|--------------|------------|----------|------------|-------|--------|
| R1 | Navigator blocked by CSP/X-Frame-Options prevents iframe mode | Phase 5 | High | Medium | Provide reader/proxy modes with clear messaging; unit tests for sanitized content; document limitations. | Engineering | Open |
| R2 | Playwright visual diffs flaky due to CRT effects and animation jitter | Phase 1+ | Medium | Medium | Disable animations during capture; use deterministic seeds; adjust thresholds; provide Storybook baselines per package. | QA | Open |
| R3 | Bundled `dist/win95sim.html` plus assets exceed target download size (>10 MB) | Phase 10 | Medium | High | Compress assets, lazy-load base64 data, review audio duration, optimize sprite sheets, monitor bundle analyzer in CI. | Engineering | Open |
| R4 | Performance degradation with large VFS directories (10k files) | Phase 2 | Medium | High | Implement list virtualization; benchmark via automated performance tests; optimize DOM updates. | Engineering | Open |
| R5 | Accessibility regressions (keyboard focus, high contrast) introduced late | Phase 3+ | Low | High | Maintain accessibility checks in automation; include manual keyboard tours in QA checklists. | QA | Open |
| R6 | Printer PDF generation incorrect or incompatible with readers | Phase 8 | Medium | Medium | Create unit tests validating jsPDF output metadata; test across multiple PDF viewers; provide fallback PNG export. | Engineering | Open |
| R7 | Sounds blocked by browser autoplay policies | Phase 9 | Medium | Low | Defer audio initialization until first user gesture; provide toggle in Sounds control panel; add tests verifying gating. | Engineering | Open |
| R8 | Minesweeper/randomized features create non-deterministic tests | Phase 7 | Medium | Medium | Inject deterministic seeds during automated tests; expose seed override in `__win95TestApi`. | QA | Open |
| R9 | Proxy mode misuse introduces privacy concerns | Phase 5 | Low | Medium | Display explicit warnings; disable by default; allow user-supplied endpoint only via settings. | Product | Open |
| R10 | Build pipeline fails to inline third-party licenses | Phase 10 | Low | Medium | Add CI check verifying license text presence; unit test for About dialog content; enforce `docs/licenses.json` update gate. | Engineering | Open |
| R11 | Interim Explorer lacks recycle bin/context menu parity causing user confusion | Phase 2 | Medium | Low | Document interim limitations, gate destructive actions behind follow-up work, prioritize recycle bin/context menu backlog items in next iteration. | Product | Open |
| R12 | Cross-team changes break module boundaries causing merge conflicts | Phase 1+ | Medium | Medium | Enforce dependency lint rules, require CODEOWNERS approval per package, run change detection scripts in CI. | Engineering | Open |
| R13 | Shared type definitions drift from implementation causing runtime mismatches | Phase 1+ | Medium | Medium | Generate `.d.ts` files from source in CI, run API snapshot tests, publish versioned contracts. | Engineering | Open |
