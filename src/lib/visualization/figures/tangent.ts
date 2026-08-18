/**
 * Figure: the derivative as the slope of the tangent line.
 * Purely interactive (no animation loop), so it costs nothing when idle.
 */
import { createPanel } from '../panel';
import { functionPath, svgEl, setAttrs, fmt } from '../plot';
import { attachDrag } from '../interaction';
import { slider, buttons, readout, status, controlGroup, el } from '../controls';
import { f, df, DOMAIN, FUNCTION_LABEL } from './curve';

const START_X = 1.6;
/** Half-length of the drawn tangent segment, in data units of x. */
const TANGENT_HALF_WIDTH = 1.5;

export function mount(host: HTMLElement, options: Record<string, unknown>): void {
  host.textContent = '';
  const plot = el('div', { class: 'viz-plot__panel' });
  host.append(plot);

  const panel = createPanel(plot, {
    label: `Graph of ${FUNCTION_LABEL} with a tangent line at a point the reader can move.`,
    describedBy: typeof options.describedBy === 'string' ? options.describedBy : undefined,
    xLabel: 'x',
    yLabel: 'f(x)',
    aspect: 0.52,
    margins: { left: 40, right: 18, top: 16, bottom: 36 },
  });
  panel.frame.setDomain(DOMAIN);
  panel.drawAxes();

  const curve = svgEl('path', { class: 'viz-curve' });
  panel.layers.data.append(curve);

  const tangent = svgEl('line', { class: 'viz-vector', stroke: 'var(--c-plot-alt)' });
  const drop = svgEl('line', {
    stroke: 'var(--c-plot-axis)',
    'stroke-width': '1',
    'stroke-dasharray': '3 3',
  });
  const point = svgEl('circle', { class: 'viz-point', r: '6' });
  const arrow = svgEl('path', {
    class: 'viz-vector',
    stroke: 'var(--c-plot-point)',
    'marker-end': '',
  });
  const arrowHead = svgEl('polygon', { fill: 'var(--c-plot-point)' });
  const arrowLabel = svgEl('text', { class: 'tick', 'text-anchor': 'middle' });
  panel.layers.overlay.append(drop, tangent, arrow, arrowHead, arrowLabel, point);

  const out = readout([
    { key: 'x', label: 'x' },
    { key: 'fx', label: 'f(x)' },
    { key: 'slope', label: 'f ′(x)  (slope)' },
  ]);
  const note = status();

  let x = START_X;

  const xSlider = slider({
    label: 'Position x',
    min: DOMAIN.xMin,
    max: DOMAIN.xMax,
    step: 0.01,
    value: START_X,
    format: (v) => fmt(v, 2),
    onInput: (v) => {
      x = v;
      render();
    },
  });

  const { root: buttonRow } = buttons([
    {
      label: 'Reset',
      onClick: () => {
        xSlider.set(START_X);
      },
    },
  ]);

  host.append(controlGroup(xSlider.root), buttonRow, out.root, note.root);

  attachDrag(panel.svg, {
    onMove: (px) => {
      xSlider.set(Number(panel.frame.clampX(panel.frame.ux(px)).toFixed(2)));
    },
  });

  function render(): void {
    const frame = panel.frame;
    curve.setAttribute('d', functionPath(frame, f, 320));

    const y = f(x);
    const slope = df(x);
    const x1 = frame.clampX(x - TANGENT_HALF_WIDTH);
    const x2 = frame.clampX(x + TANGENT_HALF_WIDTH);
    setAttrs(tangent, {
      x1: frame.px(x1),
      y1: frame.py(y + slope * (x1 - x)),
      x2: frame.px(x2),
      y2: frame.py(y + slope * (x2 - x)),
    });
    setAttrs(point, { cx: frame.px(x), cy: frame.py(y) });
    setAttrs(drop, {
      x1: frame.px(x),
      y1: frame.py(y),
      x2: frame.px(x),
      y2: frame.top + frame.innerHeight,
    });

    // Arrow along the x-axis showing the downhill direction, −f′(x).
    const baseY = frame.top + frame.innerHeight - 12;
    const dir = Math.sign(-slope) || 1;
    const length = Math.min(46, 14 + Math.abs(slope) * 26);
    const startX = frame.px(x);
    const endX = startX + dir * length;
    setAttrs(arrow, { d: `M${startX} ${baseY}L${endX} ${baseY}` });
    const head = 5;
    setAttrs(arrowHead, {
      points: `${endX},${baseY} ${endX - dir * head * 1.6},${baseY - head} ${
        endX - dir * head * 1.6
      },${baseY + head}`,
      opacity: Math.abs(slope) < 0.02 ? '0.25' : '1',
    });
    setAttrs(arrowLabel, { x: (startX + endX) / 2, y: baseY - 9 });
    arrowLabel.textContent = Math.abs(slope) < 0.02 ? 'no downhill direction' : 'downhill';

    out.set('x', fmt(x, 2));
    out.set('fx', fmt(y, 3));
    out.set('slope', fmt(slope, 3));

    if (Math.abs(slope) < 0.02) {
      note.set(
        'The slope is (almost) zero: this is a stationary point, so neither direction goes downhill at first order.',
      );
    } else if (slope > 0) {
      note.set(
        `f ′(x) = ${fmt(slope, 2)} > 0, so f increases to the right. To decrease f, move left — in the direction of −f ′(x).`,
      );
    } else {
      note.set(
        `f ′(x) = ${fmt(slope, 2)} < 0, so f decreases to the right. To decrease f, move right — again the direction of −f ′(x).`,
      );
    }
  }

  panel.onLayout(render);
}
