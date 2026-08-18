/**
 * A deliberately tiny decorative particle field.
 *
 * Budget: at most 34 particles, one 24 fps canvas draw, no allocation inside
 * the frame callback, and nothing at all when the reader prefers reduced
 * motion, when the tab is hidden, or when the canvas is off screen.
 */
import { createLoop, onResize, prefersReducedMotion } from './lifecycle';

const MAX_PARTICLES = 34;
const AREA_PER_PARTICLE = 26000;
const TARGET_FPS = 24;
const SPEED = 5; // pixels per second

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
}

export function mount(canvas: HTMLCanvasElement): void {
  if (prefersReducedMotion()) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  // Pre-allocated pool: the animation loop never allocates.
  const particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 1,
    a: 0.1,
  }));
  let count = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let seed = 0x9e3779b9;

  const random = (): number => {
    // Small xorshift: deterministic, no Math.random cost in hot paths.
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 100000) / 100000;
  };

  const resize = (w: number, h: number): void => {
    if (w < 2 || h < 2) return;
    // Cap the device pixel ratio: a 3× buffer costs 9× the fill for no visible
    // gain on a field of faint dots.
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = w;
    height = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const wanted = Math.min(MAX_PARTICLES, Math.max(8, Math.round((w * h) / AREA_PER_PARTICLE)));
    for (let i = count; i < wanted; i++) {
      const p = particles[i]!;
      p.x = random() * w;
      p.y = random() * h;
      const angle = random() * Math.PI * 2;
      p.vx = Math.cos(angle) * SPEED;
      p.vy = Math.sin(angle) * SPEED;
      p.r = 0.9 + random() * 1.4;
      p.a = 0.05 + random() * 0.12;
    }
    count = wanted;
    // Keep existing particles inside the new box.
    for (let i = 0; i < count; i++) {
      const p = particles[i]!;
      if (p.x > w) p.x = w * random();
      if (p.y > h) p.y = h * random();
    }
  };

  const stopResize = onResize(canvas.parentElement ?? canvas, resize);

  const loop = createLoop(
    canvas,
    (dt) => {
      for (let i = 0; i < count; i++) {
        const p = particles[i]!;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -4) p.x = width + 4;
        else if (p.x > width + 4) p.x = -4;
        if (p.y < -4) p.y = height + 4;
        else if (p.y > height + 4) p.y = -4;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#b4552b';
      for (let i = 0; i < count; i++) {
        const p = particles[i]!;
        ctx.globalAlpha = p.a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    TARGET_FPS,
  );

  loop.start();

  window.addEventListener(
    'pagehide',
    () => {
      loop.destroy();
      stopResize();
    },
    { once: true },
  );
}
