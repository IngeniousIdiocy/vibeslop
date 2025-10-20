# Experience Extensibility Guide

Phase 09 introduces the shared services that allow contributors to add themes,
locales, and experience plug-ins without modifying core runtime files. Follow
the guidance below to extend the simulator safely.

## Adding a theme

1. **Create a theme manifest** – Add a JSON file under `src/styles/themes/`
   describing the theme. Each manifest should provide an `id`, human readable
   `label`, optional `metadata`, and a map of CSS custom property overrides via
   `tokens`.
   ```json
   {
     "id": "sunset",
     "label": "Sunset",
     "tokens": {
       "--win95-color-window": "#f5d7b2",
       "--win95-color-highlight": "#d14a00"
     }
   }
   ```
2. **Register the theme** – Themes are managed by `createThemeService`. Pass
   your manifest when constructing the service or call
   `themeService.registerTheme(manifest)` at runtime. Registration throws if an
   `id` collides, ensuring independent workstreams do not overwrite each other.
3. **React to theme changes** – Modules can subscribe to
   `themeService.onThemeChanged(handler)` to update UI state. The event payload
   includes the active `theme`, `previous` theme, and whether reduced motion is
   enabled. UI code can also read the currently applied CSS tokens from
   `themeService.getTokens()` when computing inline styles.
4. **Respect reduced motion** – When the accessibility toggle is enabled the
   theme service automatically zeroes out token names starting with
   `--motion-duration-` and marks the root element with `data-reduced-motion`.
   Avoid reintroducing long animations in feature modules; instead, read
   `themeService.isReducedMotionEnabled()` before starting custom transitions.

## Adding a locale

1. **Create a catalog** – Drop a JSON file inside `src/assets/locales/` with the
   locale identifier, optional `direction`, and a `messages` object containing
   key/value translations.
2. **Expose a loader** – Provide a loader function that returns the catalog and
   pass it to `createLocalizationService({ loaders: { 'fr-FR': () => frCatalog }})`.
   Loaders may return a Promise for lazy imports. The default locale loader must
   remain synchronous so boot code can translate immediately.
3. **Translate strings** – Use `localizationService.translate(key, replacements)`
   to access messages. Missing keys fall back to the default locale and finally
   to the key name, so incremental catalogs do not break the shell.
4. **Respond to locale changes** – Subscribe to
   `localizationService.onLocaleChanged(handler)` to update UI after a user
   switches languages. The event includes the new catalog and previous locale.

## Screensavers and audio hooks

Future phases will add plug-in manifests for screensavers and system sounds.
These will follow the same pattern: JSON manifests registered through
phase-specific services so teams can contribute assets without touching shared
code. Until then, keep new experience features isolated under
`src/apps/system/experience/` to avoid merge conflicts.
