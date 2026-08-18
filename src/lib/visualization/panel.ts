/**
 * A resize-aware SVG panel with grid, axes and layered groups.
 * Every visualization in the article is built on top of this.
 */
import { Frame, setAttrs, svgEl, ticks, type Domain, type Margins } from './plot';
import { onResize } from './lifecycle';

export interface PanelOptions {
  margins?: Partial<Margins>;
  /** height = clamp(minHeight, width * aspect, maxHeight) */
  aspect?: number;
  minHeight?: number;
  maxHeight?: number;
  xLabel?: string;
  yLabel?: string;
  /** Accessible name for the figure's graphic. */
  label: string;
  /** Longer textual description associated with the SVG. */
  describedBy?: string;
  xTickCount?: number;
  yTickCount?: number;
  /** Format tick values (defaults to a compact numeric string). */
  formatTick?: (value: number) => string;
}

let clipCounter = 0;

const DEFAULT_MARGINS: Margins = { top: 14, right: 16, bottom: 34, left: 46 };

export interface Panel {
  svg: SVGSVGElement;
  /** Restrict an element to the inner plotting area (used by contour rings). */
  clip(el: SVGElement): void;
  frame: Frame;
  layers: {
    grid: SVGGElement;
    axes: SVGGElement;
    data: SVGGElement;
    overlay: SVGGElement;
  };
  /** Register a callback run after every layout change (and once at startup). */
  onLayout(cb: () => void): void;
  /** Redraw grid lines and tick labels for the current domain. */
  drawAxes(): void;
  setDomain(domain: Domain): void;
  destroy(): void;
}

export function createPanel(container: HTMLElement, options: PanelOptions): Panel {
  const margins: Margins = { ...DEFAULT_MARGINS, ...options.margins };
  const frame = new Frame(margins);
  const aspect = options.aspect ?? 0.56;
  const minHeight = options.minHeight ?? 190;
  const maxHeight = options.maxHeight ?? 420;
  const formatTick = options.formatTick ?? defaultTickFormat;

  const svg = svgEl('svg', {
    class: 'viz-svg',
    role: 'img',
    'aria-label': options.label,
    preserveAspectRatio: 'xMidYMid meet',
  });
  if (options.describedBy) svg.setAttribute('aria-describedby', options.describedBy);

  // A clip rectangle covering the inner plotting area, so that shapes larger
  // than the domain (elongated contour ellipses) cannot paint over the axes.
  const clipId = `viz-clip-${(clipCounter += 1)}`;
  const defs = svgEl('defs', {});
  const clipPath = svgEl('clipPath', { id: clipId });
  const clipRect = svgEl('rect', {});
  clipPath.append(clipRect);
  defs.append(clipPath);

  const grid = svgEl('g', { class: 'viz-grid', 'aria-hidden': 'true' });
  const axes = svgEl('g', { class: 'viz-axes', 'aria-hidden': 'true' });
  const data = svgEl('g', { class: 'viz-data' });
  const overlay = svgEl('g', { class: 'viz-overlay' });
  svg.append(defs, grid, axes, data, overlay);
  container.append(svg);

  const layoutCallbacks: Array<() => void> = [];

  const applySize = (width: number) => {
    const w = Math.max(240, Math.round(width));
    const h = Math.round(Math.min(maxHeight, Math.max(minHeight, w * aspect)));
    frame.setSize(w, h);
    setAttrs(clipRect, {
      x: frame.left,
      y: frame.top,
      width: frame.innerWidth,
      height: frame.innerHeight,
    });
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    drawAxes();
    for (const cb of layoutCallbacks) cb();
  };

  function drawAxes(): void {
    grid.textContent = '';
    axes.textContent = '';
    const { xMin, xMax, yMin, yMax } = frame.domain;
    const xt = ticks(xMin, xMax, options.xTickCount ?? (frame.innerWidth < 380 ? 4 : 6));
    const yt = ticks(yMin, yMax, options.yTickCount ?? 5);

    for (const v of xt) {
      const x = frame.px(v);
      grid.append(
        svgEl('line', { x1: x, x2: x, y1: frame.top, y2: frame.top + frame.innerHeight }),
      );
      const label = svgEl('text', {
        x,
        y: frame.top + frame.innerHeight + 17,
        'text-anchor': 'middle',
        class: 'tick',
      });
      label.textContent = formatTick(v);
      axes.append(label);
    }
    for (const v of yt) {
      const y = frame.py(v);
      grid.append(
        svgEl('line', { x1: frame.left, x2: frame.left + frame.innerWidth, y1: y, y2: y }),
      );
      const label = svgEl('text', {
        x: frame.left - 8,
        y: y + 4,
        'text-anchor': 'end',
        class: 'tick',
      });
      label.textContent = formatTick(v);
      axes.append(label);
    }

    // Axis lines (drawn on the domain edges, or on zero when it is in range).
    const axisY = yMin <= 0 && yMax >= 0 ? frame.py(0) : frame.top + frame.innerHeight;
    const axisX = xMin <= 0 && xMax >= 0 ? frame.px(0) : frame.left;
    axes.append(
      svgEl('line', {
        class: 'axis',
        x1: frame.left,
        x2: frame.left + frame.innerWidth,
        y1: axisY,
        y2: axisY,
      }),
      svgEl('line', {
        class: 'axis',
        x1: axisX,
        x2: axisX,
        y1: frame.top,
        y2: frame.top + frame.innerHeight,
      }),
    );

    if (options.xLabel) {
      const t = svgEl('text', {
        x: frame.left + frame.innerWidth,
        y: frame.top + frame.innerHeight + 30,
        'text-anchor': 'end',
        class: 'axis-label',
      });
      t.textContent = options.xLabel;
      axes.append(t);
    }
    if (options.yLabel) {
      const t = svgEl('text', {
        x: frame.left - 8,
        y: frame.top - 2,
        'text-anchor': 'end',
        class: 'axis-label',
      });
      t.textContent = options.yLabel;
      axes.append(t);
    }
  }

  const stopResize = onResize(container, (width) => applySize(width));
  applySize(container.clientWidth || 640);

  return {
    svg,
    clip(el: SVGElement) {
      el.setAttribute('clip-path', `url(#${clipId})`);
    },
    frame,
    layers: { grid, axes, data, overlay },
    onLayout(cb) {
      layoutCallbacks.push(cb);
      cb();
    },
    drawAxes,
    setDomain(domain) {
      frame.setDomain(domain);
      drawAxes();
      for (const cb of layoutCallbacks) cb();
    },
    destroy() {
      stopResize();
      svg.remove();
    },
  };
}

function defaultTickFormat(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1000 || abs < 0.01) return value.toExponential(0);
  const text = abs < 1 ? value.toFixed(2) : value.toFixed(abs < 10 ? 1 : 0);
  return text
    .replace(/\.0+$/, '')
    .replace(/(\.\d)0$/, '$1')
    .replace('-', '−');
}
