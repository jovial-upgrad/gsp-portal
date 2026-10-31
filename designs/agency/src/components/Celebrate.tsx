import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Icon } from './Icon';
import './celebrate.css';

const COLOURS = ['#EE2C3C', '#F5A524', '#2BB673', '#3B82F6', '#8B5CF6', '#EC4899'];

/**
 * The application's happy end: a tick, the student enrolled, and party poppers going off from both corners
 * once. Nothing flies for people who ask for less motion.
 */
export function Celebrate({ title, text }: { title: string; text: string }) {
  const reduce = useReducedMotion();
  return (
    <section className="aneed acelebrate" aria-label={title}>
      <motion.span
        className="acelebrate__tick"
        aria-hidden="true"
        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.1 }}
      >
        <Icon name="check" size={22} strokeWidth={2.8} />
      </motion.span>
      <div className="aneed__t">
        <p className="aneed__title">{title}</p>
        <p className="aneed__text">{text}</p>
      </div>
      {!reduce && <Poppers />}
    </section>
  );
}

/** Two bursts of paper, from the bottom corners, up and out, then falling away. */
function Poppers() {
  const bits = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        const r = (n: number) => Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1;
        return {
          side,
          x: side * -(40 + r(1) * 220),
          up: 90 + r(2) * 150,
          down: 60 + r(3) * 120,
          spin: (r(4) - 0.5) * 720,
          delay: r(5) * 0.18,
          w: 6 + Math.round(r(6) * 5),
          h: 8 + Math.round(r(7) * 8),
          colour: COLOURS[i % COLOURS.length],
          round: r(8) > 0.7,
        };
      }),
    [],
  );
  return (
    <span className="poppers" aria-hidden="true">
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className={`poppers__bit poppers__bit--${b.side > 0 ? 'r' : 'l'}`}
          style={{ width: b.w, height: b.round ? b.w : b.h, background: b.colour, borderRadius: b.round ? '50%' : 2 }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: b.x, y: [0, -b.up, -b.up + b.down + 80], rotate: b.spin, opacity: [1, 1, 0] }}
          transition={{ duration: 1.8, ease: [0.15, 0.7, 0.4, 1], times: [0, 0.4, 1], delay: b.delay }}
        />
      ))}
    </span>
  );
}
