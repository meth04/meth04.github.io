/**
 * Figure: batch, mini-batch and stochastic gradient descent on a real (if
 * small) least-squares problem.
 *
 *   model    ŷ = w x + b
 *   loss     J(w, b) = (1/m) Σ (w xᵢ + b − yᵢ)²
 *
 * The inputs are centred, so J is an axis-aligned quadratic in (w, b) and its
 * level sets can be drawn exactly. A mini-batch gradient is the same formula
 * evaluated on k of the m examples: unbiased, but noisy.
 */
import { createPanel } from '../panel';
import { svgEl, setStyle, fmt } from '../plot';
import { createLoop, prefersReducedMotion } from '../lifecycle';
import { slider, buttons, readout, status, controlGroup, legend, el } from '../controls';
import { drawContours, pathThrough, type Quadratic } from './quadratic';

const M = 40;
const TRUE_W = 1.4;
const TRUE_B = 0.6;
const NOISE = 1.1;
const MAX_STEPS = 400;
const SECONDS_PER_STEP = 0.12;
const START: [number, number] = [-0.9, 1.9];
/** Updates applied on arrival, so both paths are visible without pressing Play. */
const START_STEPS = 30;

/** Deterministic PRNG so every reader sees the same dataset and the same run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mount(host: HTMLElement, options: Record<string, unknown>): void {
  host.textContent = '';
  const reduced = prefersReducedMotion();

  // ---- Data ----
  const rng = mulberry32(20260818);
  const xs = Array.from({ length: M }, () => rng() * 4 - 2);
  const meanX = xs.reduce((s, v) => s + v, 0) / M;
  for (let i = 0; i < M; i++) xs[i] = xs[i]! - meanX; // centre the inputs
  const ys = xs.map((x) => TRUE_W * x + TRUE_B + (rng() * 2 - 1) * NOISE);

  const meanXX = xs.reduce((s, v) => s + v * v, 0) / M;
  const meanY = ys.reduce((s, v) => s + v, 0) / M;
  const meanXY = xs.reduce((s, v, i) => s + v * ys[i]!, 0) / M;
  const wStar = meanXY / meanXX;
  const bStar = meanY;
  const J: Quadratic = { a: 2 * meanXX, b: 2, p: wStar, q: bStar, c0: 0 };

  function fullGradient(w: number, b: number): [number, number] {
    let gw = 0;
    let gb = 0;
    for (let i = 0; i < M; i++) {
      const r = w * xs[i]! + b - ys[i]!;
      gw += r * xs[i]!;
      gb += r;
    }
    return [(2 / M) * gw, (2 / M) * gb];
  }

  function batchGradient(w: number, b: number, indices: number[]): [number, number] {
    let gw = 0;
    let gb = 0;
    for (const i of indices) {
      const r = w * xs[i]! + b - ys[i]!;
      gw += r * xs[i]!;
      gb += r;
    }
    const k = indices.length;
    return [(2 / k) * gw, (2 / k) * gb];
  }

  function loss(w: number, b: number): number {
    let s = 0;
    for (let i = 0; i < M; i++) s += (w * xs[i]! + b - ys[i]!) ** 2;
    return s / M;
  }

  // ---- Layout ----
  const grid = el('div', { class: 'viz-multi' });
  host.append(grid);

  const dataItem = el('div', { class: 'viz-multi__item' });
  dataItem.append(el('p', { class: 'viz-multi__title' }, 'Data and current fit'));
  const dataPlot = el('div', {});
  dataItem.append(dataPlot);
  const paramItem = el('div', { class: 'viz-multi__item' });
  paramItem.append(el('p', { class: 'viz-multi__title' }, 'Parameter space (w, b)'));
  const paramPlot = el('div', {});
  paramItem.append(paramPlot);
  grid.append(dataItem, paramItem);

  const yMin = Math.min(...ys) - 0.6;
  const yMax = Math.max(...ys) + 0.6;
  const dataPanel = createPanel(dataPlot, {
    label: 'Scatter plot of the training data with the line given by the current parameters.',
    describedBy: typeof options.describedBy === 'string' ? options.describedBy : undefined,
    xLabel: 'x',
    yLabel: 'y',
    aspect: 0.72,
    minHeight: 190,
    maxHeight: 300,
    margins: { left: 32, right: 12, top: 12, bottom: 28 },
    xTickCount: 4,
    yTickCount: 4,
  });
  dataPanel.frame.setDomain({ xMin: -2.4, xMax: 2.4, yMin, yMax });
  dataPanel.drawAxes();

  const dots = svgEl('g', {});
  const fitLine = svgEl('line', { stroke: 'var(--c-plot-alt2)', 'stroke-width': '2.5' });
  const optimalLine = svgEl('line', {
    stroke: 'var(--c-plot-axis)',
    'stroke-width': '1.5',
    'stroke-dasharray': '5 4',
  });
  dataPanel.layers.data.append(dots);
  dataPanel.layers.overlay.append(optimalLine, fitLine);

  const paramPanel = createPanel(paramPlot, {
    label:
      'Contours of the least-squares loss in parameter space with the batch and mini-batch paths.',
    describedBy: typeof options.describedBy === 'string' ? options.describedBy : undefined,
    xLabel: 'w',
    yLabel: 'b',
    aspect: 0.72,
    minHeight: 190,
    maxHeight: 300,
    margins: { left: 34, right: 12, top: 12, bottom: 28 },
    xTickCount: 4,
    yTickCount: 4,
  });
  const contours = svgEl('g', { 'aria-hidden': 'true' });
  paramPanel.layers.grid.after(contours);
  paramPanel.clip(contours);
  const batchPath = svgEl('path', { class: 'viz-path' });
  setStyle(batchPath, { stroke: 'var(--c-plot-point)', strokeWidth: 2.2, opacity: 1 });
  const noisyPath = svgEl('path', { class: 'viz-path' });
  setStyle(noisyPath, { stroke: 'var(--c-plot-alt2)', strokeWidth: 1.4, opacity: 0.9 });
  const batchDot = svgEl('circle', {
    r: '5',
    fill: 'var(--c-plot-point)',
    stroke: 'var(--c-bg-raised)',
    'stroke-width': '2',
  });
  const noisyDot = svgEl('circle', {
    r: '5',
    fill: 'var(--c-plot-alt2)',
    stroke: 'var(--c-bg-raised)',
    'stroke-width': '2',
  });
  paramPanel.layers.overlay.append(batchPath, noisyPath, batchDot, noisyDot);

  // ---- State ----
  let k = 2;
  let eta = 0.25;
  let steps = 0;
  let progress = 0;
  let batchTrail: Array<[number, number]> = [START];
  let noisyTrail: Array<[number, number]> = [START];
  let currentBatch: number[] = [];
  let order: number[] = [];
  let cursor = 0;
  let shuffleRng = mulberry32(7);

  const out = readout([
    { key: 'iter', label: 'Updates t' },
    { key: 'epoch', label: 'Passes over data' },
    { key: 'params', label: '(w, b)' },
    { key: 'loss', label: 'J on all m = 40' },
    { key: 'gap', label: 'J − J(w*, b*)' },
  ]);
  const note = status();

  const kSlider = slider({
    label: 'Batch size k',
    min: 1,
    max: M,
    step: 1,
    value: k,
    format: (v) => (v === M ? `${M} (full batch)` : v === 1 ? '1 (single example)' : String(v)),
    onInput: (v) => {
      k = Math.round(v);
      restart();
    },
  });
  const etaSlider = slider({
    label: 'Learning rate η',
    min: 0.02,
    max: 0.6,
    step: 0.01,
    value: eta,
    format: (v) => fmt(v, 2),
    onInput: (v) => {
      eta = v;
      restart();
    },
  });

  const { root: buttonRow, items } = buttons([
    {
      label: reduced ? 'Advance 20 updates' : 'Play',
      variant: 'primary',
      onClick: () => (reduced ? advance(20) : togglePlay()),
    },
    { label: 'Step', onClick: () => stepOnce() },
    { label: 'Reset', onClick: () => restart() },
  ]);
  const playButton = items[0]!;
  playButton.setAttribute('aria-pressed', 'false');

  host.append(
    controlGroup(kSlider.root, etaSlider.root),
    buttonRow,
    legend([
      { label: 'full-batch gradient descent', color: 'var(--c-plot-point)' },
      { label: 'mini-batch SGD (k examples)', color: 'var(--c-plot-alt2)' },
      { label: 'least-squares optimum', color: 'var(--c-plot-axis)', dashed: true },
    ]),
    out.root,
    note.root,
  );

  const loop = reduced
    ? null
    : createLoop(host, (dt) => {
        progress += dt / SECONDS_PER_STEP;
        while (progress >= 1) {
          progress -= 1;
          stepOnce();
          if (steps >= MAX_STEPS) {
            pause();
            break;
          }
        }
      });

  function nextBatch(): number[] {
    if (k >= M) return Array.from({ length: M }, (_, i) => i);
    if (cursor + k > order.length) {
      order = shuffle(
        Array.from({ length: M }, (_, i) => i),
        shuffleRng,
      );
      cursor = 0;
    }
    const batch = order.slice(cursor, cursor + k);
    cursor += k;
    return batch;
  }

  function stepOnce(): void {
    if (steps >= MAX_STEPS) return;
    steps += 1;

    const [bw, bb] = batchTrail[batchTrail.length - 1]!;
    const [gw, gb] = fullGradient(bw, bb);
    batchTrail.push([bw - eta * gw, bb - eta * gb]);

    const [nw, nb] = noisyTrail[noisyTrail.length - 1]!;
    currentBatch = nextBatch();
    const [sw, sb] = batchGradient(nw, nb, currentBatch);
    noisyTrail.push([nw - eta * sw, nb - eta * sb]);

    if (noisyTrail.length > 260) noisyTrail = noisyTrail.slice(-260);
    if (batchTrail.length > 260) batchTrail = batchTrail.slice(-260);
    render();
  }

  function advance(n: number): void {
    for (let i = 0; i < n; i++) stepOnce();
  }

  function togglePlay(): void {
    if (!loop) return;
    if (loop.running) pause();
    else {
      if (steps >= MAX_STEPS) restart();
      loop.start();
      playButton.textContent = 'Pause';
      playButton.setAttribute('aria-pressed', 'true');
    }
  }
  function pause(): void {
    loop?.stop();
    playButton.textContent = reduced ? 'Advance 20 updates' : 'Play';
    playButton.setAttribute('aria-pressed', 'false');
  }

  function restart(): void {
    steps = 0;
    progress = 0;
    batchTrail = [START];
    noisyTrail = [START];
    currentBatch = [];
    shuffleRng = mulberry32(7);
    order = shuffle(
      Array.from({ length: M }, (_, i) => i),
      shuffleRng,
    );
    cursor = 0;
    for (let i = 0; i < START_STEPS; i++) stepOnce();
    render();
  }

  function layout(): void {
    const frame = paramPanel.frame;
    const half = 2.6;
    const yHalf = (half * frame.innerHeight) / frame.innerWidth;
    frame.setDomain({
      xMin: wStar - half,
      xMax: wStar + half,
      yMin: bStar - yHalf,
      yMax: bStar + yHalf,
    });
    paramPanel.drawAxes();
    drawContours(contours, frame, J, 8, Math.sqrt(J.a) * half);

    // Data panel: the fixed scatter and the optimal line.
    const dframe = dataPanel.frame;
    dots.textContent = '';
    for (let i = 0; i < M; i++) {
      dots.append(
        svgEl('circle', {
          cx: dframe.px(xs[i]!),
          cy: dframe.py(ys[i]!),
          r: '3.2',
          fill: 'var(--c-ink-faint)',
          'data-index': String(i),
        }),
      );
    }
    const x1 = dframe.domain.xMin;
    const x2 = dframe.domain.xMax;
    optimalLine.setAttribute('x1', String(dframe.px(x1)));
    optimalLine.setAttribute('y1', String(dframe.py(wStar * x1 + bStar)));
    optimalLine.setAttribute('x2', String(dframe.px(x2)));
    optimalLine.setAttribute('y2', String(dframe.py(wStar * x2 + bStar)));
  }

  function render(): void {
    const frame = paramPanel.frame;
    batchPath.setAttribute('d', pathThrough(frame, batchTrail));
    noisyPath.setAttribute('d', pathThrough(frame, noisyTrail));
    const lastBatch = batchTrail[batchTrail.length - 1]!;
    const lastNoisy = noisyTrail[noisyTrail.length - 1]!;
    batchDot.setAttribute('cx', String(frame.px(frame.clampX(lastBatch[0]))));
    batchDot.setAttribute('cy', String(frame.py(frame.clampY(lastBatch[1]))));
    noisyDot.setAttribute('cx', String(frame.px(frame.clampX(lastNoisy[0]))));
    noisyDot.setAttribute('cy', String(frame.py(frame.clampY(lastNoisy[1]))));

    // Current fit line and highlighted batch members.
    const dframe = dataPanel.frame;
    const [w, b] = lastNoisy;
    const x1 = dframe.domain.xMin;
    const x2 = dframe.domain.xMax;
    fitLine.setAttribute('x1', String(dframe.px(x1)));
    fitLine.setAttribute('y1', String(dframe.py(w * x1 + b)));
    fitLine.setAttribute('x2', String(dframe.px(x2)));
    fitLine.setAttribute('y2', String(dframe.py(w * x2 + b)));

    const inBatch = new Set(currentBatch);
    for (const dot of dots.children) {
      const index = Number((dot as SVGElement).dataset.index);
      const active = inBatch.has(index) && k < M;
      dot.setAttribute('fill', active ? 'var(--c-plot-alt2)' : 'var(--c-ink-faint)');
      dot.setAttribute('r', active ? '4.4' : '3.2');
      dot.setAttribute('opacity', active || k >= M ? '1' : '0.45');
    }

    const jNow = loss(w, b);
    const jStar = loss(wStar, bStar);
    out.set('iter', String(steps));
    out.set('epoch', fmt((steps * k) / M, 1));
    out.set('params', `(${fmt(w, 3)}, ${fmt(b, 3)})`);
    out.set('loss', fmt(jNow, 4));
    out.set('gap', fmt(jNow - jStar, 4));

    if (k >= M) {
      note.set(
        'With k = m the mini-batch gradient is the full gradient, so both paths coincide and the iterates settle exactly at the optimum.',
      );
    } else {
      note.set(
        `Each update uses ${k} of ${M} examples, so it costs ${fmt(k / M, 2)}× a full-batch update but is noisy: the iterates approach the optimum and then keep bouncing inside a region whose size grows with η and shrinks with k.`,
      );
    }
  }

  dataPanel.onLayout(() => {
    layout();
    render();
  });
  paramPanel.onLayout(() => {
    layout();
    render();
  });
  restart();
  layout();
  render();
}

function shuffle(items: number[], rng: () => number): number[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
