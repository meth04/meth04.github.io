/**
 * Figure: conditional probability as renormalisation.
 *
 * The unit square is the sample space. Splitting it vertically at P(B) and each
 * column horizontally at P(A|B) and P(A|¬B) produces a picture in which every
 * probability is an area. Conditioning on B then means discarding the ¬B column
 * and stretching what is left back to area 1 — which is exactly the division by
 * P(B) in the definition.
 */
import { createStage, pct, setDecimalSeparator } from '../stage';
import { svgEl, setStyle } from '../plot';
import { createLoop, prefersReducedMotion } from '../lifecycle';
import { slider, buttons, readout, status, controlGroup, legend, el } from '../controls';
import { figureLang, type FigureLang } from '../strings';

const START = { pB: 0.4, pAgivenB: 0.7, pAgivenNotB: 0.2 };
const TRANSITION_SECONDS = 0.55;

const STRINGS: Record<FigureLang, Record<string, string>> = {
  en: {
    aria: 'The unit square split into the events B and not B, each divided into the part inside A and the part outside A.',
    condition: 'Condition on B',
    unconditioned: 'Show the whole square',
    reset: 'Reset',
    inA: 'inside A',
    outA: 'outside A',
    theEventB: 'the event B',
    labelAB: 'A ∩ B',
    labelBnotA: 'B \\ A',
    labelAnotB: 'A \\ B',
    labelNeither: 'neither',
    b: 'B',
    bWhole: 'B is now the whole space',
    total: 'total area 1',
    independent:
      'The two columns are shaded to the same height, so B carries no information about A: here A and B are independent, and P(A | B) = P(A).',
  },
  vi: {
    aria: 'Hình vuông đơn vị được chia thành biến cố B và không B, mỗi cột lại chia thành phần nằm trong A và phần ngoài A.',
    condition: 'Điều kiện theo B',
    unconditioned: 'Xem lại cả hình vuông',
    reset: 'Đặt lại',
    inA: 'thuộc A',
    outA: 'ngoài A',
    theEventB: 'biến cố B',
    labelAB: 'A ∩ B',
    labelBnotA: 'B \\ A',
    labelAnotB: 'A \\ B',
    labelNeither: 'không cả hai',
    b: 'B',
    bWhole: 'B giờ là toàn bộ không gian',
    total: 'tổng diện tích 1',
    independent:
      'Hai cột được tô cùng chiều cao, nên B không mang thông tin gì về A: ở đây A và B độc lập, và P(A | B) = P(A).',
  },
};

