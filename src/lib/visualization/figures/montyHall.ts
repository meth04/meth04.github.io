/**
 * Figure: the Monty Hall problem, played and simulated.
 *
 * Two hosts are available. The usual host knows where the car is and always
 * opens a goat door, which makes switching win two times in three. The second
 * host opens one of the other two doors at random; rounds in which he happens
 * to reveal the car are discarded, and conditioning on "a goat was revealed"
 * then leaves the two remaining doors equally likely. Same picture on screen,
 * different conditional probability — which is the point.
 */
import { buttons, readout, status, controlGroup, el } from '../controls';
import { pct, setDecimalSeparator } from '../stage';
import { figureLang, type FigureLang } from '../strings';

const DOORS = 3;
const SEED = 20260818;

const STRINGS: Record<FigureLang, Record<string, string>> = {
  en: {
    hostKnows: 'Host knows where the car is',
    hostRandom: 'Host opens a door at random',
    hostLabel: 'Which host',
    door: 'Door',
    car: 'car',
    goat: 'goat',
    pick: 'Pick a door to begin.',
    opened: 'The host opened door {door}, showing a goat. Stay or switch?',
    voided:
      'The host opened door {door} and revealed the car. This round is void — it is exactly the case we condition away.',
    stay: 'Stay',
    switchDoor: 'Switch',
    wonStay: 'You stayed with door {door} and won the car.',
    lostStay: 'You stayed with door {door} and got a goat.',
    wonSwitch: 'You switched to door {door} and won the car.',
    lostSwitch: 'You switched to door {door} and got a goat.',
    newRound: 'New round',
    run100: 'Simulate 100 rounds',
    run1000: 'Simulate 1000 rounds',
    resetStats: 'Clear the tally',
    stayRate: 'Staying wins',
    switchRate: 'Switching wins',
    rounds: 'Rounds counted',
    tooFew: 'Only {n} round(s) so far — far too few to tell 1/3 from 2/3. Simulate a few hundred.',
    voidedCount: 'Rounds discarded',
    theory: 'Theory',
    yourPick: 'your pick',
    hostOpened: 'host opened',
  },
  vi: {
    hostKnows: 'Người dẫn biết xe ở đâu',
    hostRandom: 'Người dẫn mở cửa ngẫu nhiên',
    hostLabel: 'Kiểu người dẫn',
    door: 'Cửa',
    car: 'xe',
    goat: 'dê',
    pick: 'Chọn một cửa để bắt đầu.',
    opened: 'Người dẫn mở cửa {door} và lộ ra con dê. Giữ nguyên hay đổi?',
    voided:
      'Người dẫn mở cửa {door} và lộ ra chiếc xe. Ván này bị huỷ — đúng là trường hợp mà ta loại bỏ khi lấy điều kiện.',
    stay: 'Giữ nguyên',
    switchDoor: 'Đổi cửa',
    wonStay: 'Bạn giữ cửa {door} và thắng chiếc xe.',
    lostStay: 'Bạn giữ cửa {door} và nhận con dê.',
    wonSwitch: 'Bạn đổi sang cửa {door} và thắng chiếc xe.',
    lostSwitch: 'Bạn đổi sang cửa {door} và nhận con dê.',
    newRound: 'Ván mới',
    run100: 'Mô phỏng 100 ván',
    run1000: 'Mô phỏng 1000 ván',
    resetStats: 'Xoá thống kê',
    stayRate: 'Tỉ lệ thắng khi giữ',
    switchRate: 'Tỉ lệ thắng khi đổi',
    rounds: 'Số ván tính',
    tooFew: 'Mới {n} ván — còn quá ít để phân biệt 1/3 với 2/3. Hãy mô phỏng vài trăm ván.',
    voidedCount: 'Số ván bị huỷ',
    theory: 'Lý thuyết',
    yourPick: 'bạn chọn',
    hostOpened: 'người dẫn mở',
  },
};

