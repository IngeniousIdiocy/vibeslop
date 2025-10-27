const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./helpers/loadModule');
const { withFakeDom } = require('./helpers/fakeDom');

function serializeBoard(board) {
  return board.map((row) => row.map((cell) => (cell.hasMine ? 'M' : String(cell.adjacentMines))).join('')).join('\n');
}

function countMines(board) {
  return board.reduce((sum, row) => sum + row.filter((cell) => cell.hasMine).length, 0);
}

test('minesweeper uses deterministic seeds and first click safety', () => {
  const { createMinesweeperEngine } = loadModule('src/apps/games/minesweeper/engine.ts');

  const config = { width: 9, height: 9, mines: 10, seed: 'phase-07' };
  const engineA = createMinesweeperEngine(config);
  const engineB = createMinesweeperEngine(config);

  const initialA = engineA.getState();
  const initialB = engineB.getState();
  assert.equal(initialA.status, 'ready');
  assert.equal(initialB.status, 'ready');
  assert.deepEqual(serializeBoard(initialA.board), serializeBoard(initialB.board));

  const afterRevealA = engineA.reveal(0, 0);
  const afterRevealB = engineB.reveal(0, 0);

  assert.equal(afterRevealA.board[0][0].hasMine, false);
  assert.equal(afterRevealA.board[0][0].isRevealed, true);
  assert.equal(afterRevealB.board[0][0].hasMine, false);
  assert.equal(afterRevealB.board[0][0].isRevealed, true);

  assert.deepEqual(serializeBoard(afterRevealA.board), serializeBoard(afterRevealB.board));
  assert.equal(countMines(afterRevealA.board), config.mines);
  assert.equal(afterRevealA.mines, config.mines);
  assert.match(afterRevealA.status, /in-progress|won/);
});

test('high score service ranks lowest values first and deduplicates players', () => {
  const { createHighScoreService } = loadModule('src/services/highScores/index.ts');

  let tick = 0;
  const service = createHighScoreService({ now: () => ++tick, limit: 3 });

  service.recordScore({ table: 'minesweeper:beginner', player: 'Alice', value: 45, unit: 'seconds' });
  service.recordScore({ table: 'minesweeper:beginner', player: 'Bob', value: 38, unit: 'seconds' });
  service.recordScore({ table: 'minesweeper:beginner', player: 'Carol', value: 39, unit: 'seconds' });

  let scores = service.getScores('minesweeper:beginner');
  assert.deepEqual(scores.map((entry) => entry.player), ['Bob', 'Carol', 'Alice']);

  const rejected = service.recordScore({ table: 'minesweeper:beginner', player: 'Bob', value: 50, unit: 'seconds' });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.position, null);

  const updated = service.recordScore({ table: 'minesweeper:beginner', player: 'Alice', value: 30, unit: 'seconds' });
  assert.equal(updated.accepted, true);
  assert.equal(updated.position, 0);

  scores = service.getScores('minesweeper:beginner');
  assert.deepEqual(scores.map((entry) => entry.player), ['Alice', 'Bob', 'Carol']);
  assert.ok(scores.every((entry) => typeof entry.achievedAt === 'number'));
});

test('seeded random generates repeatable sequences', () => {
  const { createSeededRandom } = loadModule('src/services/games/seededRandom.ts');

  const rngA = createSeededRandom('win95');
  const rngB = createSeededRandom('win95');
  const valuesA = Array.from({ length: 5 }, () => rngA.next());
  const valuesB = Array.from({ length: 5 }, () => rngB.next());

  assert.deepEqual(valuesA, valuesB);
  assert.ok(valuesA.every((value) => value >= 0 && value < 1));

  const intsA = Array.from({ length: 5 }, (_, index) => rngA.nextInt(0, index + 5));
  const intsB = Array.from({ length: 5 }, (_, index) => rngB.nextInt(0, index + 5));
  assert.deepEqual(intsA, intsB);
});

test('minesweeper app mounts board, controls, and cleans up', () => {
  const { createMinesweeperApp } = loadModule('src/apps/games/minesweeper/index.ts');

  withFakeDom(({ document, FakeElement }) => {
    if (typeof FakeElement.prototype.removeEventListener !== 'function') {
      FakeElement.prototype.removeEventListener = function removeEventListener(type, handler) {
        const listeners = this.eventListeners?.get(type);
        if (listeners) {
          listeners.delete(handler);
        }
      };
    }

    const host = document.createElement('div');
    const app = createMinesweeperApp();
    app.mount(host);

    assert.equal(host.children.length, 1);
    const root = host.children[0];
    assert.ok(root.className.includes('app-minesweeper'));

    const findByClass = (node, className) => {
      if (!node || !node.children) {
        return undefined;
      }
      if (typeof node.className === 'string' && node.className.split(/\s+/).includes(className)) {
        return node;
      }
      for (const child of node.children) {
        const found = findByClass(child, className);
        if (found) {
          return found;
        }
      }
      return undefined;
    };

    const menuBar = findByClass(root, 'app-minesweeper__menubar');
    const status = findByClass(root, 'app-minesweeper__status');
    const board = findByClass(root, 'app-minesweeper__board');
    const controlsPanel = findByClass(root, 'app-minesweeper__controls');
    const select = findByClass(root, 'app-minesweeper__select');
    const button = findByClass(root, 'app-minesweeper__button');
    const indicator = findByClass(root, 'app-minesweeper__indicator');

    assert.ok(menuBar, 'expected menu bar to render');
    assert.deepEqual(
      Array.from(menuBar?.children ?? []).map((child) => child.textContent?.trim()),
      ['Game', 'Help'],
      'expected Game and Help menu entries',
    );
    assert.ok(status, 'expected status panel to render');
    assert.ok(status?.parentElement?.className.includes('app-minesweeper__board-wrapper'), 'status should sit inside board frame');
    assert.ok(board, 'expected board to render');
    assert.ok(controlsPanel, 'expected controls panel to render');
    assert.ok(select, 'expected difficulty selector');
    assert.ok(button, 'expected new game button');
    assert.equal(indicator?.tagName, 'BUTTON', 'status indicator should be a button');
    assert.equal(indicator?.textContent?.trim(), '🙂', 'status indicator should show ready face');
    assert.ok(board.children.length > 0, 'expected board to contain cells');

    app.destroy();
    assert.equal(host.children.length, 0);
  });
});
