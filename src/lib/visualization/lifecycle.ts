/**
 * Animation lifecycle helpers shared by every visualization on the site.
 *
 * Rules enforced here (see docs/PROJECT_SPEC.md §4):
 *  - a loop only runs while its element is on screen AND the tab is visible;
 *  - `prefers-reduced-motion` callers get a static/step-based experience;
 *  - no per-frame allocation inside the loop itself.
 */

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Run `cb` once, the first time `el` comes near the viewport. */
export function whenNearViewport(el: Element, cb: () => void, rootMargin = '200px'): void {
  if (typeof IntersectionObserver === 'undefined') {
    cb();
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          io.disconnect();
          cb();
          return;
        }
      }
    },
    { rootMargin },
  );
  io.observe(el);
}

export interface Loop {
  /** Request that the loop run (it still waits for visibility). */
  start(): void;
  /** Stop requesting frames. */
  stop(): void;
  readonly running: boolean;
  /** Detach observers and cancel any pending frame. */
  destroy(): void;
}

/**
 * A requestAnimationFrame loop bound to an element's visibility.
 *
 * `frame(dt)` receives the elapsed seconds since the previous callback, clamped
 * so that a backgrounded tab cannot produce a huge jump on resume. Passing
 * `fps` caps how often the callback runs: the browser still schedules frames,
 * but the drawing work — which dominates the cost of an SVG animation — happens
 * at the requested rate instead of the display's.
 */
export function createLoop(el: Element, frame: (dt: number) => void, fps?: number): Loop {
  let wanted = false;
  let onScreen = false;
  let handle = 0;
  let last = 0;
  let pending = 0;
  const minStep = fps ? 1 / fps : 0;

  const tick = (now: number) => {
    handle = requestAnimationFrame(tick);
    const dt = last === 0 ? 1 / 60 : Math.min((now - last) / 1000, 1 / 15);
    last = now;
    if (minStep === 0) {
      frame(dt);
      return;
    }
    pending += dt;
    if (pending < minStep) return;
    const elapsed = pending;
    pending = 0;
    frame(elapsed);
  };

  const sync = () => {
    const shouldRun = wanted && onScreen && document.visibilityState === 'visible';
    if (shouldRun && handle === 0) {
      last = 0;
      handle = requestAnimationFrame(tick);
    } else if (!shouldRun && handle !== 0) {
      cancelAnimationFrame(handle);
      handle = 0;
    }
  };

  const io =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((entries) => {
          onScreen = entries.some((e) => e.isIntersecting);
          sync();
        });
  if (io) io.observe(el);
  else onScreen = true;

  document.addEventListener('visibilitychange', sync);

  return {
    start() {
      wanted = true;
      sync();
    },
    stop() {
      wanted = false;
      sync();
    },
    get running() {
      return wanted;
    },
    destroy() {
      wanted = false;
      sync();
      io?.disconnect();
      document.removeEventListener('visibilitychange', sync);
    },
  };
}

/** Observe element size; calls back with content-box pixels (debounced by rAF). */
export function onResize(el: Element, cb: (width: number, height: number) => void): () => void {
  if (typeof ResizeObserver === 'undefined') {
    const handler = () => cb(el.clientWidth, el.clientHeight);
    window.addEventListener('resize', handler);
    handler();
    return () => window.removeEventListener('resize', handler);
  }
  let pending = 0;
  const ro = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const { width, height } = entry.contentRect;
    if (pending) cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      pending = 0;
      cb(width, height);
    });
  });
  ro.observe(el);
  return () => {
    if (pending) cancelAnimationFrame(pending);
    ro.disconnect();
  };
}
