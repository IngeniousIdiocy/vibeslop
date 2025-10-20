const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers/loadModule');

function loadPaintEngine() {
  return loadModule('src/apps/creative/paint/engine/index.ts');
}

function loadPaletteStore() {
  return loadModule('src/services/media/paletteStore.ts');
}

test('paint supports basic drawing tools', () => {
  const { createPaintEngine } = loadPaintEngine();
  const engine = createPaintEngine({
    width: 8,
    height: 6,
    background: [250, 250, 250, 255],
    historyLimit: 8,
  });

  engine.apply({
    type: 'stroke',
    color: [0, 0, 0, 255],
    points: [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
    ],
  });

  const drawn = Array.from({ length: 8 }, (_, x) => engine.getColor(x, 1)[0]);
  assert.deepEqual(drawn, [250, 0, 0, 0, 0, 0, 250, 250]);

  engine.apply({
    type: 'fill',
    origin: { x: 0, y: 0 },
    color: [200, 220, 255, 255],
  });

  assert.deepEqual(engine.getColor(0, 0), [200, 220, 255, 255]);
  assert.deepEqual(engine.getColor(2, 1), [0, 0, 0, 255]);

  engine.apply({
    type: 'drawPixels',
    pixels: [
      { x: 3, y: 3, color: [255, 0, 0, 255] },
      { x: 4, y: 4, color: [0, 0, 255, 255] },
    ],
  });

  const snapshot = engine.export();
  assert.equal(snapshot.width, 8);
  assert.equal(snapshot.height, 6);
  assert.equal(snapshot.pixels.length, 8 * 6 * 4);

  assert.equal(engine.canUndo(), true);
  assert.equal(engine.canRedo(), false);

  assert.deepEqual(engine.getColor(3, 3), [255, 0, 0, 255]);
  assert.deepEqual(engine.getColor(4, 4), [0, 0, 255, 255]);

  assert.equal(engine.undo(), true);
  assert.deepEqual(engine.getColor(3, 3), [200, 220, 255, 255]);
  assert.equal(engine.canRedo(), true);

  assert.equal(engine.undo(), true);
  assert.deepEqual(engine.getColor(0, 0), [250, 250, 250, 255]);

  assert.equal(engine.redo(), true);
  assert.deepEqual(engine.getColor(0, 0), [200, 220, 255, 255]);

  assert.equal(engine.redo(), true);
  assert.deepEqual(engine.getColor(3, 3), [255, 0, 0, 255]);
});

test('media service loads palette data', async () => {
  const { createPaletteStore } = loadPaletteStore();
  let loadCount = 0;
  const store = createPaletteStore({
    loader: async (id) => {
      loadCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 0));
      return {
        id,
        swatches: [
          { id: 'foreground', color: [0, 0, 0] },
          { id: 'highlight', color: [0, 120, 215] },
        ],
      };
    },
  });

  const [paletteA, paletteB] = await Promise.all([
    store.load('win95/basic'),
    store.preload('win95/basic'),
  ]);

  assert.equal(loadCount, 1);
  assert.strictEqual(paletteA, paletteB);
  assert.deepEqual(store.list(), ['win95/basic']);
  assert.strictEqual(store.getCached('win95/basic'), paletteA);

  store.clear('win95/basic');
  assert.equal(store.getCached('win95/basic'), undefined);

  const paletteC = await store.load('win95/basic');
  assert.equal(loadCount, 2);
  assert.notStrictEqual(paletteC, paletteA);

  store.put({
    id: 'custom',
    swatches: [
      { id: 'primary', color: [255, 0, 0] },
    ],
  });

  assert.deepEqual(store.list().sort(), ['custom', 'win95/basic']);

  store.clear();
  assert.deepEqual(store.list(), []);
});