export function mount(host: HTMLElement, options: Record<string, unknown>): void {
  host.textContent = '';
  const lang = figureLang(options);
  const s = STRINGS[lang];
  setDecimalSeparator(lang === 'vi' ? ',' : '.');
  const reduced = prefersReducedMotion();
  const plot = el('div', {});
  host.append(plot);

  const stage = createStage(plot, {
    label: s.aria!,
    describedBy: typeof options.describedBy === 'string' ? options.describedBy : undefined,
    aspect: 0.56,
    minHeight: 230,
    maxHeight: 340,
  });

  const regions = svgEl('g', {});
  const frame = svgEl('g', {});
  const labels = svgEl('g', {});
  stage.svg.append(regions, frame, labels);

  const out = readout([
    { key: 'pa', label: 'P(A)' },
    { key: 'pb', label: 'P(B)' },
    { key: 'pab', label: 'P(A ∩ B)' },
    { key: 'agb', label: 'P(A | B)' },
    { key: 'bga', label: 'P(B | A)' },
  ]);
  const note = status();

  let pB = START.pB;
  let pAgivenB = START.pAgivenB;
  let pAgivenNotB = START.pAgivenNotB;
  /** 0 = whole sample space, 1 = conditioned on B. */
  let zoom = 0;
  let target = 0;

  const bSlider = slider({
    label: 'P(B)',
    min: 0.05,
    max: 0.95,
    step: 0.01,
    value: START.pB,
    format: (v) => pct(v, 0),
    onInput: (v) => {
      pB = v;
      render();
    },
  });
  const aGivenBSlider = slider({
    label: 'P(A | B)',
    min: 0,
    max: 1,
    step: 0.01,
    value: START.pAgivenB,
    format: (v) => pct(v, 0),
    onInput: (v) => {
      pAgivenB = v;
      render();
    },
  });
  const aGivenNotBSlider = slider({
    label: lang === 'vi' ? 'P(A | không B)' : 'P(A | not B)',
    min: 0,
    max: 1,
    step: 0.01,
    value: START.pAgivenNotB,
    format: (v) => pct(v, 0),
    onInput: (v) => {
      pAgivenNotB = v;
      render();
    },
  });

  const { root: buttonRow, items } = buttons([
    {
      label: s.condition!,
      variant: 'primary',
      onClick: () => {
        target = target === 1 ? 0 : 1;
        toggleButton.textContent = target === 1 ? s.unconditioned! : s.condition!;
        toggleButton.setAttribute('aria-pressed', String(target === 1));
        if (reduced || !loop) {
          zoom = target;
          render();
        } else {
          loop.start();
        }
      },
    },
    {
      label: s.reset!,
      onClick: () => {
        target = 0;
        zoom = 0;
        pB = START.pB;
        pAgivenB = START.pAgivenB;
        pAgivenNotB = START.pAgivenNotB;
        bSlider.set(START.pB, true);
        aGivenBSlider.set(START.pAgivenB, true);
        aGivenNotBSlider.set(START.pAgivenNotB, true);
        toggleButton.textContent = s.condition!;
        toggleButton.setAttribute('aria-pressed', 'false');
        render();
      },
    },
  ]);
  const toggleButton = items[0]!;
  toggleButton.setAttribute('aria-pressed', 'false');

  host.append(
    controlGroup(bSlider.root, aGivenBSlider.root, aGivenNotBSlider.root),
    buttonRow,
    legend([
      { label: s.inA!, color: 'var(--c-plot-point)' },
      { label: s.outA!, color: 'var(--c-rule-strong)' },
      { label: s.theEventB!, color: 'var(--c-plot-alt)', dashed: true },
    ]),
    out.root,
    note.root,
  );

  const loop = reduced
    ? null
    : createLoop(
        host,
        (dt) => {
          const step = dt / TRANSITION_SECONDS;
          if (zoom < target) zoom = Math.min(target, zoom + step);
          else if (zoom > target) zoom = Math.max(target, zoom - step);
          render();
          if (zoom === target) loop?.stop();
        },
        60,
      );

  function render(): void {
    const { width, height } = stage;
    if (width === 0) return;
    const pad = 20;
    const side = Math.min(width - pad * 2, height - pad * 2);
    const x0 = Math.round((width - side) / 2);
    const y0 = Math.round((height - side) / 2) + 4;

    // Widths interpolate between the true split and the conditioned view.
    const wB = side * (pB + (1 - pB) * zoom);
    const wNotB = side - wB;
    const hAgivenB = side * pAgivenB;
    const hAgivenNotB = side * pAgivenNotB;

    regions.textContent = '';
    labels.textContent = '';
    frame.textContent = '';

    const rect = (
      x: number,
      y: number,
      w: number,
      h: number,
      fill: string,
      opacity: string,
      label?: string,
      labelFill = 'var(--c-ink-soft)',
    ) => {
      if (w <= 0.5 || h <= 0.5) return;
      regions.append(svgEl('rect', { x, y, width: w, height: h, fill, opacity }));
      if (label && w > 56 && h > 22) {
        const text = svgEl('text', {
          x: x + w / 2,
          y: y + h / 2 + 4,
          'text-anchor': 'middle',
          class: 'tick',
          fill: labelFill,
        });
        text.textContent = label;
        labels.append(text);
      }
    };

    rect(x0, y0, wB, hAgivenB, 'var(--c-plot-point)', '0.8', s.labelAB, 'var(--c-bg-raised)');
    rect(x0, y0 + hAgivenB, wB, side - hAgivenB, 'var(--c-rule-strong)', '0.55', s.labelBnotA);
    rect(x0 + wB, y0, wNotB, hAgivenNotB, 'var(--c-plot-point)', '0.26', s.labelAnotB);
    rect(
      x0 + wB,
      y0 + hAgivenNotB,
      wNotB,
      side - hAgivenNotB,
      'var(--c-rule-strong)',
      '0.2',
      s.labelNeither,
    );

    frame.append(
      svgEl('rect', {
        x: x0,
        y: y0,
        width: side,
        height: side,
        fill: 'none',
        stroke: 'var(--c-plot-axis)',
        'stroke-width': '1',
      }),
    );
    const bOutline = svgEl('rect', {
      x: x0,
      y: y0,
      width: wB,
      height: side,
      fill: 'none',
      'stroke-dasharray': '6 4',
    });
    setStyle(bOutline, { stroke: 'var(--c-plot-alt)', strokeWidth: 2 });
    frame.append(bOutline);

    const bLabel = svgEl('text', {
      x: x0 + wB / 2,
      y: y0 - 8,
      'text-anchor': 'middle',
      class: 'tick',
      fill: 'var(--c-plot-alt)',
    });
    bLabel.textContent = zoom > 0.5 ? s.bWhole! : s.b!;
    labels.append(bLabel);

    if (width - (x0 + side) > 96) {
      const areaLabel = svgEl('text', {
        x: x0 + side + 10,
        y: y0 + 12,
        'text-anchor': 'start',
        class: 'tick',
      });
      areaLabel.textContent = s.total!;
      labels.append(areaLabel);
    }

    const pAandB = pB * pAgivenB;
    const pA = pAandB + (1 - pB) * pAgivenNotB;
    out.set('pa', pct(pA, 1));
    out.set('pb', pct(pB, 1));
    out.set('pab', pct(pAandB, 1));
    out.set('agb', pct(pAgivenB, 1));
    out.set('bga', pA > 0 ? pct(pAandB / pA, 1) : '—');

    if (zoom > 0.5) {
      note.set(
        lang === 'vi'
          ? `Chỉ còn lại B, được kéo giãn để diện tích trở lại bằng 1. Phần tô đậm giờ chiếm ${pct(pAgivenB, 1)} của hình — đó chính là P(A | B) = P(A ∩ B)/P(B) = ${pct(pAandB, 1)} ÷ ${pct(pB, 1)}.`
          : `Only B is left, rescaled so that its area is 1 again. The shaded part is now ${pct(pAgivenB, 1)} of the picture — that is P(A | B) = P(A ∩ B)/P(B) = ${pct(pAandB, 1)} ÷ ${pct(pB, 1)}.`,
      );
    } else if (Math.abs(pAgivenB - pAgivenNotB) < 0.005) {
      note.set(s.independent!);
    } else {
      note.set(
        lang === 'vi'
          ? `A là phần tô đậm, diện tích ${pct(pA, 1)}. Bên trong cột nét đứt B, phần tô chiếm ${pct(pAgivenB, 1)} của cột — bấm “${s.condition}” để thấy vì sao tỉ lệ đó chính là P(A | B).`
          : `A is the shaded region, of area ${pct(pA, 1)}. Inside the dashed column B, the shaded part takes up ${pct(pAgivenB, 1)} of the column — press “${s.condition}” to see why that fraction is P(A | B).`,
      );
    }
  }

  stage.onLayout(render);
  render();
}
