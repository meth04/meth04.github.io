/** Small DOM builders for figure controls. Keeps every figure consistent. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) node.append(child);
  return node;
}

let uid = 0;
const nextId = (prefix: string) => `${prefix}-${(uid += 1)}`;

export interface SliderSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Formats the live value shown beside the label. */
  format?: (value: number) => string;
  /** Extra text appended to the accessible name, e.g. "learning rate". */
  describe?: string;
  onInput: (value: number) => void;
}

export interface SliderHandle {
  root: HTMLElement;
  input: HTMLInputElement;
  set(value: number, silent?: boolean): void;
  value(): number;
}

export function slider(spec: SliderSpec): SliderHandle {
  const id = nextId('viz-slider');
  const format = spec.format ?? ((v: number) => String(v));
  const valueEl = el('span', { class: 'viz-control__value' }, format(spec.value));
  const input = el('input', {
    type: 'range',
    class: 'viz-range',
    id,
    min: String(spec.min),
    max: String(spec.max),
    step: String(spec.step),
    value: String(spec.value),
  }) as HTMLInputElement;
  // Screen readers announce the formatted value rather than the raw number.
  input.setAttribute('aria-valuetext', format(spec.value));

  const label = el(
    'label',
    { class: 'viz-control__label', for: id },
    el('span', {}, spec.label),
    valueEl,
  );
  const root = el('div', { class: 'viz-control' }, label, input);

  const sync = (value: number, silent = false) => {
    const text = format(value);
    valueEl.textContent = text;
    input.setAttribute('aria-valuetext', text);
    if (!silent) spec.onInput(value);
  };

  input.addEventListener('input', () => sync(input.valueAsNumber));

  return {
    root,
    input,
    set(value, silent = false) {
      input.value = String(value);
      sync(value, silent);
    },
    value: () => input.valueAsNumber,
  };
}

export interface ButtonSpec {
  label: string;
  onClick: (button: HTMLButtonElement) => void;
  variant?: 'primary' | 'default';
  pressed?: boolean;
}

export function buttons(specs: ButtonSpec[]): {
  root: HTMLElement;
  items: HTMLButtonElement[];
} {
  const items = specs.map((spec) => {
    const button = el('button', { type: 'button', class: 'viz-btn' }, spec.label);
    if (spec.variant) button.dataset.variant = spec.variant;
    button.addEventListener('click', () => spec.onClick(button));
    return button;
  });
  return { root: el('div', { class: 'viz-buttons' }, ...items), items };
}

export interface ReadoutItem {
  key: string;
  label: string;
  hint?: string;
}

export interface ReadoutHandle {
  root: HTMLElement;
  set(key: string, value: string): void;
}

/**
 * A live numeric readout. Marked `aria-live="off"` deliberately: values change
 * every frame during playback and announcing each one would be unusable. The
 * figure's status line carries the announcements instead.
 */
export function readout(items: ReadoutItem[]): ReadoutHandle {
  const values = new Map<string, HTMLElement>();
  const root = el('dl', { class: 'viz-readout', 'aria-live': 'off' });
  for (const item of items) {
    const dd = el('dd', {}, '—');
    values.set(item.key, dd);
    const dt = el('dt', {}, item.label);
    root.append(el('div', {}, dt, dd));
  }
  return {
    root,
    set(key, value) {
      const node = values.get(key);
      // Skip identical writes: readouts are refreshed every animation frame and
      // replacing a text node invalidates layout even when nothing changed.
      if (node && node.textContent !== value) node.textContent = value;
    },
  };
}

export function status(): { root: HTMLElement; set(text: string, tone?: 'warn' | 'plain'): void } {
  const root = el('p', { class: 'viz-status', role: 'status', 'aria-live': 'polite' });
  return {
    root,
    set(text, tone = 'plain') {
      if (root.textContent === text) return;
      root.textContent = text;
      if (tone === 'warn') root.dataset.tone = 'warn';
      else delete root.dataset.tone;
    },
  };
}

export interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

export function legend(items: LegendItem[]): HTMLElement {
  const list = el('ul', { class: 'viz-legend' });
  for (const item of items) {
    const swatch = el('span', {
      class: `swatch${item.dashed ? ' swatch--dash' : ''}`,
      'aria-hidden': 'true',
    });
    swatch.style.borderTopColor = item.color;
    list.append(el('li', {}, swatch, el('span', {}, item.label)));
  }
  return list;
}

export function controlGroup(...children: HTMLElement[]): HTMLElement {
  return el('div', { class: 'viz-controls' }, ...children);
}

/** Reads a CSS custom property from :root, for use in inline SVG attributes. */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
