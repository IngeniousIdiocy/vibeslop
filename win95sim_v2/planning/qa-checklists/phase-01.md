# QA Checklist – Phase 1
- [ ] Windows can be created, moved, resized via mouse.
- [ ] Alt+Space opens system menu; keyboard Size/Move operations function.
- [ ] Maximize respects CRT bounds; restore returns to original dimensions.
- [ ] Pixel mode shows scrollbars when resolution exceeds viewport; fit/integer hide them.
- [ ] Alt+` task switcher lists windows and changes focus.
- [ ] Axe-core scan yields no critical accessibility issues on base desktop.
- [ ] `yarn build` produces `dist/win95sim.html` without module resolution warnings.
