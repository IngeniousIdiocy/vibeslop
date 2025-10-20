const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');

const { packageRelease } = require('../tools/release/packager');
const { loadModule } = require('./helpers/loadModule');

test('build pipeline emits dist/ bundle manifest', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'win95sim-release-'));
  const distDir = path.join(workspace, 'dist');
  const assetsDir = path.join(distDir, 'assets');
  await fs.mkdir(assetsDir, { recursive: true });

  const initialHtml = `<!doctype html>
<html><head><link rel="stylesheet" href="assets/app.css"></head><body><script type="module" src="assets/app.js"></script></body></html>`;
  await fs.writeFile(path.join(distDir, 'index.html'), initialHtml, 'utf8');

  const sourceManifest = {
    script: 'assets/app.js',
    styles: ['assets/app.css'],
    assets: [],
  };
  await fs.writeFile(path.join(assetsDir, 'manifest.json'), JSON.stringify(sourceManifest, null, 2));
  await fs.writeFile(path.join(assetsDir, 'app.js'), 'export const boot = () => console.log("hi");', 'utf8');
  await fs.writeFile(path.join(assetsDir, 'app.css'), 'body{background:#008080;}', 'utf8');

  await fs.mkdir(path.join(workspace, 'docs'), { recursive: true });
  await fs.writeFile(
    path.join(workspace, 'docs', 'licenses.json'),
    JSON.stringify(
      {
        project: {
          name: 'Win95Sim V2',
          license: 'MIT',
          homepage: 'https://example.test/win95sim',
        },
        dependencies: [
          { name: 'esbuild', license: 'MIT', homepage: 'https://esbuild.github.io' },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  await fs.writeFile(
    path.join(workspace, 'package.json'),
    JSON.stringify({ name: 'win95sim-v2', version: '2.0.0' }, null, 2),
    'utf8',
  );

  const { manifest } = await packageRelease({ rootDir: workspace });

  const releaseHtml = await fs.readFile(path.join(distDir, 'win95sim.html'), 'utf8');
  assert.ok(releaseHtml.startsWith('<!--'), 'release html includes license banner');
  assert.ok(releaseHtml.includes('Win95Sim V2 v2.0.0') || releaseHtml.includes('Version: 2.0.0'));

  const manifestPath = path.join(distDir, 'manifest.json');
  const storedManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  assert.deepEqual(storedManifest, manifest);

  const htmlEntry = manifest.files.find((entry) => entry.path === 'win95sim.html');
  assert.ok(htmlEntry, 'manifest contains packaged html');
  assert.match(htmlEntry.sha256, /^[a-f0-9]{64}$/);
  assert.equal(typeof htmlEntry.size, 'number');
  assert.ok(htmlEntry.size > 0);
  assert.ok(htmlEntry.gzipSize <= htmlEntry.size);

  assert.equal(manifest.assets.length, 2, 'script and stylesheet assets recorded');
  const assetPaths = manifest.assets.map((asset) => asset.path).sort();
  assert.deepEqual(assetPaths, ['assets/app.css', 'assets/app.js']);

  const aboutDataPath = path.join(workspace, 'src/apps/system/about/about.data.json');
  const aboutData = JSON.parse(await fs.readFile(aboutDataPath, 'utf8'));
  assert.equal(aboutData.version, '2.0.0');
  assert.equal(Array.isArray(aboutData.licenses), true);
  assert.equal(aboutData.licenses.length, 2);
  assert.equal(aboutData.manifest.files[0].path, 'win95sim.html');
});

test('telemetry service respects opt-in setting', async () => {
  const { createSettingsService } = loadModule('src/services/settings/index.ts');
  const { createDiagnosticsService } = loadModule('src/services/diagnostics/index.ts');

  const settings = createSettingsService();
  const diagnostics = createDiagnosticsService({ settings });

  diagnostics.log('boot');
  let flush = await diagnostics.flush();
  assert.equal(flush.optedIn, false);
  assert.equal(flush.events.length, 0);
  assert.equal(flush.dropped, 1);

  settings.set('telemetry.optIn', true);
  diagnostics.log('boot', { stage: 'opted-in' });
  diagnostics.log('window:open', { id: 'notepad' });
  flush = await diagnostics.flush();
  assert.equal(flush.optedIn, true);
  assert.equal(flush.events.length, 2);
  assert.equal(flush.dropped, 0);
  assert.deepEqual(
    flush.events.map((event) => event.event),
    ['boot', 'window:open'],
  );

  settings.set('telemetry.optIn', false);
  diagnostics.log('after-opt-out');
  flush = await diagnostics.flush();
  assert.equal(flush.optedIn, false);
  assert.equal(flush.events.length, 0);
  assert.equal(flush.dropped, 1);
});
