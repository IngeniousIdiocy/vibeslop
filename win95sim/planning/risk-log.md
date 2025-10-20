# Risk Log

| ID | Risk | Phase Impact | Likelihood | Severity | Mitigation | Owner | Status |
|----|------|--------------|------------|----------|------------|-------|--------|
| R1 | Navigator blocked by CSP/X-Frame-Options prevents iframe mode | Phase 5 | High | Medium | Provide reader/proxy modes with clear messaging; unit tests for sanitized content; document limitations. | Engineering | Open |
| R2 | Playwright visual diffs flaky due to CRT effects and animation jitter | Phase 1+ | Medium | Medium | Disable animations during capture; use deterministic seeds; adjust thresholds; document in QA checklist. | QA | Open |
| R3 | Single HTML file size exceeds practical download limits (>10 MB) | Phase 10 | Medium | High | Compress assets, lazy-load base64 data, review audio duration, optimize sprite sheets. | Engineering | Open |
| R4 | Performance degradation with large VFS directories (10k files) | Phase 2 | Medium | High | Implement list virtualization; benchmark via automated performance tests; optimize DOM updates. | Engineering | Open |
| R5 | Accessibility regressions (keyboard focus, high contrast) introduced late | Phase 3+ | Low | High | Maintain accessibility checks in automation; include manual keyboard tours in QA checklists. | QA | Open |
| R6 | Printer PDF generation incorrect or incompatible with readers | Phase 8 | Medium | Medium | Create unit tests validating jsPDF output metadata; test across multiple PDF viewers; provide fallback PNG export. | Engineering | Open |
| R7 | Sounds blocked by browser autoplay policies | Phase 9 | Medium | Low | Defer audio initialization until first user gesture; provide toggle in Sounds control panel; add tests verifying gating. | Engineering | Open |
| R8 | Minesweeper/randomized features create non-deterministic tests | Phase 7 | Medium | Medium | Inject deterministic seeds during automated tests; expose seed override in `__win95TestApi`. | QA | Open |
| R9 | Proxy mode misuse introduces privacy concerns | Phase 5 | Low | Medium | Display explicit warnings; disable by default; allow user-supplied endpoint only via settings. | Product | Open |
| R10 | Build pipeline fails to inline third-party licenses | Phase 10 | Low | Medium | Add CI check verifying license text presence; unit test for About dialog content. | Engineering | Open |
