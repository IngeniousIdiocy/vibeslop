const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers/loadModule');

function resolveAppletModule(request) {
  if (!request.startsWith('@apps/')) {
    throw new Error(`Unsupported module request: ${request}`);
  }

  const relative = request.replace(/^@apps\//, 'src/apps/');

  try {
    return loadModule(`${relative}.ts`);
  } catch (error) {
    return loadModule(`${relative}/index.ts`);
  }
}

test('control panel loads applets dynamically', async () => {
  const { createModuleRegistry } = loadModule('src/core/kernel/moduleRegistry.ts');
  const {
    registerControlPanelApplets,
    getControlPanelManifest,
  } = loadModule('src/apps/system/control-panel/index.ts');
  const { createDisplayService } = loadModule('src/services/display/index.ts');
  const { createSettingsService } = loadModule('src/services/settings/index.ts');
  const {
    createPrintService,
    createMemorySpooler,
  } = loadModule('src/services/print/index.ts');

  const registry = createModuleRegistry();
  const display = createDisplayService();
  const settings = createSettingsService();
  const spooler = createMemorySpooler({ root: '/test/spool', clock: (() => {
    let tick = 0;
    return () => ++tick;
  })() });
  const print = createPrintService({ spooler, autoProcess: false, now: (() => {
    let tick = 0;
    return () => ++tick;
  })() });

  const manifest = getControlPanelManifest();
  const applets = await registerControlPanelApplets(
    registry,
    { display, settings, print },
    { loader: resolveAppletModule },
  );

  assert.equal(applets.length, manifest.length);

  const registeredIds = registry
    .list()
    .filter((id) => id.startsWith('apps/control-panel/'));
  const expectedIds = manifest
    .map((entry) => `apps/control-panel/${entry.id}`)
    .sort();
  assert.deepStrictEqual(registeredIds, expectedIds);

  const displayApplet = registry.resolve('apps/control-panel/display');
  const displaySession = displayApplet.open();
  assert.deepStrictEqual(displaySession.tabs, ['Background', 'Screen Saver', 'Appearance', 'Settings']);

  assert.equal(displaySession.state.applied.width, 1024);
  displaySession.previewResolution(1280, 960);
  assert.equal(displaySession.state.pending.width, 1280);
  assert.equal(display.getState().width, 1024, 'pending state should not mutate display service');
  displaySession.setScalingMode('pixel');
  displaySession.toggleIntegerScale(false);
  displaySession.apply();
  assert.equal(display.getState().width, 1280);
  assert.equal(display.getState().scalingMode, 'pixel');
  assert.equal(display.getState().integerScale, false);
  displaySession.previewResolution(300, 10000);
  assert.equal(displaySession.state.pending.height, 1536, 'height should be clamped');
  displaySession.cancel();
  assert.equal(displaySession.state.pending.width, 1280, 'cancel restores applied state');

  const dateTimeApplet = registry.resolve('apps/control-panel/date-time');
  const dateTimeSession = dateTimeApplet.open();
  assert.equal(dateTimeSession.getOffsetMinutes(), 0);
  dateTimeSession.setOffsetMinutes(95.7);
  dateTimeSession.apply();
  assert.equal(settings.get('time.offsetMinutes'), 96);
  dateTimeSession.setOffsetMinutes(-2000);
  assert.equal(dateTimeSession.getOffsetMinutes(), -720, 'offset is clamped to minimum');
  dateTimeSession.reset();
  assert.equal(dateTimeSession.getOffsetMinutes(), 96, 'reset restores stored value');

  const soundsApplet = registry.resolve('apps/control-panel/sounds');
  const soundsSession = soundsApplet.open();
  assert.equal(soundsSession.preview('open'), 'Windows Default:open');
  soundsSession.setEnabled(false);
  assert.equal(soundsSession.preview('close'), null, 'preview disabled when audio muted');
  soundsSession.setScheme('Sci-Fi');
  soundsSession.apply();
  assert.equal(settings.get('audio.scheme'), 'Sci-Fi');
  soundsSession.reset();
  assert.equal(soundsSession.getScheme(), 'Sci-Fi', 'reset pulls scheme from settings');

  const printersApplet = registry.resolve('apps/control-panel/printers');
  const printersSession = printersApplet.open();
  const printerList = printersSession.listPrinters();
  assert.ok(printerList.some((printer) => printer.id === 'printer:generic-text'));
  const job = printersSession.submitTestPage('printer:generic-text');
  assert.equal(job.status, 'queued');
  const processed = print.processNextJob();
  assert(processed);
  assert.equal(processed.status, 'completed');
  assert.ok(processed.outputPath);
  assert.equal(spooler.read(processed.outputPath), job.content);

  const queued = printersSession.submitTestPage('printer:generic-text');
  printersSession.pause(queued.id);
  assert.equal(print.getJob(queued.id).status, 'paused');
  printersSession.resume(queued.id);
  assert.equal(print.getJob(queued.id).status, 'queued');
  print.processNextJob();

  const cancelled = printersSession.submitTestPage('printer:generic-text');
  printersSession.cancel(cancelled.id);
  assert.equal(print.getJob(cancelled.id).status, 'cancelled');

  printersSession.install({
    id: 'printer:deskjet',
    name: 'HP DeskJet',
    driver: 'generic-text',
  });
  assert.ok(printersSession.listPrinters().some((printer) => printer.id === 'printer:deskjet'));
  printersSession.uninstall('printer:deskjet');
  assert.ok(!printersSession.listPrinters().some((printer) => printer.id === 'printer:deskjet'));
});

test('printer manager queues jobs', () => {
  const {
    createPrintService,
    createMemorySpooler,
  } = loadModule('src/services/print/index.ts');

  let tick = 0;
  const clock = () => ++tick;
  const spooler = createMemorySpooler({ root: '/queue/spool', clock });
  const service = createPrintService({ spooler, autoProcess: false, now: clock });

  const events = [];
  service.bus.on('print:job-updated', (event) => events.push({ type: 'updated', status: event.job.status }));
  service.bus.on('print:job-completed', (event) => events.push({ type: 'completed', status: event.job.status }));

  const job1 = service.submitJob({
    printerId: 'printer:generic-text',
    documentName: 'Doc 1',
    content: 'alpha',
  });
  assert.equal(job1.status, 'queued');
  const finished1 = service.processNextJob();
  assert(finished1);
  assert.equal(finished1.status, 'completed');
  assert.equal(spooler.read(finished1.outputPath), 'alpha');

  const job2 = service.submitJob({
    printerId: 'printer:generic-text',
    documentName: 'Doc 2',
    content: 'beta',
  });
  service.pauseJob(job2.id);
  assert.equal(service.getJob(job2.id).status, 'paused');
  service.resumeJob(job2.id);
  const finished2 = service.processNextJob();
  assert(finished2);
  assert.equal(finished2.status, 'completed');

  const job3 = service.submitJob({
    printerId: 'printer:generic-text',
    documentName: 'Doc 3',
    content: 'gamma',
  });
  service.cancelJob(job3.id);
  assert.equal(service.getJob(job3.id).status, 'cancelled');
  assert.equal(service.processNextJob(), undefined, 'cancelled job should not process');

  const job4 = service.submitJob({
    printerId: 'printer:virtual-pdf',
    documentName: 'Doc 4',
    content: 'delta',
    contentType: 'application/pdf',
  });
  service.pauseJob(job4.id);
  service.removePrinter('printer:virtual-pdf');
  assert.equal(service.getJob(job4.id).status, 'cancelled', 'removing printer cancels pending jobs');

  const statuses = events.map((event) => event.status);
  assert.ok(statuses.includes('completed'));
  assert.ok(statuses.every((status) => ['queued', 'printing', 'completed', 'paused', 'cancelled', 'error'].includes(status)));
  assert.ok(service.listPrinters().every((printer) => printer.id.startsWith('printer:')));
});
