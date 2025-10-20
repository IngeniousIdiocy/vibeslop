export interface HighScoreEntry {
  player: string;
  value: number;
  unit: string;
  achievedAt: number;
  metadata?: Record<string, unknown>;
}

export interface RecordScoreOptions {
  table: string;
  player: string;
  value: number;
  unit: string;
  lowerIsBetter?: boolean;
  metadata?: Record<string, unknown>;
}

export interface HighScoreService {
  recordScore(options: RecordScoreOptions): { accepted: boolean; position: number | null; entries: HighScoreEntry[] };
  getScores(table: string): HighScoreEntry[];
  reset(table?: string): void;
}

interface HighScoreServiceOptions {
  now?: () => number;
  limit?: number;
}

function cloneEntry(entry: HighScoreEntry): HighScoreEntry {
  return {
    player: entry.player,
    value: entry.value,
    unit: entry.unit,
    achievedAt: entry.achievedAt,
    metadata: entry.metadata ? { ...entry.metadata } : undefined,
  };
}

export function createHighScoreService(options: HighScoreServiceOptions = {}): HighScoreService {
  const now = options.now ?? (() => Date.now());
  const limit = options.limit ?? 5;
  const tables = new Map<string, HighScoreEntry[]>();

  function sortEntries(entries: HighScoreEntry[], lowerIsBetter: boolean) {
    entries.sort((a, b) => {
      if (a.value === b.value) {
        return a.achievedAt - b.achievedAt;
      }
      return lowerIsBetter ? a.value - b.value : b.value - a.value;
    });
  }

  function ensureTable(id: string) {
    if (!tables.has(id)) {
      tables.set(id, []);
    }
    return tables.get(id)!;
  }

  return {
    recordScore({ table, player, value, unit, lowerIsBetter = true, metadata }) {
      if (!table) {
        throw new Error('High score table id is required');
      }
      if (!player) {
        throw new Error('Player name is required');
      }
      if (!Number.isFinite(value)) {
        throw new Error('Score value must be a finite number');
      }

      const entries = ensureTable(table);
      const existingIndex = entries.findIndex((entry) => entry.player === player);
      const entry: HighScoreEntry = {
        player,
        value,
        unit,
        achievedAt: now(),
        metadata: metadata ? { ...metadata } : undefined,
      };

      if (existingIndex >= 0) {
        const current = entries[existingIndex];
        const isBetter = lowerIsBetter ? value < current.value : value > current.value;
        if (!isBetter) {
          return { accepted: false, position: null, entries: entries.map(cloneEntry) };
        }
        entries.splice(existingIndex, 1, entry);
      } else {
        entries.push(entry);
      }

      sortEntries(entries, lowerIsBetter);

      if (entries.length > limit) {
        entries.length = limit;
      }

      const position = entries.findIndex((item) => item === entry);
      return {
        accepted: position !== -1,
        position: position === -1 ? null : position,
        entries: entries.map(cloneEntry),
      };
    },
    getScores(table: string) {
      const entries = tables.get(table);
      if (!entries) {
        return [];
      }
      return entries.map(cloneEntry);
    },
    reset(table?: string) {
      if (typeof table === 'string') {
        tables.delete(table);
      } else {
        tables.clear();
      }
    },
  };
}
