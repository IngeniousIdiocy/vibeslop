import type { PaintColor } from '@services/graphics/bitmap';
import { normalizeColor } from '@services/graphics/bitmap';
import {
  createPaintEngine,
  type PaintCommand,
  type PaintEngine,
  type PaintEngineOptions,
  type StrokePoint,
} from './engine';

export interface PaintAppOptions {
  width?: number;
  height?: number;
  background?: PaintColor;
  palette?: PaintColor[];
  engineFactory?: (options: PaintEngineOptions) => PaintEngine;
}

export interface PaintAppInstance {
  mount(host: HTMLElement): void;
  destroy(): void;
}

const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 320;
const DEFAULT_BACKGROUND: PaintColor = [255, 255, 255, 255];
const DEFAULT_PALETTE: PaintColor[] = [
  [0, 0, 0, 255],
  [255, 255, 255, 255],
  [128, 128, 128, 255],
  [255, 0, 0, 255],
  [255, 128, 0, 255],
  [255, 255, 0, 255],
  [0, 176, 80, 255],
  [0, 112, 192, 255],
  [0, 0, 255, 255],
  [112, 48, 160, 255],
];

export function createPaintApp(options: PaintAppOptions = {}): PaintAppInstance {
  const palette = options.palette && options.palette.length > 0 ? options.palette.slice() : DEFAULT_PALETTE;
  const engineFactory = options.engineFactory ?? createPaintEngine;
  const width = Math.max(32, Math.round(options.width ?? DEFAULT_WIDTH));
  const height = Math.max(32, Math.round(options.height ?? DEFAULT_HEIGHT));
  const background = options.background ?? DEFAULT_BACKGROUND;

  let engine = engineFactory({ width, height, background });

  let container: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let overlay: HTMLCanvasElement | null = null;
  let toolbar: HTMLElement | null = null;
  let statusBar: HTMLElement | null = null;
  let brushInput: HTMLInputElement | null = null;
  let swatches: HTMLButtonElement[] = [];

  let ctx: CanvasRenderingContext2D | null = null;
  let overlayCtx: CanvasRenderingContext2D | null = null;
  let activeColor: PaintColor = palette[0];
  let brushSize = 2;
  let drawing = false;
  let strokePoints: StrokePoint[] = [];

  function toggleClass(element: HTMLElement, token: string, active: boolean) {
    const tokens = new Set((element.className ?? '').split(/\s+/).filter(Boolean));
    if (active) {
      tokens.add(token);
    } else {
      tokens.delete(token);
    }
    element.className = Array.from(tokens).join(' ');
  }

  function getCssColor(color: PaintColor): string {
    const [r, g, b, a] = normalizeColor(color);
    const alpha = Math.max(0, Math.min(1, a / 255));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function setStatus(text: string) {
    if (statusBar) {
      statusBar.textContent = text;
    }
  }

  function activateColor(color: PaintColor) {
    activeColor = color;
    const encoded = JSON.stringify(color);
    swatches.forEach((button) => {
      toggleClass(button, 'app-paint__swatch--active', button.dataset.color === encoded);
    });
    setStatus('Brush ready');
  }

  function ensureContexts() {
    if (!canvas || !overlay) {
      return;
    }
    if (!ctx) {
      ctx = (canvas.getContext && canvas.getContext('2d')) || null;
    }
    if (!overlayCtx) {
      overlayCtx = (overlay.getContext && overlay.getContext('2d')) || null;
      if (overlayCtx) {
        overlayCtx.lineCap = 'round';
        overlayCtx.lineJoin = 'round';
      }
    }
  }

  function renderBitmap() {
    ensureContexts();
    if (!ctx) {
      return;
    }
    try {
      const snapshot = engine.export();
      const imageData = ctx.createImageData(snapshot.width, snapshot.height);
      imageData.data.set(snapshot.pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // Ignore rendering errors in environments without full canvas support.
    }
  }

  function clearOverlay() {
    ensureContexts();
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, width, height);
    }
  }

  function applyCommand(command: PaintCommand) {
    engine.apply(command);
    renderBitmap();
  }

  function resetEngine() {
    engine = engineFactory({ width, height, background });
    renderBitmap();
    setStatus('Canvas cleared');
  }

  function clampPoint(point: StrokePoint): StrokePoint {
    return {
      x: Math.max(0, Math.min(width - 1, point.x)),
      y: Math.max(0, Math.min(height - 1, point.y)),
    };
  }

  function getCanvasPoint(event: PointerEvent | MouseEvent): StrokePoint {
    if ('offsetX' in event && typeof event.offsetX === 'number') {
      return clampPoint({ x: Math.round(event.offsetX), y: Math.round(event.offsetY) });
    }
    if (canvas && typeof canvas.getBoundingClientRect === 'function') {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX ?? 0) - rect.left) * (width / rect.width || 1);
      const y = ((event.clientY ?? 0) - rect.top) * (height / rect.height || 1);
      return clampPoint({ x: Math.round(x), y: Math.round(y) });
    }
    return { x: 0, y: 0 };
  }

  function commitStroke() {
    if (strokePoints.length === 0) {
      return;
    }
    const points = strokePoints.map(clampPoint);
    if (points.length === 1) {
      applyCommand({
        type: 'drawPixels',
        pixels: [{ x: points[0].x, y: points[0].y, color: activeColor }],
      });
    } else {
      applyCommand({
        type: 'stroke',
        color: activeColor,
        size: brushSize,
        points,
      });
    }
    strokePoints = [];
    clearOverlay();
    setStatus('Stroke applied');
  }

  function handlePointerDown(event: PointerEvent) {
    if (!overlay) {
      return;
    }
    overlay.setPointerCapture?.(event.pointerId);
    drawing = true;
    strokePoints = [getCanvasPoint(event)];
    ensureContexts();
    if (overlayCtx) {
      overlayCtx.beginPath();
      overlayCtx.strokeStyle = getCssColor(activeColor);
      overlayCtx.lineWidth = Math.max(1, brushSize);
      overlayCtx.moveTo(strokePoints[0].x, strokePoints[0].y);
    }
    setStatus('Drawing...');
  }

  function handlePointerMove(event: PointerEvent) {
    if (!drawing || !overlayCtx) {
      return;
    }
    const point = getCanvasPoint(event);
    strokePoints.push(point);
    overlayCtx.lineTo(point.x, point.y);
    try {
      overlayCtx.stroke();
    } catch {
      // ignore
    }
  }

  function handlePointerUp(event: PointerEvent) {
    if (!drawing) {
      return;
    }
    drawing = false;
    overlay?.releasePointerCapture?.(event.pointerId);
    if (overlayCtx) {
      try {
        overlayCtx.closePath();
      } catch {
        // ignore
      }
    }
    commitStroke();
  }

  function handlePointerLeave() {
    if (!drawing) {
      return;
    }
    drawing = false;
    if (overlayCtx) {
      try {
        overlayCtx.closePath();
      } catch {
        // ignore
      }
    }
    commitStroke();
  }

  function attachCanvasEvents(layer: HTMLCanvasElement) {
    layer.addEventListener('pointerdown', handlePointerDown);
    layer.addEventListener('pointermove', handlePointerMove);
    layer.addEventListener('pointerup', handlePointerUp);
    layer.addEventListener('pointerleave', handlePointerLeave);
    layer.addEventListener('pointercancel', handlePointerLeave);
    layer.style.touchAction = 'none';
  }

  function detachCanvasEvents(layer: HTMLCanvasElement | null) {
    if (!layer) {
      return;
    }
    layer.removeEventListener('pointerdown', handlePointerDown);
    layer.removeEventListener('pointermove', handlePointerMove);
    layer.removeEventListener('pointerup', handlePointerUp);
    layer.removeEventListener('pointerleave', handlePointerLeave);
    layer.removeEventListener('pointercancel', handlePointerLeave);
  }

  function buildToolbar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'app-paint__toolbar';

    const paletteContainer = document.createElement('div');
    paletteContainer.className = 'app-paint__palette';

    swatches = palette.map((color) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'app-paint__swatch';
      button.dataset.color = JSON.stringify(color);
      button.style.background = getCssColor(color);
      button.addEventListener('click', () => activateColor(color));
      paletteContainer.appendChild(button);
      return button;
    });

    const brushGroup = document.createElement('label');
    brushGroup.className = 'app-paint__brush';
    brushGroup.textContent = 'Brush:';

    brushInput = document.createElement('input');
    brushInput.type = 'number';
    brushInput.min = '1';
    brushInput.max = '20';
    brushInput.value = String(brushSize);
    brushInput.addEventListener('change', () => {
      const next = Number(brushInput?.value ?? brushSize) || brushSize;
      brushSize = Math.max(1, Math.min(20, Math.round(next)));
      if (brushInput) {
        brushInput.value = String(brushSize);
      }
      setStatus(`Brush size: ${brushSize}`);
    });
    brushGroup.appendChild(brushInput);

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'app-paint__button';
    clearButton.textContent = 'Clear';
    clearButton.addEventListener('click', () => resetEngine());

    bar.appendChild(paletteContainer);
    bar.appendChild(brushGroup);
    bar.appendChild(clearButton);

    return bar;
  }

  function buildCanvas(): HTMLElement {
    const surface = document.createElement('div');
    surface.className = 'app-paint__surface';

    const frame = document.createElement('div');
    frame.className = 'app-paint__canvas';

    canvas = document.createElement('canvas');
    canvas.className = 'app-paint__layer';
    canvas.width = width;
    canvas.height = height;

    overlay = document.createElement('canvas');
    overlay.className = 'app-paint__layer app-paint__layer--overlay';
    overlay.width = width;
    overlay.height = height;

    frame.appendChild(canvas);
    frame.appendChild(overlay);
    surface.appendChild(frame);

    attachCanvasEvents(overlay);
    ensureContexts();
    renderBitmap();

    return surface;
  }

  function buildStatus(): HTMLElement {
    const status = document.createElement('div');
    status.className = 'app-paint__status';
    status.textContent = 'Brush ready';
    return status;
  }

  return {
    mount(host) {
      container = document.createElement('div');
      container.className = 'app-paint';

      toolbar = buildToolbar();
      container.appendChild(toolbar);

      const surface = buildCanvas();
      container.appendChild(surface);

      statusBar = buildStatus();
      container.appendChild(statusBar);

      activateColor(activeColor);
      host.innerHTML = '';
      host.appendChild(container);
    },
    destroy() {
      detachCanvasEvents(overlay);
      if (container && container.parentElement) {
        container.parentElement.removeChild(container);
      }
      container = null;
      canvas = null;
      overlay = null;
      toolbar = null;
      statusBar = null;
      brushInput = null;
      swatches = [];
      ctx = null;
      overlayCtx = null;
      strokePoints = [];
    },
  };
}
