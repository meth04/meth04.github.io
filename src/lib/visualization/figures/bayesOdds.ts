/**
 * Figure: repeated evidence in odds form.
 *
 * Written as odds, Bayes' theorem is a multiplication:
 *   posterior odds = prior odds × likelihood ratio.
 * Plotting the belief on a log-odds axis therefore turns each new piece of
 * evidence into a jump of the same size, which is what makes "two positives"
 * so much stronger than one — and why a very low prior still needs a lot of
 * evidence to overturn.
 */
import { createStage, num, pct, setDecimalSeparator } from '../stage';
import { svgEl, setStyle } from '../plot';
import { slider, buttons, readout, status, controlGroup, el } from '../controls';
import { figureLang, type FigureLang } from '../strings';

const START = { prior: 0.005, sensitivity: 0.99, specificity: 0.95 };
const AXIS = [0.001, 0.01, 0.1, 0.5, 0.9, 0.99, 0.999];
const MAX_STEPS = 8;

const STRINGS: Record<FigureLang, Record<string, string>> = {
  en: {
    aria: 'Belief about the condition plotted on a log-odds axis after each test result.',
    prior: 'Prior P(condition)',
    sensitivity: 'Sensitivity',
    specificity: 'Specificity',
    addPositive: 'Add a positive test',
    addNegative: 'Add a negative test',
    undo: 'Undo',
    reset: 'Reset',
    priorOdds: 'Prior odds',
    lrPos: 'LR for a positive',
    lrNeg: 'LR for a negative',
    posterior: 'Current belief',
    results: 'Results so far',
    none: 'none yet',
  },
  vi: {
    aria: 'Niềm tin về việc có bệnh, vẽ trên trục log-odds sau mỗi kết quả xét nghiệm.',
    prior: 'Tiên nghiệm P(có bệnh)',
    sensitivity: 'Độ nhạy',
    specificity: 'Độ đặc hiệu',
    addPositive: 'Thêm một kết quả dương',
    addNegative: 'Thêm một kết quả âm',
    undo: 'Hoàn tác',
    reset: 'Đặt lại',
    priorOdds: 'Odds tiên nghiệm',
    lrPos: 'LR khi dương tính',
    lrNeg: 'LR khi âm tính',
    posterior: 'Niềm tin hiện tại',
    results: 'Các kết quả đã có',
    none: 'chưa có',
  },
};

