import { createMinesweeperEngine } from './engine';
import type {
  MinesweeperAppInstance,
  MinesweeperAppOptions,
  MinesweeperCellState,
  MinesweeperConfig,
  MinesweeperDifficulty,
  MinesweeperPreset,
  MinesweeperState,
} from './types';

function clonePreset(preset: MinesweeperPreset): MinesweeperPreset {
  return {
    id: preset.id,
    label: preset.label,
    config: { ...preset.config },
  };
}

function normalizePresetConfig(preset: MinesweeperPreset): MinesweeperConfig {
  const config: MinesweeperConfig = { ...preset.config };
  if (!config.difficulty) {
    config.difficulty = preset.id;
  }
  if (config.firstClickSafe === undefined) {
    config.firstClickSafe = true;
  }
  return config;
}

const DEFAULT_PRESETS: MinesweeperPreset[] = [
  {
    id: 'beginner',
    label: 'Beginner (9×9, 10 mines)',
    config: { width: 9, height: 9, mines: 10, difficulty: 'beginner', firstClickSafe: true },
  },
  {
    id: 'intermediate',
    label: 'Intermediate (16×16, 40 mines)',
    config: { width: 16, height: 16, mines: 40, difficulty: 'intermediate', firstClickSafe: true },
  },
  {
    id: 'expert',
    label: 'Expert (30×16, 99 mines)',
    config: { width: 30, height: 16, mines: 99, difficulty: 'expert', firstClickSafe: true },
  },
];

function formatCount(value: number): string {
  const clamped = Math.max(-999, Math.min(999, value));
  const prefix = clamped < 0 ? '-' : '';
  const absolute = Math.abs(clamped).toString().padStart(3, '0');
  return `${prefix}${absolute}`;
}

