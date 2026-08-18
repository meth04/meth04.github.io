/**
 * Figure: one-dimensional gradient descent on f(x) = 0.12x² + 0.8 sin x + 3.
 *
 * The reader controls the starting point and the learning rate, and can step
 * the iteration by hand or play it. The step arrow is drawn to scale, which is
 * the point of the figure: the step length is η·|f ′(x)|, so it shrinks by
 * itself as the slope flattens.
 */
import { createPanel } from '../panel';
import { functionPath, svgEl, setAttrs, fmt } from '../plot';
import { createLoop, prefersReducedMotion, type Loop } from '../lifecycle';
import { slider, buttons, readout, status, controlGroup, el } from '../controls';
import { f, df, DOMAIN, GLOBAL_MIN_X, LOCAL_MIN_X, FUNCTION_LABEL } from './curve';

const START_X = 4.6;
const START_ETA = 0.6;
const MAX_STEPS = 300;
const SECONDS_PER_STEP = 0.42;
const CONVERGED = 1e-3;
const DIVERGED = 40;
/** The point glides between iterates; 30 redraws a second is plenty for that
 * and halves the paint cost compared with running at display refresh rate. */
const ANIMATION_FPS = 30;

export function mount(host: HTMLElement, options: Record<string, unknown>): void {
  host.textContent = '';
  const reduced = prefersReducedMotion();
  const plot = el('div', {});
  host.append(plot);

  const panel = createPanel(plot, {
    label: `Gradient descent iterates on the graph of ${FUNCTION_LABEL}.`,
    describedBy: typeof options.describedBy === 'string' ? options.describedBy : undefined,
    xLabel: 'x',
    yLabel: 'f(x)',
    aspect: 0.52,
    margins: { left: 40, right: 18, top: 16, bottom: 36 },
  });
  panel.frame.setDomain(DOMAIN);
  panel.drawAxes();

  const curve = svgEl('path', { class: 'viz-curve' });
  const minMarks = svgEl('g', { 'aria-hidden': 'true' });
  panel.layers.data.append(curve, minMarks);

  const trail = svgEl('path', { class: 'viz-path', 'stroke-dasharray': '4 3' });
  const marks = svgEl('g', {});
  const stepArrow = svgEl('path', { class: 'viz-vector', stroke: 'var(--c-plot-point)' });
  const stepHead = svgEl('polygon', { fill: 'var(--c-plot-point)' });
  const drop = svgEl('line', {
    stroke: 'var(--c-plot-axis)',
    'stroke-width': '1',
    'stroke-dasharray': '3 3',
  });
  const point = svgEl('circle', { class: 'viz-point', r: '6.5' });
  panel.layers.overlay.append(trail, marks, drop, stepArrow, stepHead, point);

  const out = readout([
    { key: 'iter', label: 'Iteration t' },
    { key: 'x', label: 'xₜ' },
    { key: 'fx', label: 'f(xₜ)' },
    { key: 'slope', label: 'f ′(xₜ)' },
    { key: 'step', label: 'Step −η f ′(xₜ)' },
  ]);
  const note = status();

  let eta = START_ETA;
  let history: number[] = [START_X];
  /** Progress in [0,1) of the animated move from the last iterate to the next. */
  let progress = 0;
  let finished: 'running' | 'converged' | 'diverged' | 'max' = 'running';
  let loop: Loop | null = null;

  const x0Slider = slider({
    label: 'Starting point x₀',
    min: DOMAIN.xMin,
    max: DOMAIN.xMax,
    step: 0.05,
    value: START_X,
    format: (v) => fmt(v, 2),
    onInput: () => reset(),
  });

  const etaSlider = slider({
    label: 'Learning rate η',
    min: 0.02,
    max: 2.6,
    step: 0.02,
    value: START_ETA,
    format: (v) => fmt(v, 2),
    onInput: (v) => {
      eta = v;
      reset();
    },
  });

  const { root: buttonRow, items } = buttons([
    {
      label: reduced ? 'Run 40 steps' : 'Play',
      variant: 'primary',
      onClick: () => (reduced ? runMany(40) : togglePlay()),
    },
    { label: 'Step', onClick: () => stepOnce() },
    { label: 'Reset', onClick: () => reset() },
  ]);
  const playButton = items[0]!;
  const stepButton = items[1]!;
  playButton.setAttribute('aria-pressed', 'false');

  host.append(controlGroup(x0Slider.root, etaSlider.root), buttonRow, out.root, note.root);

  function current(): number {
    return history[history.length - 1]!;
  }

  function nextIterate(x: number): number {
    return x - eta * df(x);
  }

  function stopCondition(x: number): typeof finished {
    if (!Number.isFinite(x) || Math.abs(x) > DIVERGED) return 'diverged';
    if (Math.abs(df(x)) < CONVERGED) return 'converged';
    if (history.length > MAX_STEPS) return 'max';
    return 'running';
  }

  function stepOnce(): void {
    if (finished !== 'running') return;
    const next = nextIterate(current());
    history.push(next);
    progress = 0;
    finished = stopCondition(next);
    if (finished !== 'running') pause();
    renderTrail();
    renderPoint();
  }

  function runMany(count: number): void {
    for (let i = 0; i < count && finished === 'running'; i++) stepOnce();
  }

  function togglePlay(): void {
    if (!loop) return;
    if (loop.running) pause();
    else play();
  }

  function play(): void {
    if (finished !== 'running' || !loop) return;
    loop.start();
    playButton.textContent = 'Pause';
    playButton.setAttribute('aria-pressed', 'true');
  }

  function pause(): void {
    loop?.stop();
    playButton.textContent = reduced ? 'Run 40 steps' : 'Play';
    playButton.setAttribute('aria-pressed', 'false');
  }

  function reset(): void {
    pause();
    history = [x0Slider.value()];
    progress = 0;
    finished = stopCondition(history[0]!);
    render();
  }

  if (!reduced) {
    loop = createLoop(
      host,
      (dt) => {
        if (finished !== 'running') {
          pause();
          return;
        }
        progress += dt / SECONDS_PER_STEP;
        while (progress >= 1) {
          progress -= 1;
          stepOnce();
          if (finished !== 'running') {
            progress = 0;
            return;
          }
        }
        // Between iterations only the moving point changes, so the per-frame
        // work is a handful of attribute writes rather than a DOM rebuild.
        renderPoint();
      },
      ANIMATION_FPS,
    );
  }

  /** Rebuild the parts that only change when the geometry or the run changes. */
  function renderStatic(): void {
    const frame = panel.frame;
    curve.setAttribute('d', functionPath(frame, f, 340));

    minMarks.textContent = '';
    const labelled: Array<[number, string]> = [
      [GLOBAL_MIN_X, 'global min'],
      [LOCAL_MIN_X, 'local min'],
    ];
    for (const [mx, label] of labelled) {
      const tick = svgEl('line', {
        x1: frame.px(mx),
        x2: frame.px(mx),
        y1: frame.py(f(mx)) - 7,
        y2: frame.py(f(mx)) + 7,
        stroke: 'var(--c-plot-alt)',
        'stroke-width': '1.5',
      });
      const text = svgEl('text', {
        class: 'tick',
        x: frame.px(mx),
        y: frame.py(f(mx)) + 22,
        'text-anchor': 'middle',
        fill: 'var(--c-plot-alt)',
      });
      text.textContent = label;
      minMarks.append(tick, text);
    }
  }

  function render(): void {
    renderStatic();
    renderTrail();
    renderPoint();
  }

  /** Redraw the iterate path; only needed when a step is taken or on resize. */
  function renderTrail(): void {
    const frame = panel.frame;

    let d = '';
    history.forEach((x, i) => {
      const cx = frame.clampX(x);
      d += `${i === 0 ? 'M' : 'L'}${frame.px(cx).toFixed(1)} ${frame.py(f(cx)).toFixed(1)}`;
    });
    trail.setAttribute('d', d);

    marks.textContent = '';
    for (const x of history.slice(-40)) {
      const cx = frame.clampX(x);
      marks.append(
        svgEl('circle', {
          cx: frame.px(cx),
          cy: frame.py(f(cx)),
          r: '2.6',
          fill: 'var(--c-plot-path)',
          opacity: '0.55',
        }),
      );
    }
  }

  /** Per-frame work: the moving point, the step arrow and the readout. */
  function renderPoint(): void {
    const frame = panel.frame;
    const from = current();
    const slope = df(from);
    const target = nextIterate(from);
    const eased = finished === 'running' && loop?.running ? easeInOut(progress) : 0;
    const shown = frame.clampX(from + (target - from) * eased);
    const shownY = f(shown);

    setAttrs(point, { cx: frame.px(shown), cy: frame.py(shownY) });
    setAttrs(drop, {
      x1: frame.px(shown),
      y1: frame.py(shownY),
      x2: frame.px(shown),
      y2: frame.top + frame.innerHeight,
    });

    // Step arrow drawn to scale along the bottom of the panel.
    const baseY = frame.top + frame.innerHeight - 10;
    const ax1 = frame.px(from);
    const ax2 = frame.px(frame.clampX(target));
    const dir = Math.sign(ax2 - ax1) || 1;
    const visible = Math.abs(ax2 - ax1) > 3 && finished !== 'diverged';
    setAttrs(stepArrow, { d: `M${ax1} ${baseY}L${ax2} ${baseY}`, opacity: visible ? '1' : '0' });
    setAttrs(stepHead, {
      points: `${ax2},${baseY} ${ax2 - dir * 8},${baseY - 4.5} ${ax2 - dir * 8},${baseY + 4.5}`,
      opacity: visible ? '1' : '0',
    });

    out.set('iter', String(history.length - 1));
    out.set('x', fmt(from, 3));
    out.set('fx', fmt(f(from), 3));
    out.set('slope', fmt(slope, 3));
    out.set('step', fmt(-eta * slope, 3));

    stepButton.disabled = finished !== 'running';
    playButton.disabled = finished !== 'running';

    if (finished === 'converged') {
      const which = Math.abs(from - GLOBAL_MIN_X) < 0.3 ? 'the global minimum' : 'a local minimum';
      note.set(
        `Stopped after ${history.length - 1} iterations: |f ′(x)| < 0.001, at ${which} x ≈ ${fmt(from, 3)}. The steps shrank because the slope did, not because η changed.`,
      );
    } else if (finished === 'diverged') {
      note.set(
        `The iterates left the plotted region: with η = ${fmt(eta, 2)} each step overshoots by more than it corrects. Try a smaller learning rate.`,
        'warn',
      );
    } else if (finished === 'max') {
      note.set(
        `Still moving after ${MAX_STEPS} iterations — with η = ${fmt(eta, 2)} progress along this curve is extremely slow.`,
        'warn',
      );
    } else if (Math.abs(slope) < 0.05) {
      note.set(
        'The slope is nearly flat here, so the steps are tiny even though η has not changed.',
      );
    } else {
      note.set(
        `Step length = η·|f ′(x)| = ${fmt(eta, 2)} × ${fmt(Math.abs(slope), 3)} = ${fmt(eta * Math.abs(slope), 3)}.`,
      );
    }
  }

  panel.onLayout(render);
  reset();
}

function easeInOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2;
}
