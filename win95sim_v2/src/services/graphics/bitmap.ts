export type RGBAColorTuple = [number, number, number, number];

export interface Bitmap {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface CreateBitmapOptions {
  fill?: PaintColor;
}

export type PaintColor = RGBAColorTuple | RGBColorObject;

export interface RGBColorObject {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface BitmapExport {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

const CHANNELS_PER_PIXEL = 4;

export function createBitmap(width: number, height: number, options: CreateBitmapOptions = {}): Bitmap {
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error('Bitmap width must be a positive integer.');
  }

  if (!Number.isInteger(height) || height <= 0) {
    throw new Error('Bitmap height must be a positive integer.');
  }

  const data = new Uint8ClampedArray(width * height * CHANNELS_PER_PIXEL);
  const fill = normalizeColor(options.fill ?? [255, 255, 255, 255]);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixelUnsafe({ width, height, data }, x, y, fill);
    }
  }

  return { width, height, data };
}

export function cloneBitmap(source: Bitmap): Bitmap {
  return {
    width: source.width,
    height: source.height,
    data: new Uint8ClampedArray(source.data),
  };
}

export function getPixel(bitmap: Bitmap, x: number, y: number): RGBAColorTuple {
  if (!withinBounds(bitmap, x, y)) {
    throw new Error(`Pixel (${x}, ${y}) is outside of the bitmap bounds.`);
  }

  const offset = getOffset(bitmap, x, y);
  return [
    bitmap.data[offset],
    bitmap.data[offset + 1],
    bitmap.data[offset + 2],
    bitmap.data[offset + 3],
  ];
}

export function setPixel(bitmap: Bitmap, x: number, y: number, color: PaintColor): void {
  if (!withinBounds(bitmap, x, y)) {
    return;
  }

  setPixelUnsafe(bitmap, x, y, normalizeColor(color));
}

export function exportBitmap(bitmap: Bitmap): BitmapExport {
  return {
    width: bitmap.width,
    height: bitmap.height,
    pixels: new Uint8ClampedArray(bitmap.data),
  };
}

export function forEachPixel(
  bitmap: Bitmap,
  visitor: (x: number, y: number, color: RGBAColorTuple) => void,
): void {
  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      visitor(x, y, getPixel(bitmap, x, y));
    }
  }
}

export function colorsEqual(a: PaintColor, b: PaintColor): boolean {
  const [ar, ag, ab, aa] = normalizeColor(a);
  const [br, bg, bb, ba] = normalizeColor(b);
  return ar === br && ag === bg && ab === bb && aa === ba;
}

export function normalizeColor(color: PaintColor): RGBAColorTuple {
  if (Array.isArray(color)) {
    const [r, g, b, a = 255] = color;
    return [clamp(r), clamp(g), clamp(b), clamp(a)];
  }

  const a = color.a ?? 255;
  return [clamp(color.r), clamp(color.g), clamp(color.b), clamp(a)];
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 255) {
    return 255;
  }

  return Math.round(value);
}

function withinBounds(bitmap: Bitmap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < bitmap.width && y < bitmap.height;
}

function getOffset(bitmap: Bitmap, x: number, y: number): number {
  return (y * bitmap.width + x) * CHANNELS_PER_PIXEL;
}

function setPixelUnsafe(bitmap: Bitmap, x: number, y: number, color: RGBAColorTuple): void {
  const offset = getOffset(bitmap, x, y);
  bitmap.data[offset] = color[0];
  bitmap.data[offset + 1] = color[1];
  bitmap.data[offset + 2] = color[2];
  bitmap.data[offset + 3] = color[3];
}

