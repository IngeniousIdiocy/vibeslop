import { createSeededRandom } from '@services/games';
import type { MinesweeperCellState, MinesweeperConfig, MinesweeperDifficulty, MinesweeperEngine, MinesweeperState } from './types';

const DEFAULT_DIFFICULTY: MinesweeperDifficulty = 'custom';

interface InternalState {
  config: MinesweeperConfig;
  board: MinesweeperCellState[][];
  status: MinesweeperState['status'];
  revealed: number;
  flags: number;
  firstMove: boolean;
}

function createEmptyBoard(width: number, height: number): MinesweeperCellState[][] {
  const board: MinesweeperCellState[][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: MinesweeperCellState[] = [];
    for (let x = 0; x < width; x += 1) {
      row.push({
        x,
        y,
        hasMine: false,
        isRevealed: false,
        isFlagged: false,
        adjacentMines: 0,
      });
    }
    board.push(row);
  }
  return board;
}

function forEachNeighbour(width: number, height: number, x: number, y: number, visit: (nx: number, ny: number) => void) {
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) {
        continue;
      }
      const nx = x + offsetX;
      const ny = y + offsetY;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
        visit(nx, ny);
      }
    }
  }
}

function applyMineCounts(board: MinesweeperCellState[][]) {
  const height = board.length;
  const width = board[0]?.length ?? 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = board[y][x];
      if (cell.hasMine) {
        cell.adjacentMines = -1;
        continue;
      }
      let count = 0;
      forEachNeighbour(width, height, x, y, (nx, ny) => {
        if (board[ny][nx].hasMine) {
          count += 1;
        }
      });
      cell.adjacentMines = count;
    }
  }
}

function serializeIndex(width: number, x: number, y: number) {
  return y * width + x;
}

function deserializeIndex(width: number, index: number) {
  const x = index % width;
  const y = (index - x) / width;
  return { x, y };
}

function placeMines(board: MinesweeperCellState[][], mines: number, seed?: string) {
  const height = board.length;
  const width = board[0]?.length ?? 0;
  const rng = createSeededRandom(seed);
  const available = new Array(width * height).fill(0).map((_, index) => index);
  rng.shuffle(available);
  const mineSlots = available.slice(0, mines);

  for (const slot of mineSlots) {
    const { x, y } = deserializeIndex(width, slot);
    board[y][x].hasMine = true;
  }

  applyMineCounts(board);
}

