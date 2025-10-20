const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers/loadModule');
const { withFakeDom } = require('./helpers/fakeDom');

test('high contrast theme switches CSS tokens', () => {
  withFakeDom(() => {
    const { createThemeService } = loadModule('src/services/theme/index.ts');
    const { createSettingsService } = loadModule('src/services/settings/index.ts');

    const settings = createSettingsService({ theme: 'classic' });
    const themeService = createThemeService({ settings });

    const root = document.body;
    assert.equal(root.dataset.theme, 'classic');
    assert.equal(root.style['--win95-color-window'], '#c3c7cb');

    const events = [];
    const unsubscribe = themeService.onThemeChanged((event) => events.push(event));

    const applied = themeService.applyTheme('high-contrast');
    assert.equal(applied.id, 'high-contrast');
    assert.equal(root.dataset.theme, 'high-contrast');
    assert.equal(root.dataset.themeContrast, 'high');
    assert.equal(root.style['--win95-color-window'], '#000000');
    assert.equal(settings.get('theme'), 'high-contrast');

    assert.equal(events.length, 1);
    assert.equal(events[0].theme.id, 'high-contrast');
    assert.equal(events[0].previous.id, 'classic');
    assert.equal(events[0].reducedMotion, false);

    themeService.setReducedMotionEnabled(true);
    assert.equal(themeService.isReducedMotionEnabled(), true);
    assert.equal(root.attributes['data-reduced-motion'], '');
    assert.equal(root.style['--motion-duration-fast'], '0ms');
    assert.equal(root.style['--motion-duration-standard'], '0ms');

    themeService.setReducedMotionEnabled(false);
    assert.equal(themeService.isReducedMotionEnabled(), false);
    assert.equal(root.attributes['data-reduced-motion'], undefined);
    assert.equal(root.style['--motion-duration-fast'], '70ms');
    assert.equal(root.style['--motion-duration-standard'], '150ms');

    assert.equal(events.length, 3);
    assert.equal(events[1].reducedMotion, true);
    assert.equal(events[2].reducedMotion, false);

    unsubscribe();
  });
});

test('localization service loads language packs', async () => {
  const { createLocalizationService } = loadModule('src/services/localization/index.ts');

  const service = createLocalizationService();
  const events = [];
  service.onLocaleChanged((event) => events.push(event));

  assert.deepEqual(service.listLocales(), ['en-US', 'es-ES']);
  assert.equal(service.getLocale(), 'en-US');
  assert.equal(service.getDirection(), 'ltr');
  assert.equal(service.translate('desktop.title'), 'My Computer');
  assert.equal(service.translate('menu.view'), 'View');
  assert.equal(service.translate('missing.key'), 'missing.key');

  await service.preload('es-ES');

  const esCatalog = await service.setLocale('es-ES');
  assert.equal(esCatalog.locale, 'es-ES');
  assert.equal(service.getLocale(), 'es-ES');
  assert.equal(service.translate('desktop.title'), 'Mi PC');
  assert.equal(service.translate('menu.view'), 'View');

  assert.equal(events.length, 1);
  assert.equal(events[0].previous, 'en-US');
  assert.equal(events[0].locale, 'es-ES');

  await service.setLocale('es-ES');
  assert.equal(events.length, 1, 'setting to the same locale should not emit');

  await service.setLocale('en-US');
  assert.equal(service.translate('desktop.title'), 'My Computer');
  assert.equal(events.length, 2);
  assert.equal(events[1].previous, 'es-ES');
});
