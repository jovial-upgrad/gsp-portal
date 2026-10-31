import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import './glass.css';

/**
 * The specular edge of a glass surface. Put it inside any `.glass` element.
 * With `follow`, the pointer acts as a light source: as it nears an edge, a highlight slides along the rim.
 * The edge itself is painted once; the highlight only moves (transform + opacity) and its layer is switched off when unlit.
 * Fine pointers only, never under reduced motion.
 */
export function GlassRim({ follow = false }: { follow?: boolean }) {
  const lightRef = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const live = follow && !reduce;

  useEffect(() => {
    const light = lightRef.current;
    const glint = light?.parentElement;
    const host = glint?.parentElement;
    if (!light || !glint || !host || !window.matchMedia('(pointer: fine)').matches) return;
    let raf = 0;
    let off = 0;
    let x = 0;
    let y = 0;
    // the layer only exists while lit, so a pointer far from the edge (or typing in the form) costs nothing
    const show = (on: boolean) => {
      window.clearTimeout(off);
      if (on) glint.style.visibility = 'visible';
      else off = window.setTimeout(() => (glint.style.visibility = 'hidden'), 450);
    };
    const paint = () => {
      raf = 0;
      const r = host.getBoundingClientRect();
      const dx = x - r.left;
      const dy = y - r.top;
      const inside = dx >= 0 && dx <= r.width && dy >= 0 && dy <= r.height;
      const toEdge = inside ? Math.min(dx, r.width - dx, dy, r.height - dy) : Math.max(-dx, dx - r.width, -dy, dy - r.height);
      const lit = Math.max(0, 1 - toEdge / 140);
      show(lit > 0);
      light.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      light.style.opacity = String(lit);
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = window.requestAnimationFrame(paint);
    };
    const leave = () => {
      light.style.opacity = '0';
      show(false);
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.cancelAnimationFrame(raf);
      window.clearTimeout(off);
    };
  }, [live]);

  return (
    <>
      <span className="glass__rim" aria-hidden="true" />
      {live && (
        <span className="glass__glint" aria-hidden="true">
          <span ref={lightRef} className="glass__light" />
        </span>
      )}
    </>
  );
}
