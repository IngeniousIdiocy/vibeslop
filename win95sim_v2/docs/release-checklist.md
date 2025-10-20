# Release Checklist

The packaging workflow for Phase 10 introduces an auditable checklist so release managers
can validate artifacts before publishing.

## Build Validation
- [ ] Run `npm run build` to produce the module bundle in `dist/`.
- [ ] Execute `npm run release` to generate `dist/win95sim.html` and `dist/manifest.json`.
- [ ] Verify the manifest lists deterministic hashes for every bundled file.

## Quality Gates
- [ ] Confirm automated unit tests (`npm test`) pass on the release commit.
- [ ] Perform smoke test of `dist/win95sim.html` in Chromium-based browser.
- [ ] Capture gzip and Brotli sizes and compare against budget noted in `planning/risk-log.md`.

## Documentation
- [ ] Update `docs/deployment.md` with any host-specific instructions discovered.
- [ ] Record release metadata in `planning/qa-checklists/phase-10.md`.
- [ ] Append changelog entry summarizing key improvements and fixes.

## Automation
- [ ] Tag the release commit following `v<major>.<minor>.<patch>` semantics.
- [ ] Push the tag and create a GitHub release attaching the generated manifest.
- [ ] Trigger CI workflow `release.yml` (dry run allowed during development).
