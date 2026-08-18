/**
 * Figure: base rates and a diagnostic test, as natural frequencies.
 *
 * A thousand people are drawn as a thousand squares. The sliders set how many
 * of them have the condition and how the test behaves, and the strip underneath
 * splits everyone who tested positive into true and false positives. The point
 * of the figure is that the posterior P(D | +) is that split, and that it is
 * dominated by the base rate long before it is dominated by the test.
 */
import { pct, setDecimalSeparator } from '../stage';
import { slider, buttons, readout, status, controlGroup, legend, el } from '../controls';
import { figureLang, type FigureLang } from '../strings';

const POPULATION = 1000;
const START = { prevalence: 0.005, sensitivity: 0.99, specificity: 0.95 };

const STRINGS: Record<FigureLang, Record<string, string>> = {
  en: {
    prevalence: 'How common the condition is',
    sensitivity: 'Sensitivity — P(+ | condition)',
    specificity: 'Specificity — P(− | no condition)',
    reset: 'Reset',
    realistic: 'Rare disease, good test',
    common: 'Common condition, same test',
    tp: 'has it, tests positive',
    fn: 'has it, tests negative',
    fp: 'does not have it, tests positive',
    tn: 'does not have it, tests negative',
    ppv: 'P(condition | positive)',
    npv: 'P(no condition | negative)',
    positives: 'People testing positive',
    falsePositives: 'of them are false alarms',
    withCondition: 'People with the condition',
    barLabel: 'Everyone who tested positive',
  },
  vi: {
    prevalence: 'Tỉ lệ mắc trong dân số',
    sensitivity: 'Độ nhạy — P(+ | có bệnh)',
    specificity: 'Độ đặc hiệu — P(− | không bệnh)',
    reset: 'Đặt lại',
    realistic: 'Bệnh hiếm, xét nghiệm tốt',
    common: 'Bệnh phổ biến, cùng xét nghiệm',
    tp: 'có bệnh, xét nghiệm dương tính',
    fn: 'có bệnh, xét nghiệm âm tính',
    fp: 'không bệnh, xét nghiệm dương tính',
    tn: 'không bệnh, xét nghiệm âm tính',
    ppv: 'P(có bệnh | dương tính)',
    npv: 'P(không bệnh | âm tính)',
    positives: 'Số người dương tính',
    falsePositives: 'trong đó là báo động nhầm',
    withCondition: 'Số người thực sự có bệnh',
    barLabel: 'Tất cả những người dương tính',
  },
};

