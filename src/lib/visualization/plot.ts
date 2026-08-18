/**
 * Minimal SVG plotting utilities.
 *
 * The plots draw in real CSS pixels (not a scaled viewBox) so that axis labels
 * keep their intended size on phones as well as desktops. Geometry is
 * recomputed on resize, which is rare and cheap.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

/**
 * Set presentational SVG properties as inline styles.
 * A `stroke="…"` *attribute* loses to any CSS rule that also sets `stroke`
 * (such as `.viz-path`), so per-series colours must be applied as styles.
 */
export function setStyle(
  el: SVGElement,
  style: {
    stroke?: string;
    strokeWidth?: number | string;
    fill?: string;
    opacity?: number | string;
  },
): void {
  if (style.stroke !== undefined) el.style.stroke = style.stroke;
  if (style.strokeWidth !== undefined) el.style.strokeWidth = String(style.strokeWidth);
  if (style.fill !== undefined) el.style.fill = style.fill;
  if (style.opacity !== undefined) el.style.opacity = String(style.opacity);
}

export function setAttrs(el: Element, attrs: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
}

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Domain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Maps between data coordinates and pixel coordinates for one SVG panel. */
export class Frame {
  width = 0;
  height = 0;
  domain: Domain = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };

  constructor(public margins: Margins) {}

  get left(): number {
    return this.margins.left;
  }
  get top(): number {
    return this.margins.top;
  }
  get innerWidth(): number {
    return Math.max(1, this.width - this.margins.left - this.margins.right);
  }
  get innerHeight(): number {
    return Math.max(1, this.height - this.margins.top - this.margins.bottom);
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  setDomain(domain: Domain): void {
    this.domain = domain;
  }

  /** Data x -> pixel x. */
  px(x: number): number {
    const { xMin, xMax } = this.domain;
    return this.left + ((x - xMin) / (xMax - xMin)) * this.innerWidth;
  }

  /** Data y -> pixel y (SVG y grows downward). */
  py(y: number): number {
    const { yMin, yMax } = this.domain;
    return this.top + this.innerHeight - ((y - yMin) / (yMax - yMin)) * this.innerHeight;
  }

  /** Pixel x -> data x. */
  ux(px: number): number {
    const { xMin, xMax } = this.domain;
    return xMin + ((px - this.left) / this.innerWidth) * (xMax - xMin);
  }

  /** Pixel y -> data y. */
  uy(py: number): number {
    const { yMin, yMax } = this.domain;
    return yMin + ((this.top + this.innerHeight - py) / this.innerHeight) * (yMax - yMin);
  }

  clampX(x: number): number {
    return Math.min(this.domain.xMax, Math.max(this.domain.xMin, x));
  }
  clampY(y: number): number {
    return Math.min(this.domain.yMax, Math.max(this.domain.yMin, y));
  }
}

/** "Nice" round tick values covering [min, max]. */
export function ticks(min: number, max: number, target = 6): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const rough = span / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * magnitude;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    // Guard against binary drift producing values like -0.30000000000000004.
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toFixed(10)));
  }
  return out;
}

/** Build an SVG path string for y = f(x) sampled across the frame width. */
export function functionPath(frame: Frame, f: (x: number) => number, samples = 240): string {
  const { xMin, xMax } = frame.domain;
  let d = '';
  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    const y = f(x);
    if (!Number.isFinite(y)) {
      d += '';
      continue;
    }
    d += `${i === 0 ? 'M' : 'L'}${frame.px(x).toFixed(2)} ${frame.py(y).toFixed(2)}`;
  }
  return d;
}

/** Pointer position in the SVG element's own pixel coordinates. */
export function localPoint(svg: SVGSVGElement, event: PointerEvent): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const scaleX = rect.width === 0 ? 1 : svg.clientWidth / rect.width;
  const scaleY = rect.height === 0 ? 1 : svg.clientHeight / rect.height;
  return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
}

const FIXED = new Map<number, Intl.NumberFormat>();

/** Stable, tabular-friendly number formatting for live readouts. */
export function fmt(value: number, digits = 3): string {
  let formatter = FIXED.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    FIXED.set(digits, formatter);
  }
  if (!Number.isFinite(value)) return value > 0 ? '+∞' : '−∞';
  if (Math.abs(value) >= 1e5) return value.toExponential(2);
  const text = formatter.format(value);
  // Avoid a stray "-0.000" readout when the value is a tiny negative number.
  return text.replace(/^-(0(?:\.0+)?)$/, '$1');
}
