/**
 * The running one-dimensional example used in the first three figures.
 *
 *   f(x) = 0.12 x^2 + 0.8 sin(x) + 3
 *
 * It is smooth, bounded below, and has two local minima (near x ≈ −1.202 and
 * x ≈ 3.294) plus a local maximum near x ≈ 2.356 — enough structure to show that
 * gradient descent finds *a* minimum, not *the* minimum.
 */
export const f = (x: number): number => 0.12 * x * x + 0.8 * Math.sin(x) + 3;
export const df = (x: number): number => 0.24 * x + 0.8 * Math.cos(x);

export const DOMAIN = { xMin: -6, xMax: 6, yMin: 1.6, yMax: 8.2 };

/** Global minimum of f on the domain, to three decimals (found by bisection). */
export const GLOBAL_MIN_X = -1.202;
export const LOCAL_MIN_X = 3.294;

export const FUNCTION_LABEL = 'f(x) = 0.12x² + 0.8 sin x + 3';