export function mount(host: HTMLElement, options: Record<string, unknown>): void {
  host.textContent = '';
  const lang = figureLang(options);
  const s = STRINGS[lang];
  setDecimalSeparator(lang === 'vi' ? ',' : '.');

  // The array is decorative: every number it encodes is also in the readout and
  // the sentence below, so assistive technology is spared a thousand nodes.
  const grid = el('div', { class: 'icon-array', 'aria-hidden': 'true' });
  const squares: HTMLElement[] = [];
  for (let i = 0; i < POPULATION; i++) {
    const cell = el('span', { class: 'icon-array__cell' });
    squares.push(cell);
    grid.append(cell);
  }

  const bar = el('div', { class: 'split-bar', 'aria-hidden': 'true' });
  const barTrue = el('span', { class: 'split-bar__part split-bar__part--true' });
  const barFalse = el('span', { class: 'split-bar__part split-bar__part--false' });
  bar.append(barTrue, barFalse);
  const barCaption = el('p', { class: 'split-bar__caption' });

  host.append(grid, el('p', { class: 'icon-array__title' }, s.barLabel!), bar, barCaption);

  let prevalence = START.prevalence;
  let sensitivity = START.sensitivity;
  let specificity = START.specificity;

  const prevalenceSlider = slider({
    label: s.prevalence!,
    min: 1,
    max: 300,
    step: 1,
    value: Math.round(START.prevalence * POPULATION),
    format: (v) => `${Math.round(v)} / ${POPULATION}`,
    onInput: (v) => {
      prevalence = Math.round(v) / POPULATION;
      render();
    },
  });
  const sensitivitySlider = slider({
    label: s.sensitivity!,
    min: 0.5,
    max: 1,
    step: 0.01,
    value: START.sensitivity,
    format: (v) => pct(v, 0),
    onInput: (v) => {
      sensitivity = v;
      render();
    },
  });
  const specificitySlider = slider({
    label: s.specificity!,
    min: 0.5,
    max: 1,
    step: 0.01,
    value: START.specificity,
    format: (v) => pct(v, 0),
    onInput: (v) => {
      specificity = v;
      render();
    },
  });

  const apply = (p: number, sens: number, spec: number) => {
    prevalence = p;
    sensitivity = sens;
    specificity = spec;
    prevalenceSlider.set(Math.round(p * POPULATION), true);
    sensitivitySlider.set(sens, true);
    specificitySlider.set(spec, true);
    render();
  };

  const { root: buttonRow } = buttons([
    {
      label: s.realistic!,
      variant: 'primary',
      onClick: () => apply(0.005, 0.99, 0.95),
    },
    { label: s.common!, onClick: () => apply(0.2, 0.99, 0.95) },
    {
      label: s.reset!,
      onClick: () => apply(START.prevalence, START.sensitivity, START.specificity),
    },
  ]);

  const out = readout([
    { key: 'ppv', label: s.ppv! },
    { key: 'npv', label: s.npv! },
    { key: 'pos', label: s.positives! },
    { key: 'sick', label: s.withCondition! },
  ]);
  const note = status();

  host.append(
    controlGroup(prevalenceSlider.root, sensitivitySlider.root, specificitySlider.root),
    buttonRow,
    legend([
      { label: s.tp!, color: 'var(--c-plot-point)' },
      { label: s.fn!, color: 'var(--c-plot-alt2)' },
      { label: s.fp!, color: 'var(--c-plot-alt)' },
      { label: s.tn!, color: 'var(--c-rule-strong)' },
    ]),
    out.root,
    note.root,
  );

  function render(): void {
    // Whole people, so the picture and the arithmetic agree exactly.
    const withCondition = Math.round(prevalence * POPULATION);
    const withoutCondition = POPULATION - withCondition;
    const truePositives = Math.round(withCondition * sensitivity);
    const falseNegatives = withCondition - truePositives;
    const falsePositives = Math.round(withoutCondition * (1 - specificity));
    const trueNegatives = withoutCondition - falsePositives;
    const positives = truePositives + falsePositives;
    const negatives = POPULATION - positives;

    let index = 0;
    const paint = (count: number, className: string) => {
      for (let i = 0; i < count && index < POPULATION; i++, index++) {
        squares[index]!.className = `icon-array__cell ${className}`;
      }
    };
    paint(truePositives, 'is-tp');
    paint(falseNegatives, 'is-fn');
    paint(falsePositives, 'is-fp');
    paint(trueNegatives, 'is-tn');

    const truthShare = positives === 0 ? 0 : truePositives / positives;
    barTrue.style.flexGrow = String(Math.max(truthShare, 0.0001));
    barFalse.style.flexGrow = String(Math.max(1 - truthShare, 0.0001));
    barCaption.textContent =
      positives === 0
        ? lang === 'vi'
          ? 'Không ai dương tính với các giá trị này.'
          : 'Nobody tests positive with these settings.'
        : lang === 'vi'
          ? `${positives} người dương tính: ${truePositives} thật sự có bệnh, ${falsePositives} ${s.falsePositives}.`
          : `${positives} people test positive: ${truePositives} really have it, ${falsePositives} ${s.falsePositives}.`;

    out.set('ppv', positives === 0 ? '—' : pct(truePositives / positives, 1));
    // When every negative really is healthy the answer is exactly 100%; short of
    // that, show enough digits that a near-certain value is not rounded to it.
    const npv = negatives === 0 ? null : trueNegatives / negatives;
    out.set(
      'npv',
      npv === null
        ? '—'
        : trueNegatives === negatives
          ? '100%'
          : pct(npv, npv > 0.999 ? 3 : npv > 0.99 ? 2 : 1),
    );
    out.set('pos', `${positives} / ${POPULATION}`);
    out.set('sick', `${withCondition} / ${POPULATION}`);

    if (positives === 0) {
      note.set(
        lang === 'vi'
          ? 'Không có ai dương tính, nên P(có bệnh | dương tính) không xác định.'
          : 'Nobody tests positive, so P(condition | positive) is undefined.',
        'warn',
      );
    } else {
      note.set(
        lang === 'vi'
          ? `Trong ${POPULATION} người: ${withCondition} người có bệnh, trong đó ${truePositives} người dương tính. Nhưng ${withoutCondition} người khoẻ mạnh cũng tạo ra ${falsePositives} ca dương tính giả. Vậy P(có bệnh | dương tính) = ${truePositives} / (${truePositives} + ${falsePositives}) = ${pct(truePositives / positives, 1)}.`
          : `Out of ${POPULATION} people, ${withCondition} have the condition and ${truePositives} of them test positive. But the ${withoutCondition} healthy people still produce ${falsePositives} false positives. So P(condition | positive) = ${truePositives} / (${truePositives} + ${falsePositives}) = ${pct(truePositives / positives, 1)}.`,
      );
    }
  }

  render();
}
