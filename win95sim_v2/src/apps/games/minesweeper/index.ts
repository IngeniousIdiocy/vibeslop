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
  let menuBar: HTMLDivElement | null = null;
  let gameMenuRoot: HTMLDivElement | null = null;
  let gameMenuButton: HTMLButtonElement | null = null;
  let gameMenu: HTMLDivElement | null = null;
  let helpMenuButton: HTMLButtonElement | null = null;
  let statusPanel: HTMLDivElement | null = null;
  let minesCounter: HTMLSpanElement | null = null;
  let statusIndicator: HTMLButtonElement | null = null;
  let timerCounter: HTMLSpanElement | null = null;
  let boardWrapper: HTMLDivElement | null = null;
  let boardElement: HTMLDivElement | null = null;

  const difficultyMenuItems = new Map<MinesweeperDifficulty, HTMLButtonElement>();
  let openMenu: 'game' | null = null;

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
      ready: '🙂',
      'in-progress': '😮',
      won: '😎',
      lost: '😵',
    };

    const statusLabels: Record<MinesweeperState['status'], string> = {
      ready: 'Ready for a new game',
      'in-progress': 'Game in progress',
      won: 'Game won',
      lost: 'Game lost',
    };

    statusIndicator.textContent = statusFaces[state.status];
    statusIndicator.dataset.state = state.status;
    statusIndicator.setAttribute('aria-label', statusLabels[state.status]);
    statusIndicator.title = statusLabels[state.status];

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

  function updateDifficultyMenuSelection(state: MinesweeperState) {
    if (difficultyMenuItems.size === 0) {
      return;
    }

    const active = difficultyMenuItems.has(state.difficulty)
      ? state.difficulty
      : activePreset.id;

    difficultyMenuItems.forEach((item, difficulty) => {
      const isActive = difficulty === active;
      const activeValue = isActive ? 'true' : 'false';
      if (item.dataset) {
        item.dataset.active = activeValue;
      }
      item.setAttribute('data-active', activeValue);
      item.setAttribute('aria-checked', activeValue);
    });
  }

  function closeMenus() {
    openMenu = null;
    if (gameMenuButton) {
      gameMenuButton.setAttribute('aria-expanded', 'false');
    }
    if (gameMenu) {
      if (gameMenu.classList && typeof gameMenu.classList.remove === 'function') {
        gameMenu.classList.remove('app-minesweeper__menu--open');
      } else if (typeof gameMenu.className === 'string') {
        gameMenu.className = gameMenu.className
          .split(/\s+/)
          .filter((token) => token && token !== 'app-minesweeper__menu--open')
          .join(' ');
      }
    }
  }

  function focusFirstMenuItem() {
    if (!gameMenu) {
      return;
    }
    const firstItem = gameMenu.querySelector<HTMLButtonElement>('.app-minesweeper__menu-option');
    if (firstItem && typeof firstItem.focus === 'function') {
      firstItem.focus();
    }
  }

  function openGameMenu() {
    if (!gameMenuButton || !gameMenu) {
      return;
    }
    openMenu = 'game';
    gameMenuButton.setAttribute('aria-expanded', 'true');
    if (gameMenu.classList && typeof gameMenu.classList.add === 'function') {
      gameMenu.classList.add('app-minesweeper__menu--open');
    } else if (typeof gameMenu.className === 'string') {
      const tokens = new Set(gameMenu.className.split(/\s+/).filter(Boolean));
      tokens.add('app-minesweeper__menu--open');
      gameMenu.className = Array.from(tokens).join(' ');
    }
  }

  function toggleGameMenu(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (openMenu === 'game') {
      closeMenus();
      gameMenuButton?.focus();
    } else {
      openGameMenu();
      focusFirstMenuItem();
    }
  }

  function handleDocumentClick(event: MouseEvent) {
    if (openMenu !== 'game') {
      return;
    }
    const target = event.target as Node | null;
    if (!target) {
      closeMenus();
      return;
    }
    if (gameMenuRoot?.contains(target)) {
      return;
    }
    closeMenus();
  }

  function handleDocumentKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && openMenu === 'game') {
      closeMenus();
      gameMenuButton?.focus();
    }
  }

  function handleGameMenuButtonKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (openMenu !== 'game') {
        openGameMenu();
      }
      focusFirstMenuItem();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (openMenu !== 'game') {
        openGameMenu();
      }
      if (gameMenu) {
        const items = gameMenu.querySelectorAll<HTMLButtonElement>('.app-minesweeper__menu-option');
        const last = items[items.length - 1];
        last?.focus?.();
      }
    }
  }

  function handleMenuOptionKeyDown(event: KeyboardEvent) {
    if (!gameMenu || !gameMenuButton) {
      return;
    }

    const items = Array.from(gameMenu.querySelectorAll<HTMLButtonElement>('.app-minesweeper__menu-option'));
    if (items.length === 0) {
      return;
    }

    const current = event.currentTarget as HTMLButtonElement | null;
    const currentIndex = items.findIndex((item) => item === current);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = items[(currentIndex + 1) % items.length];
      next?.focus?.();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const previous = items[(currentIndex - 1 + items.length) % items.length];
      previous?.focus?.();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenus();
      gameMenuButton.focus();
    }
  }

  function render(state: MinesweeperState) {
    updateStatus(state);
    renderBoard(state);
    updateDifficultyMenuSelection(state);
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

    menuBar = document.createElement('div');
    menuBar.className = 'app-minesweeper__menubar';
    menuBar.setAttribute('role', 'menubar');

    difficultyMenuItems.clear();

    gameMenuRoot = document.createElement('div');
    gameMenuRoot.className = 'app-minesweeper__menu-root';

    gameMenuButton = document.createElement('button');
    gameMenuButton.type = 'button';
    gameMenuButton.className = 'app-minesweeper__menu-item';
    gameMenuButton.textContent = 'Game';
    gameMenuButton.setAttribute('role', 'menuitem');
    gameMenuButton.setAttribute('aria-haspopup', 'true');
    gameMenuButton.setAttribute('aria-expanded', 'false');
    gameMenuRoot.appendChild(gameMenuButton);

    gameMenu = document.createElement('div');
    gameMenu.className = 'app-minesweeper__menu';
    gameMenu.setAttribute('role', 'menu');
    gameMenuRoot.appendChild(gameMenu);

    const createMenuOption = (
      label: string,
      onSelect: () => void,
      options: { accelerator?: string; type?: 'radio'; difficulty?: MinesweeperDifficulty } = {},
    ) => {
      if (!gameMenu) {
        return;
      }

      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'app-minesweeper__menu-option';
      option.setAttribute('role', options.type === 'radio' ? 'menuitemradio' : 'menuitem');
      option.textContent = '';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'app-minesweeper__menu-option-label';
      labelSpan.textContent = label;
      option.appendChild(labelSpan);

      if (options.accelerator) {
        const accelerator = document.createElement('span');
        accelerator.className = 'app-minesweeper__menu-option-accelerator';
        accelerator.textContent = options.accelerator;
        option.appendChild(accelerator);
      }

      if (options.type === 'radio') {
        if (option.dataset) {
          option.dataset.role = 'radio';
          option.dataset.active = 'false';
        }
        option.setAttribute('data-role', 'radio');
        option.setAttribute('data-active', 'false');
        option.setAttribute('aria-checked', 'false');
      }

      if (options.difficulty) {
        if (option.dataset) {
          option.dataset.difficulty = options.difficulty;
        }
        option.setAttribute('data-difficulty', options.difficulty);
        difficultyMenuItems.set(options.difficulty, option);
      }

      const handleClick = (event: MouseEvent) => {
        event.preventDefault();
        onSelect();
        closeMenus();
      };

      option.addEventListener('click', handleClick);
      option.addEventListener('keydown', handleMenuOptionKeyDown);

      cleanupListeners.push(() => {
        option.removeEventListener('click', handleClick);
        option.removeEventListener('keydown', handleMenuOptionKeyDown);
      });

      gameMenu.appendChild(option);
    };

    const addMenuSeparator = () => {
      if (!gameMenu) {
        return;
      }
      const separator = document.createElement('div');
      separator.className = 'app-minesweeper__menu-separator';
      gameMenu.appendChild(separator);
    };

    createMenuOption('New', handleNewGame, { accelerator: 'F2' });
    addMenuSeparator();
    presetList.forEach((preset) => {
      createMenuOption(preset.label, () => {
        selectPreset(preset.id);
      }, { type: 'radio', difficulty: preset.id });
    });

    menuBar.appendChild(gameMenuRoot);

    helpMenuButton = document.createElement('button');
    helpMenuButton.type = 'button';
    helpMenuButton.className = 'app-minesweeper__menu-item';
    helpMenuButton.textContent = 'Help';
    helpMenuButton.setAttribute('role', 'menuitem');
    menuBar.appendChild(helpMenuButton);

    boardWrapper = document.createElement('div');
    boardWrapper.className = 'app-minesweeper__board-wrapper';

    boardWrapper = document.createElement('div');
    boardWrapper.className = 'app-minesweeper__board-wrapper';

    statusPanel = document.createElement('div');
    statusPanel.className = 'app-minesweeper__status';

    minesCounter = document.createElement('span');
    minesCounter.className = 'app-minesweeper__counter';
    minesCounter.setAttribute('aria-live', 'polite');
    statusPanel.appendChild(minesCounter);

    statusIndicator = document.createElement('button');
    statusIndicator.type = 'button';
    statusIndicator.className = 'app-minesweeper__indicator';
    statusIndicator.setAttribute('aria-live', 'polite');
    statusPanel.appendChild(statusIndicator);

    statusIndicator.addEventListener('click', handleNewGame);
    cleanupListeners.push(() => statusIndicator?.removeEventListener('click', handleNewGame));

    timerCounter = document.createElement('span');
    timerCounter.className = 'app-minesweeper__counter';
    timerCounter.setAttribute('aria-live', 'polite');
    statusPanel.appendChild(timerCounter);

    boardWrapper.appendChild(statusPanel);

    boardElement = document.createElement('div');
    boardElement.className = 'app-minesweeper__board';
    boardElement.setAttribute('role', 'grid');
    boardElement.setAttribute('aria-label', 'Minesweeper board');
    boardWrapper.appendChild(boardElement);

    container.appendChild(menuBar);
    container.appendChild(boardWrapper);

    const doc = container.ownerDocument ?? document;

    if (gameMenuButton) {
      const handleClick = (event: MouseEvent) => {
        toggleGameMenu(event);
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        handleGameMenuButtonKeyDown(event);
      };
      gameMenuButton.addEventListener('click', handleClick);
      gameMenuButton.addEventListener('keydown', handleKeyDown);
      cleanupListeners.push(() => {
        gameMenuButton?.removeEventListener('click', handleClick);
        gameMenuButton?.removeEventListener('keydown', handleKeyDown);
      });
    }

    if (doc && typeof doc.addEventListener === 'function' && typeof doc.removeEventListener === 'function') {
      doc.addEventListener('click', handleDocumentClick);
      cleanupListeners.push(() => doc.removeEventListener('click', handleDocumentClick));

      doc.addEventListener('keydown', handleDocumentKeyDown);
      cleanupListeners.push(() => doc.removeEventListener('keydown', handleDocumentKeyDown));
    }

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

    closeMenus();
    difficultyMenuItems.clear();

    host = null;
    container = null;
    menuBar = null;
    gameMenuRoot = null;
    gameMenuButton = null;
    gameMenu = null;
    helpMenuButton = null;
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
