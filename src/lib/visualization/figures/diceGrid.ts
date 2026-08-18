/**
 * Figure: conditioning on a finite sample space.
 *
 * All 36 equally likely outcomes of two dice are drawn as a grid. Choosing the
 * events A and B highlights |B| and |A ∩ B|, and "restrict to B" greys out
 * everything outside B — so P(A | B) is visibly a count of cells divided by a
 * smaller count of cells, not a new kind of probability.
 */
import { buttons, readout, status, controlGroup, el } from '../controls';
import { figureLang, type FigureLang } from '../strings';
import { num, setDecimalSeparator } from '../stage';

type Predicate = (d1: number, d2: number) => boolean;

interface EventSpec {
  id: string;
  label: Record<FigureLang, string>;
  test: Predicate;
}

const EVENTS: EventSpec[] = [
  {
    id: 'sum-ge-9',
    label: { en: 'sum ≥ 9', vi: 'tổng ≥ 9' },
    test: (a, b) => a + b >= 9,
  },
  {
    id: 'sum-ge-10',
    label: { en: 'sum ≥ 10', vi: 'tổng ≥ 10' },
    test: (a, b) => a + b >= 10,
  },
  {
    id: 'sum-7',
    label: { en: 'sum = 7', vi: 'tổng = 7' },
    test: (a, b) => a + b === 7,
  },
  {
    id: 'sum-even',
    label: { en: 'sum is even', vi: 'tổng chẵn' },
    test: (a, b) => (a + b) % 2 === 0,
  },
  {
    id: 'at-least-one-6',
    label: { en: 'at least one 6', vi: 'có ít nhất một mặt 6' },
    test: (a, b) => a === 6 || b === 6,
  },
  {
    id: 'no-6',
    label: { en: 'no 6 at all', vi: 'không có mặt 6 nào' },
    test: (a, b) => a !== 6 && b !== 6,
  },
  {
    id: 'doubles',
    label: { en: 'a double', vi: 'hai mặt giống nhau' },
    test: (a, b) => a === b,
  },
  {
    id: 'first-4',
    label: { en: 'first die is 4', vi: 'xúc xắc thứ nhất bằng 4' },
    test: (a) => a === 4,
  },
  {
    id: 'first-even',
    label: { en: 'first die is even', vi: 'xúc xắc thứ nhất chẵn' },
    test: (a) => a % 2 === 0,
  },
];

let selectCounter = 0;

const STRINGS: Record<FigureLang, Record<string, string>> = {
  en: {
    aria: 'A six by six grid of the 36 equally likely outcomes of rolling two dice, with the chosen events highlighted.',
    eventA: 'Event A',
    eventB: 'Event B (what we condition on)',
    restrict: 'Restrict to B',
    showAll: 'Show all 36 outcomes',
    reset: 'Reset',
    die1: 'First die',
    die2: 'Second die',
    caption: 'Sum of the two dice for every outcome',
    countA: 'Outcomes in A',
    countB: 'Outcomes in B',
    countAB: 'Outcomes in A ∩ B',
    pA: 'P(A)',
    pAgivenB: 'P(A | B)',
    inB: 'in B',
    inA: 'in A',
  },
  vi: {
    aria: 'Lưới sáu nhân sáu gồm 36 kết quả đồng khả năng khi gieo hai xúc xắc, các biến cố được chọn được tô sáng.',
    eventA: 'Biến cố A',
    eventB: 'Biến cố B (điều kiện)',
    restrict: 'Chỉ giữ lại B',
    showAll: 'Hiện đủ 36 kết quả',
    reset: 'Đặt lại',
    die1: 'Xúc xắc 1',
    die2: 'Xúc xắc 2',
    caption: 'Tổng hai xúc xắc ứng với từng kết quả',
    countA: 'Số kết quả thuộc A',
    countB: 'Số kết quả thuộc B',
    countAB: 'Số kết quả thuộc A ∩ B',
    pA: 'P(A)',
    pAgivenB: 'P(A | B)',
    inB: 'thuộc B',
    inA: 'thuộc A',
  },
};

