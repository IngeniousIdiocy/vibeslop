# QA Checklist – Phase 9
- [ ] Screensaver activates after idle timeout, exits on input, optional password prompt appears.
- [ ] CRT effect toggle and intensity update visuals; reduced motion disables effect.
- [ ] Theme switching updates entire UI instantly; high-contrast meets readability requirements.
- [ ] System sounds fire for menu open, error, minimize, startup/shutdown when enabled; silent when disabled.
- [ ] Boot/shutdown sequences display and play audio appropriately.
- [ ] BSOD easter egg triggers via shortcut/command and recovers with Enter.
- [ ] Theme/screensaver manifests validate via `yarn lint:manifests`; no manual edits required to core runtime.
