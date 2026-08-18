/**
 * Axis-aligned quadratic objectives, shared by the contour, conditioning,
 * momentum and mini-batch figures.
 *
 *   J(θ₁, θ₂) = c₀ + ½ [ a (θ₁ − p)² + b (θ₂ − q)² ]
 *   ∇J        = ( a (θ₁ − p),  b (θ₂ − q) )
 *
 * Keeping every example axis-aligned means the level sets are ellipses with
 * axes parallel to the coordinate axes, which can be drawn exactly with one
 * SVG <ellipse> per level instead of a marching-squares pass.
 */
import { svgEl, type Frame } from '../plot';

export interface Quadratic {
  a: number;
  b: number;
  /** Minimiser. */
  p: number;
  q: number;
  c0: number;
}

export function value(J: Quadratic, x: number, y: number): number {
  return J.c0 + 0.5 * (J.a * (x - J.p) ** 2 + J.b * (y - J.q) ** 2);
}

export function grad(J: Quadratic, x: number, y: number): [number, number] {
  return [J.a * (x - J.p), J.b * (y - J.q)];
}

/** Largest stable learning rate for gradient descent on this quadratic. */
export function stabilityLimit(J: Quadratic): number {
  return 2 / Math.max(J.a, J.b);
}

/**
 * Draw level sets J = c₀ + Lᵢ as concentric ellipses.
 * Levels grow quadratically so that the rings are evenly spaced in distance.
 */
export function drawContours(
  layer: SVGGElement,
  frame: Frame,
  J: Quadratic,
  rings = 7,
  maxRadius = 1,
): void {
  layer.textContent = '';
  for (let i = 1; i <= rings; i++) {
    const r = (maxRadius * i) / rings;
    const rx = Math.abs(frame.px(J.p + r / Math.sqrt(J.a)) - frame.px(J.p));
    const ry = Math.abs(frame.py(J.q + r / Math.sqrt(J.b)) - frame.py(J.q));
    if (!(rx > 0.5) || !(ry > 0.5)) continue;
    layer.append(
      svgEl('ellipse', {
        class: 'viz-contour',
        cx: frame.px(J.p),
        cy: frame.py(J.q),
        rx,
        ry,
        opacity: (0.28 + 0.5 * (1 - i / rings)).toFixed(2),
      }),
    );
  }
  // Mark the minimiser.
  layer.append(
    svgEl('path', {
      d: `M${frame.px(J.p) - 5} ${frame.py(J.q)}h10M${frame.px(J.p)} ${frame.py(J.q) - 5}v10`,
      stroke: 'var(--c-plot-alt)',
      'stroke-width': '1.5',
    }),
  );
}

/** Radius, in the metric of J, that reaches the corner of the drawn domain. */
export function radiusForDomain(J: Quadratic, frame: Frame): number {
  const { xMin, xMax, yMin, yMax } = frame.domain;
  const dx = Math.max(Math.abs(xMax - J.p), Math.abs(J.p - xMin));
  const dy = Math.max(Math.abs(yMax - J.q), Math.abs(J.q - yMin));
  return Math.max(Math.sqrt(J.a) * dx, Math.sqrt(J.b) * dy);
}

/** Build an SVG path string through a list of parameter-space points. */
export function pathThrough(frame: Frame, points: Array<[number, number]>): string {
  let d = '';
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) break;
    d += `${i === 0 ? 'M' : 'L'}${frame.px(frame.clampX(x)).toFixed(1)} ${frame
      .py(frame.clampY(y))
      .toFixed(1)}`;
  }
  return d;
}

/** Arrow with a head, drawn from (x1,y1) to (x2,y2) in pixel coordinates. */
export function arrow(
  group: SVGGElement,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  label?: string,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.min(9, len * 0.4);
  group.append(
    svgEl('line', {
      x1,
      y1,
      x2: x2 - ux * head * 0.8,
      y2: y2 - uy * head * 0.8,
      stroke: color,
      'stroke-width': '2',
      'stroke-linecap': 'round',
    }),
    svgEl('polygon', {
      points: `${x2},${y2} ${x2 - ux * head - uy * head * 0.45},${y2 - uy * head + ux * head * 0.45} ${
        x2 - ux * head + uy * head * 0.45
      },${y2 - uy * head - ux * head * 0.45}`,
      fill: color,
    }),
  );
  if (label) {
    const text = svgEl('text', {
      class: 'tick',
      x: x2 + ux * 12,
      y: y2 + uy * 12 + 4,
      'text-anchor': ux > 0.2 ? 'start' : ux < -0.2 ? 'end' : 'middle',
      fill: color,
    });
    text.textContent = label;
    group.append(text);
  }
}
