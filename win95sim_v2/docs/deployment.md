# Deployment Guide

The single-file artifact produced by the Phase 10 packaging workflow is designed for static
hosting platforms. Follow the steps below for common targets.

## GitHub Pages
1. Run the packaging pipeline: `npm run build && npm run release`.
2. Copy `dist/win95sim.html` to the `docs/` directory or dedicated `gh-pages` branch.
3. Enable GitHub Pages in repository settings and point it at the chosen branch.
4. Optionally rename the artifact to `index.html` for automatic loading.

## Netlify
1. Upload `dist/win95sim.html` via the drag-and-drop UI or CLI.
2. Configure a build command of `npm run build && npm run release` with `dist` as the publish directory.
3. Attach the generated `dist/manifest.json` as a deploy note for hash verification.

## npm Package
1. Ensure `dist/win95sim.html` and `dist/manifest.json` are included in the package `files` list.
2. Update `package.json` with the release version and run `npm publish --access public`.
3. Provide usage instructions for consumers to serve the HTML locally or from a CDN.

Always validate Subresource Integrity hashes after deployment to confirm assets were not mutated
during upload.
