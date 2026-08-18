/**
 * Figure: conditioning. Two quadratic bowls, one round and one stretched,
 * each run with the learning rate that is optimal *for that bowl*
 * (η* = 2/(a+b)). The difference in path shape and iteration count is caused
 * entirely by the ratio of curvatures κ = b/a.
 */
import { createPanel, type Panel } from '../panel';
import { svgEl, fmt } from '../plot';
import { createLoop, prefersReducedMotion } from '../lifecycle';
import { slider, buttons, readout, status, controlGroup, el } from '../controls';
import { drawContours, grad, pathThrough, radiusForDomain, type Quadratic } from './quadratic';

const X_HALF_RANGE = 3;
const START: [number, number] = [-2.5, 0.9];
const MAX_STEPS = 200;
const SECONDS_PER_STEP = 0.16;
const TOL = 0.01;
/** Iterations shown on arrival. */
const START_STEPS = 10;

interface Lane {
  panel: Panel;
  contours: SVGGElement;
  trail: SVGPathElement;
  marks: SVGGElement;
  point: SVGCircleElement;
  caption: HTMLElement;
  J: Quadratic;
}

export function mount(host: HTMLElement, options: Record<string, unknown>): void {
  host.textContent = '';
  const reduced = prefersReducedMotion();
  const grid = el('div', { class: 'viz-multi' });
  host.append(grid);

  let kappa = 12;

  const lanes: Lane[] = [1, kappa].map((b, index) => {
    const item = el('div', { class: 'viz-multi__item' });
    const title = el('p', { class: 'viz-multi__title' }, index === 0 ? 'κ = 1' : `κ = ${b}`);
    const plot = el('div', {});
    const caption = el('p', { class: 'viz-multi__caption' }, '');
    item.append(title, plot, caption);
    grid.append(item);

    const panel = createPanel(plot, {
      label:
        index === 0
          ? 'Contours of a round quadratic bowl with the gradient descent path.'
          : 'Contours of a stretched quadratic bowl with a zig-zagging gradient descent path.',
      describedBy: typeof options.describedBy === 'string' ? options.describedBy : undefined,
      aspect: 0.72,
      minHeight: 170,
      maxHeight: 300,
      margins: { left: 30, right: 12, top: 12, bottom: 24 },
      xTickCount: 3,
      yTickCount: 3,
    });

    const contours = svgEl('g', { 'aria-hidden': 'true' });
    panel.layers.grid.after(contours);
    panel.clip(contours);
    const trail = svgEl('path', { class: 'viz-path' });
    const marks = svgEl('g', {});
    const point = svgEl('circle', { class: 'viz-point', r: '5' });
    panel.layers.overlay.append(trail, marks, point);

    return {
      panel,
      contours,
      trail,
      marks,
      point,
      caption,
      J: { a: 1, b, p: 0, q: 0, c0: 0 },
      titleEl: title,
    } as Lane & { titleEl: HTMLElement };
  });

  const titles = [...grid.querySelectorAll<HTMLElement>('.viz-multi__title')];

  let steps = START_STEPS;
  let progress = 0;

  const kappaSlider = slider({
    label: 'Curvature ratio κ (right panel)',
    min: 2,
    max: 40,
    step: 1,
    value: kappa,
    format: (v) => `${Math.round(v)} : 1`,
    onInput: (v) => {
      kappa = Math.round(v);
      lanes[1]!.J.b = kappa;
      if (titles[1]) titles[1].textContent = `κ = ${kappa}`;
      layout();
      render();
    },
  });

  const stepSlider = slider({
    label: 'Iterations completed',
    min: 0,
    max: MAX_STEPS,
    step: 1,
    value: START_STEPS,
    format: (v) => String(Math.round(v)),
    onInput: (v) => {
      steps = Math.round(v);
      render();
    },
  });

  const out = readout([
    { key: 'eta1', label: 'η* round bowl' },
    { key: 'eta2', label: 'η* stretched bowl' },
    { key: 'rate', label: 'Contraction (κ−1)/(κ+1)' },
    { key: 'iters', label: 'Iterations to ‖θ−θ*‖ < 0.01' },
  ]);
  const note = status();

  const { root: buttonRow, items } = buttons([
    {
      label: reduced ? 'Advance 20 iterations' : 'Play',
      variant: 'primary',
      onClick: () => (reduced ? advance(20) : togglePlay()),
    },
    { label: 'Reset', onClick: () => reset() },
  ]);
  const playButton = items[0]!;
  playButton.setAttribute('aria-pressed', 'false');

  host.append(controlGroup(kappaSlider.root, stepSlider.root), buttonRow, out.root, note.root);

  const loop = reduced
    ? null
    : createLoop(host, (dt) => {
        progress += dt / SECONDS_PER_STEP;
        let advanced = false;
        while (progress >= 1) {
          progress -= 1;
          steps += 1;
          advanced = true;
          if (steps >= MAX_STEPS) {
            steps = MAX_STEPS;
            pause();
            break;
          }
        }
        // Nothing moves between iterations in this figure, so redraw only when
        // the iteration count actually changed.
        if (!advanced) return;
        stepSlider.set(steps, true);
        render();
      });

  function togglePlay(): void {
    if (!loop) return;
    if (loop.running) pause();
    else {
      if (steps >= MAX_STEPS) steps = 0;
      loop.start();
      playButton.textContent = 'Pause';
      playButton.setAttribute('aria-pressed', 'true');
    }
  }
  function pause(): void {
    loop?.stop();
    playButton.textContent = reduced ? 'Advance 20 iterations' : 'Play';
    playButton.setAttribute('aria-pressed', 'false');
  }
  function advance(n: number): void {
    steps = Math.min(MAX_STEPS, steps + n);
    stepSlider.set(steps, true);
    render();
  }
  function reset(): void {
    pause();
    steps = START_STEPS;
    progress = 0;
    stepSlider.set(START_STEPS, true);
    kappa = 12;
    kappaSlider.set(12, true);
    lanes[1]!.J.b = 12;
    if (titles[1]) titles[1].textContent = 'κ = 12';
    layout();
    render();
  }

  /** η that minimises the worst-case contraction factor for diag(a,b). */
  function optimalEta(J: Quadratic): number {
    return 2 / (J.a + J.b);
  }

  function trajectory(J: Quadratic, n: number): Array<[number, number]> {
    const eta = optimalEta(J);
    const points: Array<[number, number]> = [START];
    let [x, y] = START;
    for (let i = 0; i < n; i++) {
      const [gx, gy] = grad(J, x, y);
      x -= eta * gx;
      y -= eta * gy;
      points.push([x, y]);
    }
    return points;
  }

  function iterationsToTolerance(J: Quadratic): number | null {
    const eta = optimalEta(J);
    let [x, y] = START;
    for (let i = 0; i <= MAX_STEPS; i++) {
      if (Math.hypot(x - J.p, y - J.q) < TOL) return i;
      const [gx, gy] = grad(J, x, y);
      x -= eta * gx;
      y -= eta * gy;
    }
    return null;
  }

  function layout(): void {
    for (const lane of lanes) {
      const frame = lane.panel.frame;
      const yHalf = (X_HALF_RANGE * frame.innerHeight) / frame.innerWidth;
      frame.setDomain({ xMin: -X_HALF_RANGE, xMax: X_HALF_RANGE, yMin: -yHalf, yMax: yHalf });
      lane.panel.drawAxes();
      drawContours(lane.contours, frame, lane.J, 8, radiusForDomain(lane.J, frame));
    }
  }

  function render(): void {
    for (const lane of lanes) {
      const frame = lane.panel.frame;
      const points = trajectory(lane.J, steps);
      lane.trail.setAttribute('d', pathThrough(frame, points));
      lane.marks.textContent = '';
      for (const [mx, my] of points.slice(-30)) {
        lane.marks.append(
          svgEl('circle', {
            cx: frame.px(frame.clampX(mx)),
            cy: frame.py(frame.clampY(my)),
            r: '2.2',
            fill: 'var(--c-plot-path)',
            opacity: '0.5',
          }),
        );
      }
      const last = points[points.length - 1]!;
      lane.point.setAttribute('cx', String(frame.px(frame.clampX(last[0]))));
      lane.point.setAttribute('cy', String(frame.py(frame.clampY(last[1]))));
      const distance = Math.hypot(last[0], last[1]);
      lane.caption.textContent = `‖θ − θ*‖ = ${fmt(distance, 3)}`;
    }

    const round = lanes[0]!.J;
    const stretched = lanes[1]!.J;
    const iterRound = iterationsToTolerance(round);
    const iterStretched = iterationsToTolerance(stretched);
    out.set('eta1', fmt(optimalEta(round), 3));
    out.set('eta2', fmt(optimalEta(stretched), 3));
    out.set('rate', fmt((kappa - 1) / (kappa + 1), 3));
    out.set('iters', `${iterRound ?? '>' + MAX_STEPS} vs ${iterStretched ?? '>' + MAX_STEPS}`);

    note.set(
      `With the best possible fixed step size, the distance to the minimiser shrinks by at most a factor (κ−1)/(κ+1) = ${fmt(
        (kappa - 1) / (kappa + 1),
        3,
      )} per iteration in the stretched bowl, against 0 in the round one — a round bowl is solved in a single step.`,
    );
  }

  layout();
  render();
  // Re-layout on resize (each panel reports its own size changes).
  for (const lane of lanes)
    lane.panel.onLayout(() => {
      layout();
      render();
    });
}