export function mount(host: HTMLElement, options: Record<string, unknown>): void {
  host.textContent = '';
  const lang = figureLang(options);
  const s = STRINGS[lang];
  setDecimalSeparator(lang === 'vi' ? ',' : '.');

  const find = (id: unknown, fallback: string) =>
    EVENTS.find((e) => e.id === id) ?? EVENTS.find((e) => e.id === fallback)!;
  let eventA = find(options.a, 'at-least-one-6');
  let eventB = find(options.b, 'sum-ge-9');
  const defaultA = eventA;
  const defaultB = eventB;
  let restricted = options.restrict === true;

  // ---- grid ----
  const table = el('table', { class: 'dice-grid' });
  const caption = el('caption', { class: 'dice-grid__caption' }, s.caption!);
  const thead = el('thead');
  const headRow = el('tr');
  headRow.append(el('th', { scope: 'col', class: 'dice-grid__corner' }, ''));
  for (let d2 = 1; d2 <= 6; d2++) headRow.append(el('th', { scope: 'col' }, String(d2)));
  thead.append(headRow);
  const tbody = el('tbody');
  const cells: HTMLTableCellElement[][] = [];
  for (let d1 = 1; d1 <= 6; d1++) {
    const row = el('tr');
    row.append(el('th', { scope: 'row' }, String(d1)));
    const rowCells: HTMLTableCellElement[] = [];
    for (let d2 = 1; d2 <= 6; d2++) {
      const cell = el('td', {}, String(d1 + d2)) as HTMLTableCellElement;
      rowCells.push(cell);
      row.append(cell);
    }
    cells.push(rowCells);
    tbody.append(row);
  }
  table.append(caption, thead, tbody);

  const gridWrap = el('div', { class: 'dice-grid__wrap', role: 'group', 'aria-label': s.aria! });
  const axisTop = el(
    'p',
    { class: 'dice-grid__axis' },
    lang === 'vi'
      ? `Hàng: ${s.die1} · Cột: ${s.die2}`
      : `Rows: ${s.die1!.toLowerCase()} · Columns: ${s.die2!.toLowerCase()}`,
  );
  gridWrap.append(axisTop, table);
  host.append(gridWrap);

  // ---- controls ----
  const selectA = buildSelect(s.eventA!, eventA.id, (id) => {
    eventA = find(id, eventA.id);
    render();
  });
  const selectB = buildSelect(s.eventB!, eventB.id, (id) => {
    eventB = find(id, eventB.id);
    render();
  });

  function buildSelect(
    label: string,
    selected: string,
    onChange: (id: string) => void,
  ): HTMLElement {
    const id = `dice-select-${(selectCounter += 1)}`;
    const select = el('select', { class: 'viz-select', id }) as HTMLSelectElement;
    for (const spec of EVENTS) {
      const option = el('option', { value: spec.id }, spec.label[lang]);
      if (spec.id === selected) option.setAttribute('selected', '');
      select.append(option);
    }
    select.addEventListener('change', () => onChange(select.value));
    const labelEl = el('label', { class: 'viz-control__label', for: id }, el('span', {}, label));
    return el('div', { class: 'viz-control' }, labelEl, select);
  }

  const { root: buttonRow, items } = buttons([
    {
      label: restricted ? s.showAll! : s.restrict!,
      variant: 'primary',
      onClick: () => {
        restricted = !restricted;
        restrictButton.textContent = restricted ? s.showAll! : s.restrict!;
        restrictButton.setAttribute('aria-pressed', String(restricted));
        render();
      },
    },
    {
      label: s.reset!,
      onClick: () => {
        eventA = defaultA;
        eventB = defaultB;
        restricted = false;
        (selectA.querySelector('select') as HTMLSelectElement).value = defaultA.id;
        (selectB.querySelector('select') as HTMLSelectElement).value = defaultB.id;
        restrictButton.textContent = s.restrict!;
        restrictButton.setAttribute('aria-pressed', 'false');
        render();
      },
    },
  ]);
  const restrictButton = items[0]!;
  restrictButton.setAttribute('aria-pressed', String(restricted));

  const out = readout([
    { key: 'nb', label: s.countB! },
    { key: 'nab', label: s.countAB! },
    { key: 'na', label: s.countA! },
    { key: 'pa', label: s.pA! },
    { key: 'pagb', label: s.pAgivenB! },
  ]);
  const note = status();

  host.append(controlGroup(selectA, selectB), buttonRow, out.root, note.root);

  function render(): void {
    let nA = 0;
    let nB = 0;
    let nAB = 0;
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        const inA = eventA.test(d1, d2);
        const inB = eventB.test(d1, d2);
        if (inA) nA++;
        if (inB) nB++;
        if (inA && inB) nAB++;
        const cell = cells[d1 - 1]![d2 - 1]!;
        cell.className = [
          inB ? 'is-b' : '',
          inA ? 'is-a' : '',
          inA && inB ? 'is-ab' : '',
          restricted && !inB ? 'is-muted' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const parts = [`${d1} + ${d2} = ${d1 + d2}`];
        if (inB) parts.push(s.inB!);
        if (inA) parts.push(s.inA!);
        cell.title = parts.join(' · ');
      }
    }

    out.set('nb', `${nB} / 36`);
    out.set('nab', `${nAB} / 36`);
    out.set('na', `${nA} / 36`);
    out.set('pa', `${nA}/36 = ${num(nA / 36, 3)}`);
    out.set('pagb', nB === 0 ? '—' : `${nAB}/${nB} = ${num(nAB / nB, 3)}`);

    const aLabel = eventA.label[lang];
    const bLabel = eventB.label[lang];
    if (nB === 0) {
      note.set(
        lang === 'vi'
          ? 'Biến cố B rỗng, nên P(A | B) không xác định: không thể chia cho 0.'
          : 'The event B is empty, so P(A | B) is undefined: there is nothing to divide by.',
        'warn',
      );
    } else {
      note.set(
        lang === 'vi'
          ? `Trong 36 kết quả, ${nB} kết quả thoả “${bLabel}”. Trong số đó, ${nAB} kết quả cũng thoả “${aLabel}”, nên P(A | B) = ${nAB}/${nB} = ${num(nAB / nB, 3)}, so với P(A) = ${nA}/36 = ${num(nA / 36, 3)}.`
          : `Of the 36 outcomes, ${nB} satisfy “${bLabel}”. Of those, ${nAB} also satisfy “${aLabel}”, so P(A | B) = ${nAB}/${nB} = ${num(nAB / nB, 3)}, against P(A) = ${nA}/36 = ${num(nA / 36, 3)}.`,
      );
    }
  }

  render();
}
