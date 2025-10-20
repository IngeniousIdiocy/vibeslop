# Asset & Licensing Guidelines

The multi-file architecture changes how we organize and ship assets. Follow these rules to keep the bundle size low and licensing clear.

## Directory layout
```
src/
  assets/
    audio/
    fonts/
    icons/
    wallpapers/
dist/
  assets/
    audio/
    fonts/
    icons/
    wallpapers/
```
- Place raw source assets under `src/assets/` and reference them from manifests.
- The build pipeline optimizes and copies assets into `dist/assets/`.

## Size budgets
- Individual audio files ≤ 500 KB (compressed Ogg/MP3).
- Icons ≤ 32 KB (PNG) and also export 16×16 and 32×32 variants.
- Wallpaper images ≤ 400 KB (JPEG/WebP).
- Total `dist/` size target: ≤ 10 MB.

## Attribution tracking
Maintain `docs/assets-attribution.csv` (created during Phase 01) with:
- Asset name & path
- Source URL / license
- Notes on modifications

Additions must update:
1. The CSV registry
2. `references/ui-guidelines.md` if the asset affects UI patterns
3. The About dialog copy (Phase 05 owner)

## Build tooling
Phase 01 introduces:
- Image compression via `sharp`
- Audio normalization via `ffmpeg` (optional, document CLI usage)
- Hash-based cache busting for `dist/assets/`

Developers should run:
```bash
npm run assets:optimize
```
prior to committing large asset changes (script to land in Phase 01).

## Licensing checklist
- Confirm permissive licenses (CC-BY, CC0, MIT). Avoid GPL assets.
- Record attribution text in the CSV and in release notes when applicable.
- Store proof-of-license screenshots in `references/assets/` (Phase 01 will add the folder).

## Localization & accessibility
- Provide alt text or aria labels for decorative imagery in the metadata manifests.
- Localize audio transcripts where applicable during Phase 09.