/** Deterministic PRNG, so the simulated tallies are the same for every reader. */
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
  const lang = figureLang(options);
  const s = STRINGS[lang];
  setDecimalSeparator(lang === 'vi' ? ',' : '.');
  let rng = mulberry32(SEED);
  const randomInt = (n: number) => Math.floor(rng() * n) % n;

  let hostKnows = options.hostKnows !== false;
  let phase: 'pick' | 'decide' | 'done' | 'void' = 'pick';
  let car = randomInt(DOORS);
  let picked = -1;
  let opened = -1;
  let finalPick = -1;

  let stayWins = 0;
  let switchWins = 0;
  let rounds = 0;
  let voided = 0;

  // ---- doors ----
  const doorRow = el('div', { class: 'doors' });
  const doorButtons: HTMLButtonElement[] = [];
  for (let i = 0; i < DOORS; i++) {
    const button = el('button', { type: 'button', class: 'door' }) as HTMLButtonElement;
    button.append(el('span', { class: 'door__number' }, `${s.door} ${i + 1}`));
    button.append(el('span', { class: 'door__content' }, '?'));
    button.append(el('span', { class: 'door__tag' }, ''));
    button.addEventListener('click', () => choose(i));
    doorButtons.push(button);
    doorRow.append(button);
  }
  host.append(doorRow);

  const note = status();

  const hostSelect = el('select', { class: 'viz-select', id: 'monty-host' }) as HTMLSelectElement;
  hostSelect.append(el('option', { value: 'knows' }, s.hostKnows!));
  hostSelect.append(el('option', { value: 'random' }, s.hostRandom!));
  hostSelect.addEventListener('change', () => {
    hostKnows = hostSelect.value === 'knows';
    clearTally();
    newRound();
  });
  const hostControl = el(
    'div',
    { class: 'viz-control' },
    el('label', { class: 'viz-control__label', for: 'monty-host' }, el('span', {}, s.hostLabel!)),
    hostSelect,
  );

  const { root: actionRow, items: actionButtons } = buttons([
    { label: s.stay!, onClick: () => decide(false) },
    { label: s.switchDoor!, onClick: () => decide(true) },
    { label: s.newRound!, onClick: () => newRound() },
  ]);
  const stayButton = actionButtons[0]!;
  const switchButton = actionButtons[1]!;

  const { root: simRow } = buttons([
    { label: s.run100!, onClick: () => simulate(100) },
    { label: s.run1000!, onClick: () => simulate(1000) },
    {
      label: s.resetStats!,
      onClick: () => {
        rng = mulberry32(SEED);
        clearTally();
        newRound();
      },
    },
  ]);

  const bars = el('div', { class: 'rate-bars', 'aria-hidden': 'true' });
  const stayBar = makeBar(s.stayRate!);
  const switchBar = makeBar(s.switchRate!);
  bars.append(stayBar.root, switchBar.root);

  function makeBar(label: string) {
    const fill = el('span', { class: 'rate-bar__fill' });
    const marker = el('span', { class: 'rate-bar__marker' });
    const track = el('span', { class: 'rate-bar__track' }, fill, marker);
    const value = el('span', { class: 'rate-bar__value' }, '—');
    const root = el(
      'div',
      { class: 'rate-bar' },
      el('span', { class: 'rate-bar__label' }, label),
      track,
      value,
    );
    return { root, fill, marker, value };
  }

  const out = readout([
    { key: 'rounds', label: s.rounds! },
    { key: 'stay', label: s.stayRate! },
    { key: 'switch', label: s.switchRate! },
    { key: 'void', label: s.voidedCount! },
    { key: 'theory', label: s.theory! },
  ]);

  host.append(controlGroup(hostControl), actionRow, bars, simRow, out.root, note.root);

  function clearTally(): void {
    stayWins = 0;
    switchWins = 0;
    rounds = 0;
    voided = 0;
  }

  function newRound(): void {
    car = randomInt(DOORS);
    picked = -1;
    opened = -1;
    finalPick = -1;
    phase = 'pick';
    render();
  }

  function openDoorFor(pick: number): number {
    const options_: number[] = [];
    for (let i = 0; i < DOORS; i++) {
      if (i === pick) continue;
      if (hostKnows && i === car) continue;
      options_.push(i);
    }
    return options_[randomInt(options_.length)]!;
  }

  function choose(index: number): void {
    if (phase !== 'pick') return;
    picked = index;
    opened = openDoorFor(index);
    phase = opened === car ? 'void' : 'decide';
    if (phase === 'void') voided += 1;
    render();
  }

  function decide(switching: boolean): void {
    if (phase !== 'decide') return;
    finalPick = switching ? [0, 1, 2].find((i) => i !== picked && i !== opened)! : picked;
    phase = 'done';
    rounds += 1;
    if (picked === car) stayWins += 1;
    const switchDoor = [0, 1, 2].find((i) => i !== picked && i !== opened)!;
    if (switchDoor === car) switchWins += 1;
    render();
  }

  function simulate(times: number): void {
    for (let i = 0; i < times; i++) {
      const carAt = randomInt(DOORS);
      const pick = randomInt(DOORS);
      const choices: number[] = [];
      for (let d = 0; d < DOORS; d++) {
        if (d === pick) continue;
        if (hostKnows && d === carAt) continue;
        choices.push(d);
      }
      const open = choices[randomInt(choices.length)]!;
      if (open === carAt) {
        voided += 1;
        continue;
      }
      const switchDoor = [0, 1, 2].find((d) => d !== pick && d !== open)!;
      rounds += 1;
      if (pick === carAt) stayWins += 1;
      if (switchDoor === carAt) switchWins += 1;
    }
    render();
  }

  function render(): void {
    for (let i = 0; i < DOORS; i++) {
      const button = doorButtons[i]!;
      const content = button.querySelector('.door__content')!;
      const tag = button.querySelector('.door__tag')!;
      const revealed = phase === 'done' || phase === 'void' || i === opened;
      content.textContent = revealed ? (i === car ? s.car! : s.goat!) : '?';
      tag.textContent = i === picked ? s.yourPick! : i === opened ? s.hostOpened! : '';
      button.className = [
        'door',
        revealed ? 'is-open' : '',
        i === picked ? 'is-picked' : '',
        i === opened ? 'is-host' : '',
        phase === 'done' && i === finalPick ? 'is-final' : '',
        revealed && i === car ? 'is-car' : '',
      ]
        .filter(Boolean)
        .join(' ');
      button.disabled = phase !== 'pick';
      button.setAttribute('aria-pressed', String(i === picked));
    }

    stayButton.disabled = phase !== 'decide';
    switchButton.disabled = phase !== 'decide';

    const theoryStay = hostKnows ? 1 / 3 : 1 / 2;
    const theorySwitch = hostKnows ? 2 / 3 : 1 / 2;
    const stayRate = rounds === 0 ? 0 : stayWins / rounds;
    const switchRate = rounds === 0 ? 0 : switchWins / rounds;
    stayBar.fill.style.width = `${stayRate * 100}%`;
    switchBar.fill.style.width = `${switchRate * 100}%`;
    stayBar.marker.style.left = `${theoryStay * 100}%`;
    switchBar.marker.style.left = `${theorySwitch * 100}%`;
    stayBar.value.textContent = rounds === 0 ? '—' : pct(stayRate, 1);
    switchBar.value.textContent = rounds === 0 ? '—' : pct(switchRate, 1);

    out.set('rounds', String(rounds));
    out.set('stay', rounds === 0 ? '—' : `${stayWins} (${pct(stayRate, 1)})`);
    out.set('switch', rounds === 0 ? '—' : `${switchWins} (${pct(switchRate, 1)})`);
    out.set('void', String(voided));
    out.set('theory', hostKnows ? '1/3 vs 2/3' : '1/2 vs 1/2');

    if (phase === 'pick') {
      note.set(s.pick!);
    } else if (phase === 'void') {
      note.set(s.voided!.replace('{door}', String(opened + 1)), 'warn');
    } else if (phase === 'decide') {
      note.set(s.opened!.replace('{door}', String(opened + 1)));
    } else {
      const won = finalPick === car;
      const switched = finalPick !== picked;
      const key = switched ? (won ? 'wonSwitch' : 'lostSwitch') : won ? 'wonStay' : 'lostStay';
      const outcome = s[key]!.replace('{door}', String(finalPick + 1));
      // A single round says nothing; without this note the 100% in the tally
      // reads like a result.
      note.set(rounds < 30 ? `${outcome} ${s.tooFew!.replace('{n}', String(rounds))}` : outcome);
    }
  }

  render();
}