function cloneBoard(board: MinesweeperCellState[][]): MinesweeperCellState[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function ensureFirstClickSafe(state: InternalState, x: number, y: number) {
  const { config, board } = state;
  const target = board[y]?.[x];
  if (!target || !target.hasMine) {
    return;
  }

  const width = config.width;
  const height = config.height;
  const rng = createSeededRandom(`${config.seed ?? ''}:safety:${x},${y}`);
  const candidates: number[] = [];
  for (let index = 0; index < width * height; index += 1) {
    const { x: cx, y: cy } = deserializeIndex(width, index);
    if (!board[cy][cx].hasMine && !(cx === x && cy === y)) {
      candidates.push(index);
    }
  }

  if (!candidates.length) {
    return;
  }

  const replacementIndex = rng.shuffle(candidates.slice())[0];
  const { x: nx, y: ny } = deserializeIndex(width, replacementIndex);

  board[y][x].hasMine = false;
  board[ny][nx].hasMine = true;

  applyMineCounts(board);
}

function floodReveal(state: InternalState, x: number, y: number) {
  const { board, config } = state;
  const stack: Array<{ x: number; y: number }> = [{ x, y }];
  const seen = new Set<number>();
  const width = config.width;

  while (stack.length) {
    const current = stack.pop()!;
    const cell = board[current.y]?.[current.x];
    if (!cell || cell.isRevealed || cell.isFlagged) {
      continue;
    }
    const index = serializeIndex(width, current.x, current.y);
    if (seen.has(index)) {
      continue;
    }
    seen.add(index);
    cell.isRevealed = true;
    state.revealed += 1;
    if (cell.adjacentMines === 0) {
      forEachNeighbour(config.width, config.height, current.x, current.y, (nx, ny) => {
        stack.push({ x: nx, y: ny });
      });
    }
  }
}

function evaluateStatus(state: InternalState) {
  if (state.status === 'lost') {
    return;
  }

  const totalCells = state.config.width * state.config.height;
  const targetRevealed = totalCells - state.config.mines;
  if (state.revealed >= targetRevealed) {
    state.status = 'won';
  }
}

function validateConfig(config: MinesweeperConfig) {
  if (config.width <= 0 || config.height <= 0) {
    throw new Error('Board dimensions must be greater than zero');
  }
  if (!Number.isInteger(config.width) || !Number.isInteger(config.height)) {
    throw new Error('Board dimensions must be integers');
  }
  if (!Number.isInteger(config.mines) || config.mines <= 0) {
    throw new Error('Mine count must be a positive integer');
  }
  if (config.mines >= config.width * config.height) {
    throw new Error('Mine count must be less than the total number of cells');
  }
}

function deriveDifficulty(config: MinesweeperConfig): MinesweeperDifficulty {
  if (config.difficulty) {
    return config.difficulty;
  }
  if (config.width === 9 && config.height === 9 && config.mines === 10) {
    return 'beginner';
  }
  if (config.width === 16 && config.height === 16 && config.mines === 40) {
    return 'intermediate';
  }
  if (config.width === 30 && config.height === 16 && config.mines === 99) {
    return 'expert';
  }
  return DEFAULT_DIFFICULTY;
}

function createInitialState(config: MinesweeperConfig): InternalState {
  validateConfig(config);
  const board = createEmptyBoard(config.width, config.height);
  placeMines(board, config.mines, config.seed);
  return {
    config,
    board,
    status: 'ready',
    revealed: 0,
    flags: 0,
    firstMove: true,
  };
}

function toPublicState(state: InternalState): MinesweeperState {
  return {
    board: cloneBoard(state.board),
    status: state.status,
    revealed: state.revealed,
    flags: state.flags,
    mines: state.config.mines,
    width: state.config.width,
    height: state.config.height,
    difficulty: deriveDifficulty(state.config),
  };
}

export function createMinesweeperEngine(config: MinesweeperConfig): MinesweeperEngine {
  const internal: InternalState = createInitialState({
    ...config,
    firstClickSafe: config.firstClickSafe ?? true,
  });

  function revealCell(x: number, y: number) {
    if (internal.status === 'lost' || internal.status === 'won') {
      return;
    }

    const cell = internal.board[y]?.[x];
    if (!cell || cell.isFlagged || cell.isRevealed) {
      return;
    }

    if (internal.firstMove && internal.config.firstClickSafe) {
      ensureFirstClickSafe(internal, x, y);
    }

    internal.firstMove = false;

    if (cell.hasMine) {
      cell.isRevealed = true;
      internal.status = 'lost';
      internal.revealed += 1;
      return;
    }

    floodReveal(internal, x, y);
    if (internal.status === 'ready') {
      internal.status = 'in-progress';
    }
    evaluateStatus(internal);
  }

  function toggleFlag(x: number, y: number) {
    if (internal.status === 'lost' || internal.status === 'won') {
      return;
    }
    const cell = internal.board[y]?.[x];
    if (!cell || cell.isRevealed) {
      return;
    }
    cell.isFlagged = !cell.isFlagged;
    internal.flags += cell.isFlagged ? 1 : -1;
  }

  return {
    getState() {
      return toPublicState(internal);
    },
    reveal(x: number, y: number) {
      revealCell(x, y);
      return toPublicState(internal);
    },
    toggleFlag(x: number, y: number) {
      toggleFlag(x, y);
      return toPublicState(internal);
    },
    reset(seed?: string) {
      const nextConfig: MinesweeperConfig = {
        ...internal.config,
        seed: seed ?? internal.config.seed,
      };
      const nextState = createInitialState(nextConfig);
      internal.board = nextState.board;
      internal.status = nextState.status;
      internal.revealed = nextState.revealed;
      internal.flags = nextState.flags;
      internal.firstMove = nextState.firstMove;
      internal.config = nextState.config;
      return toPublicState(internal);
    },
  };
}
