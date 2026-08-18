/**
 * Figure: gradient descent on a two-dimensional quadratic, drawn on its
 * contour map.
 *
 * The horizontal and vertical pixel scales are kept equal, so the right angle
 * between ∇J and the level set through the current point is a true right angle
 * on screen and not an artefact of the aspect ratio.
 */
import { createPanel } from '../panel';
import { svgEl, setAttrs, fmt } from '../plot';
import { createLoop, prefersReducedMotion } from '../lifecycle';
import { attachDrag } from '../interaction';
import { slider, buttons, readout, status, controlGroup, legend, el } from '../controls';
import {
  drawContours,
  grad,
  value,
  pathThrough,
  arrow,
  radiusForDomain,
  stabilityLimit,
  type Quadratic,
} from './quadratic';

const X_HALF_RANGE = 3;
const START = { x: -2.4, y: 1.1 };
const START_ETA = 0.18;
const START_B = 3;
const MAX_STEPS = 400;
const SECONDS_PER_STEP = 0.24;

export function mount(host: HTMLElement, options: Record<string, unknown>): void {
  host.textContent = '';
  const reduced = prefersReducedMotion();
  const plot = el('div', {});
  host.append(plot);

  const J: Quadratic = { a: 1, b: START_B, p: 0, q: 0, c0: 0 };

  const panel = createPanel(plot, {
    label:
      'Contour map of a quadratic loss with the gradient, the negative gradient and the path taken by gradient descent.',
    describedBy: typeof options.describedBy === 'string' ? options.describedBy : undefined,
    xLabel: 'θ₁',
    yLabel: 'θ₂',
    aspect: 0.62,
    minHeight: 240,
    maxHeight: 400,
    margins: { left: 40, right: 18, top: 16, bottom: 34 },
  });

  const contours = svgEl('g', { 'aria-hidden': 'true' });
  panel.layers.grid.after(contours);
  panel.clip(contours);
  const trail = svgEl('path', { class: 'viz-path' });
  const marks = svgEl('g', {});
  const vectors = svgEl('g', {});
  const tangent = svgEl('line', {
    stroke: 'var(--c-plot-axis)',
    'stroke-width': '1.2',
    'stroke-dasharray': '5 4',
  });
  const point = svgEl('circle', { class: 'viz-point', r: '6' });
  panel.layers.overlay.append(trail, marks, tangent, vectors, point);

  const out = readout([
    { key: 'iter', label: 'Iteration t' },
    { key: 'theta', label: 'θ = (θ₁, θ₂)' },
    { key: 'grad', label: '∇J(θ)' },
    { key: 'norm', label: '‖∇J(θ)‖' },
    { key: 'loss', label: 'J(θ)' },
  ]);
  const note = status();

  let path: Array<[number, number]> = [[START.x, START.y]];
  let eta = START_ETA;
  let playing = false;
  let progress = 0;

  const xSlider = slider({
    label: 'Start θ₁',
    min: -X_HALF_RANGE,
    max: X_HALF_RANGE,
    step: 0.05,
    value: START.x,
    format: (v) => fmt(v, 2),
    onInput: () => restart(),
  });
  const ySlider = slider({
    label: 'Start θ₂',
    min: -2,
    max: 2,
    step: 0.05,
    value: START.y,
    format: (v) => fmt(v, 2),
    onInput: () => restart(),
  });
  const etaSlider = slider({
    label: 'Learning rate η',
    min: 0.02,
    max: 0.9,
    step: 0.01,
    value: START_ETA,
    format: (v) => fmt(v, 2),
    onInput: (v) => {
      eta = v;
      restart();
    },
  });
  const bSlider = slider({
    label: 'Curvature ratio b : a',
    min: 1,
    max: 8,
    step: 0.5,
    value: START_B,
    format: (v) => `${fmt(v, 1)} : 1`,
    onInput: (v) => {
      J.b = v;
      layout();
      restart();
    },
  });

  const { root: buttonRow, items } = buttons([
    {
      label: reduced ? 'Run 25 steps' : 'Play',
      variant: 'primary',
      onClick: () => (reduced ? runMany(25) : togglePlay()),
    },
    { label: 'Step', onClick: () => stepOnce() },
    { label: 'Reset', onClick: () => reset() },
  ]);
  const playButton = items[0]!;
  playButton.setAttribute('aria-pressed', 'false');

  host.append(
    controlGroup(xSlider.root, ySlider.root, etaSlider.root, bSlider.root),
    buttonRow,
    legend([
      { label: '∇J direction (uphill)', color: 'var(--c-plot-alt)' },
      { label: 'update −η∇J, to scale', color: 'var(--c-plot-point)' },
      { label: 'level set through θ', color: 'var(--c-plot-axis)', dashed: true },
    ]),
    out.root,
    note.root,
  );

  attachDrag(panel.svg, {
    onMove: (px, py) => {
      xSlider.set(Number(panel.frame.clampX(panel.frame.ux(px)).toFixed(2)), true);
      ySlider.set(Number(panel.frame.clampY(panel.frame.uy(py)).toFixed(2)), true);
      restart();
    },
  });

  const loop = reduced
    ? null
    : createLoop(host, (dt) => {
        progress += dt / SECONDS_PER_STEP;
        // stepOnce() redraws; between steps nothing changes, so the frame
        // callback usually does no DOM work at all.
        while (progress >= 1) {
          progress -= 1;
          stepOnce();
          if (!playing) break;
        }
      });

  function current(): [number, number] {
    return path[path.length - 1]!;
  }

  function stepOnce(): void {
    const [x, y] = current();
    const [gx, gy] = grad(J, x, y);
    const next: [number, number] = [x - eta * gx, y - eta * gy];
    if (!Number.isFinite(next[0]) || !Number.isFinite(next[1]) || Math.hypot(...next) > 500) {
      pause();
      render();
      return;
    }
    path.push(next);
    if (path.length > MAX_STEPS || Math.hypot(gx, gy) < 1e-4) pause();
    render();
  }

  function runMany(n: number): void {
    for (let i = 0; i < n; i++) stepOnce();
  }

  function togglePlay(): void {
    if (playing) pause();
    else play();
  }
  function play(): void {
    if (!loop) return;
    playing = true;
    loop.start();
    playButton.textContent = 'Pause';
    playButton.setAttribute('aria-pressed', 'true');
  }
  function pause(): void {
    playing = false;
    loop?.stop();
    playButton.textContent = reduced ? 'Run 25 steps' : 'Play';
    playButton.setAttribute('aria-pressed', 'false');
  }

  function restart(): void {
    path = [[xSlider.value(), ySlider.value()]];
    progress = 0;
    render();
  }

  function reset(): void {
    pause();
    J.b = START_B;
    bSlider.set(START_B, true);
    etaSlider.set(START_ETA, true);
    eta = START_ETA;
    xSlider.set(START.x, true);
    ySlider.set(START.y, true);
    layout();
    restart();
  }

  /** Keep pixel scales equal in both axes so angles are drawn faithfully. */
  function layout(): void {
    const frame = panel.frame;
    const yHalf = (X_HALF_RANGE * frame.innerHeight) / frame.innerWidth;
    frame.setDomain({ xMin: -X_HALF_RANGE, xMax: X_HALF_RANGE, yMin: -yHalf, yMax: yHalf });
    panel.drawAxes();
    drawContours(contours, frame, J, 8, radiusForDomain(J, frame));
    ySlider.input.min = String(-yHalf.toFixed(2));
    ySlider.input.max = String(yHalf.toFixed(2));
  }

  function render(): void {
    const frame = panel.frame;
    const [x, y] = current();
    const [gx, gy] = grad(J, x, y);
    const norm = Math.hypot(gx, gy);

    trail.setAttribute('d', pathThrough(frame, path));
    marks.textContent = '';
    for (const [mx, my] of path.slice(-30)) {
      marks.append(
        svgEl('circle', {
          cx: frame.px(frame.clampX(mx)),
          cy: frame.py(frame.clampY(my)),
          r: '2.4',
          fill: 'var(--c-plot-path)',
          opacity: '0.5',
        }),
      );
    }

    const cx = frame.px(frame.clampX(x));
    const cy = frame.py(frame.clampY(y));
    setAttrs(point, { cx, cy });

    vectors.textContent = '';
    if (norm > 1e-6) {
      // Direction-only arrow for ∇J: a fixed pixel length, so no scale factor
      // has to be invented for the reader.
      const ux = gx / norm;
      const uy = gy / norm;
      const dirLen = 54;
      arrow(vectors, cx, cy, cx + ux * dirLen, cy - uy * dirLen, 'var(--c-plot-alt)', '∇J');
      // The actual update, drawn to scale in data units.
      const stepX = frame.px(x - eta * gx) - frame.px(x);
      const stepY = frame.py(y - eta * gy) - frame.py(y);
      if (Math.hypot(stepX, stepY) > 2) {
        arrow(vectors, cx, cy, cx + stepX, cy + stepY, 'var(--c-plot-point)', '−η∇J');
      }

      // Tangent to the level set: perpendicular to the gradient.
      const t = 60;
      setAttrs(tangent, {
        x1: cx - uy * t,
        y1: cy - ux * t,
        x2: cx + uy * t,
        y2: cy + ux * t,
        opacity: '1',
      });
    } else {
      tangent.setAttribute('opacity', '0');
    }

    out.set('iter', String(path.length - 1));
    out.set('theta', `(${fmt(x, 2)}, ${fmt(y, 2)})`);
    out.set('grad', `(${fmt(gx, 2)}, ${fmt(gy, 2)})`);
    out.set('norm', fmt(norm, 3));
    out.set('loss', fmt(value(J, x, y), 3));

    const limit = stabilityLimit(J);
    if (eta >= limit) {
      note.set(
        `η = ${fmt(eta, 2)} is at or above the stability limit 2/b = ${fmt(limit, 2)} for this bowl, so the θ₂ component grows instead of shrinking.`,
        'warn',
      );
    } else if (norm < 1e-3) {
      note.set(
        `Converged after ${path.length - 1} iterations. ∇J = 0 only at the minimiser of this bowl.`,
      );
    } else {
      note.set(
        `∇J points uphill; the update moves the opposite way. Both arrows are perpendicular to the dashed level set through θ.`,
      );
    }
  }

  panel.onLayout(() => {
    layout();
    render();
  });
  render();
}
