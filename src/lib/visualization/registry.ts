/**
 * Lazy loader for interactive figures.
 *
 * Each figure lives in its own module so that Vite emits a separate chunk. A
 * chunk is fetched only when its figure approaches the viewport, so opening an
 * article costs a single ~1 KB loader until the reader actually scrolls to a
 * visualization.
 */
import { whenNearViewport } from './lifecycle';

export interface VizModule {
  mount(host: HTMLElement, options: Record<string, unknown>): void;
}

const registry: Record<string, () => Promise<VizModule>> = {
  tangent: () => import('./figures/tangent'),
  'descent-1d': () => import('./figures/descent1d'),
  'learning-rate': () => import('./figures/learningRate'),
  contour: () => import('./figures/contour'),
  conditioning: () => import('./figures/conditioning'),
  stochastic: () => import('./figures/stochastic'),
  momentum: () => import('./figures/momentum'),
};

export function initVisualizations(root: ParentNode = document): void {
  const hosts = root.querySelectorAll<HTMLElement>('[data-viz]');
  for (const host of hosts) {
    const key = host.dataset.viz;
    const load = key ? registry[key] : undefined;
    if (!load) continue;
    // Mount well before the figure scrolls into view, so the swap from the
    // reserved box to the real graphic happens off screen.
    whenNearViewport(
      host,
      () => {
        let options: Record<string, unknown> = {};
        if (host.dataset.options) {
          try {
            options = JSON.parse(host.dataset.options) as Record<string, unknown>;
          } catch {
            options = {};
          }
        }
        if (host.dataset.describedby) options.describedBy = host.dataset.describedby;
        load()
          .then((module) => module.mount(host, options))
          .catch(() => {
            // A failed chunk must not leave a blank box: the caption below the
            // figure already carries the mathematical content.
            host.hidden = true;
          });
      },
      '600px',
    );
  }
}
