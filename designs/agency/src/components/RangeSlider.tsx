import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import './range.css';

/**
 * A range with two handles (slice 3 PRD: the Tuition fee and Duration filters), drawn by the portal, never the
 * browser's own slider. Each handle is an ARIA slider: arrow keys move it a step, Page Up and Down ten steps, Home
 * and End to its end; dragging works with a mouse, pen or finger, and clicking the track moves the nearer handle.
 * The handles can meet but not cross. `stops` labels the steps (Duration's "<1 year" … "5+ years"); without them the
 * values are numbers from `min` to `max` in `step`s, said with `format`.
 */
export function RangeSlider({
  id,
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  format = (n) => String(n),
  stops,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  format?: (n: number) => string;
  /** Labels for each step from min to max (min and max are then indexes). */
  stops?: string[];
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<0 | 1 | null>(null);
  const [lo, hi] = value;
  const span = Math.max(1e-9, max - min);
  const pct = (n: number) => ((Math.min(max, Math.max(min, n)) - min) / span) * 100;
  const say = (n: number) => (stops ? stops[n] ?? String(n) : format(n));
  const snap = (n: number) => Math.min(max, Math.max(min, Math.round((n - min) / step) * step + min));
  const set = (i: 0 | 1, n: number) => {
    const v = snap(n);
    if (i === 0) onChange([Math.min(v, hi), hi]);
    else onChange([lo, Math.max(v, lo)]);
  };
  const at = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || !r.width) return min;
    return min + ((clientX - r.left) / r.width) * span;
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (max <= min) return;
    const n = at(e.clientX);
    const i: 0 | 1 = Math.abs(n - lo) <= Math.abs(n - hi) && !(lo === hi && n > hi) ? 0 : 1;
    drag.current = i;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    set(i, n);
    document.getElementById(`${id}-${i}`)?.focus();
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current === null) return;
    set(drag.current, at(e.clientX));
  };
  const onUp = () => {
    drag.current = null;
  };
  const onKey = (i: 0 | 1) => (e: KeyboardEvent) => {
    const v = i === 0 ? lo : hi;
    const big = Math.max(step, Math.round(span / 10 / step) * step);
    const to =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? v + step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? v - step : e.key === 'PageUp' ? v + big : e.key === 'PageDown' ? v - big : e.key === 'Home' ? min : e.key === 'End' ? max : null;
    if (to === null) return;
    e.preventDefault();
    set(i, to);
  };
  const off = max <= min;
  return (
    <div className={`rslide ${off ? 'is-off' : ''}`} role="group" aria-labelledby={`${id}-label`}>
      <div className="rslide__vals" aria-hidden="true">
        <span>{say(lo)}</span>
        <span>{say(hi)}</span>
      </div>
      <div ref={track} className="rslide__track" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span className="rslide__rail" />
        <span className="rslide__fill" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        {([0, 1] as const).map((i) => {
          const v = i === 0 ? lo : hi;
          return (
            <button
              key={i}
              id={`${id}-${i}`}
              type="button"
              role="slider"
              className="rslide__thumb"
              style={{ left: `${pct(v)}%` }}
              aria-label={`${label}, ${i === 0 ? 'from' : 'to'}`}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={v}
              aria-valuetext={say(v)}
              disabled={off}
              onKeyDown={onKey(i)}
              onPointerDown={(e) => {
                e.stopPropagation();
                drag.current = i;
                track.current?.setPointerCapture?.(e.pointerId);
              }}
            />
          );
        })}
      </div>
      {stops && (
        <div className="rslide__stops" aria-hidden="true">
          {stops.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}
