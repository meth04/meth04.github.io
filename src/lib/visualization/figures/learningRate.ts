/**
 * Figure: the same descent run at three learning rates side by side.
 *
 * Everything except η is held fixed, so any difference between the three
 * panels is caused by η alone. The rates are chosen relative to the curvature
 * at the minimum, where f ″ ≈ 0.986 and the stability threshold 2/f ″ ≈ 2.03.
 */
import { createPanel, type Panel } from '../panel';
import { functionPath, svgEl, setStyle, fmt } from '../plot';
import { createLoop, prefersReducedMotion } from '../lifecycle';
import { slider, buttons, status, controlGroup, el } from '../controls';
import { f, df, DOMAIN, FUNCTION_LABEL } from './curve';

const START_X = -4;
const MAX_STEPS = 120;
const SECONDS_PER_STEP = 0.28;
const TOL = 0.01;
/** Iterations shown on arrival, so the three regimes are visible without
 * touching a control. */
const START_STEPS = 15;

interface Case {
  eta: number;
  verdict: string;
}

const CASES: Case[] = [
  { eta: 0.05, verdict: 'too small' },
  { eta: 0.6, verdict: 'well chosen' },
  { eta: 2.4, verdict: 'too large' },
];

interface Lane {
  panel: Panel;
  curve: SVGPathElement;
  trail: SVGPathElement;
  marks: SVGGElement;
  point: SVGCircleElement;
  caption: HTMLElement;
  eta: number;
  verdict: string;
}

export function mount(host: HTMLElement, options: Record<string, unknown>): void {
  host.textContent = '';
  const reduced = prefersReducedMotion();
  const grid = el('div', { class: 'viz-multi' });
  host.append(grid);

  const lanes: Lane[] = CASES.map((c) => {
    const item = el('div', { class: 'viz-multi__item' });
    const heading = el(
      'p',
      { class: 'viz-multi__title' },
      `η = ${fmt(c.eta, 2)}`,
      el('span', { class: 'viz-multi__verdict' }, c.verdict),
    );
    const plot = el('div', {});
    const caption = el('p', { class: 'viz-multi__caption' }, '');
    item.append(heading, plot, caption);
    grid.append(item);

    const panel = createPanel(plot, {
      label: `Gradient descent on ${FUNCTION_LABEL} with learning rate ${c.eta}.`,
      describedBy: typeof options.describedBy === 'string' ? options.describedBy : undefined,
      aspect: 0.82,
      minHeight: 150,
      maxHeight: 240,
      margins: { left: 26, right: 10, top: 10, bottom: 22 },
      xTickCount: 3,
      yTickCount: 3,
    });
    panel.frame.setDomain(DOMAIN);
    panel.drawAxes();

    const curve = svgEl('path', { class: 'viz-curve' });
    setStyle(curve, { strokeWidth: 1.6 });
    panel.layers.data.append(curve);
    const trail = svgEl('path', { class: 'viz-path', 'stroke-dasharray': '3 3' });
    const marks = svgEl('g', {});
    const point = svgEl('circle', { class: 'viz-point', r: '5' });
    panel.layers.overlay.append(trail, marks, point);

    return { panel, curve, trail, marks, point, caption, eta: c.eta, verdict: c.verdict };
  });

  const note = status();
  let x0 = START_X;
  let steps = START_STEPS;
  let progress = 0;

  const x0Slider = slider({
    label: 'Starting point x₀',
    min: DOMAIN.xMin,
    max: DOMAIN.xMax,
    step: 0.05,
    value: START_X,
    format: (v) => fmt(v, 2),
    onInput: (v) => {
      x0 = v;
      steps = START_STEPS;
      stepSlider.set(START_STEPS, true);
      pause();
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

  host.append(controlGroup(x0Slider.root, stepSlider.root), buttonRow, note.root);

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
    else play();
  }

  function play(): void {
    if (!loop) return;
    if (steps >= MAX_STEPS) steps = 0;
    loop.start();
    playButton.textContent = 'Pause';
    playButton.setAttribute('aria-pressed', 'true');
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
    x0 = START_X;
    x0Slider.set(START_X, true);
    stepSlider.set(START_STEPS, true);
    render();
  }

  /** Iterates x₀ … x_n for one learning rate, stopping if they leave the plot. */
  function trajectory(eta: number, n: number): number[] {
    const xs = [x0];
    let x = x0;
    for (let i = 0; i < n; i++) {
      x = x - eta * df(x);
      if (!Number.isFinite(x)) break;
      xs.push(x);
      if (Math.abs(df(x)) < 1e-9) break;
    }
    return xs;
  }

  function stepsToTolerance(eta: number): number | null {
    let x = x0;
    for (let i = 0; i <= MAX_STEPS; i++) {
      if (Math.abs(df(x)) < TOL) return i;
      x = x - eta * df(x);
      if (!Number.isFinite(x)) return null;
    }
    return null;
  }

  function render(): void {
    for (const lane of lanes) {
      const frame = lane.panel.frame;
      lane.curve.setAttribute('d', functionPath(frame, f, 160));

      const xs = trajectory(lane.eta, steps);
      let d = '';
      for (let i = 0; i < xs.length; i++) {
        const cx = frame.clampX(xs[i]!);
        d += `${i === 0 ? 'M' : 'L'}${frame.px(cx).toFixed(1)} ${frame.py(f(cx)).toFixed(1)}`;
      }
      lane.trail.setAttribute('d', d);

      lane.marks.textContent = '';
      for (const x of xs.slice(-25)) {
        const cx = frame.clampX(x);
        lane.marks.append(
          svgEl('circle', {
            cx: frame.px(cx),
            cy: frame.py(f(cx)),
            r: '2.2',
            fill: 'var(--c-plot-path)',
            opacity: '0.5',
          }),
        );
      }

      const last = frame.clampX(xs[xs.length - 1]!);
      lane.point.setAttribute('cx', String(frame.px(last)));
      lane.point.setAttribute('cy', String(frame.py(f(last))));

      const reached = stepsToTolerance(lane.eta);
      const gradient = Math.abs(df(xs[xs.length - 1]!));
      lane.caption.textContent =
        reached === null
          ? `f = ${fmt(f(last), 3)} · |f ′| = ${fmt(gradient, 3)} · never settles`
          : `f = ${fmt(f(last), 3)} · |f ′| = ${fmt(gradient, 3)} · settles in ${reached}`;
    }

    const small = stepsToTolerance(CASES[0]!.eta);
    const good = stepsToTolerance(CASES[1]!.eta);
    note.set(
      `After ${steps} iteration${steps === 1 ? '' : 's'}: η = 0.60 needs ${
        good === null ? 'more than ' + MAX_STEPS : good
      } iterations to reach |f ′| < 0.01, η = 0.05 needs ${
        small === null ? 'more than ' + MAX_STEPS : small
      }, and η = 2.40 exceeds the local stability limit 2/f ″(x*) ≈ 2.03, so it never settles.`,
    );
  }

  for (const lane of lanes) lane.panel.onLayout(render);
  render();
}
