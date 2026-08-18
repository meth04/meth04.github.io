/**
 * A resize-aware SVG drawing surface without axes.
 *
 * `createPanel` is built around a coordinate domain with ticks and grid lines,
 * which suits function plots. Diagrams that are laid out in their own pixel
 * space — area diagrams, trees, number lines — use this instead.
 */
import { svgEl } from './plot';
import { onResize } from './lifecycle';

export interface StageOptions {
  label: string;
  describedBy?: string;
  /** height = clamp(minHeight, width * aspect, maxHeight) */
  aspect?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface Stage {
  svg: SVGSVGElement;
  /** Current pixel size of the drawing surface. */
  width: number;
  height: number;
  /** Register a callback run after every resize (and once at startup). */
  onLayout(cb: () => void): void;
  destroy(): void;
}

export function createStage(container: HTMLElement, options: StageOptions): Stage {
  const aspect = options.aspect ?? 0.6;
  const minHeight = options.minHeight ?? 180;
  const maxHeight = options.maxHeight ?? 420;

  const svg = svgEl('svg', {
    class: 'viz-svg',
    role: 'img',
    'aria-label': options.label,
    preserveAspectRatio: 'xMidYMid meet',
  });
  if (options.describedBy) svg.setAttribute('aria-describedby', options.describedBy);
  container.append(svg);

  const callbacks: Array<() => void> = [];

  const stage: Stage = {
    svg,
    width: 0,
    height: 0,
    onLayout(cb) {
      callbacks.push(cb);
      cb();
    },
    destroy() {
      stopResize();
      svg.remove();
    },
  };

  const applySize = (rawWidth: number) => {
    const w = Math.max(240, Math.round(rawWidth));
    const h = Math.round(Math.min(maxHeight, Math.max(minHeight, w * aspect)));
    if (w === stage.width && h === stage.height) return;
    stage.width = w;
    stage.height = h;
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    for (const cb of callbacks) cb();
  };

  const stopResize = onResize(container, (width) => applySize(width));
  applySize(container.clientWidth || 640);

  return stage;
}

/** Remove every child of an SVG group. */
export function clear(node: Element): void {
  node.textContent = '';
}

/** Rectangle helper with an optional label centred inside it. */
export function labelledRect(
  group: SVGGElement,
  x: number,
  y: number,
  width: number,
  height: number,
  attrs: Record<string, string | number>,
  label?: { text: string; className?: string; fill?: string },
): void {
  if (width <= 0.5 || height <= 0.5) return;
  group.append(svgEl('rect', { x, y, width, height, ...attrs }));
  if (label && width > 34 && height > 18) {
    const text = svgEl('text', {
      x: x + width / 2,
      y: y + height / 2 + 4,
      'text-anchor': 'middle',
      class: label.className ?? 'tick',
      ...(label.fill ? { fill: label.fill } : {}),
    });
    text.textContent = label.text;
    group.append(text);
  }
}

/**
 * Decimal separator used by every figure on the page. Vietnamese writes 0,306
 * where English writes 0.306, and a figure that disagrees with the prose around
 * it looks like a bug. One page is always one language, so a module-level
 * setting is enough.
 */
let decimalSeparator = '.';

export function setDecimalSeparator(separator: string): void {
  decimalSeparator = separator;
}

/** Fixed-point number in the page's language. */
export function num(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits).replace('.', decimalSeparator);
}

/** Percentage string for readouts, e.g. 0.0345 -> "3.45%". */
export function pct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${num(value * 100, digits)}%`;
}
