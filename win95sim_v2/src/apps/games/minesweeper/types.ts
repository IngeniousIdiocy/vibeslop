export type MinesweeperDifficulty = 'beginner' | 'intermediate' | 'expert' | 'custom';

export interface MinesweeperConfig {
  width: number;
  height: number;
  mines: number;
  seed?: string;
  difficulty?: MinesweeperDifficulty;
  firstClickSafe?: boolean;
}

export interface MinesweeperCellState {
  x: number;
  y: number;
  hasMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;
}

export interface MinesweeperState {
  board: MinesweeperCellState[][];
  status: 'ready' | 'in-progress' | 'won' | 'lost';
  revealed: number;
  flags: number;
  mines: number;
  width: number;
  height: number;
  difficulty: MinesweeperDifficulty;
}

export interface MinesweeperEngine {
  getState(): MinesweeperState;
  reveal(x: number, y: number): MinesweeperState;
  toggleFlag(x: number, y: number): MinesweeperState;
  reset(seed?: string): MinesweeperState;
}
