/**
 * Figure: the law of total probability and Bayes' theorem on a tree.
 *
 * The first split is the partition {B, ¬B}; the second is the event A observed
 * within each branch. Every leaf is a product of the probabilities along its
 * path, P(A) is the sum of the two leaves that end in A, and P(B | A) is the
 * share of that sum contributed by the upper branch. Branch thickness is drawn
 * proportional to probability, so a rare branch looks rare.
 */
import { createStage, pct, setDecimalSeparator } from '../stage';
import { svgEl, setStyle } from '../plot';
import { slider, buttons, readout, status, controlGroup, legend, el } from '../controls';
import { figureLang, type FigureLang } from '../strings';

const START = { pB: 0.3, pAgivenB: 0.8, pAgivenNotB: 0.1 };

const STRINGS: Record<FigureLang, Record<string, string>> = {
  en: {
    aria: 'A probability tree: the first split is B against not B, and each branch then splits into A and not A.',
    b: 'B',
    notB: 'not B',
    a: 'A',
    notA: 'not A',
    pB: 'P(B)',
    pAgivenB: 'P(A | B)',
    pAgivenNotB: 'P(A | not B)',
    reset: 'Reset',
    highlight: 'Highlight the paths to A',
    unhighlight: 'Show every path',
    pathsToA: 'paths ending in A',
    otherPaths: 'other paths',
    total: 'P(A) — total probability',
    leafBA: 'P(B ∩ A)',
    leafNotBA: 'P(not B ∩ A)',
    posterior: 'P(B | A) — Bayes',
    prior: 'P(B) — prior',
  },
  vi: {
    aria: 'Cây xác suất: nhánh đầu chia thành B và không B, mỗi nhánh lại chia thành A và không A.',
    b: 'B',
    notB: 'không B',
    a: 'A',
    notA: 'không A',
    pB: 'P(B)',
    pAgivenB: 'P(A | B)',
    pAgivenNotB: 'P(A | không B)',
    reset: 'Đặt lại',
    highlight: 'Làm nổi các đường dẫn tới A',
    unhighlight: 'Hiện mọi đường',
    pathsToA: 'đường kết thúc ở A',
    otherPaths: 'đường còn lại',
    total: 'P(A) — xác suất toàn phần',
    leafBA: 'P(B ∩ A)',
    leafNotBA: 'P(không B ∩ A)',
    posterior: 'P(B | A) — Bayes',
    prior: 'P(B) — tiên nghiệm',
  },
};

