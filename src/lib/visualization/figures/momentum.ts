/**
 * Figure: momentum in a narrow valley.
 *
 * Both methods run on the same stretched quadratic with the same learning
 * rate, so the only difference is the velocity state:
 *
 *   plain:     θ_{t+1} = θ_t − η ∇J(θ_t)
 *   momentum:  v_{t+1} = β v_t − η ∇J(θ_t),   θ_{t+1} = θ_t + v_{t+1}
 */
import { createPanel } from '../panel';
import { svgEl, setStyle, fmt } from '../plot';
import { createLoop, prefersReducedMotion } from '../lifecycle';
import { slider, buttons, readout, status, controlGroup, legend, el } from '../controls';
import { drawContours, grad, pathThrough, radiusForDomain, type Quadratic } from './quadratic';

const X_HALF_RANGE = 3;
const START: [number, number] = [-2.6, 0.85];
const MAX_STEPS = 160;
const SECONDS_PER_STEP = 0.14;
const J: Quadratic = { a: 1, b: 16, p: 0, q: 0, c0: 0 };
/** Iterations shown on arrival, enough for the two paths to separate. */
const START_STEPS = 30;

export function mount(host: HTMLElement, options: Record<string, unknown>): void {
  host.textContent = '';
  const reduced = prefersReducedMotion();
  const plot = el('div', {});
  host.append(plot);

  const panel = createPanel(plot, {
    label:
      'Contours of a narrow quadratic valley showing a zig-zagging plain gradient descent path and a smoother momentum path.',
    describedBy: typeof options.describedBy === 'string' ? options.describedBy : undefined,
    xLabel: 'θ₁',
    yLabel: 'θ₂',
    aspect: 0.55,
    minHeight: 220,
    maxHeight: 360,
    margins: { left: 38, right: 16, top: 14, bottom: 32 },
  });

  const contours = svgEl('g', { 'aria-hidden': 'true' });
  panel.layers.grid.after(contours);
  panel.clip(contours);
  const plainPath = svgEl('path', { class: 'viz-path' });
  setStyle(plainPath, { stroke: 'var(--c-plot-point)', strokeWidth: 1.6 });
  const momentumPath = svgEl('path', { class: 'viz-path' });
  setStyle(momentumPath, { stroke: 'var(--c-plot-alt2)', strokeWidth: 2.2, opacity: 1 });
  const plainPoint = svgEl('circle', {
    r: '5.5',
    fill: 'var(--c-plot-point)',
    stroke: 'var(--c-bg-raised)',
    'stroke-width': '2',
  });
  const momentumPoint = svgEl('circle', {
    r: '5.5',
    fill: 'var(--c-plot-alt2)',
    stroke: 'var(--c-bg-raised)',
    'stroke-width': '2',
  });
  panel.layers.overlay.append(plainPath, momentumPath, plainPoint, momentumPoint);

  const out = readout([
    { key: 'iter', label: 'Iteration t' },
    { key: 'plain', label: '‖θ−θ*‖ plain' },
    { key: 'mom', label: '‖θ−θ*‖ momentum' },
    { key: 'eff', label: 'Effective step ×1/(1−β)' },
  ]);
  const note = status();

  let beta = 0.5;
  let eta = 0.1;
  let steps = START_STEPS;
  let progress = 0;

  const betaSlider = slider({
    label: 'Momentum β',
    min: 0,
    max: 0.95,
    step: 0.01,
    value: beta,
    format: (v) => fmt(v, 2),
    onInput: (v) => {
      beta = v;
      render();
    },
  });
  const etaSlider = slider({
    label: 'Learning rate η',
    min: 0.01,
    max: 0.12,
    step: 0.005,
    value: eta,
    format: (v) => fmt(v, 3),
    onInput: (v) => {
      eta = v;
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

  host.append(
    controlGroup(betaSlider.root, etaSlider.root, stepSlider.root),
    buttonRow,
    legend([
      { label: 'plain gradient descent', color: 'var(--c-plot-point)' },
      { label: 'with momentum', color: 'var(--c-plot-alt2)' },
    ]),
    out.root,
    note.root,
  );

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
    beta = 0.5;
    eta = 0.1;
    betaSlider.set(beta, true);
    etaSlider.set(eta, true);
    stepSlider.set(START_STEPS, true);
    render();
  }

  function plainTrajectory(n: number): Array<[number, number]> {
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

  function momentumTrajectory(n: number): Array<[number, number]> {
    const points: Array<[number, number]> = [START];
    let [x, y] = START;
    let vx = 0;
    let vy = 0;
    for (let i = 0; i < n; i++) {
      const [gx, gy] = grad(J, x, y);
      vx = beta * vx - eta * gx;
      vy = beta * vy - eta * gy;
      x += vx;
      y += vy;
      points.push([x, y]);
    }
    return points;
  }

  function layout(): void {
    const frame = panel.frame;
    const yHalf = (X_HALF_RANGE * frame.innerHeight) / frame.innerWidth;
    frame.setDomain({ xMin: -X_HALF_RANGE, xMax: X_HALF_RANGE, yMin: -yHalf, yMax: yHalf });
    panel.drawAxes();
    drawContours(contours, frame, J, 8, radiusForDomain(J, frame));
  }

  function render(): void {
    const frame = panel.frame;
    const plain = plainTrajectory(steps);
    const withMomentum = momentumTrajectory(steps);
    plainPath.setAttribute('d', pathThrough(frame, plain));
    momentumPath.setAttribute('d', pathThrough(frame, withMomentum));

    const lastPlain = plain[plain.length - 1]!;
    const lastMom = withMomentum[withMomentum.length - 1]!;
    plainPoint.setAttribute('cx', String(frame.px(frame.clampX(lastPlain[0]))));
    plainPoint.setAttribute('cy', String(frame.py(frame.clampY(lastPlain[1]))));
    momentumPoint.setAttribute('cx', String(frame.px(frame.clampX(lastMom[0]))));
    momentumPoint.setAttribute('cy', String(frame.py(frame.clampY(lastMom[1]))));

    const dPlain = Math.hypot(lastPlain[0], lastPlain[1]);
    const dMom = Math.hypot(lastMom[0], lastMom[1]);
    out.set('iter', String(steps));
    out.set('plain', fmt(dPlain, 4));
    out.set('mom', Number.isFinite(dMom) ? fmt(dMom, 4) : 'diverged');
    out.set('eff', beta < 1 ? `${fmt(1 / (1 - beta), 1)}×` : '—');

    if (!Number.isFinite(dMom) || dMom > 40) {
      note.set(
        `β = ${fmt(beta, 2)} with η = ${fmt(eta, 3)} is unstable here: momentum widens the range of stable η but does not make it unlimited.`,
        'warn',
      );
    } else if (beta === 0) {
      note.set('With β = 0 the two runs coincide: momentum with zero β is plain gradient descent.');
    } else {
      note.set(
        `Along the steep θ₂ direction the gradient flips sign every step, so those contributions largely cancel in v. Along the shallow θ₁ direction they agree and accumulate, up to about 1/(1−β) = ${fmt(1 / (1 - beta), 1)} times a single step.`,
      );
    }
  }

  panel.onLayout(() => {
    layout();
    render();
  });
  layout();
  render();
}