const logit = (p: number): number => Math.log(p / (1 - p));

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
    minHeight: 230,
    maxHeight: 320,
  });
  const axis = svgEl('g', { 'aria-hidden': 'true' });
  const path = svgEl('g', {});
  stage.svg.append(axis, path);

  let prior = START.prior;
  let sensitivity = START.sensitivity;
  let specificity = START.specificity;
  // Two positives by default: one point alone cannot show equal-sized jumps.
  let results: Array<'+' | '-'> = ['+', '+'];

  const priorSlider = slider({
    label: s.prior!,
    min: 1,
    max: 500,
    step: 1,
    value: Math.round(START.prior * 1000),
    format: (v) => `${Math.round(v)} / 1000`,
    onInput: (v) => {
      prior = Math.round(v) / 1000;
      render();
    },
  });
  const sensSlider = slider({
    label: s.sensitivity!,
    min: 0.5,
    max: 0.999,
    step: 0.001,
    value: START.sensitivity,
    format: (v) => pct(v, 1),
    onInput: (v) => {
      sensitivity = v;
      render();
    },
  });
  const specSlider = slider({
    label: s.specificity!,
    min: 0.5,
    max: 0.999,
    step: 0.001,
    value: START.specificity,
    format: (v) => pct(v, 1),
    onInput: (v) => {
      specificity = v;
      render();
    },
  });

  const { root: buttonRow } = buttons([
    {
      label: s.addPositive!,
      variant: 'primary',
      onClick: () => {
        if (results.length < MAX_STEPS) results.push('+');
        render();
      },
    },
    {
      label: s.addNegative!,
      onClick: () => {
        if (results.length < MAX_STEPS) results.push('-');
        render();
      },
    },
    {
      label: s.undo!,
      onClick: () => {
        results.pop();
        render();
      },
    },
    {
      label: s.reset!,
      onClick: () => {
        results = ['+', '+'];
        prior = START.prior;
        sensitivity = START.sensitivity;
        specificity = START.specificity;
        priorSlider.set(Math.round(START.prior * 1000), true);
        sensSlider.set(START.sensitivity, true);
        specSlider.set(START.specificity, true);
        render();
      },
    },
  ]);

  const out = readout([
    { key: 'priorOdds', label: s.priorOdds! },
    { key: 'lrPos', label: s.lrPos! },
    { key: 'lrNeg', label: s.lrNeg! },
    { key: 'results', label: s.results! },
    { key: 'post', label: s.posterior! },
  ]);
  const note = status();

  host.append(
    controlGroup(priorSlider.root, sensSlider.root, specSlider.root),
    buttonRow,
    out.root,
    note.root,
  );

  function beliefs(): number[] {
    const lrPos = sensitivity / Math.max(1e-6, 1 - specificity);
    const lrNeg = (1 - sensitivity) / Math.max(1e-6, specificity);
    let odds = prior / (1 - prior);
    const series = [prior];
    for (const r of results) {
      odds *= r === '+' ? lrPos : lrNeg;
      series.push(odds / (1 + odds));
    }
    return series;
  }

  function render(): void {
    const { width, height } = stage;
    if (width === 0) return;
    axis.textContent = '';
    path.textContent = '';

    const left = 52;
    const right = width - 16;
    const top = 18;
    const bottom = height - 26;
    const lo = logit(0.0005);
    const hi = logit(0.9995);
    const y = (p: number) => bottom - ((logit(p) - lo) / (hi - lo)) * (bottom - top);
    const series = beliefs();
    const steps = Math.max(series.length - 1, 1);
    const x = (i: number) => left + ((right - left) * i) / Math.max(steps, 1);

    for (const value of AXIS) {
      const gy = y(value);
      axis.append(
        svgEl('line', {
          x1: left,
          x2: right,
          y1: gy,
          y2: gy,
          stroke: 'var(--c-plot-grid)',
          'stroke-width': '1',
        }),
      );
      const label = svgEl('text', {
        x: left - 8,
        y: gy + 4,
        'text-anchor': 'end',
        class: 'tick',
      });
      label.textContent = pct(value, value < 0.01 || value > 0.99 ? 1 : 0);
      axis.append(label);
    }
    for (let i = 0; i <= steps; i++) {
      const label = svgEl('text', {
        x: x(i),
        y: bottom + 18,
        'text-anchor': 'middle',
        class: 'tick',
      });
      label.textContent = i === 0 ? (lang === 'vi' ? 'tiên nghiệm' : 'prior') : String(i);
      axis.append(label);
    }

    let d = '';
    series.forEach((p, i) => {
      d += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(clamp(p)).toFixed(1)}`;
    });
    const line = svgEl('path', { d, fill: 'none' });
    setStyle(line, { stroke: 'var(--c-plot-point)', strokeWidth: 2 });
    path.append(line);

    series.forEach((p, i) => {
      const dot = svgEl('circle', {
        cx: x(i),
        cy: y(clamp(p)),
        r: i === series.length - 1 ? 6 : 4,
      });
      setStyle(dot, {
        fill: i === 0 ? 'var(--c-plot-alt)' : 'var(--c-plot-point)',
        stroke: 'var(--c-bg-raised)',
        strokeWidth: 2,
      });
      path.append(dot);
      if (i > 0) {
        const mark = svgEl('text', {
          x: x(i),
          y: y(clamp(p)) - 12,
          'text-anchor': 'middle',
          class: 'tick',
          fill: 'var(--c-ink-soft)',
        });
        mark.textContent = results[i - 1] === '+' ? '+' : '−';
        path.append(mark);
      }
    });

    const lrPos = sensitivity / Math.max(1e-6, 1 - specificity);
    const lrNeg = (1 - sensitivity) / Math.max(1e-6, specificity);
    const posterior = series[series.length - 1]!;
    out.set('priorOdds', `${num(prior / (1 - prior), 4)} : 1`);
    out.set('lrPos', `×${num(lrPos, 1)}`);
    out.set('lrNeg', `×${num(lrNeg, 3)}`);
    out.set(
      'results',
      results.length === 0 ? s.none! : results.map((r) => (r === '+' ? '+' : '−')).join(' '),
    );
    out.set('post', beliefText(posterior));

    const positives = results.filter((r) => r === '+').length;
    const negativesCount = results.length - positives;
    const factors = [
      positives > 0 ? `${num(lrPos, 1)}^${positives}` : '',
      negativesCount > 0 ? `${num(lrNeg, 3)}^${negativesCount}` : '',
    ]
      .filter(Boolean)
      .join(' × ');
    if (results.length === 0) {
      note.set(
        lang === 'vi'
          ? `Chưa có kết quả xét nghiệm nào, nên niềm tin vẫn đúng bằng tiên nghiệm ${beliefText(posterior)}. Thêm một kết quả để thấy nó dịch chuyển.`
          : `No test results yet, so the belief is still exactly the prior, ${beliefText(posterior)}. Add a result to make it move.`,
      );
    } else {
      note.set(
        lang === 'vi'
          ? `Odds tiên nghiệm ${num(prior / (1 - prior), 4)} nhân với ${factors} cho niềm tin hiện tại ${beliefText(posterior)}. Trên trục log-odds, mỗi kết quả giống nhau tạo một bước nhảy cao bằng nhau.`
          : `Prior odds of ${num(prior / (1 - prior), 4)} multiplied by ${factors} give a current belief of ${beliefText(posterior)}. On a log-odds axis every identical result is the same size of jump.`,
      );
    }
  }

  /**
   * Bayes never reaches certainty from a prior strictly between 0 and 1, so the
   * readout must not round to "100%" — it would contradict the article.
   */
  function beliefText(p: number): string {
    if (p > 0.9999) return lang === 'vi' ? '> 99,99%' : '> 99.99%';
    if (p < 0.0001) return lang === 'vi' ? '< 0,01%' : '< 0.01%';
    return pct(p, p < 0.01 || p > 0.99 ? 2 : 1);
  }

  function clamp(p: number): number {
    return Math.min(0.9995, Math.max(0.0005, p));
  }

  stage.onLayout(render);
  render();
}
