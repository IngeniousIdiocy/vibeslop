export interface SeededRandom {
  /**
   * Returns a floating point number in the range [0, 1).
   */
  next(): number;
  /**
   * Returns an integer between the provided bounds (inclusive of min, exclusive of max).
   */
  nextInt(min: number, max: number): number;
  /**
   * Shuffles the provided array in-place and returns it.
   */
  shuffle<T>(items: T[]): T[];
}

function normalizeSeed(seed: string | number | undefined): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return seed >>> 0;
  }

  const text = String(seed ?? 'win95sim');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createMulberry32(state: number) {
  let current = state || 1;
  return function next() {
    current += 0x6d2b79f5;
    let t = current;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRandom(seed?: string | number): SeededRandom {
  const generator = createMulberry32(normalizeSeed(seed));

  return {
    next() {
      return generator();
    },
    nextInt(min: number, max: number) {
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new Error('Bounds must be finite numbers');
      }
      if (max <= min) {
        throw new Error('Max must be greater than min');
      }
      const span = max - min;
      return Math.floor(generator() * span + min);
    },
    shuffle<T>(items: T[]) {
      for (let index = items.length - 1; index > 0; index -= 1) {
        const swapWith = this.nextInt(0, index + 1);
        [items[index], items[swapWith]] = [items[swapWith], items[index]];
      }
      return items;
    },
  };
}
