# Asset Strategy & Licensing

## Iconography
- **Style**: Recreated Windows 95 style icons at 16×16 and 32×32 resolutions.
- **Format**: Base64 PNG sprite sheets with transparent backgrounds; supplemental inline SVG for scalable symbols.
- **Source**: Custom-drawn or sourced from permissively licensed icon packs (e.g., CC0/CC-BY) with attribution listed in `Start → Help → About`.
- **Registry IDs**: `ico-notepad`, `ico-explorer`, `ico-navigator`, `ico-paint`, `ico-minesweeper`, `ico-media`, `ico-calc`, `ico-command`, `ico-folder`, `ico-file`, `ico-file-txt`, `ico-file-png`, `ico-file-bmp`, `ico-file-wav`, `ico-file-mp3`, `ico-shortcut`, `ico-recycle`, `ico-controlpanel`, `ico-printers`, `ico-mycomputer`, `ico-network`.

## Audio
- **Content**: Startup, shutdown, system notification, minimize/maximize, menu open/execute sounds.
- **Format**: Short (<1s) 22kHz mono WAV files embedded as base64 strings, decoded once after the first user gesture.
- **Licensing**: Original compositions or CC0 samples with attribution.
- **Schemes**: `classic` (default) and `none`. Additional schemes can be added by extending the sound manifest.

## Fonts
- **UI Font**: Custom pixel-friendly WOFF2 approximating MS Sans Serif (`W95Sans`).
- **Monospace**: WOFF2 approximating Fixedsys (`W95Fixed`).
- **Embedding**: `@font-face` declarations with `font-display: swap`. Licensing statement stored in About dialog.

## Wallpapers
- **Included**: Clouds, solid colors, abstract texture tiles.
- **Format**: Base64 PNG/JPEG assets referenced via wallpaper registry IDs.
- **Usage**: Configurable as tile/center/stretch from Display Control Panel.

## Screensaver Assets
- 3D Pipes and Starfield implemented via procedural canvas rendering (no external models).
- Optional textures (if needed) included as inline base64 PNG.

## Printer Output Templates
- PNG pages for Generic/Text printer created dynamically (no static assets).
- jsPDF handles PDF output; ensure license text from jsPDF is included.

## Attribution & Licensing Requirements
- Maintain a license appendix in `Start → Help → About` referencing all third-party assets.
- `docs/assets.md` is kept up to date as assets are finalized, including source URLs, creators, and license terms.
- Ensure all assets are compatible with distribution under MIT or similarly permissive terms.

## Asset Pipeline Guidelines
- Store raw editable assets (e.g., PSD, AI, WAV project files) outside the single HTML file repository to keep the deliverable self-contained.
- Use build scripts to convert assets to optimized base64 strings with deduplication.
- Sprite sheets should pack icons tightly to minimize base64 length.
- Compress audio via ADPCM or μ-law if necessary to keep total file size reasonable (<10 MB target for final HTML).