export function createMinesweeperApp(options: MinesweeperAppOptions = {}): MinesweeperAppInstance {
  const presetList = (options.presets && options.presets.length > 0 ? options.presets : DEFAULT_PRESETS).map(clonePreset);
  if (presetList.length === 0) {
    throw new Error('Minesweeper requires at least one difficulty preset.');
  }

  const engineFactory = options.engineFactory ?? ((config: MinesweeperConfig) => createMinesweeperEngine(config));

  const resolvePreset = (difficulty?: MinesweeperDifficulty): MinesweeperPreset | undefined =>
    difficulty ? presetList.find((preset) => preset.id === difficulty) : undefined;

  let activePreset = resolvePreset(options.difficulty) ?? presetList[0];
  let engine = engineFactory(normalizePresetConfig(activePreset));
  let currentState: MinesweeperState = engine.getState();

  let host: HTMLElement | null = null;
  let container: HTMLElement | null = null;
  let toolbar: HTMLDivElement | null = null;
  let controls: HTMLDivElement | null = null;
  let difficultySelect: HTMLSelectElement | null = null;
  let newGameButton: HTMLButtonElement | null = null;
  let statusPanel: HTMLDivElement | null = null;
  let minesCounter: HTMLSpanElement | null = null;
  let statusIndicator: HTMLSpanElement | null = null;
  let timerCounter: HTMLSpanElement | null = null;
  let boardWrapper: HTMLDivElement | null = null;
  let boardElement: HTMLDivElement | null = null;

  let timerHandle: ReturnType<typeof setInterval> | undefined;
  let timerStartedAt: number | null = null;
  let elapsedSeconds = 0;

  const cleanupListeners: Array<() => void> = [];

  function updateTimerDisplay() {
    if (!timerCounter) {
      return;
    }
    timerCounter.textContent = formatCount(elapsedSeconds);
    timerCounter.setAttribute('aria-label', `Elapsed time: ${elapsedSeconds} seconds`);
  }

  function pauseTimer() {
    if (timerHandle !== undefined) {
      clearInterval(timerHandle);
      timerHandle = undefined;
    }
    if (timerStartedAt !== null) {
      elapsedSeconds = Math.floor((Date.now() - timerStartedAt) / 1000);
      timerStartedAt = null;
    }
    updateTimerDisplay();
  }

  function ensureTimerRunning() {
    if (timerHandle !== undefined) {
      return;
    }
    if (timerStartedAt === null) {
      timerStartedAt = Date.now() - elapsedSeconds * 1000;
    }
    timerHandle = setInterval(() => {
      if (timerStartedAt !== null) {
        elapsedSeconds = Math.floor((Date.now() - timerStartedAt) / 1000);
        updateTimerDisplay();
      }
    }, 1000);
    updateTimerDisplay();
  }

  function resetTimer() {
    pauseTimer();
    elapsedSeconds = 0;
    updateTimerDisplay();
  }

  function applyCellClasses(button: HTMLButtonElement, cell: MinesweeperCellState, state: MinesweeperState) {
    const classes = ['app-minesweeper__cell'];
    const revealMine = cell.hasMine && (cell.isRevealed || (state.status === 'lost' && !cell.isFlagged));
    const isRevealed = cell.isRevealed || revealMine;

    if (isRevealed) {
      classes.push('app-minesweeper__cell--revealed');
    }

    if (cell.isFlagged) {
      classes.push('app-minesweeper__cell--flagged');
      if (state.status === 'lost' && !cell.hasMine) {
        classes.push('app-minesweeper__cell--incorrect');
      }
    } else if (revealMine) {
      classes.push('app-minesweeper__cell--mine');
    } else if (cell.isRevealed && cell.adjacentMines > 0) {
      classes.push(`app-minesweeper__cell--number-${cell.adjacentMines}`);
    }

    button.className = classes.join(' ');
  }

  function renderBoard(state: MinesweeperState) {
    if (!boardElement) {
      return;
    }

    boardElement.innerHTML = '';
    boardElement.style.gridTemplateColumns = `repeat(${state.width}, 24px)`;
    boardElement.setAttribute('aria-rowcount', state.height.toString());
    boardElement.setAttribute('aria-colcount', state.width.toString());
    boardElement.setAttribute('data-status', state.status);

    state.board.forEach((row) => {
      row.forEach((cell) => {
        const cellButton = document.createElement('button') as HTMLButtonElement;
        cellButton.type = 'button';
        cellButton.dataset.x = cell.x.toString();
        cellButton.dataset.y = cell.y.toString();
        cellButton.setAttribute('role', 'gridcell');

        applyCellClasses(cellButton, cell, state);

        if (cell.isFlagged) {
          if (state.status === 'lost' && !cell.hasMine) {
            cellButton.textContent = '✖';
            cellButton.setAttribute('aria-label', 'Incorrect flag');
          } else {
            cellButton.textContent = '⚑';
            cellButton.setAttribute('aria-label', 'Flagged cell');
          }
        } else if (cell.hasMine && (cell.isRevealed || state.status === 'lost')) {
          cellButton.textContent = '💣';
          cellButton.setAttribute('aria-label', 'Mine');
        } else if (cell.isRevealed) {
          const count = cell.adjacentMines;
          if (count > 0) {
            cellButton.textContent = String(count);
            cellButton.setAttribute('aria-label', `${count} adjacent mines`);
          } else {
            cellButton.textContent = '';
            cellButton.setAttribute('aria-label', 'Empty cell');
          }
        } else {
          cellButton.textContent = '';
          cellButton.setAttribute('aria-label', 'Hidden cell');
        }

        cellButton.disabled = cell.isRevealed && !cell.hasMine;
        boardElement.appendChild(cellButton);
      });
    });
  }

  function updateStatus(state: MinesweeperState) {
    if (!minesCounter || !statusIndicator) {
      return;
    }

    const remainingMines = state.mines - state.flags;
    minesCounter.textContent = formatCount(remainingMines);
    minesCounter.setAttribute('aria-label', `Mines remaining: ${remainingMines}`);

    const statusFaces: Record<MinesweeperState['status'], string> = {
      ready: '🙂 Ready',
      'in-progress': '😮 In progress',
      won: '😎 You win!',
      lost: '😵 Boom!',
    };

    statusIndicator.textContent = statusFaces[state.status];
    statusIndicator.dataset.state = state.status;
    statusIndicator.setAttribute('aria-label', statusFaces[state.status]);

    switch (state.status) {
      case 'ready':
        pauseTimer();
        break;
      case 'in-progress':
        ensureTimerRunning();
        break;
      case 'won':
      case 'lost':
        pauseTimer();
        break;
      default:
        pauseTimer();
        break;
    }
  }

  function render(state: MinesweeperState) {
    if (difficultySelect) {
      const presetExists = presetList.some((preset) => preset.id === state.difficulty);
      difficultySelect.value = presetExists ? state.difficulty : activePreset.id;
    }

    updateStatus(state);
    renderBoard(state);
    updateTimerDisplay();
  }

  function updateState(next: MinesweeperState) {
    currentState = next;
    render(currentState);
  }

  function selectPreset(difficulty: MinesweeperDifficulty) {
    const preset = resolvePreset(difficulty) ?? presetList[0];
    activePreset = preset;
    engine = engineFactory(normalizePresetConfig(preset));
    currentState = engine.getState();
    resetTimer();
    render(currentState);
  }

  function generateSeed() {
    return Math.random().toString(36).slice(2, 10);
  }

  const handleCellClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const cellElement = target?.closest('.app-minesweeper__cell') as HTMLButtonElement | null;
    if (!cellElement) {
      return;
    }
    const x = Number(cellElement.dataset.x);
    const y = Number(cellElement.dataset.y);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      return;
    }
    const nextState = engine.reveal(x, y);
    updateState(nextState);
  };

  const handleContextMenu = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const cellElement = target?.closest('.app-minesweeper__cell') as HTMLButtonElement | null;
    if (!cellElement) {
      return;
    }
    event.preventDefault();
    const x = Number(cellElement.dataset.x);
    const y = Number(cellElement.dataset.y);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      return;
    }
    const nextState = engine.toggleFlag(x, y);
    updateState(nextState);
  };

  const handleNewGame = () => {
    const nextState = engine.reset(generateSeed());
    resetTimer();
    updateState(nextState);
  };

  const handleDifficultyChange = () => {
    if (!difficultySelect) {
      return;
    }
    const value = difficultySelect.value as MinesweeperDifficulty;
    selectPreset(value);
  };

  function clearHost() {
    if (host && container && container.parentElement === host) {
      host.removeChild(container);
    } else {
      container?.remove();
    }
  }

  function mount(target: HTMLElement) {
    if (!target) {
      throw new Error('A host element is required to mount the Minesweeper app.');
    }

    destroy();

    host = target;
    container = document.createElement('div');
    container.className = 'app-minesweeper';

    toolbar = document.createElement('div');
    toolbar.className = 'app-minesweeper__toolbar';
    container.appendChild(toolbar);

    controls = document.createElement('div');
    controls.className = 'app-minesweeper__controls';
    toolbar.appendChild(controls);

    const difficultyLabel = document.createElement('label');
    difficultyLabel.className = 'app-minesweeper__label';
    difficultyLabel.textContent = 'Difficulty:';

    difficultySelect = document.createElement('select');
    difficultySelect.className = 'app-minesweeper__select';
    presetList.forEach((preset) => {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.label;
      difficultySelect?.appendChild(option);
    });
    if (difficultySelect) {
      difficultySelect.value = activePreset.id;
      difficultyLabel.appendChild(difficultySelect);
    }

    newGameButton = document.createElement('button');
    newGameButton.type = 'button';
    newGameButton.className = 'app-minesweeper__button';
    newGameButton.textContent = 'New Game';

    controls.appendChild(difficultyLabel);
    controls.appendChild(newGameButton);

    statusPanel = document.createElement('div');
    statusPanel.className = 'app-minesweeper__status';

    minesCounter = document.createElement('span');
    minesCounter.className = 'app-minesweeper__counter';
    minesCounter.setAttribute('aria-live', 'polite');
    statusPanel.appendChild(minesCounter);

    statusIndicator = document.createElement('span');
    statusIndicator.className = 'app-minesweeper__indicator';
    statusIndicator.setAttribute('role', 'status');
    statusIndicator.setAttribute('aria-live', 'polite');
    statusPanel.appendChild(statusIndicator);

    timerCounter = document.createElement('span');
    timerCounter.className = 'app-minesweeper__counter';
    timerCounter.setAttribute('aria-live', 'polite');
    statusPanel.appendChild(timerCounter);

    toolbar.appendChild(statusPanel);

    boardWrapper = document.createElement('div');
    boardWrapper.className = 'app-minesweeper__board-wrapper';

    boardElement = document.createElement('div');
    boardElement.className = 'app-minesweeper__board';
    boardElement.setAttribute('role', 'grid');
    boardElement.setAttribute('aria-label', 'Minesweeper board');
    boardWrapper.appendChild(boardElement);

    container.appendChild(boardWrapper);

    difficultySelect?.addEventListener('change', handleDifficultyChange);
    cleanupListeners.push(() => difficultySelect?.removeEventListener('change', handleDifficultyChange));

    newGameButton.addEventListener('click', handleNewGame);
    cleanupListeners.push(() => newGameButton?.removeEventListener('click', handleNewGame));

    boardElement.addEventListener('click', handleCellClick);
    cleanupListeners.push(() => boardElement?.removeEventListener('click', handleCellClick));

    boardElement.addEventListener('contextmenu', handleContextMenu);
    cleanupListeners.push(() => boardElement?.removeEventListener('contextmenu', handleContextMenu));

    host.appendChild(container);

    resetTimer();
    render(currentState);
  }

  function destroy() {
    pauseTimer();
    cleanupListeners.splice(0).forEach((cleanup) => {
      try {
        cleanup();
      } catch {
        // Ignore listener cleanup issues in non-DOM test environments.
      }
    });

    clearHost();

    host = null;
    container = null;
    toolbar = null;
    controls = null;
    difficultySelect = null;
    newGameButton = null;
    statusPanel = null;
    minesCounter = null;
    statusIndicator = null;
    timerCounter = null;
    boardWrapper = null;
    boardElement = null;
  }

  return {
    mount,
    destroy,
    setDifficulty(difficulty: MinesweeperDifficulty) {
      selectPreset(difficulty);
    },
    getState() {
      return currentState;
    },
  };
}

export { createMinesweeperEngine } from './engine';
export type {
  MinesweeperAppInstance,
  MinesweeperAppOptions,
  MinesweeperCellState,
  MinesweeperConfig,
  MinesweeperDifficulty,
  MinesweeperEngine,
  MinesweeperPreset,
  MinesweeperState,
} from './types';
