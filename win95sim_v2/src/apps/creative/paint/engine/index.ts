import {
  Bitmap,
  BitmapExport,
  PaintColor,
  RGBAColorTuple,
  cloneBitmap,
  createBitmap,
  exportBitmap,
  getPixel,
  normalizeColor,
  setPixel,
} from '@services/graphics/bitmap';

export interface PaintEngineOptions {
  width: number;
  height: number;
  background?: PaintColor;
  historyLimit?: number;
}

export interface PaintPixelCommand {
  x: number;
  y: number;
  color: PaintColor;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface DrawPixelsCommand {
  type: 'drawPixels';
  pixels: PaintPixelCommand[];
}

export interface StrokeCommand {
  type: 'stroke';
  points: StrokePoint[];
  color: PaintColor;
  size?: number;
}

export interface FillCommand {
  type: 'fill';
  origin: StrokePoint;
  color: PaintColor;
  tolerance?: number;
}

export type PaintCommand = DrawPixelsCommand | StrokeCommand | FillCommand;

export interface PaintEngineSnapshot extends BitmapExport {}

export interface PaintEngine {
  apply(command: PaintCommand): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  getBitmap(): Bitmap;
  getColor(x: number, y: number): RGBAColorTuple;
  export(): PaintEngineSnapshot;
}

const DEFAULT_HISTORY_LIMIT = 25;

export function createPaintEngine(options: PaintEngineOptions): PaintEngine {
  if (!Number.isInteger(options.width) || options.width <= 0) {
    throw new Error('Paint engine width must be a positive integer.');
  }

  if (!Number.isInteger(options.height) || options.height <= 0) {
    throw new Error('Paint engine height must be a positive integer.');
  }

  const historyLimit = Math.max(1, options.historyLimit ?? DEFAULT_HISTORY_LIMIT);
  let bitmap = createBitmap(options.width, options.height, { fill: options.background });
  const undoStack: Bitmap[] = [];
  const redoStack: Bitmap[] = [];

  function pushUndoSnapshot() {
    undoStack.push(cloneBitmap(bitmap));
    if (undoStack.length > historyLimit) {
      undoStack.shift();
    }
  }

  function applyCommand(command: PaintCommand) {
    switch (command.type) {
      case 'drawPixels':
        applyDrawPixels(bitmap, command);
        break;
      case 'stroke':
        applyStroke(bitmap, command);
        break;
      case 'fill':
        applyFill(bitmap, command);
        break;
      default: {
        const exhaustive: never = command;
        throw new Error(`Unsupported paint command: ${exhaustive}`);
      }
    }
  }

  return {
    apply(command) {
      pushUndoSnapshot();
      redoStack.length = 0;
      applyCommand(command);
    },
    undo() {
      if (undoStack.length === 0) {
        return false;
      }

      redoStack.push(cloneBitmap(bitmap));
      bitmap = undoStack.pop()!;
      return true;
    },
    redo() {
      if (redoStack.length === 0) {
        return false;
      }

      pushUndoSnapshot();
      bitmap = redoStack.pop()!;
      return true;
    },
    canUndo() {
      return undoStack.length > 0;
    },
    canRedo() {
      return redoStack.length > 0;
    },
    getBitmap() {
      return bitmap;
    },
    getColor(x, y) {
      const px = clampIntoRange(clampCoordinate(x), 0, bitmap.width - 1);
      const py = clampIntoRange(clampCoordinate(y), 0, bitmap.height - 1);
      return getPixel(bitmap, px, py);
    },
    export() {
      return exportBitmap(bitmap);
    },
  };
}

function applyDrawPixels(bitmap: Bitmap, command: DrawPixelsCommand): void {
  command.pixels.forEach((pixel) => {
    const x = clampCoordinate(pixel.x);
    const y = clampCoordinate(pixel.y);
    setPixel(bitmap, x, y, pixel.color);
  });
}

function applyStroke(bitmap: Bitmap, command: StrokeCommand): void {
  const points = command.points;
  if (points.length === 0) {
    return;
  }

  const color = normalizeColor(command.color);
  const size = Math.max(1, Math.round(command.size ?? 1));
  const stamped = new Set<string>();

  function stamp(x: number, y: number) {
    const radius = Math.max(0, Math.floor((size - 1) / 2));
    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        const px = clampCoordinate(x + ox);
        const py = clampCoordinate(y + oy);
        const key = `${px},${py}`;
        if (stamped.has(key)) {
          continue;
        }
        stamped.add(key);
        setPixel(bitmap, px, py, color);
      }
    }
  }

  let previous = points[0];
  stamp(Math.round(previous.x), Math.round(previous.y));

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    drawLine(previous, point, (x, y) => stamp(x, y));
    previous = point;
  }
}

function applyFill(bitmap: Bitmap, command: FillCommand): void {
  const originX = clampCoordinate(command.origin.x);
  const originY = clampCoordinate(command.origin.y);
  if (!isWithin(bitmap, originX, originY)) {
    return;
  }

  const target = getPixel(bitmap, originX, originY);
  const fillColor = normalizeColor(command.color);
  if (colorsMatch(target, fillColor)) {
    return;
  }

  const tolerance = Math.max(0, Math.round(command.tolerance ?? 0));
  const queue: Array<[number, number]> = [[originX, originY]];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const key = `${x},${y}`;
    if (visited.has(key)) {
      continue;
    }
    visited.add(key);

    if (!isWithin(bitmap, x, y)) {
      continue;
    }

    const current = getPixel(bitmap, x, y);
    if (!colorWithinTolerance(current, target, tolerance)) {
      continue;
    }

    setPixel(bitmap, x, y, fillColor);
    queue.push([x + 1, y]);
    queue.push([x - 1, y]);
    queue.push([x, y + 1]);
    queue.push([x, y - 1]);
  }
}

function drawLine(from: StrokePoint, to: StrokePoint, plot: (x: number, y: number) => void): void {
  let x0 = Math.round(from.x);
  let y0 = Math.round(from.y);
  const x1 = Math.round(to.x);
  const y1 = Math.round(to.y);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) {
      break;
    }
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function colorWithinTolerance(current: RGBAColorTuple, target: RGBAColorTuple, tolerance: number): boolean {
  if (tolerance === 0) {
    return colorsMatch(current, target);
  }

  const dr = Math.abs(current[0] - target[0]);
  const dg = Math.abs(current[1] - target[1]);
  const db = Math.abs(current[2] - target[2]);
  const da = Math.abs(current[3] - target[3]);
  return Math.max(dr, dg, db, da) <= tolerance;
}

function colorsMatch(a: RGBAColorTuple, b: RGBAColorTuple): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

function isWithin(bitmap: Bitmap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < bitmap.width && y < bitmap.height;
}

function clampCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value);
}

function clampIntoRange(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