export function mount(host: HTMLElement, options: Record<string, unknown>): void {
  host.textContent = '';
  const lang = figureLang(options);
  const s = STRINGS[lang];
  setDecimalSeparator(lang === 'vi' ? ',' : '.');
  const plot = el('div', {});
  host.append(plot);

  const stage = createStage(plot, {
    label: s.aria!,
    describedBy: typeof options.describedBy === 'string' ? options.describedBy : undefined,
    aspect: 0.5,
    minHeight: 240,
    maxHeight: 340,
  });
  const edges = svgEl('g', {});
  const nodes = svgEl('g', {});
  stage.svg.append(edges, nodes);

  let pB = START.pB;
  let pAgivenB = START.pAgivenB;
  let pAgivenNotB = START.pAgivenNotB;
  let highlight = true;

  const bSlider = slider({
    label: s.pB!,
    min: 0.01,
    max: 0.99,
    step: 0.01,
    value: START.pB,
    format: (v) => pct(v, 0),
    onInput: (v) => {
      pB = v;
      render();
    },
  });
  const aGivenBSlider = slider({
    label: s.pAgivenB!,
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
    label: s.pAgivenNotB!,
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
      label: s.unhighlight!,
      variant: 'primary',
      onClick: () => {
        highlight = !highlight;
        toggle.textContent = highlight ? s.unhighlight! : s.highlight!;
        toggle.setAttribute('aria-pressed', String(highlight));
        render();
      },
    },
    {
      label: s.reset!,
      onClick: () => {
        pB = START.pB;
        pAgivenB = START.pAgivenB;
        pAgivenNotB = START.pAgivenNotB;
        highlight = true;
        bSlider.set(START.pB, true);
        aGivenBSlider.set(START.pAgivenB, true);
        aGivenNotBSlider.set(START.pAgivenNotB, true);
        toggle.textContent = s.unhighlight!;
        toggle.setAttribute('aria-pressed', 'true');
        render();
      },
    },
  ]);
  const toggle = items[0]!;
  toggle.setAttribute('aria-pressed', 'true');

  const out = readout([
    { key: 'prior', label: s.prior! },
    { key: 'leafBA', label: s.leafBA! },
    { key: 'leafNotBA', label: s.leafNotBA! },
    { key: 'total', label: s.total! },
    { key: 'post', label: s.posterior! },
  ]);
  const note = status();

  host.append(
    controlGroup(bSlider.root, aGivenBSlider.root, aGivenNotBSlider.root),
    buttonRow,
    legend([
      { label: s.pathsToA!, color: 'var(--c-plot-point)' },
      { label: s.otherPaths!, color: 'var(--c-rule-strong)' },
    ]),
    out.root,
    note.root,
  );

  function render(): void {
    const { width, height } = stage;
    if (width === 0) return;
    edges.textContent = '';
    nodes.textContent = '';

    const leftPad = 26;
    const rightPad = Math.min(96, Math.max(58, width * 0.16));
    const x0 = leftPad;
    const x1 = leftPad + (width - leftPad - rightPad) * 0.34;
    const x2 = leftPad + (width - leftPad - rightPad) * 0.78;
    const yMid = height / 2;
    const spread1 = height * 0.3;
    const spread2 = height * 0.13;

    const yB = yMid - spread1;
    const yNotB = yMid + spread1;
    const leaves = [
      { y: yB - spread2, from: yB, isA: true, branch: pAgivenB, weight: pB, label: s.a! },
      { y: yB + spread2, from: yB, isA: false, branch: 1 - pAgivenB, weight: pB, label: s.notA! },
      {
        y: yNotB - spread2,
        from: yNotB,
        isA: true,
        branch: pAgivenNotB,
        weight: 1 - pB,
        label: s.a!,
      },
      {
        y: yNotB + spread2,
        from: yNotB,
        isA: false,
        branch: 1 - pAgivenNotB,
        weight: 1 - pB,
        label: s.notA!,
      },
    ];

    const edge = (
      ax: number,
      ay: number,
      bx: number,
      by: number,
      p: number,
      active: boolean,
      label: string,
    ) => {
      const line = svgEl('path', {
        d: `M${ax} ${ay}C${(ax + bx) / 2} ${ay} ${(ax + bx) / 2} ${by} ${bx} ${by}`,
        fill: 'none',
      });
      setStyle(line, {
        stroke: active ? 'var(--c-plot-point)' : 'var(--c-rule-strong)',
        strokeWidth: 1 + 6 * p,
        opacity: active ? 0.95 : 0.5,
      });
      edges.append(line);
      // Push the label to the outside of the bend so it never sits on the line.
      const text = svgEl('text', {
        x: (ax + bx) / 2,
        y: (ay + by) / 2 + (by < ay ? -8 : 15),
        'text-anchor': 'middle',
        class: 'tick',
      });
      text.textContent = label;
      edges.append(text);
    };

    // Both first-level branches lead to A, so neither is ever dimmed.
    edge(x0, yMid, x1, yB, pB, true, pct(pB, 0));
    edge(x0, yMid, x1, yNotB, 1 - pB, true, pct(1 - pB, 0));

    for (const leaf of leaves) {
      const active = !highlight || leaf.isA;
      edge(x1, leaf.from, x2, leaf.y, leaf.branch, active, pct(leaf.branch, 0));
    }

    const dot = (x: number, y: number, label: string, strong = false) => {
      const circle = svgEl('circle', { cx: x, cy: y, r: strong ? 5 : 4 });
      setStyle(circle, {
        fill: strong ? 'var(--c-plot-alt)' : 'var(--c-ink-faint)',
      });
      nodes.append(circle);
      const text = svgEl('text', {
        x,
        y: y - 11,
        'text-anchor': 'middle',
        class: 'tick',
        fill: 'var(--c-ink-soft)',
      });
      text.textContent = label;
      nodes.append(text);
    };

    dot(x0, yMid, '', true);
    dot(x1, yB, s.b!, true);
    dot(x1, yNotB, s.notB!, true);

    for (const leaf of leaves) {
      const active = !highlight || leaf.isA;
      const circle = svgEl('circle', { cx: x2, cy: leaf.y, r: 4 });
      setStyle(circle, {
        fill: active && leaf.isA ? 'var(--c-plot-point)' : 'var(--c-ink-faint)',
        opacity: active ? 1 : 0.5,
      });
      nodes.append(circle);
      const text = svgEl('text', {
        x: x2 + 10,
        y: leaf.y + 4,
        'text-anchor': 'start',
        class: 'tick',
        fill: active ? 'var(--c-ink)' : 'var(--c-ink-faint)',
      });
      text.textContent = `${leaf.label} · ${pct(leaf.weight * leaf.branch, 1)}`;
      nodes.append(text);
    }

    const pBA = pB * pAgivenB;
    const pNotBA = (1 - pB) * pAgivenNotB;
    const pA = pBA + pNotBA;
    out.set('prior', pct(pB, 1));
    out.set('leafBA', pct(pBA, 1));
    out.set('leafNotBA', pct(pNotBA, 1));
    out.set('total', pct(pA, 1));
    out.set('post', pA > 0 ? pct(pBA / pA, 1) : '—');

    if (pA === 0) {
      note.set(
        lang === 'vi'
          ? 'P(A) = 0 nên không thể điều kiện theo A: Bayes cần P(A) > 0.'
          : 'P(A) = 0, so we cannot condition on A: Bayes needs P(A) > 0.',
        'warn',
      );
    } else {
      note.set(
        lang === 'vi'
          ? `P(A) = ${pct(pBA, 1)} + ${pct(pNotBA, 1)} = ${pct(pA, 1)}. Trong phần đó, nhánh B đóng góp ${pct(pBA / pA, 1)}, nên P(B | A) = ${pct(pBA / pA, 1)} — so với tiên nghiệm P(B) = ${pct(pB, 1)}.`
          : `P(A) = ${pct(pBA, 1)} + ${pct(pNotBA, 1)} = ${pct(pA, 1)}. Of that, the B branch contributes ${pct(pBA / pA, 1)}, so P(B | A) = ${pct(pBA / pA, 1)} — against a prior of P(B) = ${pct(pB, 1)}.`,
      );
    }
  }

  stage.onLayout(render);
  render();
}
