const test = require('node:test');
const assert = require('node:assert');

const { loadModule } = require('./helpers/loadModule');

const navigatorModule = () => loadModule('src/apps/internet/navigator/index.ts');
const settingsModule = () => loadModule('src/services/settings/index.ts');
const sanitizerModule = () => loadModule('src/services/security/sanitizer.ts');
const networkProxyModule = () => loadModule('src/services/network/proxy.ts');
const networkIframeModule = () => loadModule('src/services/network/iframe-policy.ts');
const downloadsModule = () => loadModule('src/services/downloads/index.ts');

function createSettings(initial = {}) {
  const { createSettingsService } = settingsModule();
  return createSettingsService(initial);
}

test('navigator session persists tab mode and history', () => {
  const { createNavigatorSession } = navigatorModule();

  const settings = createSettings();
  const session = createNavigatorSession({
    settings,
    homeUrl: 'https://initial.example',
  });

  assert.strictEqual(session.getActiveTab().mode, 'iframe');
  session.setMode('reader');

  session.navigate('https://example.org/docs');
  session.goBack();
  const forward = session.goForward();
  assert.ok(forward);
  assert.strictEqual(forward.url, 'https://example.org/docs');

  const restored = createNavigatorSession({ settings });
  assert.strictEqual(restored.getActiveTab().mode, 'reader');
  assert.strictEqual(restored.getActiveTab().url, 'https://example.org/docs');
});

test('bookmark store performs CRUD operations and persists order', () => {
  const { createBookmarkStore } = navigatorModule();
  const settings = createSettings();

  const store = createBookmarkStore({ settings });
  const first = store.add('Example', 'https://example.com');
  const second = store.add('Docs', 'https://docs.example.com');

  assert.strictEqual(store.list().length, 2);
  store.reorder([second.id, first.id]);
  const reordered = store.list();
  assert.deepStrictEqual(reordered.map((entry) => entry.id), [second.id, first.id]);

  store.remove(second.id);
  assert.deepStrictEqual(store.list().map((entry) => entry.id), [first.id]);

  // Ensure persistence round trip.
  const { createBookmarkStore: recreate } = navigatorModule();
  const restored = recreate({ settings });
  assert.deepStrictEqual(restored.list().map((entry) => entry.id), [first.id]);
});

test('sanitizer removes scripts, event handlers, and blocked protocols', () => {
  const { sanitizeHtml } = sanitizerModule();
  const dirty = `
    <div onclick="evil()">
      <script>alert('bad')</script>
      <a href="javascript:alert('boom')">boom</a>
      <img src="data:image/png;base64,abc" onload="bad()">
    </div>
  `;

  const result = sanitizeHtml(dirty);
  assert.ok(!result.html.includes('<script'));
  assert.ok(!/onclick\s*=/.test(result.html));
  assert.ok(result.blockedProtocols.includes('href:javascript'));
  assert.ok(result.strippedAttributes.includes('onload'));
});

test('proxy validation enforces http(s) base URLs and produces proxied targets', () => {
  const { validateProxyUrl, buildProxiedUrl } = networkProxyModule();

  const valid = validateProxyUrl('http://proxy.local');
  assert.ok(valid.valid);
  assert.ok(valid.normalized.endsWith('/'));

  const invalid = validateProxyUrl('ftp://proxy.local');
  assert.strictEqual(invalid.valid, false);
  assert.strictEqual(invalid.reason, 'invalid-protocol');

  const proxied = buildProxiedUrl('https://proxy.local', 'https://example.com/path?q=1');
  assert.strictEqual(
    proxied,
    'https://proxy.local/https%3A%2F%2Fexample.com%2Fpath%3Fq%3D1',
  );
});

test('iframe policy blocks unsupported protocols and returns sandbox attributes', () => {
  const { createIframePolicy } = networkIframeModule();
  const policy = createIframePolicy({ allowScripts: true, allowSameOrigin: true });

  assert.ok(policy.isUrlAllowed('https://example.com'));
  assert.ok(!policy.isUrlAllowed('javascript:alert(1)'));

  const attributes = policy.buildAttributes('https://example.com');
  assert.match(attributes.sandbox, /allow-scripts/);
  assert.strictEqual(attributes.referrerpolicy, 'strict-origin-when-cross-origin');
});

test('download manager drives lifecycle events and saves resources', async () => {
  const { createDownloadManager } = downloadsModule();
  const saved = [];

  const manager = createDownloadManager({
    fetchResource: async () => ({ data: 'payload', totalBytes: 7 }),
    saveFile: async (record, data) => {
      saved.push({ record, data: Buffer.from(data).toString('utf8') });
    },
    idGenerator: () => 'download-test',
  });

  const events = [];
  manager.bus.on('download:completed', (event) => {
    events.push(event.record.status);
  });

  const record = await manager.start({
    url: 'https://example.com/file.txt',
    filename: 'file.txt',
  });

  assert.strictEqual(record.id, 'download-test');
  assert.strictEqual(record.status, 'completed');
  assert.strictEqual(record.receivedBytes, 7);
  assert.deepStrictEqual(events, ['completed']);
  assert.deepStrictEqual(saved[0].data, 'payload');
});
