/** Pointer/touch dragging normalized across mouse, pen and touch. */
import { localPoint } from './plot';

export interface DragHandlers {
  onStart?: (x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onEnd?: () => void;
}

/**
 * Makes the whole plot area draggable. `touch-action: none` is applied while a
 * drag is in progress only, so vertical page scrolling over the figure still
 * works when the reader is not interacting with it.
 */
export function attachDrag(svg: SVGSVGElement, handlers: DragHandlers): () => void {
  let active: number | null = null;

  const start = (event: PointerEvent) => {
    if (event.button !== undefined && event.button !== 0) return;
    active = event.pointerId;
    svg.setPointerCapture(event.pointerId);
    svg.style.touchAction = 'none';
    const p = localPoint(svg, event);
    handlers.onStart?.(p.x, p.y);
    handlers.onMove(p.x, p.y);
    event.preventDefault();
  };

  const move = (event: PointerEvent) => {
    if (active !== event.pointerId) return;
    const p = localPoint(svg, event);
    handlers.onMove(p.x, p.y);
    event.preventDefault();
  };

  const end = (event: PointerEvent) => {
    if (active !== event.pointerId) return;
    active = null;
    svg.style.touchAction = '';
    handlers.onEnd?.();
  };

  svg.addEventListener('pointerdown', start);
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  return () => {
    svg.removeEventListener('pointerdown', start);
    svg.removeEventListener('pointermove', move);
    svg.removeEventListener('pointerup', end);
    svg.removeEventListener('pointercancel', end);
  };
}
