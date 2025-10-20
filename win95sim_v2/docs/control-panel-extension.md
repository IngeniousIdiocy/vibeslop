# Control Panel Extension Guide

The Control Panel hub is manifest driven so individual teams can add applets
without editing shared hub source. Follow these steps when introducing a new
applet:

1. **Create the module**
   - Place implementation files under `src/apps/system/control-panel/applets/<id>/`.
   - Export a `createApplet(context, manifest)` function that returns a
     `ControlPanelApplet` instance. Reuse the shared context for access to
     `@services/display`, `@services/settings`, and `@services/print`.
2. **Register in the manifest**
   - Append an entry to `src/apps/system/control-panel/control-panel.manifest.json`
     with a unique `id`, title, category, keywords, and module path.
   - IDs are slug based (e.g., `network`) and must remain stable for saved state.
3. **Rely on the registry**
   - The Control Panel boot sequence calls
     `registerControlPanelApplets(registry, context)` which loads every manifest
     entry via dynamic imports and registers it under `apps/control-panel/<id>`.
   - Avoid manual registry calls inside the applet to prevent duplicate
     instances.
4. **Expose deterministic surfaces**
   - Applet `open()` methods should return pure state containers or controllers
     that can be unit tested without DOM dependencies.
   - Persist user changes through the shared services instead of local storage.
5. **Document settings contracts**
   - If the applet introduces new settings keys or events, document them in
     `docs/module-apis-v2.md` so other teams understand the surface area.

The automated unit tests assert manifest integrity, so malformed entries will be
caught during CI. Use `npm test` before submitting changes to confirm the
manifest compiles and applets register correctly.
